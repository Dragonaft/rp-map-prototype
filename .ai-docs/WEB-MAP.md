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
| `user`       | id, login, countryName, color, money, troops, piety, class, researchPoints, completedResearch, isNew, provinces, projectedIncome/Troops/Research/Piety |
| `provinces`  | provinces[], selectedProvinceId, selectedTroops, provinceCentersById, provinceBBoxById, mapWidth/Height |
| `armies`     | armies[], troopTypes[]                                            |
| `buildings`  | buildings[]                                                       |
| `techs`      | techs[]                                                           |
| `actions`    | actions[] (pending BUILD, ARMY_MOVE, RESEARCH, COLONIZE, etc.)   |
| `otherUsers` | otherUsers[] (id, countryName, color)                            |
| `resources`  | resources[] (catalog, `/resources`), mine[] (`UserResourceHolding[]`, `/resources/mine`) |
| `goods`      | mine[] (`UserGoodHolding[]`, `/goods/mine`)                       |
| `diplomacy`  | relations[] (`DiplomaticRelation[]`, `/diplomacy/relations`), wars[] (`/diplomacy/wars`), treaties[] (`/diplomacy/treaties`) |

> Player resource/good holdings are no longer embedded in the `user` slice — they're fetched separately as ledger rows (`resource`/`good` + `quantity`) and displayed in `TopBar.tsx`, mirroring each other.

## Context API

- **AuthContext** — user, isLoading, isAuthenticated, login(), logout(), checkAuth()
- **SnackbarContext** — showError(), showSuccess(), showSnackbar()

## API Layer (`src/api/`)

**Axios instance** (`config.ts`):
- Base URL: `VITE_API_BASE_URL` (default `http://localhost:3000`)
- `withCredentials: true` (httpOnly cookies)
- 401 interceptor: queues failed requests, calls `/auth/refresh`, retries all

**API modules:** auth.ts, users.ts, provinces.ts, armies.ts, actions.ts, buildings.ts, techs.ts, resources.ts, goods.ts, diplomacy.ts

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
- **Occupied provinces**: base fill stays the legal owner's color; a second `<path>` with the same
  polygon is overlaid using an inline per-province `<pattern>` (`occupied-stripes-{id}`, diagonal lines
  via `patternTransform="rotate(45)"`) filled in the **occupier's** color. Computed from
  `province.occupierId` the same way `provinceOwnerColor` is computed from `province.userId`

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
├── TopBar              Resources display, tech tree button, notifications bell, diplomacy, profile, logout
├── MapView             SVG map canvas (pan/zoom/wrap)
│   └── ProvinceShape   Individual province rendering (incl. occupied-province stripes)
├── SelectedProvinceHover  Right panel (build, deploy, setup, colonize, occupation state, player treaties)
├── ArmyBlock           Army detail panel (recruit, edit, disband)
├── CreateArmyModal     New army creation
├── TroopMovementModal  Army move target selection
└── Modals/
    ├── BuildMenuModal         Select building to construct
    ├── BuildingActionsModal   Upgrade/demolish
    ├── CancelActionModal      Confirm action cancellation
    ├── DeleteBuildingModal    Demolish confirmation
    ├── ProfileModal           Edit country name/color
    ├── TechsModal             Tech tree research UI (renders TechTree)
    ├── NotificationsModal     Bell dropdown: Treaties (pending + log) / News / System tabs
    ├── DiplomacyModal         Player list + relation state + propose/declare-war/send-money hub
    ├── TreatyNegotiationModal Vic3-style article builder (alliance/trade/troops_pass/article)
    ├── PeaceNegotiationModal  EU4-style peace proposal (province checklist + tribute, contiguity-checked)
    └── PlayerTreatiesModal    Read-only view of another player's public accepted treaties
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
- **Visual identity, terminology, and copy source of truth: [`DESIGN.md`](DESIGN.md)**
  (repo root) — read it before any UI/design work. It documents the exact color
  tokens, type scale, spacing/radius tokens, component patterns, and the game's
  closed vocabulary (building types, resources, diplomacy terms, etc.) pulled
  directly from this codebase. Update it when the visual system changes.

### Tailwind gotchas specific to this project

`tailwind.config.js` sets **`corePlugins: { preflight: false }`** (no global CSS
reset) and **`important: '#root'`** (every utility is scoped to require `#root`
as an ancestor). Both are easy to forget and cause silent, hard-to-diagnose
rendering bugs:

