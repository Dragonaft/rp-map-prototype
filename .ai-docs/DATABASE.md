# Database — MySQL 8 + TypeORM

## Connection

- **ORM:** TypeORM 0.3 (NestJS integration via `@nestjs/typeorm`)
- **Database:** MySQL 8
- **Config:** `api/src/db/data-source.ts` (dev), `data-source.prod.ts` (prod; compiled to `dist/db/data-source.prod.js`)
- **Migrations:** `api/src/db/migrations/` (26 migration files)

## Entity Relationship Diagram

```
User (1) ──── (*) Province ──── (*:1) Resource
  │                 │
  │                 └── (1) ─ (*) ProvinceBuilding (*:1) ──── Building (*:1) ──── Good
  │
  ├── (1) ──── (*) Army
  │                 │
  │                 └── (1) ──── (*) ArmyUnit ──── (*:1) TroopType
  │
  └── (1) ──── (*) UserGood (*:1) ──── Good

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
| type                        | varchar      | Holds a `BuildingTypes` value: CAPITAL, FORT, BARRACKS, FARM, etc. (17 types; not a DB enum) |
| name                        | varchar      | Display name |
| description                 | varchar      | |
| income                      | int          | Money per turn (nullable) |
| upkeep                      | int          | Money cost per turn (nullable) |
| modifier                    | varchar      | Numeric string for defense bonus |
| cost                        | int          | Money to construct |
| upgrade_to                  | varchar      | Target building type for upgrades (BuildingTypes value) |
| requirement_tech            | simple-array | Tech keys required to build |
| requirement_building        | varchar      | Building type prerequisite (BuildingTypes value) |
| visible                     | boolean      | Whether the building shows in UI listings (default false) |
| can_recruit                 | boolean      | Whether troops can be recruited here (exposed as `canRecruit`, default false) |
| isProduction                | boolean      | Whether this building produces goods (default false; economy rework, not yet wired to turn logic) |
| production_good_id          | uuid (FK)    | → Good, nullable. The single Good this building produces per turn when `isProduction` is true. Exposed as `productionGood` getter (returns the FK id) on the player-facing API |
| production_requirement_resource | varchar   | Nullable, references `Resource.key` (same convention as `requirement_resource`). Building only produces if the owning user holds > 0 of this resource. Not yet wired to turn logic |
| buildable                   | boolean      | Whether players can construct this (default true). CAPITAL/CAPITOL = false |
| destructible                | boolean      | Whether players can demolish this (default true). CAPITAL = false |
| unique_per_province         | boolean      | Only one per province allowed (default false). MINE, FORT, CASTLE = true |
| allowed_province_resources  | simple-array | Province resource key filter (nullable), references `Resource.key`. MINE=['iron','gold','stone'], FORESTRY=['wood'], FARM=['grain']. Null = any province |
| requirement_resource        | varchar      | User resource consumed on build (nullable), references `Resource.key`. ARMORY='iron', FORT='stone' |
| requirement_resource_amount | int          | How many of that resource consumed (nullable). Usually 1 |

> Building has no direct relation to Province. The link is the **ProvinceBuilding** join entity (see below). Building's resource fields reference `Resource.key` (not a FK) — they're plain strings sourced from a dropdown in the admin panel.

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
| key           | varchar   | Unique natural key (e.g., "iron"). Referenced by Building's `allowed_province_resources`/`requirement_resource`, map-generator output, and frontend icon/color maps |
| name          | varchar   | Display name, editable in admin panel |
| type          | varchar   | `plain` or `consumable` (not a DB enum). Metadata only — not wired to any behavior yet (reserved for the wider economy rework) |
| plain_income  | int       | Money/turn credited by a MINE built on a province with this resource (default 0). Replaces the old hardcoded `MINE_INCOME_BY_RESOURCE` map |

> Editable via the admin panel's Resources tab. Seeded rows: stone, iron, gold, wood, grain, fish (fish covers water provinces).

### Good
| Column        | Type      | Notes |
|---------------|-----------|-------|
| id            | uuid (PK) | |
| name          | varchar   | Display name |
| type          | varchar   | `civilian` or `military` (not a DB enum) |
| price_per_one | int       | Money cost per unit |

> First step of the wider economy rework (goods to be produced/traded, following the resource rework). Not yet wired into any building/trade logic. Editable via the admin panel's Goods tab.

### UserGood
Per-player goods inventory (ledger), mirroring the `Army`/`ArmyUnit`/`TroopType` shape.

| Column   | Type      | Notes |
|----------|-----------|-------|
| id       | uuid (PK) | |
| user_id  | uuid (FK) | → User, `ON DELETE CASCADE` |
| good_id  | uuid (FK) | → Good (eager), `ON DELETE CASCADE` |
| quantity | int       | Amount held, default 0 |

> Unique constraint on `(user_id, good_id)` — every user has exactly one row per good. Rows are backfilled automatically: `UserGoodsService.createRowsForNewGood` fans a zero-quantity row out to every existing user when an admin creates a `Good`; `UserGoodsService.createRowsForNewUser` fans a zero-quantity row out across every existing `Good` when a user is created (registration or admin). No spend/trade/turn logic wired yet — `GET /goods/mine` just returns the caller's rows.

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
- `provinces.json` — Map geometry and metadata (generated by map-generator; `resource_type` is a resource **key** string, resolved to `resource_id` at import time)
- `buildings.json` — Building type definitions
- `techs.json` — Tech tree definitions
- `troop-types.json` — Troop type stats

Import scripts in `api/src/scripts/`:
- `seed-resources.ts` — Seeds the resources table. **Must run before `import-provinces.ts`**, which looks up each province's resource key against this table and fails loudly on an unknown key
- `import-provinces.ts` — Reads provinces.json, upserts into DB
- `seed-buildings.ts` — Seeds building definitions
- `seed-techs.ts` — Seeds tech tree
- `seed-troop-types.ts` — Seeds troop types
- `balance-report.ts` — Combat balance analysis
- `reset-game-data.ts` — Reset game data

## Migrations

```bash
# Development (TypeORM 0.3 — name is a positional path arg, NOT -n)
npm run migration:generate -- src/db/migrations/MigrationName  # Auto-generate from entity changes
npm run migration:create -- src/db/migrations/MigrationName    # Empty migration
npm run migration:run                            # Apply pending migrations
npm run migration:revert                         # Rollback last migration
npm run migration:fresh                          # Drop schema + re-run all

# Production (Docker)
docker compose exec api npm run migration:run:prod
docker compose exec api npm run migration:revert:prod
```

Migration files: `api/src/db/migrations/` (timestamped TypeScript files)
