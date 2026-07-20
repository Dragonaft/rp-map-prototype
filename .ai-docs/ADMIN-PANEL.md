# Admin Panel — CRUD Management UI

## Stack

- **React 19** + **Vite 8** (with React Compiler)
- **TypeScript 6** (ES2023 target)
- **MUI 6** + **MUI X Data Grid 7** (inline row editing)
- **Axios** for HTTP with auto-refresh interceptor

## Access

- Port **8081** (Docker) or Vite dev server locally
- **ADMIN or MODERATOR only**: `AuthContext.canAccessPanel = isAdmin || isModerator`, blocks
  PLAYER accounts. A few actions inside the panel (deleting/reassigning an ADMIN or MODERATOR
  account, editing `is_npc`/`role` on an existing user) are further restricted to ADMIN — see
  Users Tab
- Same JWT cookie auth as web-map (shares cookies with API)

## Features

Ten tabs in the dashboard — eight manage one entity each via MUI DataGrid with inline row
editing; Notifications is a compose-and-send utility instead (broadcast rows fan out per-user,
so there's no single browsable list to grid-edit), and News Wall is read/delete-only (agencies
and articles are player-authored in-game, not admin-created):

### Users Tab
- Fields: login, password, country_name, color, money, troops, piety, research_points (per-turn rate, not a stockpile), is_new, is_npc (NPC country, can't log in — settable here on create, or via the separate Mod layer's "Create NPC" tool; only an ADMIN, not a MODERATOR, may flip it on an *existing* user), completed_research, active_research_key, class (dropdown sourced from the **Classes tab** below — any `PlayerClass.key`, not a hard-coded list), role (ADMIN/MODERATOR/PLAYER)
- Create via modal dialog (login + password required)
- Inline edit, delete with confirmation

### Buildings Tab
- Fields: type (enum of building types, incl. SAWMILL/BRICKYARD/BARN/PORT), name, description, income, upkeep, cost, modifier, upgrade_to, requirement_tech (array), requirement_building, requires_neighbor_water (boolean, default false — buildable only if a neighboring province is water; PORT sets this true), isProduction (boolean, default false), production_good_id (dropdown sourced from Goods tab), production_requirement_resource (dropdown sourced from Resources tab, same as requirement_resource), production_requirement_resource_amount (per-turn spend, default 1), production_amount (units of the good credited per turn, default 1), resource_production_amount (per-turn raw-resource credit for MINE/FORESTRY/BARN — this is what feeds the whole chain), requirement_good_id + requirement_good_amount (one-time BUILD cost paid in goods, dropdown sourced from Goods tab, same mechanic as requirement_resource)
- Create via modal (type + name + description required)

### Armies Tab
- Fields: name, user_id, province_id, flat_upkeep (default 100), units (read-only nested display)
- Create via modal (user_id + province_id required)

