# MKZ — Monorepo

| Service | Path | Image |
|---------|------|-------|
| Frontend (SolidJS + Vite) | `MKZ-website/` | `ghcr.io/<owner>/mkz-website` |
| Backend (PocketBase + Go migrations) | `MKZ-pocketbase/` | `ghcr.io/<owner>/mkz-pocketbase` |

## Release pipeline

Push a semver tag to trigger GitHub Actions:

```bash
git tag v1.2.3
git push origin v1.2.3
```

The workflow (`.github/workflows/release.yml`):
1. Runs frontend tests (`npm run test:run`)
2. Validates Go build (`go build && go vet`)
3. Builds and pushes both Docker images to `ghcr.io` — tagged `v1.2.3` **and** `latest`
4. Supports `linux/amd64` and `linux/arm64`

## Running on your server

```bash
# PocketBase — mount a named volume for the database
docker run -d \
  --name mkz-pocketbase \
  -p 8090:8090 \
  -v mkz_pb_data:/app/pb_data \
  ghcr.io/<owner>/mkz-pocketbase:latest

# Website — tell it where PocketBase lives
docker run -d \
  --name mkz-website \
  -p 80:80 \
  -e PB_URL=https://pb.yourdomain.com \
  ghcr.io/<owner>/mkz-website:latest
```

Migrations run automatically on first start of `mkz-pocketbase`.

## Local development

```bash
# Website
cd MKZ-website && npm install && npm run dev
```

```bash
# PocketBase
cd MKZ-pocketbase && go run . serve --dir pb_data
```
