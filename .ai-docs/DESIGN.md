# Design Brief — PR_PROTOTYPE

> Written for Google Stitch. Every name, label, color, and copy string below is pulled
> directly from the running codebase — `web-map/src/**`, `README.md`, `.ai-docs/**`.
> Nothing here is invented. Where the product is inconsistent (see **Design Debt**
> at the end), that inconsistency is called out explicitly rather than papered over,
> so Stitch generates toward the *intended* system, not the accidental one.

## 1. What this product is

A **turn-based political strategy game**, browser-based. From `README.md`:

> A prototype for a turn-based political strategy game. Players claim provinces,
> build structures, deploy troops, and invade neighbors. Game state advances in
> scheduled turns — players queue actions between turns and see results after each tick.

In-app identity (`LoginPage.tsx`, `RegisterPage.tsx`):

- **Product name:** `PR_PROTOTYPE` — always rendered as a single uppercase token,
  never spaced out as "PR Prototype."
- **Version tag:** `v0.6.5_WAR` — shown directly under the wordmark on the login screen.
- **Tone:** a military command terminal, not a friendly SaaS app. Copy uses
  underscore_case, uppercase, and terminal/ops vocabulary: `AUTHENTICATION_REQUIRED`,
  `Initialize link to strategic network`, `USER_ID`, `ENTER_ID...`, `INITIALIZE_LOGIN`,
  `INITIALIZE_ACCOUNT`. This voice is deliberate — keep it in any new screen's copy
  rather than defaulting to generic "Sign in" / "Welcome back" SaaS phrasing.

The native shape of the product is **a persistent world map, not a series of pages.**
There is functionally one screen (`GamePage`): a full-viewport SVG map the player
pans and zooms, with a fixed top bar and a floating right-hand inspector panel.
Every other surface (tech tree, diplomacy, army management, building menus) is a
modal layered on top of that map — nothing ever navigates away from it. Design
every new feature as a layer over the map, not a new route.

## 2. What the README leads with — this dominates the page

The README's first line of substance, before anything else, is the four-verb loop:

> Players **claim provinces, build structures, deploy troops, and invade neighbors**.

That is the hierarchy. In order:

1. **The map and province ownership** — claiming and holding territory is the base
   layer everything else sits on. It should visually dominate: full-bleed, always
   present, everything else floats on top of it in transparent/glass panels that
   never fully occlude it.
2. **Buildings / the province economy** — the build-menu and province-inspector
   panel is the second most load-bearing surface (`SelectedProvinceHover.tsx` is
   ~700 lines — the single largest interactive component in the app).
3. **Armies and combat** — troop deployment, army movement, invasion.
4. **Diplomacy** — the most recently added system (wars, treaties, occupation);
   important but explicitly secondary to the map/build/army loop it sits on top of.

Research (tech tree) and profile/notifications are utility surfaces, reachable from
the top bar, not part of the primary loop.

## 3. Core vocabulary — use these exact terms, never synonyms

Pulled from `types.ts`, `buildingIcons.ts`, and the API enums. Stitch should treat
these as a closed vocabulary — do not paraphrase "province" as "region," "troops"
as "units," etc.

**Entities:** Province, Building, Army, Troop, Tech, Resource, Good, Treaty, War.

**Province landscapes** (`Landscape` type): `plains`, `forest`, `mountain`, `desert`,
`hills`, `swamp` — plus water provinces (no landscape).

**Province resources:** `iron`, `gold`, `stone`, `wood`, `grain`, `fish` (fish = water
provinces only).

**Goods** (manufactured, seeded in `api/data/goods.json`): Lumber, Food, Weapons, Bricks.

**Building types** (`BuildingTypes` enum, 20 total — every one of these is real, no
invented buildings): `CAPITAL`, `CAPITOL`, `FORT`, `CASTLE`, `BARRACKS`, `ARMORY`,
`FARM`, `GARDEN`, `MINE`, `FORESTRY`, `SAWMILL`, `BRICKYARD`, `BARN`, `LIBRARY`,
`TEMPLE`, `CATHEDRAL`, `ROAD`, `TRADE_HOUSE`, `BAZAAR`, `MARKET`.

