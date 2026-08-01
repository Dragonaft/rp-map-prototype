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
├── TechsModule         Tech tree definitions + data-driven effects engine + per-user research progress
├── ArmiesModule        Army CRUD, troop types, visibility rules
├── ActionsModule       Action queue, executor, scheduler, income, upkeep
├── ResourcesModule     Resource definitions + per-user UserResource capacity ledger (drives build gating + MINE income)
├── GoodsModule         Good definitions + per-user UserGood inventory ledger — economy rework, step 3
├── DiplomacyModule     Diplomatic states, wars, treaties, province occupation
├── NotificationsModule Per-user durable notifications (action failures, admin broadcasts)
├── ClassesModule       Player class definitions (`classes` table) + visibility gating for TechsModule
├── ModModule           ADMIN/MODERATOR "god-mode" tools (spawn NPCs/armies/buildings, edit stocks) + act-as impersonation
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
| GET    | /           | JWT  | All provinces (troops hidden for non-owners unless enemy present; non-owned buildings filtered to `Building.visible` unless an ADMIN/MODERATOR has the mod no-fog toggle on — see [Auth — Mod No-Fog-of-War Toggle](#auth--mod-no-fog-of-war-toggle)) |
| GET    | /:id        | JWT  | Single province |
| GET    | /layout     | JWT  | Static geometry (polygon, type, landscape, resource, neighbors) |
| GET    | /state      | JWT  | Dynamic state (ownership, troops, buildings, building caps) — same fog-of-war/mod-bypass rules as above; the endpoint the web client actually uses |
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
| Method | Path     | Auth | Description |
|--------|----------|------|-------------|
| GET    | /        | JWT  | Available techs (filtered by user class + completed research + `PlayerClass.is_visible`), each annotated with the caller's saved `progress` (0 if never started) toward `cost` |
| POST   | /select  | JWT  | `{tech_key}` — sets `active_research_key` **immediately** (not queued/turn-delayed like other actions — see [GAME-MECHANICS.md](GAME-MECHANICS.md#tech-tree)); re-validates prerequisites/class/visibility same as the old RESEARCH action |

### Diplomacy (`/diplomacy`)
Real-time REST, **not** queued actions — treaty offers must persist across turns awaiting a reply, and the
existing 503 turn-gate already prevents races with turn execution. See
[GAME-MECHANICS.md](GAME-MECHANICS.md#diplomacy--occupation) for the full state/treaty/occupation model.

| Method | Path                          | Auth | Description |
|--------|-------------------------------|------|-------------|
| GET    | /relations                    | JWT  | Caller's diplomatic state with every other player (missing row ⇒ `neutral`) |
| GET    | /wars                         | JWT  | Wars the caller participates in (with side/leader info) |
| GET    | /treaties                     | JWT  | Caller's treaties: pending in/out + accepted/rejected log |
| GET    | /treaties/public/:userId      | JWT  | Another player's `public`, `accepted` treaties |
| POST   | /declare-war                  | JWT  | `{targetUserId}` — instant; rejected if allied or already at peace/war |
| POST   | /send-money                   | JWT  | `{targetUserId, amount}` — direct gift, no connectivity/treaty required; rejected if the pair is at `WAR` |
| POST   | /treaties                     | JWT  | `{name, receiverId, kind, peaceScope?, visibility, recurring?, articles, note?}` — propose (pending) |
| POST   | /treaties/:id/accept          | JWT  | Receiver accepts; re-validates and applies all articles atomically |
| POST   | /treaties/:id/reject          | JWT  | Receiver rejects a pending proposal |
| DELETE | /treaties/:id                 | JWT  | Proposer cancels their own pending proposal |
| POST   | /treaties/:id/cancel-signed   | JWT  | Either signatory cancels an accepted `alliance`/`troops_pass` treaty |

### Notifications (`/notifications`)
Durable, per-user notifications — the only place a non-admin player can ever see *why* a queued action
failed, since `ActionQueue` rows (including `failureReason`) are deleted by the scheduler's same-turn
cleanup before the client's next fetch.

| Method | Path              | Auth | Description |
|--------|-------------------|------|-------------|
| GET    | /                 | JWT  | Caller's notifications, newest first (max 200) |
| POST   | /mark-read        | JWT  | `{type?}` — marks caller's notifications read, optionally scoped to one `type` |

Three `type` values: `action_failed` (auto-created by the scheduler on any action failure — see
`ActionSchedulerService.notifyActionFailed`), `system` (reserved, unused so far), `admin` (created via
the admin broadcast endpoint below). The web client splits the feed by type: `action_failed`/`system` →
Notifications Center's "System Logs" tab, `admin` → "News" tab.

### Armies (`/armies`)
| Method | Path         | Auth | Description |
|--------|--------------|------|-------------|
| GET    | /            | JWT  | User's armies with units |
| GET    | /all         | JWT  | All armies visible to the requesting user (fog of war: enemy armies shown with full composition only if in player-owned or neighboring province; unfiltered for an ADMIN/MODERATOR with the mod no-fog toggle on — see [Auth — Mod No-Fog-of-War Toggle](#auth--mod-no-fog-of-war-toggle)) |
| GET    | /troop-types | JWT  | Available troop types (filtered by class/tech/building) |
| POST   | /            | JWT  | Queue ARMY_CREATE action |
| PATCH  | /:id         | JWT  | Rename army |
| DELETE | /:id         | JWT  | Queue ARMY_DISBAND action |

### Actions (`/actions`)
| Method | Path              | Auth  | Description |
|--------|-------------------|-------|-------------|
| POST   | /                 | JWT   | Queue action (BUILD, UPGRADE, ARMY_MOVE, COLONIZE, etc. — not RESEARCH, see Techs) |
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
| GET    | /classes       | Admin | List player classes (full list, including hidden) |
| POST   | /classes       | Admin | Create class (`{key, name, is_visible?}`) |
| PATCH  | /classes/:id   | Admin | Update class (rename, toggle `is_visible`) |
| DELETE | /classes/:id   | Admin | Delete class (does not touch existing `User.class`/`Tech.branch` string values) |
| GET    | /diplomacy-relations     | Admin | List diplomatic relations |
| POST   | /diplomacy-relations     | Admin | Create diplomatic relation |
| PATCH  | /diplomacy-relations/:id | Admin | Update diplomatic relation |
| DELETE | /diplomacy-relations/:id | Admin | Delete diplomatic relation |
| GET    | /wars          | Admin | List wars (with participants) |
| POST   | /wars          | Admin | Create war |
| PATCH  | /wars/:id      | Admin | Update war |
| DELETE | /wars/:id      | Admin | Delete war |
| POST   | /notifications/broadcast | Admin | `{title, message, severity?}` — fans one `Notification` row out to every registered user (admin-panel's Notifications tab) |

> No admin-panel UI tab exists for diplomacy-relations/wars yet — only the REST endpoints (for direct inspection/editing).

### Mod (`/mod`)
ADMIN/MODERATOR-only "god-mode" tools for running NPC countries and seeding test state, gated
by the controller-level `@Roles(ADMIN, MODERATOR)` guard (`mod.controller.ts`). Distinct from
`/admin/*`: these act on **game entities** (armies, buildings, stocks) using the same executor
paths a player would, not raw CRUD.

| Method | Path                   | Auth        | Description |
|--------|------------------------|-------------|-------------|
| POST   | /npc                   | ADMIN/MOD   | `{login, country_name, color, money?, troops?, piety?}` — creates a `User` with `is_npc = true` (can't log in) |
| GET    | /npcs                  | ADMIN/MOD   | List NPC users |
| PATCH  | /province/:id/owner    | ADMIN/MOD   | `{userId}` — force-sets a province's legal owner directly |
| POST   | /army                  | ADMIN/MOD   | `{userId, provinceId, name?, units}` — spawns an army instantly (no queue/turn wait) |
| POST   | /building               | ADMIN/MOD   | `{provinceId, buildingId}` — places a building instantly |
| DELETE | /building/:id          | ADMIN/MOD   | Removes a built `ProvinceBuilding` instance instantly |
| PATCH  | /user/:id/stocks       | ADMIN/MOD   | `{money?, troops?, piety?, goods?, resources?}` — directly sets a user's stockpiles |

### Auth — Mod Impersonation
`ActAsInterceptor` (`api/src/auth/interceptors/act-as.interceptor.ts`), registered globally as
an `APP_INTERCEPTOR` in `AuthModule`, lets an ADMIN/MODERATOR "play" an NPC through the normal
player API surface: if the request carries an `X-Act-As-User: <npcId>` header, and the real
caller is ADMIN/MODERATOR, and the target user has `is_npc = true`, `req.user` is swapped to
the NPC (id + role) for the rest of that request — every existing `req.user.id` call site
(actions, armies, techs, etc.) then runs exactly as if the NPC itself had submitted it. The real
actor is preserved on `req.realUser`. Live-player impersonation is never allowed (only
`is_npc = true` targets); guards run before interceptors, so anything RBAC-gated (e.g.
`/admin/*`) still evaluates against the real actor's role first — the swap only ever narrows
permissions, never escalates them. The web client sets this header from `mod.actingAsUserId`
(Redux `modSlice`, persisted in `localStorage`) on every request except `/auth/*` — see
[WEB-MAP.md](WEB-MAP.md#mod--npc-impersonation-state). **Gotcha:** that header is derived from
`localStorage`, not the auth session, so logging out must explicitly clear it (`setActingAsUserId(null)`)
or the next account to log in on the same browser inherits a stale act-as target and gets a 403
from this interceptor on every request.

### Auth — Mod No-Fog-of-War Toggle
`resolveModFogBypass(req)` (`api/src/utils/mod-visibility.ts`) is a plain helper — not an
interceptor — called explicitly from `ArmiesController.getAllArmies` and
`ProvincesController.getAll`/`getState`. It returns `true` only when the request carries
`X-Mod-Full-Visibility: true` **and** the real authenticated actor (`req.realUser ?? req.user`,
same "prefer realUser" logic as `ActAsInterceptor`'s swap, so it still works correctly mid
act-as impersonation) is ADMIN/MODERATOR; a PLAYER sending the header is silently ignored
(no exception — this only relaxes what data is returned, not what actions can be taken). The
resulting `bypassFog` boolean is threaded into `ArmiesService.getAllArmies` (every army
included regardless of province visibility) and `ProvincesService.getAll`/`getState` (every
non-owned province's buildings included regardless of `Building.visible`) — see
[GAME-MECHANICS.md](GAME-MECHANICS.md#visibility-fog-of-war). The web client attaches the header from `mod.switchOn` — see
[WEB-MAP.md](WEB-MAP.md#mod--npc-impersonation-state).

## Action Types (Enum)

`actionData` uses **snake_case** keys. Shapes below are validated at queue time
by `ActionsService.validateActionPayload` (see Key Services).

| Action            | actionData fields                                          |
|-------------------|-----------------------------------------------------------|
| BUILD             | province_id, building_id                                   |
| UPGRADE           | province_id, province_building_id                          |
| REMOVE            | province_id, province_building_id                          |
| COLONIZE          | province_id (land-province check enforced by executor, not at queue time) |
| ARMY_CREATE       | province_id, name?, units: [{ troop_type_key, count }]     |
| ARMY_MOVE         | army_id, to_province_id (diplomacy-gated — see [GAME-MECHANICS.md](GAME-MECHANICS.md#diplomacy--occupation)) |
| ARMY_RECRUIT      | army_id, units: [{ troop_type_key, count }]               |
| ARMY_MERGE        | source_army_id, target_army_id (must differ) — dissolves source into target |
| ARMY_TRANSFER     | army_a_id, army_b_id, transfers: [{ troop_type_key, from_army_id, to_army_id, count }] — rebalance, both armies survive |
| ARMY_DISBAND      | army_id                                                    |
| ARMY_EDIT         | army_id, troop_type_key, count                             |

`ARMY_MOVE`/`ARMY_MERGE`/`ARMY_TRANSFER` mutually lock the armies they reference — an army may
have at most one of the three pending at a time (see
[GAME-MECHANICS.md](GAME-MECHANICS.md#movement)).

**Legacy/unused enum values:** `DISBAND` (no handler) and `RESEARCH` (explicitly rejected by
`ActionsService.createAction` — tech selection is `POST /techs/select` now, since research can't
afford to wait a turn just for the selection itself to take effect). `INVADE`, `DEPLOY`, and
`TRANSFER_TROOPS` were removed outright (the latter was a dead stub with nothing ever queuing
it — not to be confused with the current `ARMY_TRANSFER`, an unrelated, fully-implemented
action). Troop counts must be integers in `[1, 1_000_000]`.

## Key Services

### ActionsService (queue-time validation)
- `createAction` rejects `RESEARCH` outright (400 — use `POST /techs/select`), validates
  payload shape per action type, enforces a per-user cap (`MAX_PENDING_ACTIONS_PER_USER = 200`
  pending), and rejects duplicates via `assertNotDuplicate`: every army id referenced by a
  pending `ARMY_MOVE`/`ARMY_MERGE`/`ARMY_TRANSFER` is locked, so an army can have at most one of
  the three queued at a time (queuing any of them for an already-locked army 400s). The executor
  re-checks everything at turn time — queue validation is just fast feedback.
- `POST /actions` body is validated by `CreateActionDto` (`@IsEnum(ActionType)`),
  so unknown action types are rejected with 400.
- All action creation funnels through here, including ARMY_CREATE / ARMY_DISBAND
  raised via the `/armies` endpoints (`ArmiesService` delegates to it).

### ActionSchedulerService
- Production: two separate crons, `0 13 * * *` and `0 20 * * *` (Europe/Kyiv) — i.e. 13:00 and 20:00
- Dev: two fast crons, every 2 minutes (`*/2 * * * *`) and every 5 minutes (`*/5 * * * *`), both gated by `isFastDevCronEnabled()` (disabled if `DISABLE_FAST_ACTION_CRON=true` or `NODE_ENV=production`)
- Acquires distributed `ExecutionLock` before processing
- Phases: income → production → upkeep → recurring-trade settlement → action
  execution → cleanup (mark actions completed/failed) → post-processing
  integrity checks → diplomacy tick
- Every action failure (either handler returning `{success:false}` or a thrown exception) calls
  `notifyActionFailed`, creating an `action_failed` `Notification` via `NotificationsService` — this is
  the only durable, player-visible record of *why* an action failed, since cleanup (next bullet) deletes
  the `ActionQueue` row (including its `failureReason`) before the client's next poll ever sees it
- Post-processing (disband weak armies, resolve multi-faction combat, sync
  province control) each runs in its own transaction. Multi-faction combat
  only engages **hostile** attacker groups (allies/troops-pass grantees
  co-locate peacefully) and calls `OccupationService.applyControlResult`
  instead of writing `province.user_id` directly — see
  [GAME-MECHANICS.md](GAME-MECHANICS.md#diplomacy--occupation). Attackers
  engage in a deterministic order (strongest attack power first).
- Diplomacy tick (`tickOccupations`, `DiplomacyService.tickPeaceDecay`,
  `TreatyService.tickPendingExpiry`): ages every occupied province by one
  turn (auto-cores at `OCCUPATION_CORE_THRESHOLD`), decays `PEACE` relations
  to `NEUTRAL` after `PEACE_DURATION_TURNS`, and auto-rejects pending treaty
  proposals older than `TREATY_EXPIRY_TURNS`.

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
- `adjustQuantity(manager, userId, goodId, delta)` — unconditional grant/release, clamped at 0. Keyed by `goodId` (not a key string — `Good` has no natural key like `Resource` does). Used to credit turn production and to release a `requirement_good` reservation on demolish/upgrade.
- `tryReserve(manager, userId, goodId, amount)` — atomic conditional decrement (locks the row). Used at BUILD/UPGRADE time to consume `requirement_good` (e.g. BARRACKS' 25 Weapons, SAWMILL's 25 Bricks). No spend/trade logic beyond BUILD costs yet.

### ProductionActionService
- Runs once per scheduled queue tick, right after `IncomeActionService` and before `UpkeepActionService`. Two passes over every building each user owns:
  1. **Resource production** — any building with `resource_production_amount` set (MINE, FORESTRY, BARN) unconditionally credits that amount of `province.resource.key` into `UserResource` via `adjustQuantity`.
  2. **Goods production** — for buildings with `isProduction && production_good_id` set: if `production_requirement_resource` is also set, atomically `tryReserve` (spend) `production_requirement_resource_amount` of it from `UserResource` — skip this building for the turn if that fails. Otherwise (or on success), credit `production_amount` of `productionGoodEntity` into `UserGood` via `UserGoodsService.adjustQuantity`.
- Pass 1 always completes before pass 2 starts, so this turn's mined resources are available to this turn's manufacturing regardless of building iteration order.

### UserResourcesService
- Maintains the `UserResource` manufacturing stockpile — see [DATABASE.md](DATABASE.md#userresource) for the full column/semantics writeup and why money income no longer reads it.
- `adjustQuantity(manager, userId, resourceKey, delta)` — unconditional grant/release, clamped at 0. Used for per-turn MINE/FORESTRY production credit and for releasing a `requirement_resource` reservation on demolish/upgrade.
- `tryReserve(manager, userId, resourceKey, amount)` — atomic conditional decrement (locks the row). Used at BUILD/UPGRADE time to consume `requirement_resource`, and per-turn in `ProductionActionService` to consume `production_requirement_resource_amount`.
- `createRowsForNewResource`/`createRowsForNewUser` — same fan-out pattern as `UserGoodsService`.
- All mutating methods take an explicit `EntityManager` so they participate in the same transaction as the BUILD/REMOVE/UPGRADE action handler or turn-phase service calling them.
- Called from `action-executor.service.ts` (Build/Remove/UpgradeActionHandler, plus the new `requirement_good` checks via `UserGoodsService`) and `OccupationService.transferProvinceResourceFootprint` (invoked by both `applyControlResult` and `coreProvince` on every legal-ownership change — transfers `requirement_resource`/`requirement_good` reservations only; per-turn production isn't transferred, it's derived fresh from whoever owns the building next turn).

### ClassesService
- `findAll()`/`findAllVisible()` — full vs. `is_visible = true` only (admin CRUD vs. potential
  player-facing use; no player-facing controller exists today since `GET /techs` is what
  actually gates player visibility, not a `/classes` endpoint).
- `getClassKeys()` — every `PlayerClass.key` as a `Set<string>`; replaces the old hard-coded
  `CLASS_BRANCHES` set in `TechsService` — a branch is "class-gated" iff its string is in this set.
- `getHiddenKeys()` — keys where `is_visible = false`; consumed by `TechsService` to drop those
  branches' techs from `GET /techs` and to reject them in `POST /techs/select`.
- Injected into `TechsModule` (exported by `ClassesModule`); no relation table — everything
  downstream (`User.class`, `Tech.branch`, `CLASS_RESTRICTED_TROOPS` in `armies.service.ts`/
  `action-executor.service.ts`) matches by the `key` string, not a foreign key. See
  [DATABASE.md](DATABASE.md#playerclass).

### DiplomacyService
- Relation/war/passage/trade-connectivity logic. Key methods: `getState`/`isHostile` (hostile = `neutral|war`), `hasPassage(mover, owner)` (alliance OR a granted `troops_pass`), `startWar`/`ensureWarBetween`/`callAllies` (call-to-arms: an attacked player's allies join their side against the aggressor; an ally that was *also* allied to the aggressor breaks that alliance first), `leaveWar`/`endWar`, `evacuateForeignArmies` (teleports non-hostile foreign armies to their owner's nearest fort/capital-tier province, else nearest owned province, else leaves them in place — used when a troops-pass/alliance is cancelled), `tradeConnected` (BFS over the player-border graph; intermediates must have granted passage to one of the two traders), `tickPeaceDecay`.
- All mutating methods take an explicit `EntityManager`, same convention as `UserResourcesService`/`UserGoodsService`.

### OccupationService
- `applyControlResult(manager, province, winnerId)` — the single place that decides claim / retake / occupy whenever a player wins military control of a province (empty land → direct claim; own core, occupied → retake; someone else's core → occupy + `ensureWarBetween`). Called from `ArmyMoveHandler` (uncontested move + attacker-wins) and from the scheduler's `resolveArmyConflicts`/`syncProvinceOwnershipWithArmies`.
- `coreProvince(manager, province, newOwnerId)` — legal ownership transfer (10-turn auto-core tick, or a peace treaty's `cede_province` article); calls `transferProvinceResourceFootprint`.
- `clearOccupation` — returns a province to its owner without an ownership change (peace non-cession, friendly retake).

### TreatyService
- `proposeTreaty`/`acceptTreaty`/`rejectTreaty`/`cancelPendingProposal`/`cancelSignedTreaty`/`declareWar`/`sendMoney` — see [GAME-MECHANICS.md](GAME-MECHANICS.md#diplomacy--occupation) for the full treaty-kind/validation matrix.
- `processRecurringTrades` (called each turn from the economy transaction) and `tickPendingExpiry` (called from the diplomacy tick) are the two turn-driven entry points; everything else is invoked directly from `DiplomacyController`.

### NotificationsService
- `createForUser(userId, type, title, message, severity)` — single-row insert. Called by `ActionSchedulerService.notifyActionFailed` (`type: action_failed`, `severity: error`) on every action failure.
- `broadcastToAll(title, message, severity)` — fans one row out to every registered user, same one-row-per-user pattern as `UserGoodsService.createRowsForNewGood`. Called from `AdminService.broadcastNotification` (`POST /admin/notifications/broadcast`, `type: admin`).
- `getMine(userId)` — newest-first, capped at 200 rows. `markAllRead(userId, type?)` — marks read, optionally scoped to one `type` so marking "System Logs" seen doesn't also clear an unread "News" broadcast.
- `type` values: `action_failed`, `system` (reserved, unused so far), `admin`. Not a DB enum — plain `varchar`, matching this codebase's usual convention for kind-like fields.

## File Structure

```
api/src/
├── main.ts
├── app.module.ts
├── auth/           controllers, services, strategies, guards, decorators
├── users/          controller, service, entity, request DTOs
├── provinces/      controller, service, entity, request DTOs
├── buildings/      controller, service, entity, types
├── techs/          controller, service, entity, tech-effects.service.ts, effect-types.ts,
│                   user-tech-progress.service.ts, entities (tech, user-tech-progress), dto/
├── armies/         controller, service, entities (army, army-unit, troop-type)
├── actions/        controller, service, executor (11 handlers), scheduler,
│                   combat-calculator, income, upkeep, state-loader, middleware
├── resources/      controller, service (Resource), user-resources.service (UserResource ledger),
│                   entities (resource, user-resource), types (plain/consumable)
├── goods/          controller, service (Good), user-goods.service (UserGood ledger),
│                   entities (good, user-good)
├── diplomacy/      controller, diplomacy.service (relations/wars/passage), occupation.service
│                   (province control), treaty.service (propose/accept/peace/trade),
│                   entities (diplomatic-relation, war, war-participant, treaty), dto/, types/
├── notifications/  controller, service, entity (notification) — per-user durable notifications
├── admin/          controller, service
├── db/             data-source.ts, data-source.prod.ts, migrations/
├── utils/          logger.ts, parseIncome.ts, colorDistance.ts, mod-visibility.ts (resolveModFogBypass)
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
| `seed:goods`       | Seed good definitions (run before `seed:buildings` and `seed:troop-types`) |
| `import:provinces` | Import provinces.json into DB                    |
| `seed:buildings`   | Seed building definitions (resolves `production_good_name` — run after `seed:goods`) |
| `seed:techs`       | Seed tech tree                                   |
| `seed:troop-types` | Seed troop type definitions (resolves `required_goods_name` — run after `seed:goods`) |
| `balance:report`   | Generate combat balance analysis                 |
| `reset:game`       | Reset game data                                  |

> All scripts above (except `migration:generate`/`migration:create`, which are dev-only tooling) route through `api/scripts/run-env.js`, which reads `NODE_ENV` and picks `ts-node` against `src/` (dev) or plain `node` against compiled `dist/` (prod) — no separate `:prod` script names. See [DOCKER.md](DOCKER.md#post-build-setup).

## None
- For creating migrations use `typeorm -- migration:create` command, don’t create migrations manually.