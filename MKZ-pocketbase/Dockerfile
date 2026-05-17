# ── Stage 1: Build ───────────────────────────────────────────────────────────
FROM golang:1.25-alpine AS builder
WORKDIR /build

# Fetch dependencies first (layer-cached separately from source)
COPY go.mod go.sum ./
RUN go mod download

# Copy source — migrations are Go files compiled into the binary
COPY . .

# Static binary: no CGO (modernc/sqlite is pure Go), stripped for size
RUN CGO_ENABLED=0 GOOS=linux \
    go build -trimpath -ldflags="-s -w" -o pocketbase_app .

# ── Stage 2: Runtime ──────────────────────────────────────────────────────────
FROM alpine:3.19

# ca-certificates: outgoing HTTPS (OAuth2, file uploads, etc.)
# tzdata: correct datetime handling in PocketBase
RUN apk --no-cache add ca-certificates tzdata

WORKDIR /app

# The compiled binary has all migrations embedded as Go init() functions.
# They are applied automatically when `serve` starts against a fresh pb_data.
COPY --from=builder /build/pocketbase_app ./pocketbase_app

# pb_data holds the SQLite database — always mount as a named volume.
VOLUME /app/pb_data

EXPOSE 8090

ENTRYPOINT ["./pocketbase_app", "serve", \
            "--http=0.0.0.0:8090", \
            "--dir=/app/pb_data"]
