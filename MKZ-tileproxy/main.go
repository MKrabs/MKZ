package main

import (
    "context"
    "database/sql"
    "encoding/json"
    "errors"
    "fmt"
    "io"
    "log"
    "net/http"
    "os"
    "os/signal"
    "path/filepath"
    "strconv"
    "strings"
    "sync"
    "syscall"
    "time"

    _ "github.com/mattn/go-sqlite3"
)

const version = "2"

var errTileNotFound = errors.New("tile not found")

type Config struct {
    TilesDB         string
    ListenAddr      string
    UpstreamURL     string
    UpstreamTimeout time.Duration
    MissTTL         int64
}

type Proxy struct {
    cfg        Config
    writeDB    *sql.DB
    readDB     *sql.DB
    httpClient *http.Client
    inflight   *deduplicator
}

type tileKey struct {
    z int
    x int
    y int
}

type fetchResult struct {
    data   []byte
    status int
    err    error
}

type call struct {
    wg sync.WaitGroup
    r  fetchResult
}

type deduplicator struct {
    mu sync.Mutex
    m  map[tileKey]*call
}

type Stats struct {
    Status      string `json:"status"`
    CachedTiles int64  `json:"cached_tiles"`
    KnownMisses int64  `json:"known_misses"`
    DbBytes     int64  `json:"db_bytes"`
}

func main() {
    cfg := loadConfig()

    log.Printf("[startup] VERSION=%s db=%s addr=%s", version, cfg.TilesDB, cfg.ListenAddr)

    writeDB, err := openWriteDB(cfg.TilesDB)
    if err != nil {
        log.Fatalf("open write db: %v", err)
    }
    defer writeDB.Close()

    if err := initSchema(writeDB); err != nil {
        log.Fatalf("init schema: %v", err)
    }

    readDB, err := openReadDB(cfg.TilesDB)
    if err != nil {
        log.Fatalf("open read db: %v", err)
    }
    defer readDB.Close()

    proxy := &Proxy{
        cfg:     cfg,
        writeDB: writeDB,
        readDB:  readDB,
        httpClient: &http.Client{
            Timeout: cfg.UpstreamTimeout,
            Transport: &http.Transport{
                MaxIdleConns:        32,
                MaxIdleConnsPerHost: 32,
                IdleConnTimeout:     90 * time.Second,
            },
        },
        inflight: &deduplicator{
            m: make(map[tileKey]*call),
        },
    }

    mux := http.NewServeMux()
    mux.HandleFunc("/tiles", proxy.handleTile)
    mux.HandleFunc("/tiles/", proxy.handleTile)
    mux.HandleFunc("/health", proxy.handleHealth)

    srv := &http.Server{
        Addr:         cfg.ListenAddr,
        Handler:      mux,
        ReadTimeout:  10 * time.Second,
        WriteTimeout: 30 * time.Second,
        IdleTimeout:  60 * time.Second,
    }

    go func() {
        sigCh := make(chan os.Signal, 1)
        signal.Notify(sigCh, os.Interrupt, syscall.SIGTERM)

        sig := <-sigCh
        log.Printf("[shutdown] received %s, starting graceful shutdown", sig)

        ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
        defer cancel()

        if err := srv.Shutdown(ctx); err != nil {
            log.Printf("[shutdown] error: %v", err)
        }

        log.Printf("[shutdown] complete")
    }()

    log.Printf("[startup] listening on %s", cfg.ListenAddr)

    if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
        log.Fatalf("listen: %v", err)
    }
}

func loadConfig() Config {
    getenv := func(key, fallback string) string {
        if value := os.Getenv(key); value != "" {
            return value
        }
        return fallback
    }

    upstreamTimeout, err := time.ParseDuration(getenv("UPSTREAM_TIMEOUT", "15s"))
    if err != nil {
        log.Printf("invalid UPSTREAM_TIMEOUT, using default 15s: %v", err)
        upstreamTimeout = 15 * time.Second
    }

    missTTL, err := strconv.ParseInt(getenv("MISS_TTL", "3600"), 10, 64)
    if err != nil {
        log.Printf("invalid MISS_TTL, using default 3600: %v", err)
        missTTL = 3600
    }

    return Config{
        TilesDB:         getenv("TILES_DB", "/tiles/cache.mbtiles"),
        ListenAddr:      getenv("LISTEN_ADDR", ":3100"),
        UpstreamURL:     getenv("UPSTREAM_URL", "https://tiles.openfreemap.org/planet/20260513_001001_pt/%d/%d/%d.pbf"),
        UpstreamTimeout: upstreamTimeout,
        MissTTL:         missTTL,
    }
}