**Troop categories:** `INFANTRY`, `RANGED`, `CAVALRY`, `SPECIAL`, `PEASANT`.

**Player classes:** `NOBLE`, `HOLY`, `GUILD` — unlock Knights, Paladins, and
Mercenaries respectively.

**Resource bar labels** (`TopBar.tsx`, exact casing): `Research`, `Money`, `Troops`,
`Piety` (Piety only shown for `HOLY`-class players). Each shows a projected delta in
parens, colored green if positive / red if negative (e.g. `Research: 340 (+12)`).

**Map modes** (`mapModes.ts`, exact labels): `Normal`, `Landscape`, `Resource`,
`Economic`, `Army`, `Buildings` — a mode switcher in the top bar re-tints every
province by that dimension.

**Diplomacy states:** `NEUTRAL`, `WAR`, `PEACE`, `ALLIANCE`. **Treaty kinds:** peace,
alliance, trade, troops_pass, article. An occupied province is described as
*"Occupied by {country name} — cores in N turn(s)"* — use "cores," not "annexes";
occupation and annexation are explicitly different mechanics in this game.

## 4. Visual system — inherit exactly, do not reinterpret

The color system is a **Material Design 3 dark theme**, defined as literal token
names in `web-map/tailwind.config.js` — treat these as the palette, not as
inspiration for a similar one:

| Token | Hex | Use |
|---|---|---|
| `primary` | `#81ecff` | Cyan — primary actions, active states, glow accents |
| `primary-dim` | `#00d4ec` | Gradient partner for `primary` on buttons |
| `secondary` | `#ffd709` | Gold/yellow — secondary emphasis, "register," warnings-adjacent |
| `tertiary` | `#a2aaff` | Violet — research/science accents |
| `error` | `#ff716c` | Errors, occupied-territory badges, logout |
| `background` / `surface` | `#0e0e0e` | Base canvas — the app is dark-mode only, no light theme exists |
| `surface-container` | `#1a1a1a` | Panel/card background |
| `surface-container-lowest` | `#000000` | Input field background |
| `surface-container-high` | `#20201f` | Hover state for containers |
| `on-surface` | `#ffffff` | Primary text |
| `on-surface-variant` | `#adaaaa` | Secondary/muted text |
| `outline-variant` | `#484847` | Hairline borders, always used at low opacity (`/10`–`/30`) |

Full token list is in `tailwind.config.js` — every M3 role (`*-container`,
`*-fixed`, `on-*`, `inverse-*`) is defined; don't invent a color outside this set.

**Type:**
- Headline font: **Space Grotesk**, used via `.font-headline` for all UI chrome
  labels/buttons/titles — always paired with `uppercase` and wide `tracking`
  (`tracking-widest` or `tracking-[0.2em]`).
- Body font: **Manrope**, used for everything else including form inputs.
- There is no display/hero size in use anywhere — the largest text in the whole
  app is `text-4xl` on the login wordmark. This is a dense, control-panel UI, not
  a marketing page. Don't design large hero type.

**Shape:** `borderRadius` scale is intentionally tight — `DEFAULT: 0.125rem`,
`lg: 0.25rem`, `xl: 0.5rem`, `full: 0.75rem`. Even the "full" pill radius is only
12px. This reads as a HUD/terminal, not a soft consumer app — avoid large rounded
corners or soft card shapes.

