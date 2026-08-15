# rp-map-prototype — Web Map

React game client for **PR_PROTOTYPE**. A full-viewport, pannable/zoomable SVG map is the entire
game — the tech tree, diplomacy, army management, build menus, and this Codex all layer on top of
it as modals; nothing ever navigates away from the map.

For deep architectural reference (Redux slice shapes, SVG rendering internals, Tailwind gotchas,
component map), see [`.ai-docs/WEB-MAP.md`](../.ai-docs/WEB-MAP.md) and
[`.ai-docs/DESIGN.md`](../.ai-docs/DESIGN.md) (visual system, terminology, copy voice — read this
before any UI work) at the repo root. This README is the quick-start and orientation layer.

## Stack

React 18 · Vite 5 (SWC) · TypeScript (strict) · Redux Toolkit · MUI 6 · Tailwind CSS 3 · Axios ·
React Router 6 · React Hook Form · react-colorful (country color picker) ·
`@uiw/react-md-editor` (Codex/news markdown rendering)

## Setup

```bash
npm install
npm run dev        # http://localhost:5173, requires the API running (see api/README.md)
```

Copy `.env.example` to `.env` if the default doesn't match your API:

```bash
VITE_API_BASE_URL=http://localhost:3000
```

## Routes

There are exactly three: `/login`, `/register` (public), and `/` (the game page, auth-gated by
`ProtectedRoute`). Everything else is a modal over `/`.

## State Management

Redux Toolkit slices: `user`, `provinces`, `armies`, `buildings`, `techs`, `actions`,
`otherUsers`, `resources`, `goods`, `diplomacy`, `notifications`, `mod`. Static reference data the
Codex reads (`GET /knowledge`) is fetched into local component state instead of a slice — it's
read-only and only one modal consumes it.

An `useActionExecutionReload` hook listens to the API's SSE stream
(`/actions/execution-stream`) and auto-reloads game state the moment a turn finishes processing —
the client never polls.

## Map Rendering

Custom SVG canvas, not Leaflet/Mapbox/Canvas — see `components/MapView.tsx` and
`components/ProvinceShape.tsx`.

- **Seamless world wrap** on the X axis: the map viewBox grows unboundedly (no coordinate
  normalization, so no wrap-seam flicker) and a sliding window of tile copies renders around the
  current position.
- **Viewport culling** — only provinces whose bounding boxes intersect the visible viewBox render.
- Owned provinces are filled with the owning player's own chosen hex color; occupied provinces
  overlay a diagonal-stripe pattern in the occupier's color on top of the legal owner's fill, so
  ownership and military control are always visually distinguishable.

## Styling

Tailwind CSS for layout, MUI for modals/forms/the top bar, custom CSS for the glass-panel/glow
effects in `index.css`. The palette, type scale, and closed game vocabulary (province landscapes,
building names, diplomacy terms — never a synonym) are defined in
[`.ai-docs/DESIGN.md`](../.ai-docs/DESIGN.md).

`tailwind.config.js` sets `corePlugins: { preflight: false }` and `important: '#root'`, which
produces a few sharp, easy-to-miss gotchas — most notably that **every MUI `Dialog`/`Modal` needs
`disablePortal`**, or its Tailwind classes silently no-op since MUI portals outside `#root` by
default. The full gotcha list (form-control chrome, `border-solid`, `box-sizing`, input text
color) is in `.ai-docs/WEB-MAP.md#tailwind-gotchas-specific-to-this-project` — read it before
touching any modal.

There's no visual regression suite; verify styling changes by actually running the app and logging
in with a seeded test account (`npm run seed:test-countries` in `api/`, logins `test-blue`/`test-red`,
password `test123`).

## npm Scripts

| Script | Purpose |
|---|---|
| `dev` | Vite dev server with HMR |
| `build` | Production build to `dist/` |
| `preview` | Serve the production build locally |

## Docker

Multi-stage build (Node 20-alpine → nginx:alpine) serves the static build and reverse-proxies
`/api/*` to the API container, stripping the prefix. See the repo-root `docker-compose.yml` and
[`.ai-docs/DOCKER.md`](../.ai-docs/DOCKER.md).
