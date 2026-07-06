# Database — MySQL 8 + TypeORM

## Connection

- **ORM:** TypeORM 0.3 (NestJS integration via `@nestjs/typeorm`)
- **Database:** MySQL 8
- **Config:** `api/src/db/data-source.ts` (dev), `data-source.prod.ts` (prod; compiled to `dist/db/data-source.prod.js`)
- **Migrations:** `api/src/db/migrations/` (29 migration files)

## Entity Relationship Diagram

```
User (1) ──── (*) Province ──── (*:1) Resource
  │                 │
  │                 └── (1) ─ (*) ProvinceBuilding (*:1) ──── Building (*:1) ──── Good
  │                                                                (*:1) ──── Good  (requirement_good, separate FK)
  │
  ├── (1) ──── (*) Army
  │                 │
  │                 └── (1) ──── (*) ArmyUnit ──── (*:1) TroopType
  │
  ├── (1) ──── (*) UserGood (*:1) ──── Good
  │
  └── (1) ──── (*) UserResource (*:1) ──── Resource

User (1) ──── (*) ActionQueue

Tech (standalone, referenced by key strings in user.completed_research)
ActionsLog (standalone, JSON blob)
ExecutionLock (standalone, distributed locking)
```

## Entities

### User
| Column             | Type          | Notes |
|--------------------|---------------|-------|
| id                 | uuid (PK)     | Auto-generated |
| login              | varchar       | Unique |
| password           | varchar       | Bcrypt-hashed, @Exclude from serialization |
| is_new             | boolean       | True until first province setup |
| country_name       | varchar       | Display name |
| color              | varchar       | Hex color code |
| money              | int           | Currency resource |
| troops             | int           | Global troop pool |
| piety              | int           | HOLY class resource |
| research_points    | int           | Spent on tech research |
| completed_research | simple-array  | Array of tech key strings |
| class              | varchar       | Lowercase string: `noble`, `holy`, `guild`, or null (not a DB enum) |
| role               | varchar       | `ADMIN`, `MODERATOR`, `PLAYER` (first user = ADMIN; not a DB enum) |

### Province
| Column         | Type          | Notes |
|----------------|---------------|-------|
| id             | uuid (PK)     | Auto-generated |
| type           | varchar       | land, water |
| landscape      | varchar       | plains, forest, mountain, hills, swamp, desert |
| polygon        | text          | SVG path string (M, H, V, L, Z commands) |
| resource_id    | uuid (FK)     | → Resource, nullable. Entity exposes a `resourceType` getter returning `resource.key` for API/frontend compatibility |
| region_id      | varchar       | Map identifier, e.g. "prov-3-7" (no DB unique constraint) |
| user_id        | uuid (FK)     | Owner, nullable |
| local_troops   | int           | Garrison count (visible only to owner) |
| neighbor_ids   | simple-json   | Array of adjacent province IDs (nullable) |
| provinceBuildings | OneToMany  | → ProvinceBuilding (the `buildings` getter maps these) |

> Note: `enemyHere` is a transient `@Expose` field (not persisted), used to flag enemy presence in API responses.