**Signature effects** (`index.css`, reuse these classes, don't recreate similar ones):
- `.glass-panel` — `rgba(38,38,38,0.6)` + `backdrop-filter: blur(20px)`. Used for
  every floating surface over the map (login card, would-be modals).
- `.glow-primary` / `.glow-secondary` — soft colored box-shadow (`0 0 12px`) at low
  opacity, used on primary CTA buttons.
- `.glow-text-primary` — text-shadow glow, used only on the wordmark/hero heading.
- A thin gradient hairline (`from-transparent via-primary/40 to-transparent`) across
  the top edge of the login card — a recurring "terminal panel" seam detail.
- Small pulsing status dots with colored glow (`bg-primary` + matching box-shadow,
  `animate-pulse` when active) for live connection/queue state — see "Server
  status" / "Queue status" indicators on the login screen. Reuse this pattern for
  any other live/real-time state (e.g. turn-processing indicator).

**Iconography — two distinct systems, don't mix their roles:**
1. **Material Symbols Outlined** (Google's icon font) for all UI chrome: nav
   buttons, form fields, status indicators. Always small (`text-sm`/`text-lg`),
   monochrome, tied to the surrounding text color.
2. **Emoji** as the *domain* iconography — every building, landscape, and resource
   has a literal emoji glyph (🏰 CAPITAL, ⚔️ BARRACKS, ⛰️ mountain, ⚙️ iron, 💰
   MARKET, etc. — see `constants/buildingIcons.ts` for the full canonical map).
   These render directly on the map and in build menus at real size (not tiny
   chrome-icon size) — they're content, not decoration. Never replace them with
   line-icon equivalents; the emoji set is the established visual language for
   game entities.

**Map rendering specifics** (`ProvinceShape.tsx`, `mapModes.ts`):
- Unclaimed land: white (`rgb(255,255,255)`). Water: pale blue (`rgb(174,226,255)`).
- Owned provinces are filled with the *owning player's own chosen hex color*
  (`user.color`, picked at registration via a hex color field + swatch picker) —
  the map is a mosaic of player-chosen colors, not a fixed palette.
- Occupied provinces keep the legal owner's fill color as the base and overlay a
  45°-rotated diagonal-stripe pattern in the occupier's color on top — ownership
  and military control are always visually distinguishable, never conflated into
  one color.
- Map-mode heat colors are a fixed green→red diverging scale (`#16a34a` positive /
  `#dc2626` negative) independent of the M3 token palette — this is a deliberate
  data-viz exception, not a token gap to fix.

## 5. Layout patterns to follow

- **Top bar**: fixed, full-width, `bg-[#0e0e0e]/80` + heavy backdrop-blur, gradient
  fade from `#1a1a1a` to transparent, thin bottom hairline. Left cluster = mode/
  action buttons (Research, Diplomacy, Map mode). Right cluster = resource readouts
  (grouped in one bordered pill, separated by vertical `|` dividers) then
  Resources/Goods tooltips, Notifications (bell + badge count), Profile, Logout.
- **Province inspector**: floats top-right over the map (`absolute right-5 top-4`),
  fixed width, scrolls internally, capped at 90vh. Content branches on relationship
  to the province: new-player setup / non-owner viewer / occupier / legal owner —
  four distinct states, not one generic template with conditionals sprinkled in.
- **Auth screens** (login/register): centered single card, max-width `md`, over a
  full-bleed dimmed background image ("cinematic deep space nebula, teal/violet"
  per the login page's own alt text) — this is the one place the product allows
  itself a moody hero visual; every other screen is flat dark chrome.
- **Modals**: MUI `Modal`/`Box`, used for build menu, building actions, tech tree,
  diplomacy, treaty negotiation, notifications, profile. Layer over the map, never
  navigate away from it.

## 6. Design debt — resolve toward the system above, not away from it

The auth pages and top bar fully express the intended dark-glass/glow/command-
terminal system above. Large parts of the province inspector and its modals
(`SelectedProvinceHover.tsx` and siblings) still use unstyled default Tailwind
grays and primary colors (`bg-gray-400`, `bg-gray-200`, `bg-blue-200`, `bg-red-100`,
plain `border-gray-400`) instead of the M3 tokens, glass panels, and headline
typography used elsewhere. When Stitch designs or redesigns any of these surfaces,
target the **login/top-bar system**, not the current gray inspector — the gray
styling is unfinished work-in-progress, not a second valid style to preserve.