- **Bare `<button>`/`<input>`/`<select>`/`<textarea>` keep native browser
  chrome.** Without preflight, form controls retain the OS/browser default
  background and border (Chrome's default button background is a visible light
  gray, `rgb(239,239,239)`) unless you explicitly add `bg-transparent` (and
  `border-none` if no border is wanted). Non-form elements (`div`/`span`/`p`)
  don't have this problem since they have no native chrome to override.
- **`border-{color}` alone does not draw a border on non-form elements.**
  Tailwind's `border` utility only sets `border-width`; normally preflight sets
  a global `border-style: solid` reset so any element with a border color
  shows one. Without preflight, `<div>`/`<span>`/`<p>` fall back to the CSS
  initial `border-style: none` — the border silently doesn't render even
  though width and color are correct. Native form controls are exempt (browsers
  give them their own default border style), which is why this only bites
  divs/spans/badges/dividers, not buttons/inputs. **Fix: always pair `border`
  with `border-solid`** on any non-form-control element.
- **`<input>` defaults to `box-sizing: content-box`.** An input styled with
  `w-full` plus horizontal padding (e.g. `pl-10 pr-4`) will overflow its
  container by the padding amount, since padding is added on top of the full
  width instead of being included in it. **Fix: add `box-border`** to any input
  using `w-full` (or any explicit width) together with padding.
- **Set input text color explicitly.** Browsers give form controls their own
  default text color rather than always inheriting the surrounding page's
  color — a dark-on-dark input (e.g. black text on a black field) is easy to
  ship unnoticed. Add `text-white` (or the appropriate token) directly.
- **MUI `Dialog`/`Modal` portals to `document.body` by default — outside
  `#root`.** Since Tailwind's `important: '#root'` scopes every utility to
  require an `#root` ancestor, any Tailwind class used inside a MUI Dialog's
  content **silently does nothing** unless the dialog renders inside `#root`.
  **Fix: pass `disablePortal` to `Dialog`** (or `container={() =>
  document.getElementById('root')}`) whenever its content uses Tailwind
  classes. This affects every MUI `Dialog`/`Modal` in this codebase — check for
  it first if a modal's Tailwind styling appears to do nothing.

### Verifying UI changes

There's no visual regression suite — verify styling changes by actually running
the app: `npm run start:dev` in `api/`, `npm run dev` in `web-map/` (DB via
`docker compose up db` or `npm run db:local` from the repo root), then log in
with a seeded test account. `api/src/scripts/seed-test-countries.ts` (run via
`npm run seed:test-countries`) creates two ready-made opposing countries —
logins `test-blue` / `test-red` (plus the pre-existing `TestUser1` admin),
shared password `test123` — useful for exercising anything that needs another
player, a diplomatic relation, or an army fight. A headless Chromium driven via
Playwright (`playwright-core` + the system's installed `google-chrome` binary,
no browser download needed) plus `getComputedStyle()` checks is the fastest way
to confirm a fix actually changed the rendered CSS rather than trusting the
source alone — this is how every gotcha above was originally diagnosed.

## Docker

- Multi-stage: Node 20-alpine builder → nginx:alpine runtime
- Build arg: `VITE_API_BASE_URL=/api`
- nginx serves static files + proxies `/api/*` → `http://api:3000/`
- SSE support: `proxy_buffering off`, `proxy_read_timeout 3600s`
- Port 80

## File Structure

```
web-map/src/
├── api/              config.ts, auth.ts, users.ts, provinces.ts, armies.ts, actions.ts, buildings.ts, techs.ts,
│                     resources.ts, goods.ts, diplomacy.ts
├── components/       MapView, ProvinceShape, SelectedProvinceHover, ArmyBlock, TopBar, TechTree, modals
├── pages/            game/index.tsx, auth/login/LoginPage.tsx, auth/register/RegisterPage.tsx
├── store/            store.ts, hooks.ts, slices/ (user, provinces, armies, buildings, techs, actions, otherUsers,
│                     resources, goods, diplomacy)
├── context/          AuthContext.tsx, SnackbarContext.tsx
├── hooks/            useApi.ts, useActionExecutionReload.ts
├── constants/        buildingIcons.ts
├── types.ts          TypeScript interfaces
├── App.tsx           Root layout
├── router.tsx        React Router config
├── main.tsx          Entry point
└── index.css         Tailwind directives + custom styles
```