func openWriteDB(path string) (*sql.DB, error) {
    if dir := filepath.Dir(path); dir != "." && dir != "" {
        if err := os.MkdirAll(dir, 0o755); err != nil {
            return nil, err
        }
    }

    dsn := fmt.Sprintf("file:%s?mode=rwc&_journal=WAL&_busy_timeout=5000&_synchronous=NORMAL", path)

    db, err := sql.Open("sqlite3", dsn)
    if err != nil {
        return nil, err
    }

    db.SetMaxOpenConns(1)
    db.SetMaxIdleConns(1)

    if err := db.Ping(); err != nil {
        _ = db.Close()
        return nil, err
    }

    return db, nil
}

func openReadDB(path string) (*sql.DB, error) {
    dsn := fmt.Sprintf("file:%s?mode=ro&_journal=WAL&_busy_timeout=5000&_synchronous=NORMAL", path)

    db, err := sql.Open("sqlite3", dsn)
    if err != nil {
        return nil, err
    }

    db.SetMaxOpenConns(0)
    db.SetMaxIdleConns(16)

    if err := db.Ping(); err != nil {
        _ = db.Close()
        return nil, err
    }

    return db, nil
}

func initSchema(db *sql.DB) error {
    schema := []string{
        `CREATE TABLE IF NOT EXISTS metadata (
            name  TEXT NOT NULL,
            value TEXT NOT NULL
        );`,
        `CREATE TABLE IF NOT EXISTS tiles (
            zoom_level  INTEGER NOT NULL,
            tile_column INTEGER NOT NULL,
            tile_row    INTEGER NOT NULL,
            tile_data   BLOB    NOT NULL,
            cached_at   INTEGER NOT NULL,
            PRIMARY KEY (zoom_level, tile_column, tile_row)
        );`,
        `CREATE TABLE IF NOT EXISTS misses (
            zoom_level   INTEGER NOT NULL,
            tile_column  INTEGER NOT NULL,
            tile_row     INTEGER NOT NULL,
            last_attempt INTEGER NOT NULL,
            PRIMARY KEY (zoom_level, tile_column, tile_row)
        );`,
    }

    for _, query := range schema {
        if _, err := db.Exec(query); err != nil {
            return err
        }
    }

    metadata := map[string]string{
        "name":        "mkz-tileproxy cache",
        "format":      "pbf",
        "attribution": "OpenFreeMap © OpenMapTiles, Data from OpenStreetMap",
    }

    for name, value := range metadata {
        _, err := db.Exec(
            `INSERT OR IGNORE INTO metadata (name, value)
             SELECT ?, ?
             WHERE NOT EXISTS (
                SELECT 1 FROM metadata WHERE name = ?
             );`,
            name,
            value,
            name,
        )
        if err != nil {
            return err
        }
    }

    return nil
}

func parseTilePath(path string) (z, x, y int, err error) {
    remainder, ok := strings.CutPrefix(path, "/tiles/")
    if !ok {
        return 0, 0, 0, errors.New("invalid tile path prefix")
    }

    parts := strings.Split(remainder, "/")
    if len(parts) != 3 {
        return 0, 0, 0, errors.New("invalid tile path segment count")
    }

    z, err = parseNonNegativeInt(parts[0])
    if err != nil {
        return 0, 0, 0, fmt.Errorf("invalid z: %w", err)
    }

    x, err = parseNonNegativeInt(parts[1])
    if err != nil {
        return 0, 0, 0, fmt.Errorf("invalid x: %w", err)
    }

    y, err = parseNonNegativeInt(parts[2])
    if err != nil {
        return 0, 0, 0, fmt.Errorf("invalid y: %w", err)
    }

    if z < 0 || z > 22 {
        return 0, 0, 0, errors.New("z out of range")
    }

    limit := 1 << uint(z)
    if x < 0 || x >= limit {
        return 0, 0, 0, errors.New("x out of range")
    }
    if y < 0 || y >= limit {
        return 0, 0, 0, errors.New("y out of range")
    }

    return z, x, y, nil
}

