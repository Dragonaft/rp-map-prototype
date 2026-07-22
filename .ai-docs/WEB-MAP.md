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
| `user`       | id, login, countryName, color, money, troops, piety, class, researchPoints (per-turn rate, not a stockpile), completedResearch, activeResearch (tech key or null), isNew, provinces, projectedIncome/Troops/Research/Piety |
| `provinces`  | provinces[], selectedProvinceId, selectedTroops, mapMode, mapModeFilterValue, fastBuild, provinceCentersById, provinceBBoxById, mapWidth/Height |
| `armies`     | armies[], troopTypes[]                                            |
| `buildings`  | buildings[]                                                       |
| `techs`      | techs[]                                                           |
| `actions`    | actions[] (pending BUILD, ARMY_MOVE, COLONIZE, etc. — RESEARCH is no longer queued, see `techsApi.selectResearch`) |
| `otherUsers` | otherUsers[] (id, countryName, color)                            |
| `resources`  | resources[] (catalog, `/resources`), mine[] (`UserResourceHolding[]`, `/resources/mine`) |
| `goods`      | mine[] (`UserGoodHolding[]`, `/goods/mine`)                       |
| `diplomacy`  | relations[] (`DiplomaticRelation[]`, `/diplomacy/relations`), wars[] (`/diplomacy/wars`), treaties[] (`/diplomacy/treaties`) |
| `notifications` | mine[] (`AppNotification[]`, `/notifications`) — split client-side by `type` into the Notifications Center's News (`admin`) and System Logs (`action_failed`/`system`) tabs |
| `mod`        | switchOn, actingAsUserId, npcs[] — ADMIN/MODERATOR-only "act as NPC" state; `switchOn`/`actingAsUserId` are backed by `localStorage`, not just in-memory, so they survive a reload. See [Mod / NPC Impersonation State](#mod--npc-impersonation-state) |

> Player resource/good holdings are no longer embedded in the `user` slice — they're fetched separately as ledger rows (`resource`/`good` + `quantity`) and displayed in `TopBar.tsx`, mirroring each other.

## Context API

- **AuthContext** — user, isLoading, isAuthenticated, login(), logout(), checkAuth()
- **SnackbarContext** — showError(), showSuccess(), showSnackbar()

## API Layer (`src/api/`)

**Axios instance** (`config.ts`):
- Base URL: `VITE_API_BASE_URL` (default `http://localhost:3000`)
- `withCredentials: true` (httpOnly cookies)
- 401 interceptor: queues failed requests, calls `/auth/refresh`, retries all

**API modules:** auth.ts, users.ts, provinces.ts, armies.ts, actions.ts, buildings.ts, techs.ts, resources.ts, goods.ts, diplomacy.ts, notifications.ts

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
├── FastBuildPanel       Left panel: pick a building once, map-click any province to queue BUILD/UPGRADE there (see Fast Build Mode)
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
    ├── NotificationsModal     Bell dropdown: Treaties (pending + log) / News (admin broadcasts) / System Logs (auto action-failure notifications) tabs
    ├── DiplomacyModal         Player list + relation state + propose/declare-war/send-money hub
    ├── TreatyNegotiationModal Vic3-style article builder (alliance/trade/troops_pass/article)
    ├── PeaceNegotiationModal  EU4-style peace proposal (province checklist + tribute, contiguity-checked)
    ├── PlayerTreatiesModal    Read-only view of another player's public accepted treaties
    ├── CreateNpcModal         ADMIN/MODERATOR-only: creates an NPC country (`POST /mod/npc`)
    └── ModStocksModal         ADMIN/MODERATOR-only: directly edits an NPC's money/troops/piety/goods/resources
```

(`ProtectedRoute` wraps the game page for auth; `TechTree.tsx` is the tech-tree
graph rendered inside `TechsModal`.)

## Research Modal — Branch Tabs

`TechsModal.tsx` builds its tabs purely from the distinct `branch` values present in whatever
`GET /techs` returned — `[...new Set(techs.map(t => t.branch))]` — then renders `TechTree` with
just that branch's techs. **There is no client-side class-visibility logic**: `user.class` is
never read here. This means the backend's tech-visibility rules (see
[GAME-MECHANICS.md](GAME-MECHANICS.md#class-system) — classless users see every visible class,
a classed user sees only their own, a hidden `PlayerClass` is dropped for everyone) are the only
gate. A class's tab and tree appear or disappear automatically based on whether `GET /techs`
included any tech with that branch — no frontend change is needed when classes are added, hidden,
or reassigned server-side.

## Fast Build Mode

Lets a player with many provinces queue the same BUILD/UPGRADE across all of them without
selecting each province individually. Entered only via the left-side `FastBuildPanel`
(🔨 button → Build/Upgrade → pick a building), never from the TopBar's "Map:" mode menu.

- **State:** `provincesSlice`'s `fastBuild: { action: 'build' | 'upgrade'; buildingId } | null`.
  `setFastBuild(selection)` sets it and switches `mapMode` to the programmatic-only
  `'fastbuild'` value (in the `MapMode` union but deliberately excluded from
  `MAP_MODE_OPTIONS`, so it never appears in the TopBar picker); `setFastBuild(null)`, or any
  other `setMapMode(...)` call (e.g. picking a different mode in the TopBar), exits it back
  to `'normal'`.
- **Eligibility, shared with the build menu:** `utils/mapModes.ts`'s `evaluateBuildRequirements`
  (money, `allowedProvinceResources`, `requirementTech`, `requirementResource`/`requirementGood`
  cost net of everything already pending, `uniquePerProvince`, `requiresNeighborWater`) is the
  single source of truth for BUILD eligibility, used by both `Modals/BuildMenuModal.tsx` and
  fast-build mode — they can't drift out of sync. `canUpgradeProvinceBuilding` (exported,
  originally private to `getProvinceBuildingSlots`) is the equivalent for UPGRADE.
- **Per-province coloring:** `getFastBuildCell(province, targetBuilding, action, hasWaterNeighbor, options)`
  in `mapModes.ts` returns `{ status: 'green'|'red'|'yellow', canQueue, upgradeInstanceId?,
  cancelActionId? }` for every owned land province, computed once per render in
  `MapView.tsx`'s `mapModeRenderData` memo and stored on `MapModeRenderData.fastBuildByProvinceId`.
  `ProvinceShape.tsx`'s fill-color switch adds a `case 'fastbuild'`: unowned/water → black
  (`FASTBUILD_BLACK`), else green/yellow (reuses `BUILDING_PENDING_COLOR`)/red per the cell.
  Upgrade mode resolves the picked building as the upgrade **target** (e.g. Castle) and looks
  for a built source instance (e.g. Fort) whose `upgradeTo` matches it.
- **Click to queue, right-click to cancel:** `MapView.tsx`'s `toggleSelect`/`handleProvinceRightClick`
  branch on `mapMode === 'fastbuild'` before their normal selection/army-move logic. A
  left-click on a green/yellow province calls `handleFastBuildClick` → `POST /actions`
  (BUILD or UPGRADE, same payload shape as the normal build menu) → `dispatch(addAction(...))`.
  A right-click on a **yellow** province (already queuing at least one of the selected
  building/upgrade here) calls `handleFastBuildCancel` → `DELETE /actions/pending/:id` on the
  action `FastBuildCell.cancelActionId` resolved for that province. Green/red provinces
  right-click as a no-op.

## Mod / NPC Impersonation State

`modSlice.ts` (Redux) backs the TopBar's country-switcher for ADMIN/MODERATOR accounts "acting
as" an NPC. Two of its three fields are mirrored into `localStorage` (`mod.switchOn`,
`mod.actingAsUserId`) so the choice survives the page reloads this app does constantly (every
turn tick via SSE, and after most mutations) — see `modSlice.ts`'s own comment on why. The axios
request interceptor (`api/config.ts`) reads `store.getState().mod.actingAsUserId` on every
request and attaches it as the `X-Act-As-User` header (except to `/auth/*`), which
`ActAsInterceptor` on the backend uses to swap `req.user` to that NPC — see
[API.md](API.md#auth--mod-impersonation).

The same interceptor also attaches `X-Mod-Full-Visibility: true` whenever `mod.switchOn` is on
**and** `state.user.role` is ADMIN/MODERATOR — this is the client half of the no-fog-of-war
toggle: it makes `GET /armies/all` and `GET /provinces/state` return every player's buildings
and mobile armies unfiltered, no other frontend change needed since the existing rendering
(enemy-army badges, building icons) already draws whatever the backend sends with no
ownership filtering of its own. The role check here is only a client-side nicety — the server
independently re-validates the *real* authenticated role (`req.realUser ?? req.user`, so an
active act-as impersonation doesn't defeat it) before honoring the header; see
[API.md](API.md#auth--mod-impersonation) and
[GAME-MECHANICS.md](GAME-MECHANICS.md#visibility-fog-of-war).

**Gotcha:** because `actingAsUserId` lives in `localStorage`, not the auth session, it outlives
a logout by default. Both places a session ends must explicitly dispatch
`setActingAsUserId(null)`/`setModSwitch(false)` before finishing: `TopBar.tsx`'s `handleLogout`,
and `config.ts`'s response interceptor on refresh-token failure (auto-logout → redirect to
`/login`). Skipping this means the next account to log in on the same browser — even a brand
new PLAYER registration — inherits the stale header and gets a 403 (`ActAsInterceptor` rejects
any non-ADMIN/MODERATOR actor) on every request.

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
│                     resources.ts, goods.ts, diplomacy.ts, notifications.ts
├── components/       MapView, ProvinceShape, SelectedProvinceHover, FastBuildPanel, ArmyBlock, TopBar, TechTree, modals
├── pages/            game/index.tsx, auth/login/LoginPage.tsx, auth/register/RegisterPage.tsx
├── store/            store.ts, hooks.ts, slices/ (user, provinces, armies, buildings, techs, actions, otherUsers,
│                     resources, goods, diplomacy, mod)
├── context/          AuthContext.tsx, SnackbarContext.tsx
├── hooks/            useApi.ts, useActionExecutionReload.ts
├── utils/            mapModes.ts (map-mode coloring, build/upgrade eligibility, fast-build cell logic)
├── constants/        buildingIcons.ts
├── types.ts          TypeScript interfaces
├── App.tsx           Root layout
├── router.tsx        React Router config
├── main.tsx          Entry point
└── index.css         Tailwind directives + custom styles
```