### Building
| Column                      | Type         | Notes |
|-----------------------------|--------------|-------|
| id                          | uuid (PK)    | |
| type                        | varchar      | Holds a `BuildingTypes` value: CAPITAL, FORT, BARRACKS, FARM, SAWMILL, BRICKYARD, BARN, etc. (20 types; not a DB enum) |
| name                        | varchar      | Display name |
| description                 | varchar      | |
| income                      | int          | Money per turn (nullable). MINE uses a flat value here like every other building — see [Resource](#resource) for why |
| upkeep                      | int          | Money cost per turn (nullable) |
| modifier                    | varchar      | Numeric string for defense bonus |
| cost                        | int          | Money to construct |
| upgrade_to                  | varchar      | Target building type for upgrades (BuildingTypes value). FORESTRY → SAWMILL, GARDEN → FARM, FORT → CASTLE |
| requirement_tech            | simple-array | Tech keys required to build |
| requirement_building        | varchar      | Building type prerequisite (BuildingTypes value). SAWMILL requires FORESTRY, FARM requires GARDEN, CASTLE requires FORT |
| visible                     | boolean      | Whether the building shows in UI listings (default false) |
| can_recruit                 | boolean      | Whether troops can be recruited here (exposed as `canRecruit`, default false) |
| isProduction                | boolean      | Whether this building produces a good each turn (default false) |
| production_good_id          | uuid (FK)    | → Good, nullable. The single Good this building produces per turn when `isProduction` is true. Exposed as `productionGood` getter (returns the FK id) on the player-facing API |
| production_requirement_resource | varchar   | Nullable, references `Resource.key`. Optional **input**: if set, production each turn atomically reserves (spends) `production_requirement_resource_amount` of this resource from `UserResource` — production is skipped for the turn if that reservation fails. If null, the building produces unconditionally (e.g. CAPITAL → Food) |
| production_requirement_resource_amount | int | How much of `production_requirement_resource` is consumed per turn (nullable, defaults to 1 in code) |
| production_amount           | int          | How many units of `productionGoodEntity` are credited to the owner's `UserGood` ledger per turn, once the reservation above (if any) succeeds (nullable, defaults to 1 in code — see `ProductionActionService`) |
| resource_production_amount  | int          | Nullable. Per-turn amount of the **province's own resource** (`province.resource.key`) credited into the owner's `UserResource` stockpile — this is what MINE/FORESTRY actually do each turn now (replaced a one-time "+1 capacity at build" grant) |
| buildable                   | boolean      | Whether players can construct this (default true). CAPITAL/CAPITOL = false |
| destructible                | boolean      | Whether players can demolish this (default true). CAPITAL = false |
| unique_per_province         | boolean      | Only one per province allowed (default false). MINE, BRICKYARD, FORESTRY, SAWMILL, ARMORY, BARN, FARM, FORT, CASTLE = true |
| allowed_province_resources  | simple-array | Province resource key filter (nullable), references `Resource.key`. MINE=['iron','gold','stone'], BRICKYARD=['stone'], FORESTRY/SAWMILL=['wood'], BARN/FARM=['grain']. Null = any province |
| requirement_resource        | varchar      | User resource reserved from the `UserResource` stockpile **once**, at build/upgrade time (nullable), references `Resource.key`. ARMORY='iron', FORT/CASTLE='stone' |
| requirement_resource_amount | int          | How much of that resource is reserved at build time (nullable). Usually 1 |
| requirement_good_id         | uuid (FK)    | → Good, nullable. A one-time BUILD cost paid in goods (same mechanic as `requirement_resource`, but from `UserGood`) — BARRACKS/FORT need Weapons, SAWMILL needs Bricks. Exposed as `requirementGood` getter (FK id) |
| requirement_good_amount     | int          | How much of that good is reserved at build time (nullable, defaults to 1 in code) |

> Building has no direct relation to Province. The link is the **ProvinceBuilding** join entity (see below). Building's resource fields reference `Resource.key` (not a FK) — they're plain strings sourced from a dropdown in the admin panel, resolved against the `UserResource` ledger at BUILD/UPGRADE/REMOVE time (see [UserResource](#userresource)).

### ProvinceBuilding
Join entity linking provinces and buildings (replaced the old ManyToMany join table — migration `ReplaceProvinceBuildingsJoinTable`).

| Column      | Type      | Notes |
|-------------|-----------|-------|
| id          | uuid (PK) | |
| province_id | uuid (FK) | → Province (ManyToOne) |
| building_id | uuid (FK) | → Building (ManyToOne, eager) |

### Army
| Column      | Type          | Notes |
|-------------|---------------|-------|
| id          | uuid (PK)     | |
| name        | varchar       | Nullable |
| user_id     | uuid (FK)     | Owner |
| province_id | uuid (FK)     | Current location |
| flat_upkeep | int           | Base cost per turn (default 100) |
| units       | OneToMany     | → ArmyUnit (eager, cascade) |
| createdAt   | timestamp     | |

### ArmyUnit
| Column        | Type      | Notes |
|---------------|-----------|-------|
| id            | uuid (PK) | |
| army_id       | uuid (FK) | Parent army |
| troop_type_id | uuid (FK) | → TroopType |
| count         | int       | Number of troops of this type |
| troopType     | ManyToOne | Eager-loaded |

### TroopType
| Column             | Type      | Notes |
|--------------------|-----------|-------|
| id                 | uuid (PK) | |
| key                | varchar   | Unique (infantry, cavalry, paladins, etc.) |
| name               | varchar   | Display name |
| description        | text      | Nullable |
| category           | enum      | INFANTRY, RANGED, CAVALRY, SPECIAL, PEASANT (real DB enum) |
| cost_per_100       | int       | Money per 100 recruited |
| attack             | float     | Combat attack stat |
| defense            | float     | Combat defense stat |
| upkeep_per_100     | int       | Money per 100 per turn |
| tech_requirement   | varchar   | Tech key required to recruit |
| building_requirement| varchar  | Building type required in province (nullable; not a DB enum) |

### Resource
| Column        | Type      | Notes |
|---------------|-----------|-------|
| id            | uuid (PK) | |
| key           | varchar   | Unique natural key (e.g., "iron"). Referenced by Building's `allowed_province_resources`/`requirement_resource`/`production_requirement_resource`, map-generator output, and frontend icon/color maps |
| name          | varchar   | Display name, editable in admin panel |
| type          | varchar   | `plain` or `consumable` (not a DB enum). Historical distinction from before the manufacturing stockpile existed; both types are tracked in `UserResource` identically today |
| plain_income  | int       | **Not currently used for income.** Money income now comes from flat `Building.income` (same mechanism every other building uses) — see [UserResource](#userresource) for why. Kept for admin panel compatibility / potential future use (e.g. a sell price) |

> Editable via the admin panel's Resources tab. Seeded rows: stone, iron, gold, wood, grain, fish (fish covers water provinces).

### UserResource
Per-player **manufacturing stockpile** — raw materials mined/harvested each turn, spent on one-time build costs (`requirement_resource`) and on per-turn goods manufacturing (`production_requirement_resource`).

| Column      | Type      | Notes |
|-------------|-----------|-------|
| id          | uuid (PK) | |
| user_id     | uuid (FK) | → User, `ON DELETE CASCADE` |
| resource_id | uuid (FK) | → Resource (eager), `ON DELETE CASCADE` |
| quantity    | int       | Amount held, default 0, never negative |

> Unique constraint on `(user_id, resource_id)`. Maintained by `UserResourcesService` (`api/src/resources/user-resources.service.ts`):
> - `adjustQuantity` — unconditional grant/release (clamped at 0): per-turn MINE/FORESTRY production credit, and releasing a `requirement_resource` reservation on demolish/upgrade.
> - `tryReserve` — atomic conditional decrement (locks the row, checks availability, decrements or fails). Used for (a) the one-time `requirement_resource` cost at BUILD/UPGRADE time, and (b) the per-turn `production_requirement_resource_amount` spend in `ProductionActionService` — production for that building is skipped for the turn if the reservation fails.
> - `createRowsForNewResource`/`createRowsForNewUser` — fan-out pattern shared with `UserGoodsService`, keeping every (user, resource) pair populated.
> - **Production (the stockpile's only income):** `ProductionActionService`'s first pass credits `Building.resource_production_amount` (e.g. 25) of `province.resource.key` into `UserResource` each turn for every building that has it set — MINE and FORESTRY. This replaced an earlier "+1 static capacity at build time" model; quantity is now a real, growing/shrinking number.
> - Conquest: `ActionSchedulerService.transferProvinceResourceFootprint` moves a captured building's `requirement_resource` reservation from the losing owner's ledger to the winner's (called from `resolveArmyConflicts` and `syncProvinceOwnershipWithArmies`). Per-turn *production* isn't transferred at the moment of conquest — it's simply derived fresh next turn from whoever then owns the building.
> - **Why money income no longer reads this table:** an earlier version computed MINE's money as `quantity × resource.plain_income`. Once mines started producing an accumulating stockpile instead of a static count, that formula would make money grow every turn a stockpile went unspent — a runaway loop, not a balance knob. MINE's income is a flat `Building.income` value now, like every other building.

### Good
| Column        | Type      | Notes |
|---------------|-----------|-------|
| id            | uuid (PK) | |
| name          | varchar   | Display name. No natural `key` like Resource — seed scripts and admin dropdowns resolve/reference goods by `name` or `id` |
| type          | varchar   | `civilian` or `military` (not a DB enum) |
| price_per_one | int       | Money cost per unit |

> Seeded: Lumber, Food, Weapons, Bricks (`api/data/goods.json`). Editable via the admin panel's Goods tab.

### UserGood
Per-player goods inventory (ledger), mirroring the `Army`/`ArmyUnit`/`TroopType` shape.

| Column   | Type      | Notes |
|----------|-----------|-------|
| id       | uuid (PK) | |
| user_id  | uuid (FK) | → User, `ON DELETE CASCADE` |
| good_id  | uuid (FK) | → Good (eager), `ON DELETE CASCADE` |
| quantity | int       | Amount held, default 0, never negative |

> Unique constraint on `(user_id, good_id)` — every user has exactly one row per good. Rows are backfilled automatically: `UserGoodsService.createRowsForNewGood` fans a zero-quantity row out to every existing user when an admin creates a `Good`; `UserGoodsService.createRowsForNewUser` fans a zero-quantity row out across every existing `Good` when a user is created (registration or admin). `UserGoodsService.adjustQuantity`/`tryReserve` (mirrors `UserResourcesService`) credit turn production and reserve `requirement_good` BUILD costs. `GET /goods/mine` returns the caller's rows.

### Goods & Resource Production (turn logic)
Each turn, `ProductionActionService` runs right after income, before upkeep (see [GAME-MECHANICS.md](GAME-MECHANICS.md#income-calculation)), in two passes over every building the user owns:

1. **Resource production** (unconditional): any building with `resource_production_amount` set credits that amount of `province.resource.key` into `UserResource` — this is what MINE and FORESTRY do (both 25/turn in the current seed data).
2. **Goods production**: skipped unless `isProduction` and `production_good_id` are set.
   - **Input (optional):** if `production_requirement_resource` is set, atomically reserve `production_requirement_resource_amount` of it from `UserResource` (via `tryReserve`) — this turn's production is skipped if that fails. If null, production is unconditional (CAPITAL→Food has no input).
   - **Output:** on success (or if there was no input to check), credit `production_amount` of `productionGoodEntity` to `UserGood`.

Pass 1 always finishes before pass 2 starts, so a building's own resource production is available to that same building's (or another building's) goods manufacturing within the same turn, regardless of iteration order.

Seed data (`api/data/buildings.json`):
| Building | Resource produced/turn | Good produced/turn | Input consumed/turn |
|----------|------------------------|---------------------|----------------------|
| MINE (iron/gold/stone provinces) | 25 of province's resource | — | — |
| BARN (grain provinces only) | 25 grain | — | — |
| FORESTRY | 25 wood | 25 Lumber | 25 wood |
| SAWMILL (upgrade of FORESTRY, costs 25 Bricks to build) | — | 25 Lumber | 25 wood |
| BRICKYARD (stone provinces only) | — | 25 Bricks | 25 stone |
| ARMORY | — | 25 Weapons | 25 iron |
| CAPITAL | — | 25 Food | none (unconditional) |
| GARDEN / FARM | — | 1 Food | 1 grain (now satisfiable once a BARN is built — before BARN existed, nothing granted grain capacity and this input could never be met) |

### Tech
| Column        | Type          | Notes |
|---------------|---------------|-------|
| id            | uuid (PK)     | |
| key           | varchar       | Unique (e.g., economy.agriculture) |
| name          | varchar       | Display name |
| description   | text          | |
| branch        | varchar       | economy, military, noble, holy, guild |
| isClassRoot   | boolean       | DB column `is_class_root`, default false. True if researching selects a class |
| cost          | int           | Research points to unlock |
| prerequisites | simple-array  | Array of tech keys required first |

### ActionQueue
| Column        | Type      | Notes |
|---------------|-----------|-------|
| id            | uuid (PK) | |
| userId        | uuid (FK) | Queuing player (also exposed as eager `user` relation) |
| order         | int       | Execution priority (lower = earlier) |
| actionType    | enum      | BUILD, UPGRADE, RESEARCH, REMOVE, COLONIZE, ARMY_CREATE/MOVE/RECRUIT/MERGE/DISBAND/EDIT (13 enum values incl. legacy TRANSFER_TROOPS, DISBAND) |
| actionData    | json      | Flexible payload per action type |
| status        | enum      | PENDING, PROCESSING, COMPLETED, FAILED, RETRACTED (default PENDING) |
| failureReason | text      | Nullable, set on failure |
| createdAt     | timestamp | |
| updatedAt     | timestamp | |

### ActionsLog
| Column    | Type      | Notes |
|-----------|-----------|-------|
| id        | int (PK)  | Auto-increment |
| data      | json      | Full execution details |
| timetable | varchar   | e.g., "12:00" |
| createdAt | timestamp | |

### ExecutionLock
| Column    | Type      | Notes |
|-----------|-----------|-------|
| lockKey   | varchar (PK) | Lock identifier (primary key) |
| lockedAt  | timestamp | When acquired |
| lockedBy  | varchar   | Instance identifier (nullable) |
| updatedAt | timestamp | Auto-updated |

## Seed Data

Located in `api/data/`:
- `resources.json` — Resource definitions (key, name, type, plain_income)
- `goods.json` — Good definitions (name, type, price_per_one)
- `provinces.json` — Map geometry and metadata (generated by map-generator; `resource_type` is a resource **key** string, resolved to `resource_id` at import time)
- `buildings.json` — Building type definitions, including `production_good_name` (a Good **name** string, resolved to `production_good_id` at seed time — Good has no natural key like Resource does)
- `techs.json` — Tech tree definitions
- `troop-types.json` — Troop type stats

Import scripts in `api/src/scripts/`:
- `seed-resources.ts` — Seeds the resources table. **Must run before `import-provinces.ts`**, which looks up each province's resource key against this table and fails loudly on an unknown key
- `seed-goods.ts` — Seeds the goods table, keyed on `name` (no natural key field). **Must run before `seed-buildings.ts`**, which resolves `production_good_name` against this table and fails loudly on an unknown name
- `import-provinces.ts` — Reads provinces.json, upserts into DB
- `seed-buildings.ts` — Seeds building definitions
- `seed-techs.ts` — Seeds tech tree
- `seed-troop-types.ts` — Seeds troop types
- `balance-report.ts` — Combat balance analysis
- `reset-game-data.ts` — Reset game data

## Migrations

```bash
# TypeORM 0.3 — name is a positional path arg, NOT -n. generate/create are dev-only tooling.
npm run migration:generate -- src/db/migrations/MigrationName  # Auto-generate from entity changes
npm run migration:create -- src/db/migrations/MigrationName    # Empty migration

# run/revert/fresh auto-detect dev vs prod via NODE_ENV (see api/scripts/run-env.js) —
# same command locally or via `docker compose exec api ...`
npm run migration:run                            # Apply pending migrations
npm run migration:revert                         # Rollback last migration
npm run migration:fresh                          # Drop schema + re-run all
```

Migration files: `api/src/db/migrations/` (timestamped TypeScript files)