### Techs Tab
- Fields: key (unique), name, description, branch (economy/military/guild/holy/noble), cost, isClassRoot (boolean), prerequisites (multi-select of other techs' keys), effects (see below)
- Create via modal (key + name + description + branch required)
- **Effects column**: read-only compact summary per row (e.g. `income ×1.2, building_cap +1 (plains)`),
  plus an "Edit Effects" action (`EffectsEditorModal.tsx`) opening a dialog with two tabs bound to the
  same `effects` array:
  - **Builder tab** (default): repeatable rows — `Target` + `Operation` dropdowns, numeric `Value`, a
    `Scale by` dropdown (only for `add_scaled`, options depend on target), `When landscape`/`When
    resource` dropdowns (only for `building_cap`); add/remove row buttons. Options are constrained by
    `effectsSchema.ts` (frontend mirror of `api/src/techs/effect-types.ts`).
  - **JSON tab**: textarea bound to the same array, parsed/validated on switch.
  - Save PATCHes the tech with `{ effects }`; invalid effects are rejected server-side
    (`validateEffects`) with an error snackbar.

### Troop Types Tab
- Fields: key (unique), name, description, category, cost_per_100, attack, defense, water_combat_modifier (power multiplier while fighting on water, default 1.0 — e.g. 0.2 = -80%), upkeep_per_100, tech_requirement, building_requirement, required_goods (dropdown sourced from Goods tab), goods_amount (goods consumed per 100 troops recruited, one-time — same mechanic as a Building's requirement_good)

### Resources Tab
- Fields: key (unique), name, type (plain/consumable), plain_income
- Create via modal (key + name required)
- Backs the dropdowns in the Buildings tab: `allowed_province_resources` (multi-select) and `requirement_resource` (single-select) are sourced from this list rather than a hardcoded array
- `plain_income` drives MINE building income for provinces with that resource (see [GAME-MECHANICS.md](GAME-MECHANICS.md))

### Goods Tab
- Fields: name, type (civilian/military), price_per_one
- Create via modal (name required)
- First step of the economy rework (follows the resource rework); not yet wired into any building/trade logic

### Notifications Tab
- Fields: title, message (multiline), severity (info/warning/error)
- "Send to All Players" fans a `Notification` row out to every registered user (`POST
  /admin/notifications/broadcast`); reports how many players it was sent to. Shows up for players in the
  Notifications Center's News tab (see [WEB-MAP.md](WEB-MAP.md))

### News Wall Tab
- Two read-only DataGrids: News Agencies and News Articles (player-authored in-game content —
  this tab exists for moderation, not authoring). Delete-only; deleting an agency cascades to
  its articles.

### Classes Tab
- Fields: key (unique, must equal the `Tech.branch` string it's meant to gate — no enforced
  constraint, just convention), name, is_visible (boolean, default true)
- Create via modal (key + name required)
- `is_visible = false` hides every tech in that class's branch from `GET /techs` for **all**
  players (including ones already assigned to that class) — see
  [GAME-MECHANICS.md](GAME-MECHANICS.md#class-system). Deleting a class here does not retroactively
  clear it off any `User.class` or `Tech.branch` — those are plain strings, not FKs
- Backs the **Users tab**'s `class` dropdown (sourced live from this list instead of a hard-coded
  `guild`/`holy`/`noble` array)

## API Communication

- Base URL: `VITE_API_BASE_URL` (default `http://localhost:3000`, Docker: `/api`)
- `withCredentials: true`
- 401 interceptor with token refresh queue (identical pattern to web-map)
- Endpoints: `/admin/users`, `/admin/buildings`, `/admin/armies`, `/admin/techs`, `/admin/troop-types`, `/admin/resources`, `/admin/goods`, `/admin/classes` (GET, POST, PATCH, DELETE), `/admin/notifications/broadcast` (POST only), `/admin/news-agencies`, `/admin/news-articles` (GET, DELETE only)

## Auth Flow

1. Login page → POST `/auth/login`
2. Verify `role === 'ADMIN'` or `role === 'MODERATOR'`
3. GET `/auth/me` to hydrate user context
4. ProtectedRoute checks `isAuthenticated && canAccessPanel`
5. Redirect to `/login` if unauthorized

## File Structure

```
admin-panel/src/
├── api/              config.ts (Axios + interceptor), auth.ts, admin.ts
├── components/       ProtectedRoute.tsx
├── context/          AuthContext.tsx
├── pages/
│   ├── login/        LoginPage.tsx
│   └── dashboard/    index.tsx, UsersTab.tsx, BuildingsTab.tsx, ArmiesTab.tsx, TechsTab.tsx,
│                     TroopTypesTab.tsx, ResourcesTab.tsx, GoodsTab.tsx, NotificationsTab.tsx,
│                     NewsWallTab.tsx, ClassesTab.tsx
├── App.tsx           Router setup
└── main.tsx          Entry point
```

## Docker

- Multi-stage: Node 20-alpine builder → nginx:alpine runtime
- Build arg: `VITE_API_BASE_URL=/api`
- nginx proxies `/api/*` → `http://api:3000/`
- Port 80 (mapped to host 8081 in docker-compose)
