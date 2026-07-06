# API — NestJS Backend

## Stack

- **NestJS 10** on Node 20
- **TypeORM 0.3** with MySQL 8
- **Passport JWT** (httpOnly cookie-based auth)
- **@nestjs/schedule** (cron-based turn execution)
- **class-validator / class-transformer** (DTO validation)

## Entry Point

`api/src/main.ts` — Creates NestFactory app, applies:
- `cookie-parser` middleware
- Global `ValidationPipe` (whitelist + transform)
- CORS: disabled in production (nginx same-origin), enabled for `localhost:5173/5174/3000` in dev
- Listens on port **3000**

## Module Map

```
AppModule
├── AuthModule          JWT login/register/refresh/logout
├── UsersModule         Player profiles, resources, projections
├── ProvincesModule     Map tiles, ownership, buildings, setup
├── BuildingsModule     Building template definitions
├── TechsModule         Tech tree definitions + research effects
├── ArmiesModule        Army CRUD, troop types, visibility rules
├── ActionsModule       Action queue, executor, scheduler, income, upkeep
├── ResourcesModule     Resource definitions + per-user UserResource capacity ledger (drives build gating + MINE income)
├── GoodsModule         Good definitions + per-user UserGood inventory ledger — economy rework, step 3
└── AdminModule         Admin CRUD for all entities
```

## Endpoints Reference

### Auth (`/auth`)
| Method | Path          | Auth     | Description |
|--------|---------------|----------|-------------|
| POST   | /register     | Public   | Create account (login, password, country_name, color) |
| POST   | /login        | Public   | Returns httpOnly cookies (access 15m, refresh 7d) |
| POST   | /refresh      | Refresh  | Renew access token |
| POST   | /logout       | Public   | Clear cookies |
| GET    | /me           | JWT      | Current user profile |

### Users (`/users`)
| Method | Path     | Auth | Description |
|--------|----------|------|-------------|
| GET    | /        | JWT  | All users (partial: id, countryName, color) |
| GET    | /:id     | JWT  | Full state if owner (income/upkeep projections), partial if viewer |
| PATCH  | /:id     | JWT  | Update user |
| POST   | /        | JWT  | Create user |
| DELETE | /:id     | JWT  | Delete user (204 No Content) |

### Provinces (`/provinces`)
| Method | Path        | Auth | Description |
|--------|-------------|------|-------------|
| GET    | /           | JWT  | All provinces (troops hidden for non-owners unless enemy present) |
| GET    | /:id        | JWT  | Single province |
| GET    | /layout     | JWT  | Static geometry (polygon, type, landscape, resource, neighbors) |
| GET    | /state      | JWT  | Dynamic state (ownership, troops, buildings, building caps) |
| PATCH  | /:id        | JWT  | Update province |
| PATCH  | /setup/:id  | JWT  | First-province claim: sets CAPITAL, grants 3000 troops + 5000 money |

### Buildings (`/buildings`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET    | /    | JWT  | All building templates |

### Resources (`/resources`)
| Method | Path  | Auth | Description |
|--------|-------|------|-------------|
| GET    | /     | JWT  | All resource definitions (key, name, type, plainIncome) |
| GET    | /mine | JWT  | Caller's UserResource ledger rows (resource + available quantity) |

### Goods (`/goods`)
| Method | Path  | Auth | Description |
|--------|-------|------|-------------|
| GET    | /     | JWT  | All good definitions (name, type, price_per_one) |
| GET    | /mine | JWT  | Caller's UserGood inventory rows (good + quantity). No spend/trade endpoints yet |

### Techs (`/techs`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET    | /    | JWT  | Available techs (filtered by user class + completed research) |

### Armies (`/armies`)
| Method | Path         | Auth | Description |
|--------|--------------|------|-------------|
| GET    | /            | JWT  | User's armies with units |
| GET    | /all         | JWT  | All armies visible to the requesting user (fog of war: enemy armies shown with full composition only if in player-owned or neighboring province) |
| GET    | /troop-types | JWT  | Available troop types (filtered by class/tech/building) |
| POST   | /            | JWT  | Queue ARMY_CREATE action |
| PATCH  | /:id         | JWT  | Rename army |
| DELETE | /:id         | JWT  | Queue ARMY_DISBAND action |

### Actions (`/actions`)
| Method | Path              | Auth  | Description |
|--------|-------------------|-------|-------------|
| POST   | /                 | JWT   | Queue action (BUILD, UPGRADE, RESEARCH, ARMY_MOVE, COLONIZE, etc.) |
| GET    | /                 | JWT   | User's actions (all statuses) |
| GET    | /pending          | JWT   | User's pending actions only |
| DELETE | /pending/:id      | JWT   | Retract pending action |
| GET    | /execution-stream | Public| SSE stream: `{ processing: boolean }` |
| GET    | /logs             | Admin | All execution logs (paginated) |
| GET    | /logs/my-actions  | Admin | Logs filtered by user |
| GET    | /logs/timetable/:t| Admin | Logs from specific timetable |
| GET    | /logs/:id         | Admin | Single log detail |

