# rp-map-prototype

A prototype for a turn-based political strategy game. Players claim provinces, build structures, deploy troops, and invade neighbors. Game state advances in scheduled turns — players queue actions between turns and see results after each tick.

---

## Project Structure

```
rp-map-prototype/
├── api/            — NestJS REST API (game backend)
├── web-map/        — React frontend (map UI)
└── map-generator/  — CLI tool (province map generation)
```

---

## Parts

### `api` — Game Backend

NestJS application. Manages all game state, enforces rules, and drives the turn engine.

**Responsibilities:**
- User registration and JWT authentication (httpOnly cookies)
- Province ownership, troop counts, and buildings
- Action queue — players submit actions (BUILD, INVADE, DEPLOY) between turns
- Scheduled turn execution (cron): income → upkeep → queued actions, in strict order
- SSE stream that signals clients when a turn starts and finishes

**Stack:** NestJS, TypeORM, MySQL, class-validator, JWT, RxJS

See [`api/README.md`](api/README.md) for full endpoint reference and game mechanics.

---

### `web-map` — Map Frontend

React SPA. Renders the interactive province map and lets players queue actions.

**Responsibilities:**
- SVG map rendering with pan and zoom
- Seamless X-axis world wrapping — the map loops horizontally so players can pan indefinitely east or west
- Viewport culling — only renders provinces visible in the current view (across all visible tile copies)
- Province selection, troop management, building icons
- Action queue UI — deploy troops, queue invasions and builds, cancel pending actions
- Army system — create and name armies, select them on the map, issue move orders via right-click; active move orders shown as lines on the map
- Effective money display in the top bar — shows how much gold is still free after committed queued actions (BUILD, UPGRADE, COLONIZE)
- Research tree modal and player profile modal
- Listens to the SSE stream and reloads data after each turn completes

**Stack:** React, Redux Toolkit, React Hook Form, MUI, Axios, Vite

**Performance notes:**
- Province layout (polygons) is cached in `localStorage` — only dynamic state (troops, ownership, buildings) is re-fetched on each turn reload
- Bounding boxes are computed from polygon strings at load time (no DOM `getBBox()` calls)
- `viewBox.x` is never normalized — tile indices are derived dynamically each frame, eliminating wrap-border flicker

---

### `map-generator` — Map Generation CLI

TypeScript CLI tool for creating and importing province maps. Outputs `provinces.json` consumed by the API seed/import flow.

**Four input modes:**

| Command | Description |
|---------|-------------|
| `generate` | Procedurally generates a grid map using fractal noise (fBm) with continent shaping and river carving |
| `generate-region` | Generates a grid map from real-world GeoJSON geography (land polygons + named sea features) |
| `import-svg` | Imports a hand-drawn SVG map (each `<path>` = one province) |
| `import-png` | Imports a color-coded PNG map using flood fill and border tracing |

**Grid generation highlights (`generate`):**
- fBm noise + radial island falloff → natural continent shapes
- Greedy downhill river paths from mountain peaks to coastline
- Elevation-biased landscape assignment (mountains, hills, plains, swamp, desert, forest)
- Fully seeded — same `--seed` always produces the same map

**GeoJSON region generation highlights (`generate-region`):**
- Takes a land-polygon GeoJSON file and an optional named-seas GeoJSON file as input
- Clips GeoJSON features to a configurable `--bbox` (supports any region or the full globe)
- Point-in-polygon classification assigns each grid cell to land or named sea
- Flood-fill from map border eliminates enclosed water artifact cells (gaps between adjacent land polygons)
- Unnamed ocean grid cells become regular water provinces; named seas are merged into single large sea provinces
- `--wrap-x true` marks all left/right-edge provinces as neighbors for seamless world-map looping
- Optional fBm noise (`--noise`) blurs coastline edges for a more natural look

**Globe map example:**
```bash
npx ts-node src/index.ts generate-region \
  --land land-110m.geojson \
  --seas seas-110m.geojson \
  --rows 45 --cols 90 \
  --bbox "-180,-85,180,85" \
  --noise 0.15 \
  --wrap-x true \
  --out ./out
```

**Stack:** TypeScript, ts-node

See [`map-generator/README.md`](map-generator/README.md) for CLI usage and all options.

---

## Quick Start

### 1. Generate a map

Procedural grid map:
```bash
cd map-generator
npm install
npx ts-node src/index.ts generate --rows 12 --cols 16 --seed 42 --out ./out
```

Real-world globe map (requires GeoJSON files):
```bash
npx ts-node src/index.ts generate-region \
  --land land-110m.geojson --seas seas-110m.geojson \
  --rows 45 --cols 90 --bbox "-180,-85,180,85" \
  --noise 0.15 --wrap-x true --out ./out
```

Copy `out/provinces.json` to `api/data/` and run the API seed.

### 2. Start local MySQL

From the repository root:

```bash
npm run db:local
```

This creates or updates `.env` and `api/.env`, then starts the `db` service with MySQL exposed on `127.0.0.1:3306`.
If port `3306` is already taken, set `DB_PORT` in `.env` and run the command again.

Useful helpers:
```bash
npm run db:local:env   # only write .env + api/.env
npm run db:local:logs  # follow MySQL logs
npm run db:local:stop  # stop local MySQL
```

### 3. Start the API

```bash
cd api
npm install
npm run migration:run
npm run start:dev
```

### 4. Start the frontend

```bash
cd web-map
npm install
npm run dev
```

---

## Game Loop

```
Players queue actions (BUILD / UPGRADE / COLONIZE / DEPLOY / ARMY_MOVE / ...)
          ↓
    Turn fires (cron, 2× daily in production)
          ↓
  Income → Upkeep → Actions execute in order
          ↓
  SSE stream signals { processing: false }
          ↓
    Frontend reloads updated state
```

## Admin Panel

A separate admin UI runs on port **8081**. It provides DataGrid-based CRUD tabs for users, provinces, buildings, and armies. Access requires the `ADMIN` role. The panel communicates with dedicated `/admin/*` API routes protected by `RolesGuard`.
