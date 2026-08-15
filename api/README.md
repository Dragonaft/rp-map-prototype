# rp-map-prototype — API

NestJS REST API for **PR_PROTOTYPE**, a turn-based political strategy game. Owns all game state
— provinces, buildings, armies, the economy, diplomacy, tech research — and drives the scheduled
turn engine that advances the world.

For the full architectural reference (every module, entity, endpoint, and turn-phase mechanic),
see [`.ai-docs/`](../.ai-docs/) at the repo root — `API.md`, `DATABASE.md`, and
`GAME-MECHANICS.md` in particular. This README is the quick-start and orientation layer.

## Stack

NestJS 10 · TypeORM 0.3 · MySQL 8 · Passport JWT (httpOnly cookies) · class-validator ·
`@nestjs/schedule` (cron turn execution)

## Setup

Start local MySQL from the repository root (writes `api/.env` automatically):

```bash
npm run db:local
```

Or copy `.env.example` to `.env` and point it at your own MySQL instance.

```bash
npm install
npm run migration:run
npm run start:dev        # http://localhost:3000, --watch
```

### Seeding

Order matters for a few of these — see the inline comments in `scripts/run-env.js` and
`.ai-docs/DOCKER.md` for the full dependency chain:

```bash
npm run seed:resources      # before import:provinces (resolves resource_type keys)
npm run seed:classes
npm run seed:goods          # before seed:buildings and seed:troop-types
npm run seed:buildings
npm run seed:techs
npm run seed:troop-types
npm run seed:knowledge      # Codex articles — no ordering dependency
npm run import:provinces    # provinces.json from map-generator, or api/data/provinces.json
```

`npm run seed:test-countries` creates two ready-made opposing accounts (`test-blue` / `test-red`,
password `test123`) for exercising anything that needs a second player.

## Environment Variables

| Variable | Description |
|---|---|
| `DB_HOST`, `DB_PORT`, `DB_USER_NAME`, `DB_USER_PASSWORD`, `DB_NAME` | MySQL connection |
| `JWT_SECRET`, `JWT_REFRESH_SECRET` | Token signing secrets |
| `COOKIE_SECURE` | `false` for local HTTP cookie auth |
| `NODE_ENV` | `development` or `production` — also picks the migration/seed runner mode (ts-node vs. compiled `dist/`), see `scripts/run-env.js` |
| `DISABLE_ACTION_EXECUTION_GATE` | `true` disables the 503 turn-processing gate, for local debugging |
| `DISABLE_FAST_ACTION_CRON` | `true` disables the 2-min/5-min dev crons (always off in production) |

## Authentication

JWT via **httpOnly cookies**, issued by `POST /auth/login` / `/auth/register`.

| Cookie | Expiry | Purpose |
|---|---|---|
| `access_token` | 15 min | Request authentication |
| `refresh_token` | 7 days | Silent renewal via `POST /auth/refresh` |

The first registered user becomes `ADMIN`; every account after that is `PLAYER`. `ADMIN`/`MODERATOR`
accounts can also flip an NPC account's role and "act as" it — see `Auth — Mod Impersonation` in
`.ai-docs/API.md`.

## Modules

| Module | Responsibility |
|---|---|
| `AuthModule` | Login/register/refresh/logout |
| `UsersModule` | Player profiles, resource/income/upkeep projections |
| `ProvincesModule` | Map tiles, ownership, buildings, first-province setup |
| `BuildingsModule` | Building template definitions |
| `TechsModule` | Tech tree, data-driven effects engine, per-user research progress |
| `ArmiesModule` | Army CRUD, troop types, fog-of-war visibility |
| `ActionsModule` | Action queue, executor, scheduler, income/upkeep/supply |
| `ResourcesModule` | Raw-resource definitions + per-user stockpile ledger |
| `GoodsModule` | Manufactured-good definitions + per-user inventory ledger |
| `DiplomacyModule` | Relations, wars, treaties, province occupation |
| `NotificationsModule` | Durable per-user notifications (action failures, admin broadcasts) |
| `ClassesModule` | DB-driven player classes (gates tech branches/units) |
| `KnowledgeModule` | Read-only in-app "Codex" — game-mechanics reference articles |
| `ModModule` | ADMIN/MODERATOR god-mode tools (spawn NPCs, edit stocks, act-as) |
| `GameSettingsModule` | Singleton pause switch + turn-execution kill switch |
| `NewsModule` | Player-authored in-game news agencies/articles |
| `AdminModule` | CRUD surface backing the separate admin panel |

