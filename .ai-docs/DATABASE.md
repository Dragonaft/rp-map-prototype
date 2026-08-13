# Database — MySQL 8 + TypeORM

## Connection

- **ORM:** TypeORM 0.3 (NestJS integration via `@nestjs/typeorm`)
- **Database:** MySQL 8
- **Config:** `api/src/db/data-source.ts` (dev), `data-source.prod.ts` (prod; compiled to `dist/db/data-source.prod.js`)
- **Migrations:** `api/src/db/migrations/` (50 migration files)

## Entity Relationship Diagram

```
User (1) ──── (*) Province ──── (*:1) Resource
  │                 │        └── (*:1) User (occupier_id, nullable — military controller, not the owner)
  │                 └── (1) ─ (*) ProvinceBuilding (*:1) ──── Building (*:1) ──── Good
  │                                                                (*:1) ──── Good  (requirement_good, separate FK)
  │
  ├── (1) ──── (*) Army
  │                 │
  │                 └── (1) ──── (*) ArmyUnit ──── (*:1) TroopType
  │
  ├── (1) ──── (*) UserGood (*:1) ──── Good
  │
  ├── (1) ──── (*) UserResource (*:1) ──── Resource
  │
  ├── (*) DiplomaticRelation (user_a_id/user_b_id, one row per unordered pair)
  │
  ├── (*) War (attacker_leader_id/defender_leader_id) ── (1) ── (*) WarParticipant (*:1) ── User
  │
  ├── (*) Treaty (proposer_id/receiver_id)
  │
  └── (*) Notification

User (1) ──── (*) ActionQueue

Tech (standalone, referenced by key strings in user.completed_research)
PlayerClass (standalone table `classes`; referenced by key string in User.class and Tech.branch —
             no FK either direction, see User.class and PlayerClass below)
ActionsLog (standalone, JSON blob)
ExecutionLock (standalone, distributed locking)
GameSettings (standalone, singleton row id='global' — global pause/turns-enabled switches)
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
| research_points    | int           | Research **speed** (points/turn), not a stockpile — recomputed and overwritten every income tick from CAPITAL/LIBRARY buildings + tech effects |
| completed_research | simple-array  | Array of tech key strings |
| active_research_key| varchar       | Nullable. Tech key currently accruing progress each turn (single active slot); null = idle. Saved progress lives in `UserTechProgress`, not here |
| class              | varchar       | Nullable class **key** (e.g. `noble`/`holy`/`guild`, or any admin-created class) — a free string, not a DB enum, not an FK to `PlayerClass`. Stays in lockstep with `Tech.branch` by pure string-equality convention, not a constraint — see [PlayerClass](#playerclass) and [GAME-MECHANICS.md](GAME-MECHANICS.md#class-system) |
| role               | varchar       | `ADMIN`, `MODERATOR`, `PLAYER` (first user = ADMIN; not a DB enum) |
| is_npc             | boolean       | Default false. NPC countries (created via the mod layer's `POST /mod/npc`) can't log in and are the only accounts an ADMIN/MODERATOR may "act as" — see [API.md](API.md#auth--mod-impersonation) |
| negative_money_turns | int         | Default 0. Consecutive turns money has ended negative; resets to 0 the moment money is ≥ 0. Triggers bankruptcy above `BANKRUPTCY_TRIGGER_TURNS` |
| bankruptcy_debuff_turns | int      | Default 0. Turns remaining on the post-bankruptcy penalty (-50% combat power, no goods/resource production); 0 = not debuffed |

### Province
| Column         | Type          | Notes |
|----------------|---------------|-------|
| id             | uuid (PK)     | Auto-generated |
| type           | varchar       | land, water |
| landscape      | varchar       | plains, forest, mountain, hills, swamp, desert |
| polygon        | text          | SVG path string (M, H, V, L, Z commands) |
| resource_id    | uuid (FK)     | → Resource, nullable. Entity exposes a `resourceType` getter returning `resource.key` for API/frontend compatibility |
| region_id      | varchar       | Map identifier, e.g. "prov-3-7" (no DB unique constraint) |
| user_id        | uuid (FK)     | Legal/core owner, nullable. **Unchanged by mere occupation** — see `occupier_id` |
| occupier_id    | uuid (FK)     | → User, nullable. Military controller when the province is occupied (not the legal owner); `ON DELETE SET NULL`. Null = not occupied |
| occupation_turns | int         | Default 0. Turns spent occupied; auto-cores to `occupier_id` at `OCCUPATION_CORE_THRESHOLD` (10) — see [GAME-MECHANICS.md](GAME-MECHANICS.md#diplomacy--occupation) |
| neighbor_ids   | simple-json   | Array of adjacent province IDs (nullable) |
| provinceBuildings | OneToMany  | → ProvinceBuilding (the `buildings` getter maps these) |

> Note: `enemyHere` is a transient `@Expose` field (not persisted), used to flag enemy presence in API responses.
> Note: `GET /provinces/state` (`ProvincesService.getState`) hand-builds its response via an explicit
> query-builder `.select()` rather than returning full entities — `occupier_id`/`occupation_turns` (and
> any future new column) must be added there explicitly, or they silently won't reach the client even
> though they're on the entity. `GET /provinces` (`getAll`) returns full entities and doesn't have this
> trap.

### Building
| Column                      | Type         | Notes |
|-----------------------------|--------------|-------|
| id                          | uuid (PK)    | |
| type                        | varchar      | Holds a `BuildingTypes` value: CAPITAL, FORT, BARRACKS, FARM, SAWMILL, BRICKYARD, BARN, PORT, plus the class-gated prestige buildings STUD_FARM (NOBLE)/RELIQUARY (HOLY)/SPICE_WHARF (GUILD), etc. (23 types; not a DB enum) |
| name                        | varchar      | Display name |
| description                 | varchar      | |
| income                      | int          | Money per turn (nullable). MINE uses a flat value here like every other building — see [Resource](#resource) for why |
| upkeep                      | int          | Money cost per turn (nullable) |
| modifier                    | varchar      | Numeric string for defense bonus |
| cost                        | int          | Money to construct |
| upgrade_to                  | varchar      | Target building type for upgrades (BuildingTypes value). FORESTRY → SAWMILL, GARDEN → FARM, FORT → CASTLE |
| requirement_tech            | simple-array | Tech keys required to build |
| requirement_building        | varchar      | Building type prerequisite (BuildingTypes value). SAWMILL requires FORESTRY, FARM requires GARDEN, CASTLE requires FORT |
| visible                     | boolean      | Fog-of-war gate (default false): whether non-owners can see this building type on someone else's province at all (`ProvincesService.getAll`/`getState` filter non-owned `provinceBuildings` down to `visible = true` ones, e.g. CAPITAL/FORT — most others aren't). Always fully visible to the owner, and to an ADMIN/MODERATOR with the mod no-fog toggle on — see [GAME-MECHANICS.md](GAME-MECHANICS.md#visibility-fog-of-war) |
| can_recruit                 | boolean      | Whether troops can be recruited here (exposed as `canRecruit`, default false) |
| isProduction                | boolean      | Whether this building produces a good each turn (default false) |
| production_good_id          | uuid (FK)    | → Good, nullable. The single Good this building produces per turn when `isProduction` is true. Exposed as `productionGood` getter (returns the FK id) on the player-facing API |
| production_requirement_resource | varchar   | Nullable, references `Resource.key`. Optional **input**: if set, production each turn atomically reserves (spends) `production_requirement_resource_amount` of this resource from `UserResource` — production is skipped for the turn if that reservation fails. If null, the building produces unconditionally (e.g. CAPITAL → Food) |
| production_requirement_resource_amount | int | How much of `production_requirement_resource` is consumed per turn (nullable, defaults to 1 in code) |
| production_amount           | int          | How many units of `productionGoodEntity` are credited to the owner's `UserGood` ledger per turn, once the reservation above (if any) succeeds (nullable, defaults to 1 in code — see `ProductionActionService`) |
| resource_production_amount  | int          | Nullable. Per-turn amount credited into the owner's `UserResource` stockpile — this is what MINE/FORESTRY actually do each turn now (replaced a one-time "+1 capacity at build" grant) |
| resource_production_key     | varchar      | Nullable, references `Resource.key`. Overrides which resource key `resource_production_amount` credits, instead of the province's own resource (`province.resource.key`) — e.g. PORT produces Fish while sitting on a province whose own resource is grain/wood/whatever. Null (the common case, MINE/FORESTRY/BARN) keeps crediting the province's own resource |
| buildable                   | boolean      | Whether players can construct this (default true). CAPITAL/CAPITOL = false |
| destructible                | boolean      | Whether players can demolish this (default true). CAPITAL = false |
| unique_per_province         | boolean      | Only one per province allowed (default false). MINE, BRICKYARD, FORESTRY, SAWMILL, ARMORY, BARN, FARM, FORT, CASTLE, PORT, STUD_FARM, RELIQUARY, SPICE_WHARF = true |
| requires_neighbor_water     | boolean      | Buildable only if at least one neighboring province is `type: water` (default false; checked in `BuildActionHandler` by loading the target province's neighbor rows — the only building-placement check that inspects neighbors rather than the province itself). PORT = true |
| allowed_province_resources  | simple-array | Province resource key filter (nullable), references `Resource.key`. MINE=['iron','gold','stone'], BRICKYARD=['stone'], FORESTRY/SAWMILL=['wood'], BARN/FARM=['grain']. Null = any province — includes ARMORY and the three prestige buildings (STUD_FARM/RELIQUARY/SPICE_WHARF), which process a resource from the *national* stockpile via `production_requirement_resource` rather than requiring the local deposit |
| requirement_resource        | varchar      | User resource reserved from the `UserResource` stockpile **once**, at build/upgrade time (nullable), references `Resource.key`. ARMORY='iron', FORT/CASTLE='stone' |
| requirement_resource_amount | int          | How much of that resource is reserved at build time (nullable). Usually 1 |
| requirement_good_id         | uuid (FK)    | → Good, nullable. A one-time BUILD cost paid in goods (same mechanic as `requirement_resource`, but from `UserGood`) — BARRACKS needs Weapons, SAWMILL/FORT need Bricks. Exposed as `requirementGood` getter (FK id) |
| requirement_good_amount     | int          | How much of that good is reserved at build time (nullable, defaults to 1 in code) |
| requirement_good_2_id       | uuid (FK)    | → Good, nullable. A second, independent one-time BUILD cost — same `tryReserve`-at-build/refund-on-demolish mechanic as `requirement_good_id`, added so Lumber (previously with no per-turn sink at all) could become a near-universal construction cost without displacing the existing Weapons/Bricks slot. Exposed as `requirementGood2` getter |
| requirement_good_2_amount   | int          | How much of `requirement_good_2_id` is reserved at build time (nullable) |
| supply_building              | boolean      | Default false. Whether this building acts as an army supply source (`SupplyActionService`'s BFS origin). Seeded true on CAPITAL, FORT, CASTLE — not CATHEDRAL, not PORT — see [GAME-MECHANICS.md](GAME-MECHANICS.md#supply-food) |

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
| water_turns | int           | Consecutive turns spent on a `type: water` province (default 0). Incremented per turn while on water, reset to 0 on landing, by `tickArmyWaterResidency` (scheduler). Army is deleted once it exceeds `TechEffectsService.waterTurnsAllowed()` (base 6 + any `water_turns_bonus` tech effects) |
| supply_distance | int, nullable | Distance (tiles) to the nearest reachable `supply_building`, written each turn by `SupplyActionService`'s BFS. Null = none reachable within the 16-tile search bound (pays the max supply multiplier) — see [GAME-MECHANICS.md](GAME-MECHANICS.md#supply-food) |
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
| category           | enum      | INFANTRY, RANGED, CAVALRY, SPECIAL, PEASANT (real DB enum). Load-bearing now, not decorative — drives the counter matrix, see [GAME-MECHANICS.md](GAME-MECHANICS.md#counter-matrix-composition) |
| cost_per_100       | int       | Money (or piety, for `PIETY_COST_TROOPS`) per 100 recruited |
| attack             | float     | Combat attack stat (10–1000 range as of the economy/class rework's ×10 rescale) |
| defense            | float     | Combat defense stat |
| water_combat_modifier | float  | Power multiplier applied to attack/defense while fighting on a water province (default 1.0 = no penalty; seeded e.g. Cavalry 0.2, Infantry 0.6, Ranged 0.55, Special 0.5) |
| upkeep_per_100     | int       | Money (or piety, for Paladins only) per 100 per turn |
| tech_requirement   | varchar   | Tech key required to recruit |
| building_requirement| varchar  | Building type required in province (nullable; not a DB enum) |
| required_goods     | uuid (FK) | → Good, nullable. One-time goods cost to recruit, same mechanic as Building's `requirement_good_id` but scaled per 100 troops like `cost_per_100`. Null = no goods needed (e.g. Peasants — money/pool only; Knights require Weapons; the class elite units require 50 of their own class's prestige good) |
| goods_amount       | int       | Units of `required_goods` consumed per 100 troops recruited (nullable). Not refunded on disband/removal, same as `cost_per_100` |
| required_goods_2   | uuid (FK) | → Good, nullable. A second, independent one-time recruit-goods cost, same mechanic as `required_goods` |
| goods_amount_2     | int       | Units of `required_goods_2` consumed per 100 troops recruited (nullable) |
| supply_good_id     | uuid (FK) | → Good, nullable, `ON DELETE SET NULL`. Good consumed each turn as food upkeep (Food in current seed data), same mechanic shape as `required_goods` but charged every turn, not once. Null = this troop type has no per-turn supply cost |
| supply_per_100     | int, nullable | Units of `supply_good_id` consumed per 100 troops per turn, before `SupplyActionService`'s distance multiplier — see [GAME-MECHANICS.md](GAME-MECHANICS.md#supply-food) |
| supply_good_2_id   | uuid (FK) | → Good, nullable, `ON DELETE SET NULL`. A second, independent per-turn supply good, same mechanic as `supply_good_id` — this is how the three class elite units draw their permanent trade-partner dependency (e.g. Grand Host eats Relics every turn on top of Food; see [the prestige-goods ring](GAME-MECHANICS.md#the-prestige-goods-ring-class-economy)) |
| supply_per_100_2   | int, nullable | Units of `supply_good_2_id` consumed per 100 troops per turn, before the distance multiplier |

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
> - Conquest: `OccupationService.transferProvinceResourceFootprint` moves a captured building's `requirement_resource` reservation from the losing legal owner's ledger to the winner's, called by both `applyControlResult` (occupation/claim/retake) and `coreProvince` (auto-core or peace cession). Per-turn *production* isn't transferred at the moment of conquest — it's simply derived fresh next turn from whoever then owns the building (and is skipped entirely while a province is occupied — see [GAME-MECHANICS.md](GAME-MECHANICS.md#diplomacy--occupation)).
> - **Why money income no longer reads this table:** an earlier version computed MINE's money as `quantity × resource.plain_income`. Once mines started producing an accumulating stockpile instead of a static count, that formula would make money grow every turn a stockpile went unspent — a runaway loop, not a balance knob. MINE's income is a flat `Building.income` value now, like every other building.

### Good
| Column        | Type      | Notes |
|---------------|-----------|-------|
| id            | uuid (PK) | |
| name          | varchar   | Display name. No natural `key` like Resource — seed scripts and admin dropdowns resolve/reference goods by `name` or `id` |
| type          | varchar   | `civilian` or `military` (not a DB enum) |
| price_per_one | int       | Money cost per unit |

> Seeded: Lumber, Food, Weapons, Bricks, plus the three class prestige goods — Warhorses (NOBLE),
> Relics (HOLY), Spices (GUILD) — see [the prestige-goods ring](GAME-MECHANICS.md#the-prestige-goods-ring-class-economy)
> (`api/data/goods.json`). Editable via the admin panel's Goods tab.

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

1. **Resource production** (unconditional): any building with `resource_production_amount` set credits that amount into `UserResource` — normally of `province.resource.key` (the province's own resource), or of `resource_production_key` instead when that override is set. This is what MINE and FORESTRY do (both 25/turn in the current seed data), and it's how PORT produces Fish (25/turn) while sitting on a province whose own resource is something else.
2. **Goods production**: skipped unless `isProduction` and `production_good_id` are set.
   - **Input (optional):** if `production_requirement_resource` is set, atomically reserve `production_requirement_resource_amount` of it from `UserResource` (via `tryReserve`) — this turn's production is skipped if that fails. If null, production is unconditional (CAPITAL→Food has no input).
   - **Output:** on success (or if there was no input to check), credit `production_amount` of `productionGoodEntity` to `UserGood`, scaled by the `goods_production` tech effect target (multiply — e.g. `economy.trade_efficiency` ×1.15).

Pass 1 always finishes before pass 2 starts, so a building's own resource production is available to that same building's (or another building's) goods manufacturing within the same turn, regardless of iteration order.

Seed data (`api/data/buildings.json`):
| Building | Resource produced/turn | Good produced/turn | Input consumed/turn |
|----------|------------------------|---------------------|----------------------|
| MINE (iron/gold/stone provinces) | 25 of province's resource | — | — |
| BARN (grain provinces only) | 25 grain | — | — |
| FORESTRY | 25 wood | 25 Lumber | 25 wood |
| SAWMILL (upgrade of FORESTRY, costs 25 Bricks to build) | 25 wood | 25 Lumber | 25 wood |
| BRICKYARD (stone provinces only) | — | 25 Bricks | 25 stone |
| ARMORY | — | 25 Weapons | 25 iron |
| CAPITAL | — | 25 Food | none (unconditional) |
| GARDEN | — | 35 Food | 5 grain |
| FARM (upgrade of GARDEN) | — | 50 Food | 10 grain |
| PORT | 25 Fish (`resource_production_key` override) | — | — |
| STUD_FARM (NOBLE-only) | — | 20 Warhorses | 50 grain |
| RELIQUARY (HOLY-only, requires TEMPLE) | — | 20 Relics | 20 gold |
| SPICE_WHARF (GUILD-only, requires PORT) | — | 20 Spices | 40 fish |

SAWMILL previously lost FORESTRY's `resource_production_amount` on upgrade, turning a
wood-neutral building into a net wood consumer for the same Lumber output — restored, so the
upgrade is now purely additive (better income, same wood-neutral footprint).

GARDEN/FARM's grain input is satisfiable once a BARN is built (25 grain/turn — one BARN sustains
5 GARDENs or 2.5 FARMs). CAPITAL is deliberately the smallest of the three Food producers — a
baseline trickle, not the primary food source, now that `SupplyActionService` gives Food an actual
per-turn sink (army supply upkeep — see [GAME-MECHANICS.md](GAME-MECHANICS.md#supply-food)).

### Tech
| Column        | Type          | Notes |
|---------------|---------------|-------|
| id            | uuid (PK)     | |
| key           | varchar       | Unique (e.g., economy.agriculture) |
| name          | varchar       | Display name |
| description   | text          | |
| branch        | varchar       | economy, military, or a `PlayerClass.key` (noble, holy, guild, or any admin-created class) |
| isClassRoot   | boolean       | DB column `is_class_root`, default false. True if researching selects a class |
| cost          | int           | Research points required to complete (compared against accrued `UserTechProgress.progress`) |
| prerequisites | simple-array  | Array of tech keys required first |
| effects       | json          | Nullable `TechEffect[]` — see [GAME-MECHANICS.md](GAME-MECHANICS.md#tech-tree) for the schema and interpreter |

> `branch` is a free-form string, not an FK — a class-gated branch is any value that matches a
> `PlayerClass.key` (see below); `TechsService` treats every other branch (economy, military) as
> common/always-visible.

### PlayerClass
Table name `classes`. Player classes (noble/holy/guild, plus any admin-created ones) — moved off
a hard-coded enum so admins can add classes and control their visibility without a deploy.

| Column     | Type      | Notes |
|------------|-----------|-------|
| id         | uuid (PK) | |
| key        | varchar   | Unique. The back-compat string stored on `User.class` and matched against `Tech.branch` — must be kept equal to the branch it's meant to gate, since that coupling is pure string equality (`TechsService`), not an FK |
| name       | varchar   | Display name, editable in admin panel |
| is_visible | boolean   | Default true. When false, every tech whose `branch` equals this class's `key` is dropped from `GET /techs` for **every** user (even one already assigned to that class) — see [GAME-MECHANICS.md](GAME-MECHANICS.md#class-system) |

> No relation to `User` or `Tech` — both reference it only by the `key` string, by convention.
> Editable via the admin panel's Classes tab (create/rename/toggle `is_visible`/delete); seeded
> rows (noble/holy/guild) come from `api/data/classes.json` via `npm run seed:classes`.

### UserTechProgress
| Column     | Type          | Notes |
|------------|---------------|-------|
| id         | uuid (PK)     | |
| user_id    | uuid (FK)     | → User, `ON DELETE CASCADE` |
| tech_key   | varchar       | Not an FK to `Tech.key` — the row is keyed by string |
| progress   | float         | Accumulated research points toward this tech's `cost`. Row is lazily created on first accrual and deleted on completion |

Unique on `(user_id, tech_key)`. One row per tech a user has ever put points into — not just
the currently-active one — so switching `active_research_key` away and back later resumes
from the saved value instead of losing progress.

### ActionQueue
| Column        | Type      | Notes |
|---------------|-----------|-------|
| id            | uuid (PK) | |
| userId        | uuid (FK) | Queuing player (also exposed as eager `user` relation) |
| order         | int       | Execution priority (lower = earlier) |
| actionType    | enum      | BUILD, UPGRADE, REMOVE, COLONIZE, ARMY_CREATE/MOVE/RECRUIT/MERGE/TRANSFER/DISBAND/EDIT (13 enum values incl. legacy DISBAND, RESEARCH — the latter rejected at queue time, see [API.md](API.md)) |
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

### GameSettings
Table `game_settings`. A **singleton** — the only row ever written has `id = 'global'` — rather
than a per-key row list, so each setting stays a typed column instead of an untyped value blob.
`GameSettingsService` (`api/src/settings/game-settings.service.ts`) lazily creates the row with
defaults if it's ever missing, and caches reads in-memory for 5s (single-process only, same
caveat `ExecutionLock`/`ActionExecutionStateService` already carry) since `GamePauseInterceptor`
reads it on every authenticated request.

| Column          | Type          | Notes |
|-----------------|---------------|-------|
| id              | varchar (PK)  | Always the literal `'global'` |
| is_paused       | boolean       | Default false. While true: `AuthService.login`/`refreshTokens` reject non-ADMIN/MODERATOR logins, and `GamePauseInterceptor` 403s every other authenticated PLAYER request (`code: 'GAME_PAUSED'`) — see [GAME-MECHANICS.md](GAME-MECHANICS.md#global-game-settings) |
| pause_message   | varchar, nullable | Shown on the web client's login screen and in the 403 body; a default string is used when null |
| turns_enabled   | boolean       | Default true. When false, `ActionSchedulerService.executeScheduledActions` returns before acquiring the distributed `ExecutionLock` — the cron tick becomes a no-op, independent of `is_paused` |
| map_checksum    | varchar, nullable | SHA-256 content hash of the current map's layout, recomputed and stored by `api/src/scripts/import-provinces.ts` on every province reimport (`computeMapChecksum`, `api/src/provinces/map-checksum.util.ts` — hashed from the source `provinces.json`, not post-import DB rows, since import always wipes-and-reinserts from that same file so the two never diverge). `NULL` until the first import after this column existed. See [GAME-MECHANICS.md](GAME-MECHANICS.md#map-checksum--layout-cache-invalidation) |

> Seeded by migration `1786028413989-CreateGameSettingsTable` (the single `'global'` row, all
> flags at their defaults); `map_checksum` added by a later migration,
> `1786030156280-AddMapChecksumToGameSettings`. Admin-editable via the admin panel's Settings tab
> (`GET`/`PATCH /admin/game-settings`, ADMIN role only) — though `map_checksum` itself is
> write-only from `import-provinces.ts`, not exposed as an editable form field; publicly readable
> (no auth) via `GET /game-settings` since the login screen must read pause state (and the web
> client must read the map checksum) before anyone is authenticated.

### DiplomaticRelation
One row per unordered player pair, created lazily on first non-neutral event — see
[GAME-MECHANICS.md](GAME-MECHANICS.md#diplomacy--occupation). Absence of a row means `NEUTRAL`.

| Column      | Type      | Notes |
|-------------|-----------|-------|
| id          | uuid (PK) | |
| user_a_id   | uuid (FK) | → User, `ON DELETE CASCADE`. Stored canonically sorted (`user_a_id < user_b_id`) so a pair never gets two rows |
| user_b_id   | uuid (FK) | → User, `ON DELETE CASCADE` |
| state       | varchar   | `neutral` (default) \| `war` \| `peace` \| `alliance` (not a DB enum) |
| peace_turns | int       | Default 0. Turns spent in `peace`; decays the state to `neutral` at `PEACE_DURATION_TURNS` (4) |
| has_trade   | boolean   | Default false. Set by an accepted `trade_agreement` article — no mechanical effect yet, just a signable flag |
| pass_a_to_b | boolean   | Default false. `user_a_id` has granted troops-pass to `user_b_id` |
| pass_b_to_a | boolean   | Default false. `user_b_id` has granted troops-pass to `user_a_id` |

> Unique constraint on `(user_a_id, user_b_id)`. `ALLIANCE` implies passage both ways regardless of these
> flags (`DiplomacyService.hasPassage` checks `state === 'alliance'` first).

### War
| Column              | Type      | Notes |
|---------------------|-----------|-------|
| id                  | uuid (PK) | |
| attacker_leader_id  | uuid (FK) | → User, `ON DELETE CASCADE` |
| defender_leader_id  | uuid (FK) | → User, `ON DELETE CASCADE` |
| status              | varchar   | `active` (default) \| `ended` (not a DB enum) |
| createdAt           | timestamp | |

### WarParticipant
Join entity: which side of which war each player is on.

| Column    | Type      | Notes |
|-----------|-----------|-------|
| id        | uuid (PK) | |
| war_id    | uuid (FK) | → War, `ON DELETE CASCADE` |
| user_id   | uuid (FK) | → User, `ON DELETE CASCADE` |
| side      | varchar   | `attacker` \| `defender` (not a DB enum) |
| is_leader | boolean   | Default false. Exactly one leader per side per war (the pair that started it, or was made leader by `DiplomacyService.startWar`) |

> Unique constraint on `(war_id, user_id)`.

### Treaty
Every proposed treaty, pending or resolved — accepted rows are never cleaned up, forming the permanent
treaty log surfaced in the web client's Treaties tab.

| Column        | Type      | Notes |
|---------------|-----------|-------|
| id            | uuid (PK) | |
| name          | varchar   | Player-supplied display name |
| proposer_id   | uuid (FK) | → User, `ON DELETE CASCADE` |
| receiver_id   | uuid (FK) | → User, `ON DELETE CASCADE` |
| kind          | varchar   | `peace` \| `alliance` \| `trade` \| `troops_pass` \| `article` (not a DB enum) |
| peace_scope   | varchar   | `leader` \| `separate`, nullable — only set for `kind = peace` |
| visibility    | varchar   | `private` (default) \| `public`. Public + `accepted` treaties are visible to any player via `GET /diplomacy/treaties/public/:userId` |
| recurring     | boolean   | Default false. Only meaningful for `kind = trade` — re-applies the transfer articles every turn |
| status        | varchar   | `pending` (default) \| `accepted` \| `rejected` \| `cancelled` (not a DB enum) |
| articles      | json      | Array of clause objects (see below) |
| note          | text      | Nullable. Markdown/message text; required for `kind = article` |
| pending_turns | int       | Default 0. Turns spent pending; auto-rejects at `TREATY_EXPIRY_TURNS` (4) |
| view_only     | boolean   | Default false. True for the read-only copies of a settled **leader peace** sent to non-leader allies — they can view but not accept/reject |
| createdAt     | timestamp | |
| resolved_at   | timestamp | Nullable. Set when accepted/rejected/cancelled |

> Indexes on `(receiver_id, status)` (inbox queries) and `proposer_id`.

**Article shapes** (`articles` json array; each carries `from`/`to` where relevant so a deal can be
bidirectional; amounts are unbounded — no warscore/cost limits):
- `{ type: 'cede_province', provinceId, from, to }` — legal ownership transfer via `OccupationService.coreProvince` on accept
- `{ type: 'money_tribute', amount, from, to }`
- `{ type: 'resource_tribute', resourceKey, amount, from, to }` — via `UserResourcesService`
- `{ type: 'goods_tribute', goodId, amount, from, to }` — via `UserGoodsService`
- `{ type: 'set_state', state }` — sets the `DiplomaticRelation.state` between proposer and receiver (e.g. `alliance`)
- `{ type: 'grant_pass', from, to }` — sets the directional `pass_*_to_*` flag
- `{ type: 'trade_agreement' }` — sets `has_trade = true`
- `{ type: 'text', markdown }` — pure RP text, no mechanical effect

### Notification
Durable, per-user record — unlike `ActionQueue`, rows here are never deleted by the turn scheduler, so
this is the only place a non-admin player can see why a queued action failed after the fact.

| Column      | Type      | Notes |
|-------------|-----------|-------|
| id          | uuid (PK) | |
| user_id     | uuid (FK) | → User, `ON DELETE CASCADE` |
| type        | varchar   | `action_failed` \| `system` (reserved, unused so far) \| `admin` (not a DB enum) |
| severity    | varchar   | `info` (default) \| `warning` \| `error` (not a DB enum) |
| title       | varchar   | Short headline, e.g. "Build Failed" |
| message     | text      | Body — for `action_failed`, the actual `ActionQueue.failureReason` |
| is_read     | boolean   | Default false |
| createdAt   | timestamp | |

> Index on `user_id`. Created by `NotificationsService.createForUser` (one row) or `broadcastToAll` (one
> row fanned out per registered user, mirroring `UserGoodsService.createRowsForNewGood`'s pattern).

## Seed Data

Located in `api/data/`:
- `resources.json` — Resource definitions (key, name, type, plain_income)
- `goods.json` — Good definitions (name, type, price_per_one). 7 rows: Lumber, Food, Weapons, Bricks, plus the three class prestige goods (Warhorses, Relics, Spices)
- `provinces.json` — Map geometry and metadata (generated by map-generator; `resource_type` is a resource **key** string, resolved to `resource_id` at import time)
- `buildings.json` — Building type definitions, including `production_good_name` (a Good **name** string, resolved to `production_good_id` at seed time — Good has no natural key like Resource does) and `requirement_good_2_name`/`resource_production_key` (the second one-time goods cost and the resource-key production override, added in the economy/class rework). 23 rows
- `techs.json` — Tech tree definitions. 51 rows across 5 branches (economy 14, military 13, guild/holy/noble 8 each), tiered T1=50/T2=150/T3=400/T4=800
- `troop-types.json` — Troop type stats, including `required_goods_name` (a Good **name** string, resolved to `required_goods` at seed time — same mechanic as `buildings.json`'s `production_good_name`) and the second goods/supply slots (`required_goods_2_name`, `supply_good_2_name`, added for the class elite units). 11 rows: 5 base + 3 class + 3 class-elite capstones

Import scripts in `api/src/scripts/`:
- `seed-resources.ts` — Seeds the resources table. **Must run before `import-provinces.ts`**, which looks up each province's resource key against this table and fails loudly on an unknown key
- `seed-goods.ts` — Seeds the goods table, keyed on `name` (no natural key field). **Must run before `seed-buildings.ts`**, which resolves `production_good_name` against this table and fails loudly on an unknown name
- `import-provinces.ts` — Reads provinces.json, upserts into DB
- `seed-buildings.ts` — Seeds building definitions
- `seed-techs.ts` — Seeds tech tree
- `seed-troop-types.ts` — Seeds troop types. **Must run after `seed-goods.ts`**, which it looks up `required_goods_name` against
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
