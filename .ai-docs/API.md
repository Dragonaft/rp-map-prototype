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
- Phases: income → upkeep → action execution → cleanup (mark actions completed/failed) → post-processing integrity checks
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
├── admin/          controller, service
├── db/             data-source.ts, data-source.prod.ts, migrations/
├── utils/          logger.ts, parseIncome.ts
└── scripts/        import-provinces, seed-buildings, seed-techs, seed-troop-types, balance-report, reset-game-data

api/data/           provinces.json, buildings.json, techs.json, troop-types.json
                    (sibling of src/, NOT api/src/data/)
```

## npm Scripts

| Script             | Purpose                                          |
|--------------------|--------------------------------------------------|
| `start:dev`        | Dev server with --watch                          |
| `build`            | Compile TypeScript                               |
| `migration:run`    | Run pending migrations                           |
| `migration:fresh`  | Drop schema + re-run all migrations              |
| `import:provinces` | Import provinces.json into DB                    |
| `seed:buildings`   | Seed building definitions                        |
| `seed:techs`       | Seed tech tree                                   |
| `seed:troop-types` | Seed troop type definitions                      |
| `balance:report`   | Generate combat balance analysis                 |
| `reset:game`       | Reset game data (`reset:game:prod` for prod)     |