func parseNonNegativeInt(value string) (int, error) {
    n, err := strconv.Atoi(value)
    if err != nil {
        return 0, err
    }
    if n < 0 {
        return 0, errors.New("negative integer")
    }
    return n, nil
}

func xyzToTMSY(z, xyzY int) int {
    return (1 << uint(z)) - 1 - xyzY
}

func (p *Proxy) handleTile(w http.ResponseWriter, r *http.Request) {
    setCORS(w)

    if r.Method == http.MethodOptions {
        w.WriteHeader(http.StatusNoContent)
        return
    }

    if r.Method != http.MethodGet {
        http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
        return
    }

    z, x, y, err := parseTilePath(r.URL.Path)
    if err != nil {
        http.Error(w, "bad tile path: "+err.Error(), http.StatusBadRequest)
        return
    }

    tmsY := xyzToTMSY(z, y)

    data, found, err := p.readTile(z, x, tmsY)
    if err != nil {
        log.Printf("read tile error z=%d x=%d tms_y=%d: %v", z, x, tmsY, err)
        http.Error(w, "tile cache read error", http.StatusBadGateway)
        return
    }

    if found {
        w.Header().Set("X-Tile-Source", "local")

        if len(data) == 0 {
            w.WriteHeader(http.StatusNoContent)
            return
        }

        serveTileBytes(w, data, "local")
        return
    }

    suppressed, err := p.isKnownMiss(z, x, tmsY)
    if err != nil {
        log.Printf("read miss error z=%d x=%d tms_y=%d: %v", z, x, tmsY, err)
        http.Error(w, "tile cache read error", http.StatusBadGateway)
        return
    }

    if suppressed {
        w.WriteHeader(http.StatusNoContent)
        return
    }

    result := p.fetchDeduplicated(z, x, y)

    if errors.Is(result.err, errTileNotFound) {
        go p.writeMiss(z, x, tmsY)
        w.WriteHeader(http.StatusNoContent)
        return
    }

    if result.err != nil {
        log.Printf("upstream error z=%d x=%d y=%d status=%d: %v", z, x, y, result.status, result.err)
        http.Error(w, "upstream tile fetch failed", http.StatusBadGateway)
        return
    }

    if result.status == http.StatusNoContent {
        go p.writeTile(z, x, tmsY, []byte{})
        w.WriteHeader(http.StatusNoContent)
        return
    }

    go p.writeTile(z, x, tmsY, result.data)
    serveTileBytes(w, result.data, "upstream")
}

func setCORS(w http.ResponseWriter) {
    w.Header().Set("Access-Control-Allow-Origin", "*")
    w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
    w.Header().Set("Access-Control-Allow-Headers", "Accept, Content-Type, Origin")
}

func serveTileBytes(w http.ResponseWriter, data []byte, source string) {
    w.Header().Set("Content-Type", "application/x-protobuf")
    w.Header().Set("Content-Encoding", "gzip")
    w.Header().Set("Cache-Control", "public, max-age=86400")
    w.Header().Set("X-Tile-Source", source)
    w.WriteHeader(http.StatusOK)

    if _, err := w.Write(data); err != nil {
        log.Printf("write response error: %v", err)
    }
}

func (p *Proxy) readTile(z, x, tmsY int) ([]byte, bool, error) {
    var data []byte

    err := p.readDB.QueryRow(
        `SELECT tile_data
         FROM tiles
         WHERE zoom_level = ?
           AND tile_column = ?
           AND tile_row = ?;`,
        z,
        x,
        tmsY,
    ).Scan(&data)

    if errors.Is(err, sql.ErrNoRows) {
        return nil, false, nil
    }
    if err != nil {
        return nil, false, err
    }

    return data, true, nil
}

func (p *Proxy) isKnownMiss(z, x, tmsY int) (bool, error) {
    var lastAttempt int64

    err := p.readDB.QueryRow(
        `SELECT last_attempt
         FROM misses
         WHERE zoom_level = ?
           AND tile_column = ?
           AND tile_row = ?;`,
        z,
        x,
        tmsY,
    ).Scan(&lastAttempt)

    if errors.Is(err, sql.ErrNoRows) {
        return false, nil
    }
    if err != nil {
        return false, err
    }

    now := time.Now().Unix()
    return now-lastAttempt < p.cfg.MissTTL, nil
}