### Admin (`/admin`)
| Method | Path           | Auth  | Description |
|--------|----------------|-------|-------------|
| GET    | /users         | Admin | List all users |
| POST   | /users         | Admin | Create user |
| PATCH  | /users/:id     | Admin | Update user |
| DELETE | /users/:id     | Admin | Delete user |
| GET    | /buildings     | Admin | List buildings |
| POST   | /buildings     | Admin | Create building |
| PATCH  | /buildings/:id | Admin | Update building |
| DELETE | /buildings/:id | Admin | Delete building |
| GET    | /armies        | Admin | List armies |
| POST   | /armies        | Admin | Create army |
| PATCH  | /armies/:id    | Admin | Update army |
| DELETE | /armies/:id    | Admin | Delete army |
| GET    | /techs         | Admin | List techs |
| POST   | /techs         | Admin | Create tech |
| PATCH  | /techs/:id     | Admin | Update tech |
| DELETE | /techs/:id     | Admin | Delete tech |
| GET    | /troop-types     | Admin | List troop types |
| POST   | /troop-types     | Admin | Create troop type |
| PATCH  | /troop-types/:id | Admin | Update troop type |
| DELETE | /troop-types/:id | Admin | Delete troop type |
| GET    | /resources     | Admin | List resources |
| POST   | /resources     | Admin | Create resource |
| PATCH  | /resources/:id | Admin | Update resource |
| DELETE | /resources/:id | Admin | Delete resource |
| GET    | /goods         | Admin | List goods |
| POST   | /goods         | Admin | Create good |
| PATCH  | /goods/:id     | Admin | Update good |
| DELETE | /goods/:id     | Admin | Delete good |

## Action Types (Enum)

`actionData` uses **snake_case** keys. Shapes below are validated at queue time
by `ActionsService.validateActionPayload` (see Key Services).

| Action            | actionData fields                                          |
|-------------------|-----------------------------------------------------------|
| BUILD             | province_id, building_id                                   |
| UPGRADE           | province_id, province_building_id                          |
| REMOVE            | province_id, province_building_id                          |
| RESEARCH          | tech_key                                                   |
| COLONIZE          | province_id (land-province check enforced by executor, not at queue time) |
| ARMY_CREATE       | province_id, name?, units: [{ troop_type_key, count }]     |
| ARMY_MOVE         | army_id, to_province_id (one move per army per turn)      |
| ARMY_RECRUIT      | army_id, units: [{ troop_type_key, count }]               |
| ARMY_MERGE        | source_army_id, target_army_id (must differ)             |
| ARMY_DISBAND      | army_id                                                    |
| ARMY_EDIT         | army_id, troop_type_key, count                             |

**Legacy/unused enum values:** `TRANSFER_TROOPS` (stub handler, nothing queues it)
and `DISBAND` (no handler). `INVADE` and `DEPLOY` were removed. Troop counts must
be integers in `[1, 1_000_000]`.

## Key Services

### ActionsService (queue-time validation)
- `createAction` validates payload shape per action type, enforces a per-user
  cap (`MAX_PENDING_ACTIONS_PER_USER = 200` pending), and rejects duplicates
  (one ARMY_MOVE per army, one RESEARCH per tech_key). The executor re-checks
  everything at turn time — queue validation is just fast feedback.
- `POST /actions` body is validated by `CreateActionDto` (`@IsEnum(ActionType)`),
  so unknown action types are rejected with 400.
- All action creation funnels through here, including ARMY_CREATE / ARMY_DISBAND
  raised via the `/armies` endpoints (`ArmiesService` delegates to it).

### ActionSchedulerService
- Production: two separate crons, `0 13 * * *` and `0 20 * * *` (Europe/Kyiv) — i.e. 13:00 and 20:00
- Dev: two fast crons, every 2 minutes (`*/2 * * * *`) and every 5 minutes (`*/5 * * * *`), both gated by `isFastDevCronEnabled()` (disabled if `DISABLE_FAST_ACTION_CRON=true` or `NODE_ENV=production`)
- Acquires distributed `ExecutionLock` before processing
- Phases: income → production → upkeep → action execution → cleanup (mark actions completed/failed) → post-processing integrity checks
- Post-processing (disband weak armies, resolve multi-faction combat, sync
  province ownership) each runs in its own transaction. Multi-faction combat
  engages attackers in a deterministic order (strongest attack power first).

### ActionExecutionBlockMiddleware
- Returns **503** during turn execution on all routes except an exact-match whitelist of five paths: `/actions/execution-stream`, `/auth/login`, `/auth/register`, `/auth/refresh`, `/auth/logout` (note: `/auth/me` is **not** whitelisted and is blocked during processing)
- Toggle: `DISABLE_ACTION_EXECUTION_GATE=true` for local debugging

