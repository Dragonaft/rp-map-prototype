# Admin Panel — CRUD Management UI

## Stack

- **React 19** + **Vite 8** (with React Compiler)
- **TypeScript 6** (ES2023 target)
- **MUI 6** + **MUI X Data Grid 7** (inline row editing)
- **Axios** for HTTP with auto-refresh interceptor

## Access

- Port **8081** (Docker) or Vite dev server locally
- **Admin-only**: login checks `role === 'ADMIN'`, blocks non-admin users
- Same JWT cookie auth as web-map (shares cookies with API)

## Features

Seven tabs in the dashboard, each managing one entity via MUI DataGrid with inline row editing:

### Users Tab
- Fields: login, password, country_name, color, money, troops, piety, research_points, is_new, completed_research, class (guild/holy/noble), role (ADMIN/MODERATOR/PLAYER)
- Create via modal dialog (login + password required)
- Inline edit, delete with confirmation

### Buildings Tab
- Fields: type (enum of 17 building types), name, description, income, upkeep, cost, modifier, upgrade_to, requirement_tech (array), requirement_building, isProduction (boolean, default false), production_good_id (dropdown sourced from Goods tab), production_requirement_resource (dropdown sourced from Resources tab, same as requirement_resource)
- Create via modal (type + name + description required)

### Armies Tab
- Fields: name, user_id, province_id, flat_upkeep (default 100), units (read-only nested display)
- Create via modal (user_id + province_id required)

### Techs Tab
- Fields: key (unique), name, description, branch (economy/military/guild/holy/noble), cost, isClassRoot (boolean), prerequisites (comma-separated tech keys)
- Create via modal (key + name + description + branch required)

### Troop Types Tab
- Fields: key (unique), name, description, category, cost_per_100, attack, defense, upkeep_per_100, tech_requirement, building_requirement

### Resources Tab
- Fields: key (unique), name, type (plain/consumable), plain_income
- Create via modal (key + name required)
- Backs the dropdowns in the Buildings tab: `allowed_province_resources` (multi-select) and `requirement_resource` (single-select) are sourced from this list rather than a hardcoded array
- `plain_income` drives MINE building income for provinces with that resource (see [GAME-MECHANICS.md](GAME-MECHANICS.md))

### Goods Tab
- Fields: name, type (civilian/military), price_per_one
- Create via modal (name required)
- First step of the economy rework (follows the resource rework); not yet wired into any building/trade logic

## API Communication

- Base URL: `VITE_API_BASE_URL` (default `http://localhost:3000`, Docker: `/api`)
- `withCredentials: true`
- 401 interceptor with token refresh queue (identical pattern to web-map)
- Endpoints: `/admin/users`, `/admin/buildings`, `/admin/armies`, `/admin/techs`, `/admin/troop-types`, `/admin/resources`, `/admin/goods` (GET, POST, PATCH, DELETE)

## Auth Flow

1. Login page → POST `/auth/login`
2. Verify `role === 'ADMIN'`
3. GET `/auth/me` to hydrate user context
4. ProtectedRoute checks `isAuthenticated && isAdmin`
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
│                     TroopTypesTab.tsx, ResourcesTab.tsx, GoodsTab.tsx
├── App.tsx           Router setup
└── main.tsx          Entry point
```

## Docker

- Multi-stage: Node 20-alpine builder → nginx:alpine runtime
- Build arg: `VITE_API_BASE_URL=/api`
- nginx proxies `/api/*` → `http://api:3000/`
- Port 80 (mapped to host 8081 in docker-compose)