func (p *Proxy) fetchDeduplicated(z, x, y int) fetchResult {
    key := tileKey{z: z, x: x, y: y}

    p.inflight.mu.Lock()

    if existing, ok := p.inflight.m[key]; ok {
        p.inflight.mu.Unlock()
        existing.wg.Wait()
        return existing.r
    }

    c := &call{}
    c.wg.Add(1)
    p.inflight.m[key] = c

    p.inflight.mu.Unlock()

    result := p.fetchUpstream(z, x, y)

    c.r = result
    c.wg.Done()

    p.inflight.mu.Lock()
    delete(p.inflight.m, key)
    p.inflight.mu.Unlock()

    return result
}

func (p *Proxy) fetchUpstream(z, x, y int) fetchResult {
    url := fmt.Sprintf(p.cfg.UpstreamURL, z, x, y)

    req, err := http.NewRequest(http.MethodGet, url, nil)
    if err != nil {
        return fetchResult{status: 0, err: err}
    }

    req.Header.Set("User-Agent", "mkz-tileproxy/1.0")
    req.Header.Set("Accept-Encoding", "gzip")

    resp, err := p.httpClient.Do(req)
    if err != nil {
        return fetchResult{status: 0, err: err}
    }
    defer resp.Body.Close()

    switch resp.StatusCode {
    case http.StatusOK:
        data, err := io.ReadAll(io.LimitReader(resp.Body, 2*1024*1024))
        if err != nil {
            return fetchResult{status: resp.StatusCode, err: err}
        }

        return fetchResult{
            data:   data,
            status: http.StatusOK,
            err:    nil,
        }

    case http.StatusNoContent:
        return fetchResult{
            status: http.StatusNoContent,
            err:    nil,
        }

    case http.StatusNotFound:
        return fetchResult{
            status: http.StatusNotFound,
            err:    errTileNotFound,
        }

    default:
        _, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, 64*1024))

        return fetchResult{
            status: resp.StatusCode,
            err:    fmt.Errorf("upstream returned HTTP %d", resp.StatusCode),
        }
    }
}

func (p *Proxy) writeTile(z, x, tmsY int, data []byte) {
    _, err := p.writeDB.Exec(
        `INSERT OR REPLACE INTO tiles
            (zoom_level, tile_column, tile_row, tile_data, cached_at)
         VALUES
            (?, ?, ?, ?, ?);`,
        z,
        x,
        tmsY,
        data,
        time.Now().Unix(),
    )

    if err != nil {
        log.Printf("write tile error z=%d x=%d tms_y=%d: %v", z, x, tmsY, err)
    }
}

func (p *Proxy) writeMiss(z, x, tmsY int) {
    _, err := p.writeDB.Exec(
        `INSERT OR REPLACE INTO misses
            (zoom_level, tile_column, tile_row, last_attempt)
         VALUES
            (?, ?, ?, ?);`,
        z,
        x,
        tmsY,
        time.Now().Unix(),
    )

    if err != nil {
        log.Printf("write miss error z=%d x=%d tms_y=%d: %v", z, x, tmsY, err)
    }
}

func (p *Proxy) handleHealth(w http.ResponseWriter, r *http.Request) {
    setCORS(w)

    if r.Method == http.MethodOptions {
        w.WriteHeader(http.StatusNoContent)
        return
    }

    w.Header().Set("Content-Type", "application/json")

    stats := Stats{
        Status: "ok",
    }

    if err := p.readDB.QueryRow(`SELECT COUNT(*) FROM tiles;`).Scan(&stats.CachedTiles); err != nil {
        log.Printf("health cached_tiles query error: %v", err)
    }

    if err := p.readDB.QueryRow(`SELECT COUNT(*) FROM misses;`).Scan(&stats.KnownMisses); err != nil {
        log.Printf("health known_misses query error: %v", err)
    }

    if info, err := os.Stat(p.cfg.TilesDB); err == nil {
        stats.DbBytes = info.Size()
    }

    w.WriteHeader(http.StatusOK)

    if err := json.NewEncoder(w).Encode(stats); err != nil {
        log.Printf("health encode error: %v", err)
    }
}
