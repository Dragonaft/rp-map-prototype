# RP Map Prototype - Architecture Overview

> Agent-facing documentation. This folder provides starting context for AI coding agents working on this codebase.

## What Is This?

A **turn-based political strategy game** where players control provinces on a map, build structures, research technologies, recruit armies, and wage war. Turns execute on a cron schedule (twice daily in production).

## Monorepo Structure

```
rp-map-prototype/
├── api/              NestJS 10 REST API (TypeScript, port 3000)
├── web-map/          React 18 game client (Vite, SVG map, port 80/5173)
├── admin-panel/      React 19 admin CRUD UI (Vite + MUI DataGrid, port 8081)
├── map-generator/    TypeScript CLI for procedural map generation (not containerized)
├── docker-compose.yml
├── package.json      npm workspaces: [web-map, map-generator, admin-panel]
└── .ai-docs/         You are here
```

**Note:** `api/` is NOT in the npm workspaces — it has its own independent `node_modules`.

## Tech Stack Summary

| Component      | Framework        | Language   | DB/State         | Port  |
|----------------|------------------|------------|------------------|-------|
| API            | NestJS 10        | TypeScript | MySQL 8 (TypeORM)| 3000  |
| Web Map        | React 18 + Vite  | TypeScript | Redux Toolkit    | 80    |
| Admin Panel    | React 19 + Vite  | TypeScript | Local state      | 8081  |
| Map Generator  | ts-node CLI      | TypeScript | N/A (file I/O)   | N/A   |
| Database       | MySQL 8          | SQL        | TypeORM migrations| 3306  |

## Service Communication

```
Browser ──► nginx (web:80) ──► /api/* proxy ──► api:3000 (NestJS)
                                                    │
Browser ──► nginx (admin:8081) ──► /api/* proxy ────┘
                                                    │
                                              MySQL (db:3306)

map-generator (local CLI) ──► provinces.json ──► api/data/ ──► DB import
```

Both frontends use nginx to serve static files and reverse-proxy `/api/*` requests to the NestJS container, stripping the `/api` prefix.

## Authentication

- **JWT in httpOnly cookies** (access token: 15min, refresh token: 7 days)
- Access token extracted from cookies by Passport strategy
- Auto-refresh: frontends intercept 401, call `/auth/refresh`, retry
- First registered user becomes ADMIN; others are PLAYER
- Role guard: `@Roles(UserRoles.ADMIN)` + `RolesGuard`

## Game Loop (Turn System)

```
Cron fires (13:00 & 20:00 Kyiv time prod; every 2min AND 5min dev)
  │
  ├─ Acquire distributed lock (ExecutionLock entity)
  ├─ Income phase: credit money/troops/piety/research from buildings
  ├─ Upkeep phase: deduct building + army costs
  ├─ Action execution: process queued actions in order
  ├─ Post-processing:
  │   ├─ Disband armies < 100 troops
  │   ├─ Resolve multi-faction combat in same province
  │   └─ Sync province ownership with army presence
  ├─ Cleanup executed actions, write log
  └─ SSE broadcast → frontends auto-reload
```

During execution, the API returns **503** on most endpoints (ActionExecutionBlockMiddleware). Whitelisted: exactly five exact-match paths — `/actions/execution-stream`, `/auth/login`, `/auth/register`, `/auth/refresh`, `/auth/logout`. Note: `/auth/me` is **not** whitelisted (blocked during processing).

## Key Files to Read First

| Purpose                  | File                                              |
|--------------------------|---------------------------------------------------|
| API bootstrap            | `api/src/main.ts`                                 |
| Root module              | `api/src/app.module.ts`                           |
| Turn scheduler           | `api/src/actions/action-scheduler.service.ts`     |
| Action handlers (12)     | `api/src/actions/action-executor.service.ts`      |
| Combat calculator        | `api/src/actions/combat-calculator.ts`            |
| Income logic             | `api/src/actions/income-action.service.ts`        |
| Upkeep logic             | `api/src/actions/upkeep-action.service.ts`        |
| Research effect modifiers| `api/src/techs/research-effects.ts`               |
| Map rendering            | `web-map/src/components/MapView.tsx`              |
| Province rendering       | `web-map/src/components/ProvinceShape.tsx`        |
| Redux store              | `web-map/src/store/store.ts`                      |
| Frontend router          | `web-map/src/router.tsx`                          |
| Docker orchestration     | `docker-compose.yml`                              |

## See Also

- [API.md](API.md) — Backend modules, entities, endpoints
- [WEB-MAP.md](WEB-MAP.md) — Frontend architecture, SVG map, state management
- [ADMIN-PANEL.md](ADMIN-PANEL.md) — Admin UI structure
- [MAP-GENERATOR.md](MAP-GENERATOR.md) — Map generation CLI tool
- [GAME-MECHANICS.md](GAME-MECHANICS.md) — Turn system, combat, economy, tech tree
- [DOCKER.md](DOCKER.md) — Container orchestration, env vars, networking
- [DATABASE.md](DATABASE.md) — Entity schemas and relationships
