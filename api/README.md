# rp-map-prototype — API

NestJS REST API for the turn-based strategy map game. Handles authentication, province state, action queuing, and scheduled turn execution.

## Setup

```bash
npm install
cp .env.example .env   # fill in DB credentials and JWT secrets
npm run start:dev
```

## Authentication

JWT-based auth via **httpOnly cookies**. All endpoints except `/auth/*` and the SSE stream require a valid access token.

| Cookie | Expiry | Purpose |
|---|---|---|
| `access_token` | 15 min | Request authentication |
| `refresh_token` | 7 days | Obtain new access token |

---

## Endpoints

### Auth — `/auth`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/register` | — | Register new user. Body: `login`, `password`, `country_name`, `color` (hex, e.g. `#2f528a`) |
| POST | `/auth/login` | — | Login. Sets `access_token` + `refresh_token` cookies |
| POST | `/auth/refresh` | refresh cookie | Rotate both tokens |
| POST | `/auth/logout` | — | Clear auth cookies |
| GET | `/auth/me` | JWT | Return current user profile |

---

### Users — `/users`

All routes require JWT.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/users` | List all users (partial data: id, countryName, color) |
| GET | `/users/:id` | Get user by ID |
| POST | `/users` | Create user |
| PATCH | `/users/:id` | Update user fields |
| DELETE | `/users/:id` | Delete user |

---

### Provinces — `/provinces`

All routes require JWT.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/provinces` | All provinces with per-user filtered troop/ownership data |
| GET | `/provinces/layout` | Static province data only: polygon, type, landscape, neighbors. Never changes after map import — safe to cache. |
| GET | `/provinces/state` | Dynamic province data: userId, localTroops, enemyHere, buildings. Changes at turn end. |
| GET | `/provinces/:id` | Get single province |
| PATCH | `/provinces/:id` | Update province fields |
| PATCH | `/provinces/setup/:id` | Claim a starting province for a new user (gives 1000 troops + Capital building) |

**Note on `/provinces` vs `/provinces/layout` + `/provinces/state`:**
The split endpoints exist for performance. The frontend fetches layout once (and caches it in `localStorage`), then only re-fetches state on each turn-end page reload.

---

### Buildings — `/buildings`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/buildings` | JWT | List all available building templates (CAPITAL excluded) |

---

### Actions — `/actions`

#### Queued Actions (require JWT)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/actions` | Queue a new action (see Action Types below) |
| GET | `/actions` | List all queued actions for current user |
| GET | `/actions/pending` | List only PENDING actions for current user |
| DELETE | `/actions/pending/:id` | Retract a pending action (status → RETRACTED) |

#### Execution Logs (require JWT)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/actions/logs` | All execution logs. Query: `limit`, `offset` |
| GET | `/actions/logs/my-actions` | Logs filtered to current user's actions |
| GET | `/actions/logs/timetable/:timetable` | Logs for a specific tick (e.g. `12:00`, `18:00`, `dev-fast`) |
| GET | `/actions/logs/:id` | Single log entry |

#### SSE Stream (no auth)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/actions/execution-stream` | Server-sent events. Emits `{ processing: boolean }` when a turn starts/ends. Clients reload the page when `processing` transitions `true → false`. |

---

## Action Types

Actions are queued by players between turns and executed in strict global order (`order ASC`) during the next tick.

### `BUILD`
Construct a building in a province.
```json
{ "actionType": "BUILD", "actionData": { "province_id": "...", "building_id": "..." } }
```
- Deducts building cost from user money
- Province must be owned by user

### `INVADE`
Attack a neighboring province or transfer troops to an allied one.
```json
{ "actionType": "INVADE", "actionData": { "from_province_id": "...", "to_province_id": "...", "troops_number": 500 } }
```
- Target must be a direct neighbor
- Battle formula: `result = troops / defenseModifier - defenderTroops`
  - `result > 0`: attacker wins, province ownership transfers
  - `result < 0`: defender holds, defender keeps `|result|` troops
  - `result = 0`: defender survives with 0 troops
- `defenseModifier` is computed from FORT / CAPITAL buildings on the target
- Water provinces cannot change ownership
- Same-owner: troops transfer without battle

### `DEPLOY`
Move troops from the user's global pool into a province.
```json
{ "actionType": "DEPLOY", "actionData": { "province_id": "...", "troops_number": 200 } }
```
- Costs 1 money per troop
- Province must be owned by user

### `UPGRADE` / `TRANSFER_TROOPS`
Planned — not yet implemented.

---

## Turn System

Turns execute on a cron schedule. Between turns, province state is frozen; players only queue actions.

| Environment | Schedule |
|---|---|
| Production | 12:00 UTC and 18:00 UTC daily |
| Development | Every 2 min and every 5 min (disable with `DISABLE_FAST_ACTION_CRON=true`) |

**Execution order per tick:**
1. **Income** — add building income to all users' money (non-military buildings: FARM, MARKET, etc.)
2. **Upkeep** — deduct maintenance costs from all users' money
3. **Player actions** — execute all PENDING actions in global `order ASC` sequence
4. **Cleanup** — delete COMPLETED / FAILED / RETRACTED actions

**During execution** all non-SSE / non-auth endpoints return `503 Service Unavailable` to prevent state inconsistency.

---

## Economy

### Income (per turn)
Sum of `income` values from all non-military buildings across user's provinces.

Excluded building types: `FORT`, `BARRACKS`

### Upkeep (per turn)
```
totalUpkeep = buildingUpkeep + troopUpkeep

buildingUpkeep = sum of upkeep from FORT + BARRACKS buildings
troopUpkeep    = ceil(totalDeployedTroops / 200) * 100
```
User money is clamped to a minimum of `0`.

---

## Environment Variables

| Variable | Description |
|---|---|
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS`, `DB_NAME` | MySQL connection |
| `JWT_SECRET` | Secret for access tokens |
| `JWT_REFRESH_SECRET` | Secret for refresh tokens |
| `NODE_ENV` | `production` disables fast dev crons |
| `DISABLE_FAST_ACTION_CRON` | Set to `true` to disable 2/5-min crons in non-prod |
