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
- Viewport culling — only renders provinces visible in the current view
- Province selection, troop management, building icons
- Action queue UI — deploy troops, queue invasions and builds, cancel pending actions
- Listens to the SSE stream and reloads data after each turn completes

**Stack:** React, Redux Toolkit, React Hook Form, MUI, Axios, Vite

**Performance notes:**
- Province layout (polygons) is cached in `localStorage` — only dynamic state (troops, ownership, buildings) is re-fetched on each turn reload
- Bounding boxes are computed from polygon strings at load time (no DOM `getBBox()` calls)

---

### `map-generator` — Map Generation CLI

TypeScript CLI tool for creating and importing province maps. Outputs `provinces.json` consumed by the API seed/import flow.

**Three input modes:**

| Command | Description |
|---------|-------------|
| `generate` | Procedurally generates a grid map using fractal noise (fBm) with continent shaping and river carving |
| `import-svg` | Imports a hand-drawn SVG map (each `<path>` = one province) |
| `import-png` | Imports a color-coded PNG map using flood fill and border tracing |

**Grid generation highlights:**
- fBm noise + radial island falloff → natural continent shapes
- Greedy downhill river paths from mountain peaks to coastline
- Elevation-biased landscape assignment (mountains, hills, plains, swamp, desert, forest)
- Fully seeded — same `--seed` always produces the same map

**Stack:** TypeScript, ts-node

See [`map-generator/README.md`](map-generator/README.md) for CLI usage and all options.

---

## Quick Start

### 1. Generate a map

```bash
cd map-generator
npm install
npx ts-node src/index.ts generate --rows 12 --cols 16 --seed 42 --out ./out
# Copy out/provinces.json to api/data/ and run the API seed
```

### 2. Start the API

```bash
cd api
npm install
cp .env.example .env   # fill in DB + JWT config
npm run start:dev
```

### 3. Start the frontend

```bash
cd web-map
npm install
npm run dev
```

---

## Game Loop

```
Players queue actions (BUILD / INVADE / DEPLOY)
          ↓
    Turn fires (cron, 2× daily in production)
          ↓
  Income → Upkeep → Actions execute in order
          ↓
  SSE stream signals { processing: false }
          ↓
    Frontend reloads updated state
```