## Turn System

Turns execute on a cron schedule. Between ticks, world state is frozen — players only queue
actions or use the real-time diplomacy endpoints.

| Environment | Schedule |
|---|---|
| Production | 13:00 and 20:00 Europe/Kyiv daily |
| Development | Every 2 min **and** every 5 min (two separate crons), gated by `game_settings.turns_enabled` and `DISABLE_FAST_ACTION_CRON` |

**Execution order per tick:**

1. **Income** — money/troops/piety/research from buildings (occupied provinces skipped)
2. **Production** — raw resources, then manufactured goods, two passes
3. **Upkeep** — building + army maintenance
4. **Supply** — army food cost by distance from the nearest supply building; unfed armies take attrition
5. **Recurring trade** — accepted recurring trade treaties settle
6. **Action execution** — queued actions run in `order ASC, createdAt ASC`
7. **Cleanup** — mark actions completed/failed, write the execution log
8. **Post-processing** — disband armies < 100 troops, resolve multi-faction combat, sync province control to army presence
9. **Diplomacy tick** — occupation counters, peace-truce decay, stale-treaty expiry, army water-residency
10. **SSE broadcast** — connected clients auto-reload

**During execution**, the API returns `503` on every route except an exact-match whitelist of six
paths (`/actions/execution-stream`, `/auth/login`, `/auth/register`, `/auth/refresh`,
`/auth/logout`, `/game-settings`) — see `ActionExecutionBlockMiddleware`.

## Action Types

Actions are queued via `POST /actions` and executed in the order above. Current set: `BUILD`,
`UPGRADE`, `REMOVE`, `COLONIZE`, `ARMY_CREATE`, `ARMY_RECRUIT`, `ARMY_MOVE`, `ARMY_MERGE`,
`ARMY_TRANSFER`, `ARMY_DISBAND`, `ARMY_EDIT`. `RESEARCH` is explicitly rejected — tech selection
is `POST /techs/select`, an instant (non-queued) call, since research can't afford to wait a full
tick just to start accruing. Diplomacy (`/diplomacy/*`) is real-time REST, not queued, for the
same reason — an offer has to be able to sit and wait for a reply across turns.

Full payload shapes are in `.ai-docs/API.md#action-types-enum`.

## Combat, Economy, Diplomacy

These are substantial systems — counter-matrix combat, the prestige-goods class economy, supply
distance scaling, occupation vs. annexation, treaties and wars — and are documented in full in
[`.ai-docs/GAME-MECHANICS.md`](../.ai-docs/GAME-MECHANICS.md) rather than duplicated here.

## npm Scripts

| Script | Purpose |
|---|---|
| `start:dev` | Dev server, `--watch` |
| `build` | Compile TypeScript to `dist/` |
| `migration:run` / `migration:revert` / `migration:fresh` | Apply / roll back / drop-and-reapply migrations |
| `migration:create` / `migration:generate` | Scaffold a new migration (dev-only tooling) |
| `seed:resources`, `seed:classes`, `seed:goods`, `seed:buildings`, `seed:techs`, `seed:troop-types`, `seed:knowledge` | Populate reference/content tables from `api/data/` |
| `import:provinces` | Import `provinces.json` into the DB (wipes and reinserts) |
| `seed:test-countries` | Create `test-blue`/`test-red` opposing test accounts |
| `reset:game` | Wipe all game-state tables (keeps users, provinces, migrations, and the Codex) back to a fresh world |
| `fix:neighbors` | Repair province `neighbor_regions` data |
| `balance:report` | Generate a combat-balance analysis from current troop-type stats |

All scripts except the dev-only migration tooling route through `scripts/run-env.js`, which picks
`ts-node` against `src/` in development or plain `node` against compiled `dist/` in production —
the same command names work identically locally or via `docker compose exec api ...`.