### ActionExecutionStateService
- RxJS `BehaviorSubject` tracks processing state
- SSE endpoint streams state changes to clients
- **Single-process only** — needs Redis for horizontal scaling

### UserGoodsService
- Keeps `UserGood` fully populated: one row per (user, good) pair, always.
- `createRowsForNewGood(good)` — called from `AdminService.createGood` — inserts a zero-quantity row for every existing user.
- `createRowsForNewUser(user)` — called from `UsersService.create` (registration) and `AdminService.createUser` — inserts a zero-quantity row for every existing good.
- `adjustQuantity(manager, userId, goodId, delta)` — unconditional grant/release, clamped at 0. Keyed by `goodId` (not a key string — `Good` has no natural key like `Resource` does). Called from `ProductionActionService` to credit turn production. No spend/trade logic yet.

### ProductionActionService
- Runs once per scheduled queue tick, right after `IncomeActionService` and before `UpkeepActionService`.
- For every building a user owns where `isProduction && production_good_id && production_requirement_resource`: if `UserResourcesService.getQuantitiesForUsers` shows the user's quantity for `production_requirement_resource` is > 0 (a **gate**, not a spend — never decremented), credits `production_amount` (default 1) of `productionGoodEntity` into `UserGood` via `UserGoodsService.adjustQuantity`.
- Resource quantities for all users are batched in one query up front (`getQuantitiesForUsers`) rather than queried per building.

### UserResourcesService
- Maintains the `UserResource` capacity ledger — see [DATABASE.md](DATABASE.md#userresource) for the full column/semantics writeup.
- `adjustQuantity(manager, userId, resourceKey, delta)` — unconditional grant/release, clamped at 0.
- `tryReserve(manager, userId, resourceKey, amount)` — atomic conditional decrement (locks the row; used at BUILD/UPGRADE time to consume `requirement_resource`).
- `sumIncomeForUsers`/`sumIncomeForUser` — `quantity × plain_income` per user, consumed by `IncomeActionService` and `UsersService.findOne`'s projection.
- `getQuantitiesForUsers(manager, userIds)` — bulk read-only quantities (userId → resourceKey → quantity), no row lock. Used by `ProductionActionService` for the production gate check.
- `createRowsForNewResource`/`createRowsForNewUser` — same fan-out pattern as `UserGoodsService`.
- All mutating methods take an explicit `EntityManager` so they participate in the same transaction as the BUILD/REMOVE/UPGRADE action handler or turn-phase service calling them; `defaultManager` is used by non-transactional callers (e.g. the `/resources/mine` read, `UsersService`'s projection).
- Called from `action-executor.service.ts` (Build/Remove/UpgradeActionHandler) and `action-scheduler.service.ts` (`transferProvinceResourceFootprint`, invoked on conquest from both `resolveArmyConflicts` and `syncProvinceOwnershipWithArmies`).

## File Structure

```
api/src/
├── main.ts
├── app.module.ts
├── auth/           controllers, services, strategies, guards, decorators
├── users/          controller, service, entity, request DTOs
├── provinces/      controller, service, entity, request DTOs
├── buildings/      controller, service, entity, types
├── techs/          controller, service, entity, research-effects.ts
├── armies/         controller, service, entities (army, army-unit, troop-type)
├── actions/        controller, service, executor (12 handlers), scheduler,
│                   combat-calculator, income, upkeep, state-loader, middleware
├── resources/      controller, service (Resource), user-resources.service (UserResource ledger),
│                   entities (resource, user-resource), types (plain/consumable)
├── goods/          controller, service (Good), user-goods.service (UserGood ledger),
│                   entities (good, user-good)
├── admin/          controller, service
├── db/             data-source.ts, data-source.prod.ts, migrations/
├── utils/          logger.ts, parseIncome.ts
└── scripts/        seed-resources, seed-goods, import-provinces, seed-buildings, seed-techs,
                    seed-troop-types, balance-report, reset-game-data

api/data/           resources.json, goods.json, provinces.json, buildings.json, techs.json, troop-types.json
                    (sibling of src/, NOT api/src/data/)
```

## npm Scripts

| Script             | Purpose                                          |
|--------------------|--------------------------------------------------|
| `start:dev`        | Dev server with --watch                          |
| `build`            | Compile TypeScript                               |
| `migration:run`    | Run pending migrations                           |
| `migration:fresh`  | Drop schema + re-run all migrations              |
| `seed:resources`   | Seed resource definitions (run before `import:provinces`) |
| `seed:goods`       | Seed good definitions (run before `seed:buildings`) |
| `import:provinces` | Import provinces.json into DB                    |
| `seed:buildings`   | Seed building definitions (resolves `production_good_name` — run after `seed:goods`) |
| `seed:techs`       | Seed tech tree                                   |
| `seed:troop-types` | Seed troop type definitions                      |
| `balance:report`   | Generate combat balance analysis                 |
| `reset:game`       | Reset game data (`reset:game:prod` for prod)     |

## None
- For creating migrations use `typeorm -- migration:create` command, don’t create migrations manually.