# ── Stage 1: Build PocketBase ─────────────────────────────────────────────────
FROM golang:1.25-alpine AS pb-builder
WORKDIR /build

COPY MKZ-pocketbase/go.mod MKZ-pocketbase/go.sum ./
RUN go mod download

COPY MKZ-pocketbase/ .

RUN CGO_ENABLED=0 GOOS=linux \
    go build -trimpath -ldflags="-s -w" -o pocketbase_app .

# ── Stage 2: Build Frontend ───────────────────────────────────────────────────
FROM node:22-alpine AS web-builder
WORKDIR /app

COPY MKZ-website/package*.json ./
RUN npm ci

COPY MKZ-website/ .
RUN npm run build

# ── Stage 3: Runtime ──────────────────────────────────────────────────────────
FROM caddy:2-alpine

# Runtime deps for PocketBase binary (TLS, timezones)
RUN apk --no-cache add ca-certificates tzdata

# PocketBase binary
COPY --from=pb-builder /build/pocketbase_app /app/pocketbase_app

# Frontend static assets
COPY --from=web-builder /app/dist /srv

# Caddy: routes /api/* and /_/* to PocketBase, SPA fallback for everything else
COPY Caddyfile /etc/caddy/Caddyfile

# Entrypoint: writes env.js, starts PocketBase in background + Caddy in foreground
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# pb_data holds the SQLite database — always mount as a named volume
VOLUME /app/pb_data

EXPOSE 80

ENTRYPOINT ["/docker-entrypoint.sh"]
