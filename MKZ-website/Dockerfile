# ── Stage 1: Build ───────────────────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ── Stage 2: Serve ────────────────────────────────────────────────────────────
# Caddy is a modern, zero-config web server. No nginx config files needed.
FROM caddy:2-alpine

# Static assets
COPY --from=build /app/dist /srv

# SPA routing: unknown paths fall back to index.html
COPY Caddyfile /etc/caddy/Caddyfile

# Entrypoint injects PB_URL into /srv/env.js before Caddy starts
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 80

ENTRYPOINT ["/docker-entrypoint.sh"]
