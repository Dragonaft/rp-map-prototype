# Docker — Container Orchestration

## docker-compose.yml Services

```yaml
services:
  db:       MySQL 8        (persistent volume, healthcheck)
  api:      NestJS         (port 3000 internal, depends on db healthy)
  web:      nginx + React  (port 80 → host 80, depends on api)
  admin:    nginx + React  (port 80 → host 8081, depends on api)
```

### db (MySQL 8)
- Image: `mysql:8`
- Volume: `db_data:/var/lib/mysql` (persistent)
- Healthcheck: `mysqladmin ping` (10s interval, 10 retries)
- Env: `MYSQL_ROOT_PASSWORD`, `MYSQL_DATABASE`, `MYSQL_USER`, `MYSQL_PASSWORD`

### api (NestJS)
- Build: context `./api` (multi-stage: Node 20-alpine build → Node 20-alpine runtime)
- Port: 3000 (internal only, not exposed to host)
- Depends on: `db` (condition: service_healthy)
- Env: NODE_ENV=production, DB_HOST=db, DB creds, JWT secrets, COOKIE_SECURE=false
- Copies `data/` directory for seed files

### web (React game client)
- Build: context `.` (repo root) + `dockerfile: web-map/Dockerfile` (root context is required so the build can install from the root npm-workspace lockfile); Node 20-alpine build → nginx:alpine
- Port: 80 → host 80
- Build arg: `VITE_API_BASE_URL=/api`
- nginx proxies `/api/*` → `http://api:3000/` (strips prefix)
- SSE support: `proxy_buffering off`, `proxy_read_timeout 3600s`

### admin (Admin panel)
- Build: context `.` (repo root) + `dockerfile: admin-panel/Dockerfile` (same root-context pattern as web)
- Port: 80 → host 8081
- Build arg: `VITE_API_BASE_URL=/api`
- Same nginx proxy config as web

## Production Override (`docker-compose.prod.yml`)

The base `docker-compose.yml` builds images on the host. In production this is
layered with `docker-compose.prod.yml`, which **replaces the `build` of
`api`/`web`/`admin` with pre-built images pulled from GHCR**:

```yaml
services:
  api:   { image: ${IMAGE_API} }
  web:   { image: ${IMAGE_WEB} }
  admin: { image: ${IMAGE_ADMIN} }
```

Used on the server as:
```bash
export COMPOSE_FILE=docker-compose.yml:docker-compose.prod.yml
export IMAGE_API=... IMAGE_WEB=... IMAGE_ADMIN=...   # tagged with commit SHA
docker compose pull && docker compose up -d --wait
```

The GitHub Actions deploy workflow (`.github/workflows/deploy.yml`) builds and
pushes the three images, SSHes to the EC2 host, sets the `IMAGE_*` vars, pulls
and brings the stack up, then runs `migration:run:prod` and (when
`api/data/provinces.json` changed or a full reset is forced) re-imports
provinces and re-seeds via the `:prod` scripts. The host only pulls images —
it never builds.

## Network Topology

```
Host:80  ──► web (nginx)  ──► /api/* proxy ──► api:3000 ──► db:3306
Host:8081 ──► admin (nginx) ──► /api/* proxy ──┘
```

All services on implicit default Docker network. Services reference each other by name.

## Environment Variables

### Root `.env` (used by docker-compose)
```
DB_ROOT_PASSWORD=...
DB_NAME=rp-map
DB_USER_NAME=...
DB_USER_PASSWORD=...
JWT_SECRET=...
JWT_REFRESH_SECRET=...
```

### API `.env` (local dev only)
```
DB_TYPE=mysql
DB_HOST=localhost     (Docker: db)
DB_PORT=3306
DB_USER_NAME=...
DB_USER_PASSWORD=...
DB_NAME=...
JWT_SECRET=...
JWT_REFRESH_SECRET=...
NODE_ENV=development  (Docker: production)
DISABLE_ACTION_EXECUTION_GATE=true  (optional, for debugging)
DISABLE_FAST_ACTION_CRON=true       (optional, stops dev cron)
```

### Frontend `.env` (local dev only)
```
VITE_API_BASE_URL=http://localhost:3000   (Docker: /api via build arg)
```

## Build Commands

```bash
# Full stack
docker compose up --build

# Individual service rebuild
docker compose up --build api
docker compose up --build web
docker compose up --build admin

# Database reset (WARNING: destroys data)
docker compose down -v
docker compose up --build
```

## Post-Build Setup

After first `docker compose up`. Use the **`:prod`** script variants — the
container ships only compiled `dist/`, so the plain `ts-node` scripts
(`seed:buildings`, `import:provinces`, …) will fail inside it:
```bash
# Run migrations
docker compose exec api npm run migration:run:prod

# Seed data
docker compose exec api npm run seed:buildings:prod
docker compose exec api npm run seed:techs:prod
docker compose exec api npm run seed:troop-types:prod
docker compose exec api npm run import:provinces:prod
```

> `reset:game:prod` wipes and re-imports game data — the CI deploy runs it
> (with the seeds) whenever `api/data/provinces.json` changes.

## Local Development (Without Docker)

```bash
# Terminal 1: MySQL (or use Docker just for DB)
docker compose up db

# Terminal 2: API
cd api && npm install && npm run start:dev

# Terminal 3: Web Map
cd web-map && npm install && npm run dev    # → localhost:5173

# Terminal 4: Admin Panel (optional)
cd admin-panel && npm install && npm run dev  # → localhost:5173 (Vite auto-bumps to 5174 if web-map is already running; port is not pinned in vite.config.ts)
```

## Nginx Config Details

Both `web-map/nginx.conf` and `admin-panel/nginx.conf`:
- SPA fallback: `try_files $uri $uri/ /index.html`
- API proxy: `location /api/ { proxy_pass http://api:3000/; }`
  - Strips `/api` prefix
  - Forwards: Host, X-Real-IP, X-Forwarded-For, Set-Cookie
- SSE: Connection keep-alive, no buffering, 3600s read timeout
