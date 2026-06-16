# Web Map — React Game Client

## Stack

- **React 18** + **Vite 5** (SWC plugin)
- **TypeScript** (strict mode)
- **Redux Toolkit** for state management
- **MUI 6** + **Tailwind CSS 3** for styling
- **Axios** for HTTP with auto-refresh interceptor
- **React Router 6** for routing
- **React Hook Form** for form handling
- **react-colorful** for the country color picker

## Entry Point

`web-map/src/main.tsx` — Provider nesting:
```
Redux Provider → SnackbarProvider → AuthProvider → RouterProvider
```

## Routes

| Path       | Component     | Auth     |
|------------|---------------|----------|
| `/`        | GamePage      | Required |
| `/login`   | LoginPage     | Public   |
| `/register`| RegisterPage  | Public   |

`ProtectedRoute` wraps `/` — redirects to `/login` if not authenticated.

## State Management (Redux Toolkit)

| Slice        | Key Fields                                                        |
|--------------|-------------------------------------------------------------------|
| `user`       | id, login, countryName, color, money, troops, piety, class, researchPoints, completedResearch, resources ({stone,iron,gold,wood}), isNew, provinces, projectedIncome/Troops/Research/Piety |
| `provinces`  | provinces[], selectedProvinceId, selectedTroops, provinceCentersById, provinceBBoxById, mapWidth/Height |
| `armies`     | armies[], troopTypes[]                                            |
| `buildings`  | buildings[]                                                       |
| `techs`      | techs[]                                                           |
| `actions`    | actions[] (pending BUILD, ARMY_MOVE, RESEARCH, COLONIZE, etc.)   |
| `otherUsers` | otherUsers[] (id, countryName, color)                            |

## Context API

- **AuthContext** — user, isLoading, isAuthenticated, login(), logout(), checkAuth()
- **SnackbarContext** — showError(), showSuccess(), showSnackbar()

## API Layer (`src/api/`)

**Axios instance** (`config.ts`):
- Base URL: `VITE_API_BASE_URL` (default `http://localhost:3000`)
- `withCredentials: true` (httpOnly cookies)
- 401 interceptor: queues failed requests, calls `/auth/refresh`, retries all

**API modules:** auth.ts, users.ts, provinces.ts, armies.ts, actions.ts, buildings.ts, techs.ts

**SSE:** `/actions/execution-stream` — listened in `useActionExecutionReload` hook for auto-reload when turn completes.

## Map Rendering (SVG)

**Not Leaflet/Mapbox/Canvas** — pure SVG with custom camera.

### MapView.tsx (main canvas, ~550 lines)
- ViewBox-based pan/zoom (mouse drag + Ctrl+scroll)
- **Wrapping X-axis**: map repeats infinitely horizontally (seamless world wrap)
  - ViewBox.x grows unboundedly (no normalization = no flicker)
  - Computes visible tile indices: `tile = Math.floor(viewBox.x / mapWidth)`
  - Renders a sliding window of tile copies (≥3: previous, current, next — more when zoomed far out)
- **Viewport culling**: only renders provinces whose bboxes intersect the viewBox
- **SVG layers**: Pass 1 = province shapes + roads; Pass 2 = army move arrows

### ProvinceShape.tsx (individual province)
- SVG `<path>` from province polygon string
- Fill: owner's country color (white if unclaimed, blue if water)
- Emoji icons rendered as `<text>`: landscape, resource, buildings
- Troop count badge (white rect), enemy indicator (red rect)
- Pending deploy label (green "+")

### Road Rendering
- Dashed lines center-to-center between road-equipped provinces
- Only shown for provinces owned by current player

### Army Movement Arrows
- Yellow line from source to destination
- Gold label with army name (clickable to cancel)
- Wraps X-axis intelligently (shorter path)

### Reachability (BFS)
- Direct neighbors always reachable
- With ROAD: 2-3 hops (3 with `military.best_logistics` tech)
- Only through player-owned provinces with roads

## Component Map

```
GamePage
├── TopBar              Resources display, tech tree button, profile, logout
├── MapView             SVG map canvas (pan/zoom/wrap)
│   └── ProvinceShape   Individual province rendering
├── SelectedProvinceHover  Right panel (build, deploy, setup, colonize)
├── ArmyBlock           Army detail panel (recruit, edit, disband)
├── CreateArmyModal     New army creation
├── TroopMovementModal  Army move target selection
└── Modals/
    ├── BuildMenuModal         Select building to construct
    ├── BuildingActionsModal   Upgrade/demolish
    ├── CancelActionModal      Confirm action cancellation
    ├── DeleteBuildingModal    Demolish confirmation
    ├── ProfileModal           Edit country name/color
    └── TechsModal             Tech tree research UI (renders TechTree)
```

(`ProtectedRoute` wraps the game page for auth; `TechTree.tsx` is the tech-tree
graph rendered inside `TechsModal`.)

## Data Flow

1. GamePage mounts → fetches layout (cached in localStorage), state, armies, buildings, techs, actions, users
2. Data dispatched to Redux slices
3. Components read via `useAppSelector`
4. User actions → `POST /actions` → queued server-side
5. Turn fires → SSE `{ processing: false }` → `useActionExecutionReload` triggers page reload
6. Fresh state fetched from API

## Custom Hooks

- `useApi.ts` — `useQuery(fetcher)` for GET, `useMutation(mutator)` for POST/PATCH/DELETE
- `useActionExecutionReload.ts` — SSE listener, auto-reloads page when turn completes

## Styling

- **Tailwind CSS** (utility-first, 90% of layout)
- **MUI** (modals, buttons, forms, top bar)
- **Custom CSS** (glow effects, glassmorphism in `index.css`)
- Custom fonts: Space Grotesk (headlines), Manrope (body)
- Dark theme color palette in `tailwind.config.js`

## Docker

- Multi-stage: Node 20-alpine builder → nginx:alpine runtime
- Build arg: `VITE_API_BASE_URL=/api`
- nginx serves static files + proxies `/api/*` → `http://api:3000/`
- SSE support: `proxy_buffering off`, `proxy_read_timeout 3600s`
- Port 80

## File Structure

```
web-map/src/
├── api/              config.ts, auth.ts, users.ts, provinces.ts, armies.ts, actions.ts, buildings.ts, techs.ts
├── components/       MapView, ProvinceShape, SelectedProvinceHover, ArmyBlock, TopBar, TechTree, modals
├── pages/            game/index.tsx, auth/login/LoginPage.tsx, auth/register/RegisterPage.tsx
├── store/            store.ts, hooks.ts, slices/ (user, provinces, armies, buildings, techs, actions, otherUsers)
├── context/          AuthContext.tsx, SnackbarContext.tsx
├── hooks/            useApi.ts, useActionExecutionReload.ts
├── constants/        buildingIcons.ts
├── types.ts          TypeScript interfaces
├── App.tsx           Root layout
├── router.tsx        React Router config
├── main.tsx          Entry point
└── index.css         Tailwind directives + custom styles
```
