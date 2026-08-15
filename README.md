# rp-map-prototype — PR_PROTOTYPE

A prototype for a turn-based political strategy game. Players claim provinces, build structures,
deploy troops, and invade neighbors — then manage an economy, research a tech tree, and wage
diplomacy (wars, treaties, occupation) on top of it. Game state advances in scheduled turns:
players queue actions between ticks and see results after each one fires.

For the full agent/developer-facing architectural reference — every module, entity, endpoint, and
turn-phase mechanic — see [`.ai-docs/`](.ai-docs/OVERVIEW.md). This README is the orientation and
quick-start layer.

---

## Project Structure

```
rp-map-prototype/
├── api/               — NestJS REST API (game backend)
├── web-map/           — React game client (the map UI players actually use)
├── admin-panel/       — React admin CRUD UI (DataGrid tabs over every game entity)
├── map-generator/     — CLI tool (province map generation, not containerized)
├── docker-compose.yml
└── .ai-docs/          — Agent/developer-facing deep reference
```

`web-map`, `map-generator`, and `admin-panel` are npm workspaces; `api` has its own independent
`node_modules`.

---

## Parts

### `api` — Game Backend

NestJS application. Owns all game state, enforces every rule, and drives the turn engine.

**Responsibilities:**
- JWT authentication (httpOnly cookies) and role-gated access (ADMIN / MODERATOR / PLAYER)
- Provinces, buildings, armies, raw resources, manufactured goods, and the tech tree
- Player classes (NOBLE/HOLY/GUILD by default, admin-configurable) and their exclusive
  prestige-goods economy
- Diplomacy: relations, wars, treaties, province occupation — real-time REST, not queued
- The player-facing "Codex" knowledge base
- Scheduled turn execution (cron): income → production → upkeep → supply → recurring trade →
  queued actions → post-processing → diplomacy tick, all in strict order
- SSE stream that signals clients when a turn starts and finishes

**Stack:** NestJS, TypeORM, MySQL, class-validator, JWT, RxJS

See [`api/README.md`](api/README.md) for setup, the full module list, and endpoint reference.

---

### `web-map` — Game Client

React SPA. One full-viewport SVG map is the entire game — everything else (build menus, army
management, the tech tree, diplomacy, the Codex) opens as a modal layered on top of it.

**Responsibilities:**
- SVG map rendering with pan/zoom and seamless X-axis world wrapping
- Viewport culling — only renders provinces visible in the current view
- Province ownership/occupation display, troop management, building menus
- Action queue UI — build, upgrade, colonize, recruit, move armies, cancel pending actions
- Army system — create/merge/transfer armies, move orders shown as lines on the map, water/naval
  movement via Ports
- Diplomacy UI — relations, wars, treaty negotiation, occupation state
- Research tree modal, player profile, notifications center, in-app Codex
- Listens to the SSE stream and reloads data after each turn completes

**Stack:** React, Redux Toolkit, MUI, Tailwind CSS, React Hook Form, Axios, Vite

See [`web-map/README.md`](web-map/README.md) for setup and frontend architecture notes.

---

### `admin-panel` — Admin CRUD UI

React SPA, separate from the game client. DataGrid-based CRUD tabs over every content-defining
entity — users, buildings, armies, techs, troop types, resources, goods, classes, the Codex,
diplomacy relations/wars (read-only), notifications broadcast, and global game settings (pause /
turn-execution kill switch). Requires `ADMIN` or `MODERATOR` role; communicates with dedicated
`/admin/*` API routes protected by `RolesGuard`.

**Stack:** React 19, MUI 6 + MUI X Data Grid, Axios, Vite

---

### `map-generator` — Map Generation CLI

TypeScript CLI tool for creating and importing province maps. Outputs `provinces.json`, consumed
by the API's seed/import flow.

**Four input modes:**

| Command | Description |
|---------|-------------|
| `generate` | Procedurally generates a grid map using fractal noise (fBm) with continent shaping and river carving |
| `generate-region` | Generates a grid map from real-world GeoJSON geography (land polygons + named sea features) |
| `import-svg` | Imports a hand-drawn SVG map (each `<path>` = one province) |
| `import-png` | Imports a color-coded PNG map using flood fill and border tracing |

A fifth command, `rewrap`, recomputes an existing map's east-west neighbor wrapping without
regenerating terrain.

**Stack:** TypeScript, ts-node

See [`map-generator/README.md`](map-generator/README.md) for CLI usage and all options.

---

## Quick Start

### 1. Start local MySQL

From the repository root — writes `.env` and `api/.env` automatically:

```bash
npm run db:local
```

MySQL is exposed on `127.0.0.1:3306`. If that port is taken, set `DB_PORT` in `.env` and run the
command again.

```bash
npm run db:local:env    # only (re)write .env + api/.env
npm run db:local:logs   # follow MySQL logs
npm run db:local:stop   # stop local MySQL
```

### 2. Set up the API

```bash
cd api
npm install
npm run migration:run
```

Seed reference/content data (order matters — see `api/README.md` for the full dependency chain):

```bash
npm run seed:resources
npm run seed:classes
npm run seed:goods
npm run seed:buildings
npm run seed:techs
npm run seed:troop-types
npm run seed:knowledge
npm run import:provinces    # provinces.json from map-generator, or the checked-in api/data/provinces.json
```

```bash
npm run start:dev
```

`npm run api:local` from the repo root automates most of this in one shot (install, local MySQL,
migrations, seed techs/buildings/troop-types, import provinces, seed test countries, start the
dev server) — a convenience path for a fresh checkout, not a substitute for understanding the
individual seed steps above if you're touching content data.

### 3. Start the frontend

```bash
cd web-map
npm install
npm run dev
```

### 4. (Optional) Seed test accounts and start the admin panel

```bash
npm run seed:test-countries   # from the repo root, or `npm run seed:test-countries` in api/
```

Creates `test-blue`/`test-red` (opposing countries, password `test123`) plus whatever `ADMIN`
account you registered first via the login screen.

```bash
cd admin-panel
npm install
npm run dev
```

---

## Game Loop

```
Players queue actions (BUILD / UPGRADE / COLONIZE / ARMY_MOVE / ARMY_RECRUIT / ...)
and use real-time diplomacy endpoints (declare war, propose/accept treaties, send money)
                          ↓
              Turn fires (cron, 2× daily in production)
                          ↓
   Income → Production → Upkeep → Supply → Recurring trade → Queued actions execute
                          ↓
     Post-processing (disband weak armies, resolve multi-faction combat,
                    sync province control) → Diplomacy tick
                          ↓
              SSE stream signals { processing: false }
                          ↓
                 Connected clients auto-reload
```

During execution, the API returns `503` on every route except a small public whitelist (login,
register, refresh, logout, the SSE stream, and the public game-settings read) — see
[`.ai-docs/GAME-MECHANICS.md`](.ai-docs/GAME-MECHANICS.md) for the complete phase-by-phase
breakdown, combat resolution, the economy, and the diplomacy/occupation model.

## Docker

`docker compose up --build` runs the full stack (MySQL, API, web client on :80, admin panel on
:8081). See [`.ai-docs/DOCKER.md`](.ai-docs/DOCKER.md) for service topology, environment
variables, and the production deploy flow.
