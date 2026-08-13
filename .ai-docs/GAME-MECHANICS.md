# Game Mechanics

## Turn System

### Schedule
- **Production:** 13:00 and 20:00 Kyiv time daily (2 turns/day; two separate `@Cron` jobs)
- **Development:** every 2 minutes AND every 5 minutes (two fast crons), gated by `isFastDevCronEnabled()` — disabled if `DISABLE_FAST_ACTION_CRON=true` or `NODE_ENV=production`
- **Admin kill switch:** every cron tick also checks `game_settings.turns_enabled` first, before
  even trying to acquire the distributed lock — when off, the tick is a silent no-op. See
  [Global Game Settings](#global-game-settings)

### Execution Order
1. **Distributed lock** acquired (prevents multi-instance race)
2. **Income phase** — credit resources from buildings (skips occupied provinces)
3. **Production phase** — credit goods from production buildings (see [Goods Production](#goods-production); skips occupied provinces)
4. **Upkeep phase** — deduct building + army maintenance costs (skips occupied provinces' building upkeep)
5. **Supply phase** — assesses every army's distance to the nearest reachable supply building and
   charges food upkeep scaled by that distance; unfed armies take attrition. See
   [Supply (Food)](#supply-food)
6. **Recurring trade settlement** — re-applies every accepted `recurring` trade treaty's transfer articles; a side that can't pay skips that turn
7. **Action execution** — process queued actions in `order` ASC, then `createdAt` ASC
8. **Cleanup** — mark actions completed/failed, write execution log
9. **Post-processing integrity** (each step in its own transaction, runs after cleanup):
   - Disband armies with < 100 troops (`ARMY_MIN_SIZE`)
   - Resolve multi-faction battles in same province — only **hostile** attacker
     groups engage (allies/troops-pass co-locate peacefully); the winner gains
     control via `OccupationService.applyControlResult` (occupy, not annex, a
     province with a different legal owner), which also transfers any
     `requirement_resource`/`requirement_good` reservations held by the
     province's buildings from the losing owner's ledger to the winner's
     (per-turn resource/goods *production* isn't transferred — it's simply
     derived fresh next turn from whoever then owns the building)
   - Sync province control with army presence — same `applyControlResult`
     path, skipped for peaceful (allied/passage) co-location
10. **Diplomacy tick** — ages every occupied province by one turn (auto-cores
   at `OCCUPATION_CORE_THRESHOLD`), decays `PEACE` relations to `NEUTRAL`
   after `PEACE_DURATION_TURNS`, and auto-rejects pending treaty proposals
   older than `TREATY_EXPIRY_TURNS`. See [Diplomacy & Occupation](#diplomacy--occupation).
11. **SSE broadcast** — clients auto-reload

### 503 Gate
During execution, API returns 503 Service Unavailable on all endpoints except an exact-match whitelist of six paths: `/actions/execution-stream`, `/auth/login`, `/auth/register`, `/auth/refresh`, `/auth/logout`, `/game-settings`. (`/auth/me` is **not** whitelisted.) `/diplomacy/*` is **not** whitelisted either — treaty/war actions are blocked during turn processing like everything else.

## Global Game Settings
Singleton `game_settings` row (`GameSettings` entity, `api/src/settings/`) holding server-wide
switches, editable via the admin panel's Settings tab and readable publicly at
`GET /game-settings` (no auth — the login screen needs it before anyone is authenticated). See
[DATABASE.md](DATABASE.md#gamesettings) for the column list and
[API.md](API.md#auth--game-pause) for the enforcement mechanism.

- **`is_paused`** — while true:
  - `AuthService.login`/`refreshTokens` reject any non-ADMIN/MODERATOR with a `403`
    (`code: 'GAME_PAUSED'`) instead of the normal credential check outcome. Registration
    (`POST /auth/register`) is deliberately **not** gated — new players can still create an
    account and wait for the game to reopen.
  - `GamePauseInterceptor`, registered globally the same way `ActAsInterceptor` is (see
    [API.md](API.md#auth--mod-impersonation)), 403s every other authenticated request from a
    PLAYER — including one from an already-logged-in session, which is what "kicks" a player out:
    their next request (the game reloads on every SSE tick and after every mutation, so this is
    near-immediate) gets the 403 and the web client forces a logout + redirect to `/login`.
  - The real actor (`req.realUser ?? req.user`, same "prefer realUser" rule
    `resolveModFogBypass` uses) is checked, not the impersonated identity — so an ADMIN/MODERATOR
    acting as an NPC keeps playing normally through a pause.
- **`turns_enabled`** — independent of `is_paused` by design: an admin can freeze the world
  (no income/production/upkeep/action execution) while leaving players free to browse and queue
  actions for whenever turns resume, or lock logins while turns keep ticking. Checked first thing
  in `ActionSchedulerService.executeScheduledActions`, before the distributed `ExecutionLock` is
  even acquired — see [Schedule](#schedule).
- **`pause_message`** — free text surfaced on the web client's login screen and in the 403 body;
  a default message is used when blank.

## Map Checksum & Layout Cache Invalidation

The web client caches the province "layout" (polygons, landscape, resource, neighbors — the
static half of a province, which never changes except at map import) in localStorage, since
re-fetching ~600 provinces' SVG polygon strings on every load is wasteful. The problem: an admin
re-importing `provinces.json` (`api/src/scripts/import-provinces.ts`, a documented workflow —
see [MAP-GENERATOR.md](MAP-GENERATOR.md)) **wipes and reinserts every province with brand-new
UUIDs**, so a stale cached layout isn't just cosmetically outdated, its `id`s no longer exist in
the DB at all.

- **`game_settings.map_checksum`** (see [DATABASE.md](DATABASE.md#gamesettings)) — a SHA-256
  hash of the map's content, recomputed by `import-provinces.ts` from the source
  `provinces.json` **before** it wipes the table (`computeMapChecksum`,
  `api/src/provinces/map-checksum.util.ts`) and stored on the singleton row immediately after a
  successful import. Canonicalized (sorted by `region_id`, each province's `neighbor_regions`
  sorted too) so cosmetic re-saves of the file — different whitespace, key order, or generator
  row ordering with identical actual content — don't needlessly bust every client's cache.
  Hashing the source file rather than post-import DB rows is sufficient because import always
  wipes-and-reinserts from that same file, so the two can never diverge.
- **Client-side check** (`web-map/src/api/provinces.ts`'s `getLayoutCached`, see
  [WEB-MAP.md](WEB-MAP.md#map-layout-cache)) — before trusting its cached layout, the client
  fetches the tiny public `GET /game-settings` response and compares `mapChecksum` against the
  checksum stored alongside its cached layout. A mismatch (or no cache) triggers a fresh
  `GET /provinces/layout` fetch and re-caches both the new layout and its checksum together.
- This replaced an earlier scheme that only force-refreshed a **new** player's first load
  (`User.is_new`) — correct for that one case, but it meant an **existing** player's browser
  never noticed a map re-import at all, surviving indefinitely across reloads, logins, and the
  turn-completion auto-reload. The checksum check subsumes that case for free (a new user simply
  has no cache yet) while also fixing it for everyone else.
- **Scope note:** this only addresses the layout cache. A live re-import while players hold
  game state referencing old province IDs (selected province, pending actions, army locations,
  buildings) is an inherently disruptive admin operation already understood to go hand-in-hand
  with `reset:game` in the documented map-swap workflow — not something the checksum mechanism
  itself reconciles.

## Resources

| Resource        | Generated By                            | Spent On                           |
|-----------------|------------------------------------------|------------------------------------|
| **Money**       | Building income (mines, farms, etc.)     | Construction, recruitment, upkeep  |
| **Troops**      | Barracks/CAPITAL (`troop_pool` tech-scaled rate/turn, default 50, if money > 0) | Army creation, deployment |
| **Piety**       | Temples (10/turn) + Cathedrals (20/turn) | Paladin/Templar Order recruitment (HOLY) |
| **Research Pts** | CAPITAL + LIBRARY buildings (10 each, tech-scaled) | Tech research             |

### The prestige-goods ring (class economy)
Each of the three classes has an exclusive building that turns one raw resource into a unique
"prestige good," arranged in a directed cycle so no class is self-sufficient:

| Class | Building (class-gated) | Input → Output | Own elite unit | Elite unit's per-turn partner-good dependency |
|---|---|---|---|---|
| NOBLE | Stud Farm | 50 grain → 20 Warhorses | Grand Host | Fed on Relics (HOLY) |
| HOLY  | Reliquary (requires Temple) | 20 gold → 20 Relics | Templar Order | Fed on Spices (GUILD) |
| GUILD | Spice Wharf (requires Port) | 40 fish → 20 Spices | Free Company | Fed on Warhorses (NOBLE) |

NOBLE → HOLY → GUILD → NOBLE. Every class's elite unit is recruited with money/piety plus its
*own* prestige good (a one-time `required_goods`/`goods_amount` cost), but its **ongoing per-turn
upkeep** draws Food plus its trade **partner's** prestige good (the second supply-good slot —
see [Supply (Food)](#supply-food)). Losing access to the partner class's goods (no trade, no war
income, hostile relations) starves the elite army via the normal supply-attrition mechanic —
this is what forces the three classes to trade or fight rather than tech in isolation. Every
tier below the elite unit (buildings, base troops, income) needs zero prestige goods, so a
player with no access to their partner class is never bricked, only capped below the top tier.

Gold is the rarest resource on the map (~4% of land provinces) — HOLY's Relic supply is
therefore the tightest bottleneck in the ring. Fish only exists on water and was previously
completely inert; PORT now produces it directly (`resource_production_key` override — see
[Resource & Goods Production](#resource--goods-production) below), making coastal provinces and
the GUILD class's economy dependent on holding coastline.

### Income Calculation
- Each building type has a flat base `income` value, including MINE — money income
  no longer reads the resource ledger at all (`Resource.plain_income` is unused
  for income; see [DATABASE.md](DATABASE.md#userresource) for why that mechanic
  was reverted)
- Research modifiers apply generically via the `income` effect target (e.g. `economy.monopoly` →
  ×1.1) — see [Tech Tree](#tech-tree)
- Upkeep modifiers apply the same way via the `upkeep` target (e.g., `guild.merchant_guilds` → -15% upkeep)

### Upkeep
- **Building upkeep:** every building's seeded `upkeep` is charged, not a fixed
  FORT/BARRACKS/ARMORY whitelist — that whitelist previously meant 13 of 20 buildings were
  effectively free and let CASTLE strictly dominate FORT (better defense modifier, +100 income,
  and its higher upkeep was never billed)
- **Army upkeep:** `flat_upkeep` (100) + per-unit costs (unit.count / 100 * troopType.upkeep_per_100)
- **Paladins:** upkeep paid in piety instead of money (the *only* troop type whose ongoing
  `upkeep_per_100` is piety — not to be confused with which troop types pay their *recruit* cost
  in piety, a larger set, see [Recruitment Cost](#recruitment-cost))
- **Food is not part of this phase** — army food consumption runs as its own turn phase
  immediately after upkeep, with its own distance-scaled cost and attrition failure mode. See
  [Supply (Food)](#supply-food)

### Resource & Goods Production
Two-pass turn mechanic (`ProductionActionService`) — see [DATABASE.md](DATABASE.md#goods--resource-production-turn-logic) for the full seed-data table:

1. **Resource production (unconditional):** any building with `resource_production_amount` set credits that amount into the owner's `UserResource` stockpile — normally of `province.resource.key` (the province's own resource), but `Building.resource_production_key` can override which resource key gets credited instead. This is what MINE and FORESTRY do each turn (25/turn each in current seed data), and it's how **PORT** produces Fish (25/turn) while sitting on a province whose own resource is something else entirely — it replaced an earlier "+1 static capacity at build time" model, so the stockpile now genuinely accumulates and depletes over time.
2. **Goods production:** requires `isProduction = true` and `production_good_id` set.
   - **Input (optional):** if `production_requirement_resource` is set, atomically reserve (spend) `production_requirement_resource_amount` of it from `UserResource` — production is skipped for the turn if that fails (e.g. ARMORY spends 25 iron/turn to make 25 Weapons; the class prestige buildings spend grain/gold/fish the same way). If null, production is unconditional (CAPITAL → 25 Food/turn, no input).
   - **Output:** `production_amount` units of the good credited to `UserGood`, scaled by the `goods_production` tech effect target (e.g. `economy.trade_efficiency` → ×1.15).
- Resource production always completes before goods production runs, so this turn's mined resources are available to this turn's manufacturing regardless of building order.
- **Food is now a real sink, not a dead end:** `SupplyActionService` spends it every turn on army
  food upkeep (see [Supply (Food)](#supply-food)) — `GET /goods/mine` (the web-map TopBar) is no
  longer the only consumer. **Lumber** has the same one-time-cost-only shape as Bricks: most
  buildings now carry a second one-time construction cost in Lumber (`requirement_good_2_id`/
  `requirement_good_2_amount`) alongside their existing requirement_good, giving Lumber a real
  per-build sink instead of accumulating forever with nothing to spend it on.
- BARN (grain provinces only, 25 grain/turn) closes the loop for GARDEN/FARM's grain input.
  GARDEN produces 35 Food/turn off 5 grain, FARM 50 Food/turn off 10 grain — CAPITAL's
  unconditional 25 Food/turn is deliberately the smallest of the three, a baseline trickle rather
  than the primary food source once an economy is running.

## Buildings

### Building Types
CAPITAL, CAPITOL, FORT, CASTLE, BARRACKS, ARMORY, FARM, GARDEN, MINE, FORESTRY, SAWMILL, BRICKYARD, BARN, LIBRARY, TEMPLE, CATHEDRAL, ROAD, TRADE_HOUSE, BAZAAR, MARKET, PORT, plus the three class-gated prestige buildings: **STUD_FARM** (NOBLE), **RELIQUARY** (HOLY), **SPICE_WHARF** (GUILD) — see [the prestige-goods ring](#the-prestige-goods-ring-class-economy).

### Building Rules
All building validation rules are stored in the DB (editable via admin panel), not hardcoded:

- **Building cap** per province based on landscape type + research unlocks
- **`buildable`** — whether players can construct this building (CAPITAL/CAPITOL = false)
- **`destructible`** — whether players can demolish this building (CAPITAL = false). Demolition costs 100 money
- **`unique_per_province`** — only one allowed per province (MINE, BRICKYARD, FORESTRY, SAWMILL, ARMORY, BARN, FARM, FORT, CASTLE, PORT, STUD_FARM, RELIQUARY, SPICE_WHARF = true)
- **`allowed_province_resources`** — province must have matching resource_type. MINE=['iron','gold','stone'], BRICKYARD=['stone'], FORESTRY/SAWMILL=['wood'], BARN/FARM=['grain']. Null = buildable anywhere. The prestige buildings are null here — like ARMORY, they process a resource drawn from the *national* stockpile (`production_requirement_resource`) rather than requiring the local province to have that deposit
- **`requirement_resource`** + **`requirement_resource_amount`** — one-time raw-resource cost reserved from the `UserResource` stockpile at build/upgrade time, released back on demolish/upgrade-away. ARMORY requires 1 iron, FORT/CASTLE require 1 stone
- **`requirement_good_id`** + **`requirement_good_amount`**, and a second independent slot **`requirement_good_2_id`** + **`requirement_good_2_amount`** — one-time costs paid in goods (`UserGood`) instead of raw resources, both reserved/refunded the same way. BARRACKS requires 25 Weapons, FORT requires 100 Bricks, SAWMILL requires 25 Bricks — most buildings also carry a second-slot Lumber cost (e.g. FORT +100 Lumber) now that Lumber has a real sink. FORESTRY itself is the one exception, deliberately left with no Lumber cost to avoid a bootstrap deadlock (needing Lumber to build the building that produces Lumber)
- **`requirement_tech`** — tech keys that must be researched first
- **`requirement_building`** — building type prerequisite (for upgrades, or e.g. RELIQUARY requiring TEMPLE, SPICE_WHARF requiring PORT)
- **Upgrade chains:** GARDEN → FARM, FORT → CASTLE, FORESTRY → SAWMILL (requires 25 Bricks)
- **Occupied provinces** — BUILD/UPGRADE/REMOVE all reject with `province.occupier_id` set, for
  the legal owner *and* the occupier alike (occupier never gets build rights). See
  [Diplomacy & Occupation](#diplomacy--occupation)

### Defense Buildings
FORT, CAPITOL, CAPITAL, CASTLE, CATHEDRAL — each adds a numeric `modifier` to defense power in combat.

## Armies

### Composition
- Each army has multiple `ArmyUnit` entries
- Each unit references a `TroopType` with attack/defense stats
- Minimum army size: 100 troops (auto-disbanded below this)

### Troop Types
All attack/defense values were rescaled ×10 in the economy/class rework (a pure readability
change — combat resolution is a ratio, so it's mechanically identical to the old 1–3 range, just
easier to read at 10–1000). Base roster: Peasants (2/3, PEASANT), Infantry (10/12, INFANTRY),
Archers (14/7, RANGED), Pikemen (9/18, INFANTRY), Knights (20/15, CAVALRY). Class troops (SPECIAL,
never affected by the counter matrix below): Noble Knights (25/20), Paladins (20/25, piety
upkeep), Mercenaries (18/18, no draft pool) — plus each class's new elite capstone unit, part of
[the prestige-goods ring](#the-prestige-goods-ring-class-economy): **Grand Host** (NOBLE, 40/35),
**Templar Order** (HOLY, 35/45), **Free Company** (GUILD, 38/38, no draft pool).

| Category | Examples | Requirements |
|----------|----------|--------------|
| INFANTRY | Soldiers, Pikemen | BARRACKS building |
| RANGED   | Archers  | BARRACKS + tech |
| CAVALRY  | Knights  | BARRACKS + noble class |
| SPECIAL  | Paladins, Mercenaries, Grand Host, Templar Order, Free Company | class-gated, various buildings |
| PEASANT  | Militia  | No requirements |

### Recruitment Cost
Recruiting troops (ARMY_CREATE/ARMY_RECRUIT) can require up to five things, all
scaled per 100 troops and checked/paid atomically in the same transaction —
recruitment fails outright if any one of them can't be met:
- **Money or piety** (`cost_per_100`) — piety for `PIETY_COST_TROOPS` (Paladins, Templar Order), money for everyone else
- **Draft pool** (`user.troops`) — skipped for troops in `NO_POOL_TROOPS` (Mercenaries, Free Company — hired directly with money)
- **Goods** (`TroopType.required_goods` + `goods_amount`) — an optional one-time reservation from the recruiting player's `UserGood` ledger (same `tryReserve` mechanic as a Building's `requirement_good`), e.g. Knights need 100 Weapons per 100 troops, each class elite unit needs 50 of its own class's prestige good per 100 troops. Null `required_goods` = no goods needed (e.g. Peasants). Not refunded when troops are later removed or the army disbanded, same as the money cost
- **A second, independent goods reservation** (`required_goods_2` + `goods_amount_2`) — same mechanic, same non-refund rule, for troop types that need two distinct one-time goods

### Counter Matrix (composition)
`TroopType.category` is load-bearing, not decorative — each unit's power is scaled by a
composition-weighted counter factor against the *opposing* side's category mix (`armyCategoryMix`/
`armyGroupCategoryMix` in `combat-calculator.ts`), computed **before** the flat power sum:

```
INFANTRY  vs CAVALRY  : +40%      RANGED    vs INFANTRY : +40%      CAVALRY   vs RANGED   : +40%
INFANTRY  vs RANGED   : −30%      RANGED    vs CAVALRY   : −30%      CAVALRY   vs INFANTRY : −30%
```

A clean rock-paper-scissors triangle: pikes/infantry stop cavalry, cavalry rides down archers,
archers shoot infantry. The swing is weighted by how much of the enemy force actually sits in the
countered/countering category — a mono-composition enemy gives the full ±40%/−30%, a 50/50 mix
half that. **SPECIAL and PEASANT are absent from the matrix entirely** — they're neutral on both
sides of every matchup, winning or losing purely on raw stats, and never dilute or benefit from
composition. This applies identically in both combat resolution paths (move-triggered and
multi-faction) — see [Multi-Faction Combat](#multi-faction-combat).

Province control requirement: `(province.user_id === caller && !province.occupier_id) ||
province.occupier_id === caller` — i.e. the legal owner may recruit only while
**not** occupied, and an **occupier** may recruit at any `can_recruit` building
in a province they occupy (the fort-use carve-out from
[Diplomacy & Occupation](#diplomacy--occupation)).

### Movement
- **One army action per turn** — an army may have at most one of `ARMY_MOVE` / `ARMY_MERGE` /
  `ARMY_TRANSFER` pending at a time (see [Merging & Transferring Troops](#merging--transferring-troops)
  below). Enforced at queue time (`ActionsService.assertNotDuplicate`, which locks every army id
  referenced by any pending one of these three) and, for moves specifically, also in the executor
  via `ExecutionContext.movedArmyIds`.
- **Adjacent:** always allowed to neighboring provinces
- **Road-based:** up to 2 hops (3 with `military.best_logistics` tech)
  - Every intermediate province must have ROAD building
  - Every intermediate province must be owned by the moving player
  - The final target itself needs neither a road nor ownership
- Armies may move onto and fight on **water** provinces, but water can never be owned
- **Diplomatic gate on entering another player's territory** (see
  [Diplomacy & Occupation](#diplomacy--occupation)): an ally or a troops-pass
  grantee always enters peacefully (no combat, no occupation change); absent
  passage, entry is only allowed while hostile (`NEUTRAL`/`WAR`) — a signed
  `PEACE` with no passage rejects the move outright

### Merging & Transferring Troops
Two actions consolidate or rebalance troops between two of the caller's own armies that are
**already in the same province** — any province; ownership of the province itself is irrelevant,
only that both armies belong to the caller and share a `province_id` (works equally in your own
territory, a raided enemy province, or at sea).

- **ARMY_MERGE** (`source_army_id`, `target_army_id`, must differ) — dissolves the source army:
  every one of its units is added into the matching troop type on the target (a new `ArmyUnit`
  row is created if the target doesn't already have that type), then the source army and its
  units are deleted outright. One-directional; no minimum-size check on the source since it's
  being destroyed anyway.
- **ARMY_TRANSFER** (`army_a_id`, `army_b_id`, `transfers: [{ troop_type_key, from_army_id,
  to_army_id, count }]`) — a rebalance where **both** armies survive. Each `transfers` entry
  moves `count` of one troop type between the two named armies in either direction (a client
  typically nets each troop type to a single line). After every transfer applies, **both**
  armies must still hold at least `ARMY_MIN_SIZE` (100) troops — see [Composition](#composition)
  above — or the whole action fails atomically; nothing is partially applied.

`ArmyMergeHandler`/`ArmyTransferHandler` (`api/src/actions/action-executor.service.ts`) each run
in one pessimistic-locked transaction over both armies. The web client's "Manage Armies" panel
(see [WEB-MAP.md](WEB-MAP.md#manage-armies-modal)) surfaces both actions behind a single
Merge/Transfer mode toggle whenever the player has 2+ of their own armies in the selected
province.

### Water & Naval Movement
- **Armies can't enter water by default.** Embarking (land → water) requires a **Port**
  building (`BuildingTypes.PORT`) in the army's actual current province — evaluated
  regardless of whether the move is direct-adjacent or a multi-hop road path, since the
  road-reach BFS above doesn't require the final target to be owned/roaded. Buildable only
  in a province with `requires_neighbor_water: true` and at least one neighboring `water`
  province (checked at BUILD time, `BuildActionHandler` in `action-executor.service.ts`).
- **Disembarking (water → land) is unrestricted** — no Port needed on either side, land onto
  any province subject to the normal adjacency/combat/diplomacy rules.
- **Water → water movement is free** — no Port needed once already at sea (water provinces
  can never have a Road building either, since they're never ownable/buildable, so
  departures from water always resolve via direct adjacency).
- **Time limit:** an army may spend `DEFAULT_WATER_TURNS` (6, `tech-effects.service.ts`)
  consecutive turns on water before it is lost. A `water_turns_bonus` tech effect (see
  [Tech Tree](#tech-tree), e.g. `military.seafaring`, +4) extends this. `Army.water_turns`
  increments once per turn while on water and resets to 0 on landing
  (`tickArmyWaterResidency`, scheduler's post-combat diplomacy-tick phase, modeled on
  `Province.occupation_turns`/`tickOccupations`). Exceeding the allowance
  (`water_turns > allowed`) deletes the army — it survives exactly the allowed number of
  turns, dying on the turn after.

### Supply (Food)
Every turn, right after money/piety upkeep, `SupplyActionService` (`api/src/actions/
supply-action.service.ts`, pure helpers in `supply-utils.ts`) charges each army Food based on its
troop composition and how far it has strayed from friendly infrastructure. This is what gives
Food — otherwise a dead-end good — an actual sink, and makes deep offensives a logistical
tradeoff rather than a free action.

- **Base cost:** per unit, `ceil(unit.count / 100) * troopType.supply_per_100` of
  `troopType.supply_good_id` (Food in the current seed data; null/0 on either field = that troop
  type eats nothing), plus the same for a **second, independent slot** —
  `troopType.supply_good_2_id`/`supply_per_100_2` — used by the three class elite units to draw
  their per-turn partner-good dependency (see [the prestige-goods ring](#the-prestige-goods-ring-class-economy)).
  Summed per army, per good; both slots go through the identical distance-scaling and
  all-or-nothing payment logic below.
- **Free radius is tech-scalable:** `SUPPLY_FREE_RADIUS` (4) is the base; the `supply_range`
  effect target (e.g. `economy.logistics` +2, `guild.smuggling_routes` +1) extends it per player,
  via `TechEffectsService.supplyRange()`.
- **Supply buildings:** `Building.supply_building` (admin-editable; seeded true on CAPITAL, FORT,
  CASTLE — not CATHEDRAL, and not PORT). A province counts as a source for whichever player
  currently *controls* it — the same predicate recruitment eligibility uses:
  `(province.user_id === userId && !province.occupier_id) || province.occupier_id === userId`.
  An **occupied fort supplies its occupier, not its legal owner** — capturing an enemy fort
  extends your supply network into their territory, and losing one to occupation cuts yours.
- **Distance:** a per-user multi-source BFS over `neighbor_ids` (`supply-utils.ts`'s
  `bfsDistances`, depth-bounded to 16) from every supply building the user controls, run once per
  turn. Traverses *any* province regardless of owner — supply range is pure geography, not gated
  by territory control in between (unlike the road-reach BFS used for movement). Each army's
  distance to the nearest source is written to `Army.supply_distance` (null = none reachable
  within 16 tiles) so the frontend and the income projection can read it without recomputing.
- **Distance multiplier:** `SUPPLY_FREE_RADIUS` (4) tiles are penalty-free (`×1.0`). Beyond that,
  linear: `1 + SUPPLY_PENALTY_PER_TILE(0.25) × (distance − 4)`, capped at `SUPPLY_MAX_MULTIPLIER`
  (4.0, reached at distance 16 — also what an unreachable army pays).
- **Payment order:** per user, armies are fed in ascending multiplier order (home garrisons before
  far-flung expeditions; ties broken by army id) via `UserGoodsService.tryReserve`. Paying an
  army's food cost is all-or-nothing across whatever goods it draws on — a partial shortfall on
  one good starves the whole army rather than partially feeding it.
- **Starvation (attrition):** an unfed army loses `ceil(unit.count × SUPPLY_ATTRITION_RATE)` (10%)
  from every unit that turn, and a single `SYSTEM`/`WARNING` notification is sent per user (not
  per army). This does **not** delete the army outright, even if it now sits below
  `ARMY_MIN_SIZE` — the existing `disbandWeakArmies()` post-processing step (see
  [Execution Order](#execution-order)) catches that later the same turn, so there is exactly one
  place in the codebase that decides "this army is too small to exist."
- **Projection:** `GET /users/:id`'s `projectedFood` (net Food/turn: CAPITAL/FARM/GARDEN
  production minus every army's *stored* `supply_distance` run back through the same cost
  formula) uses the identical pure functions `SupplyActionService` does, so the number shown
  before a turn can never drift from what that turn will actually charge.

### Visibility (Fog of War)
- Own armies: always visible with full unit composition, regardless of location
- Enemy armies: visible (full composition + total count) only if stationed in a province that is owned by the player OR adjacent to a player-owned province
- Enemy armies outside this radius are hidden entirely (not returned by the API)
- Province buildings follow the same idea from the other direction: non-owned provinces only
  reveal buildings whose `Building.visible` flag is true (e.g. CAPITAL/FORT, always visible;
  most others aren't) — see [DATABASE.md](DATABASE.md#building)
- **Moderator bypass:** an ADMIN/MODERATOR with the client's Mod switch on gets both of the
  above lifted entirely — every player's armies and buildings, unfiltered, everywhere on the
  map. Server-enforced via `resolveModFogBypass` (`api/src/utils/mod-visibility.ts`), which
  only honors the client's `X-Mod-Full-Visibility` header after independently confirming the
  *real* authenticated actor (not an impersonated NPC) is ADMIN/MODERATOR — see
  [API.md](API.md#auth--mod-no-fog-of-war-toggle).

## Combat System

### Power Calculation
```
Attack Power  = sum(unit.count * troopType.attack * counterFactor(unit.category, defenderMix))
Defense Power = sum(unit.count * troopType.defense * counterFactor(unit.category, attackerMix))

Building Modifier = sum(defensive_building.modifier)  for buildings in province
Final Defense = Defense Power * max(Building Modifier, 1.0)
```
`counterFactor` is the [Counter Matrix](#counter-matrix-composition) composition scaling —
1.0 (no change) for any unit whose category isn't in the matrix, or when the opposing side has
none of the categories it counters/is-countered-by.

### Outcomes

**Attacker wins** (attackPower > defenderPower):
- Attacker casualty rate = `defenderPower / (attackerPower + defenderPower)`
- Defender loses ALL armies (this "loser fully wipes" rule predates the water feature —
  it already applied here for land)
- Attacker gains **control** of the province via `OccupationService.applyControlResult` on
  land — empty land is claimed outright, but a province with a different legal owner is
  **occupied**, not annexed (skipped on water, which has no ownership). See
  [Diplomacy & Occupation](#diplomacy--occupation)
- If attacker < 100 troops after casualties → army disbanded

**Defender wins** (defenderPower >= attackerPower):
- **On land:** attacker retreats to source province with partial casualties —
  `min(0.8, (defenderPower / (attackerPower + defenderPower)) * 1.4)` (capped at 80%);
  defender takes `(attackerPower / (attackerPower + defenderPower)) * 0.7`. Minimum 5%
  casualties per battle either way (`CASUALTY_FLOOR = 0.05`, prevents stalemates). Either
  side is disbanded if it drops below 100 troops.
- **On water:** the attacker (loser) is **always fully deleted** — no partial-casualty
  survival at sea, regardless of casualty math. The defender (winner) still takes the same
  partial casualties as on land.

### Water Combat Modifiers
Fighting on a water province scales every unit's attack/defense by its `TroopType.
water_combat_modifier` (default 1.0, admin-editable in the Troop Types tab) before the power
comparison above — e.g. Cavalry seeded at 0.2 (−80%) fights at a fraction of its land
strength at sea; other categories have smaller seeded penalties (Infantry/Pikemen 0.6,
Ranged 0.55, Special/class troops 0.5). This composes with the existing bankruptcy penalty
and tech `army_attack`/`army_defense` effects exactly like the land power calculation.

### Multi-Faction Combat
When 2+ users have armies in the same province — including **water**, where combat only
resolves here (there's no per-turn "owner defends" concept, and this is the only path that
catches hostility arising *without* a move, e.g. an alliance breaking while armies are
already co-located at sea) — resolved in post-processing (`resolveArmyConflicts` triggers
when `userIds.size > 1`):
1. Province owner is initial defender (if no owner army present — always true on water — the
   lowest-sorted user id takes provisional **defender**, without changing legal ownership)
2. Only armies **hostile** to the defender count as attackers — an ally's or
   troops-pass grantee's army co-locates peacefully and is ignored here
3. Attackers engage in a **deterministic order** — strongest total attack power
   first (water-modified, see above), ties broken by user id
4. Each attacker fights the defender sequentially; the winner becomes the new
   defender for the next attacker. On land the winner gains control via
   `applyControlResult` (occupy, not annex, if the province belongs to someone else); water
   has no ownership to claim, so this step is skipped there. The same water-only
   "loser is always fully deleted" rule from Outcomes above applies here too.

This path now applies `army_attack`/`army_defense` tech effects and the counter matrix
identically to the move-triggered path in `ArmyMoveHandler` — previously a documented asymmetry
(this batch path skipped tech effects entirely), fixed so the same battle resolves the same way
regardless of which code path handles it.

## Diplomacy & Occupation

Real-time REST (`/diplomacy/*`, [API.md](API.md)), not queued actions — treaty offers must persist
across turns awaiting a reply. Core services: `DiplomacyService` (relations/wars/passage),
`OccupationService` (province control), `TreatyService` (propose/accept/peace/trade) in `api/src/diplomacy/`.

### Diplomatic States
Per unordered player pair, stored lazily in `DiplomaticRelation` (absent row = `NEUTRAL`):
- **NEUTRAL** (default) — attacks allowed
- **WAR** — attacks allowed; tied to an explicit `War` entity (see below)
- **PEACE** — enforced truce, attacks blocked; decays to `NEUTRAL` after `PEACE_DURATION_TURNS` (4 turns)
- **ALLIANCE** — attacks blocked, mutual passage, mutual defense (call-to-arms); breaking an alliance
  sets the pair to `NEUTRAL` (not peace)

### Wars
Every hostility (a `POST /diplomacy/declare-war`, or a NEUTRAL-relation attack that lands a hit) creates
or joins an explicit `War` with an **attacker leader** and **defender leader** plus a `WarParticipant`
list split into `attacker`/`defender` sides. You cannot declare war on an ally (must break the alliance
first) or during an active `PEACE` truce.

**Call-to-arms:** when X attacks Y, each of Y's allies is called to the **defender** side (auto `WAR`
with X). An ally that is *also* allied to X breaks that alliance first (and evacuates any
now-illegally-parked armies on both sides) before joining Y's side. Concrete example: U1 is allied to
both U2 and U3 (U2/U3 not allied to each other); U2 attacks U3 → U1 breaks its alliance with U2 and
joins U3's side.

### Occupation (not instant conquest)
Winning military control of a province (`OccupationService.applyControlResult`, called from
`ArmyMoveHandler` and the scheduler's `resolveArmyConflicts`/`syncProvinceOwnershipWithArmies`) decides:
- **Empty land** (`user_id` null) → direct claim, no occupation
- **Your own core, currently occupied by someone else** → retake: occupation cleared
- **Someone else's core province** → **occupy**: `Province.occupier_id` set, `occupation_turns` reset to
  0, `user_id` (legal owner) **unchanged**. Escalates the pair to `WAR` if it wasn't already.

While occupied:
- The **occupier** cannot build/demolish/upgrade, but **can recruit and defend at the province's fort**
  (any building with `can_recruit`) — see the ARMY_CREATE/ARMY_RECRUIT guards in
  [API.md](API.md#action-types-enum)
- The **legal owner** is cut off: cannot build there either, and the province is skipped entirely by
  income/production/upkeep (nobody earns from it) — see `income-action.service.ts`,
  `production-action.service.ts`, `upkeep-action.service.ts` (`if (province.occupier_id) continue`)
- A province **auto-cores** to the occupier (legal ownership transfers, occupation clears) after
  `OCCUPATION_CORE_THRESHOLD` (10) turns, ticked every turn in the scheduler's diplomacy phase, or
  immediately via a peace treaty's `cede_province` article

### Treaties
`Treaty` entity, propose → accept/reject (war is the only unilateral/instant diplomatic action). Every
treaty has a player-supplied `name` and is `public` (viewable by any player via
`GET /diplomacy/treaties/public/:userId`, the web client's "Player Treaties" button) or `private`.
Pending proposals older than `TREATY_EXPIRY_TURNS` (4 turns) auto-reject.

- **Peace** (`peace_scope: leader | separate`) — ends a war. Demanded/ceded provinces (`cede_province`
  articles) must be **contiguous** to the receiving party's existing territory (EU4-style; BFS over
  `neighbor_ids`, chained through other ceded provinces in the same treaty) — no random enclaves. No
  warscore: any contiguous demand is allowed, plus optional money/resource tribute articles.
  - **Leader peace** (attacker leader ↔ defender leader): accepting **ends the whole war** — every
    opposing pair across both sides goes to `PEACE`, any occupied-but-not-ceded provinces between them
    return to their owner, and non-leader allies receive a **view-only** copy of the settled treaty
    (`Treaty.view_only = true`, cannot accept/reject).
  - **Separate peace** (attacker leader ↔ a non-leader enemy ally): may cede **only that ally's occupied
    provinces** (`province.user_id === receiver && province.occupier_id === proposer`). Accepting makes
    that ally **leave the war** and **break its alliance** with its side leader, going to `PEACE` with
    the attacker — the leaders' war continues.
- **Alliance** — sets the pair to `ALLIANCE` (`set_state` article). Rejected while at `WAR`.
- **Trade** — money/resource/goods transfer articles. Money can be sent to anyone
  (`POST /diplomacy/send-money`, no treaty needed) **except an enemy currently at `WAR`** with you.
  Goods/resources additionally require the pair to be **trade-connected**
  (`DiplomacyService.tradeConnected`): a shared border, or a chain of bordering intermediates who have
  each granted troops-pass to one of the two traders. `recurring: true` re-applies the transfer articles
  every turn (`TreatyService.processRecurringTrades`, called from the scheduler's economy transaction); a
  side that can't pay simply skips that turn. Proposing a `trade` treaty is itself rejected while at `WAR`
  with the receiver, same as alliance.
- **Troops Pass** (`grant_pass` article, `{from, to}`) — directional: `from` lets `to`'s armies enter
  its territory without occupying/war. Alliance implies both directions implicitly (checked via state,
  not via the pass flags). Rejected while at `WAR` with the receiver, same as trade/alliance.
- **Article** — pure Markdown text (`note`), no mechanical effect. RP-only.

Any signed `alliance` or `troops_pass` treaty can be cancelled by either party at any time
(`POST /diplomacy/treaties/:id/cancel-signed`) — alliance cancellation sets the pair to `NEUTRAL`.
Cancelling either kind calls `DiplomacyService.evacuateForeignArmies`: every foreign army on the
canceller's territory that isn't at war with them teleports to its owner's nearest fort/capital-tier
province, else nearest owned province, else stays put if the owner holds no provinces at all.

## Tech Tree

### Branches
- **Economy** (14 techs) — income bonuses, upkeep reduction, goods-production throughput,
  landscape-conditioned building cap increases (Plains/Mountain), supply range
- **Military** (13 techs) — attack **and** defense bonus ladders (mirrored — defense previously
  had no techs at all), logistics (road range, supply range), troop-pool rate, troop unlocks
- **Class-specific** (any branch whose string equals a `PlayerClass.key` — noble/holy/guild by
  default, plus any admin-created class; 8 techs each) — exclusive units, abilities, buildings,
  ending in the class's elite-unit capstone

Tech costs are tiered T1=50, T2=150, T3=400, T4=800 (rescaled ×10 alongside combat stats — see
[Troop Types](#troop-types)); research point generation was scaled to match (10 RP/turn per
CAPITAL or LIBRARY, up from 1). `capitalCount` in the income/research tick now genuinely counts
owned, unoccupied CAPITAL buildings — it was previously hardcoded to `1` regardless of actual
count (or occupation state), silently flattening any `add_scaled`-by-`capitalCount` effect to a
constant.

### Class System
Classes (`noble`/`holy`/`guild` by default) live in the DB (`classes` table, `PlayerClass`
entity, `api/src/classes/`) rather than a hard-coded enum, so an admin can add new ones or hide
existing ones from the Classes tab without a deploy. A class's `key` must equal the `Tech.branch`
string it gates — that coupling (here, `CLASS_RESTRICTED_TROOPS` in `armies.service.ts`/
`action-executor.service.ts`, and the HOLY piety projection in `users.service.ts`) is pure string
equality, not a foreign key. See [DATABASE.md](DATABASE.md#playerclass).

- Players start classless; researching a **class root** tech selects specialization (unchanged).
  An admin can *also* set `User.class` directly in the Users tab — both paths are equally valid
  and either one locks in the class the same way.
- **Visibility (`PlayerClass.is_visible`, default true)** — a hidden class's branch techs are
  dropped from `GET /techs` for **every** user, including one already assigned to it
  (`TechsService.getAvailableForUser`); `POST /techs/select` also rejects selecting one directly.
  Because the research modal's tabs are just the distinct branches present in whatever `GET
  /techs` returns ([WEB-MAP.md](WEB-MAP.md#research-modal--branch-tabs)), hiding a class makes
  its tab and tree disappear on the frontend with no frontend change needed.
- **NOBLE** — Knights (cavalry), Castle, Stud Farm (Warhorses), Grand Host (elite, fed on Relics)
- **HOLY** — Paladins (piety-based), Cathedral, Reliquary (Relics), Templar Order (elite, fed on Spices)
- **GUILD** — Mercenaries (no draft consumption), Spice Wharf (Spices), Free Company (elite, fed on Warhorses)

### Research Effects (Modifiers) — data-driven engine
A tech's mechanical effect is **data**, not code: a nullable JSON `effects: TechEffect[]`
column on `Tech`, edited via the admin panel's Effects builder (or raw JSON), interpreted
generically by `TechEffectsService` (`api/src/techs/tech-effects.service.ts`). Types live in
`api/src/techs/effect-types.ts`.

Each `TechEffect` is `{ target, op, value, scaleBy?, when?, note? }`:
- **`target`**: `income` | `upkeep` | `research_points` | `building_cap` | `army_attack` |
  `army_defense` | `road_hops` | `water_turns_bonus` | `goods_production` | `supply_range` |
  `troop_pool` — the last three added in the economy/class rework: `goods_production` (multiply)
  scales every building's `production_amount`; `supply_range` (add) extends
  `SUPPLY_FREE_RADIUS`; `troop_pool` (add/multiply) scales the per-building draft-pool rate
  (default 50, see [Resources](#resources))
- **`op`**: `add` | `add_scaled` (value × a whitelisted ctx quantity, e.g. `provinceCount`,
  `capitalCount`, `barracksCount`, `farmGardenIncome`) | `multiply` | `set`
- **`when`**: `{ landscape?, resource? }` — `building_cap` only, filters by province
- Application order per hook: `base` → last `set` wins → sum all `add`/`add_scaled` → apply
  all `multiply` (product) → round (`Math.round` for income/army/RP, `Math.floor` for upkeep,
  integer for building_cap/road_hops). Adds are applied **before** multiplies — this is an
  intentional stacking-order change from the old hardcoded maps.

`TechEffectsService.apply(target, base, ctx, completedResearch[])` is called from every
consumption site: `income-action.service.ts` (income + `research_points`),
`upkeep-action.service.ts` (upkeep), `action-executor.service.ts` (`army_attack`/
`army_defense`/road hops/building cap), `provinces.service.ts` (building-cap display),
`users.service.ts` (income/upkeep/RP **projections**, routed through the same `apply(...)`
calls so they can't drift from the real turn logic), and `action-scheduler.service.ts`'s
`tickArmyWaterResidency` (`water_turns_bonus`, via the `waterTurnsAllowed()` wrapper — see
[Water & Naval Movement](#water--naval-movement)). `computeBuildingCap()` and
`LANDSCAPE_BUILDING_CAPS` (base cap per landscape: plains 4, forest/hills 3, mountain/desert/swamp
2 — `hills` and `swamp` previously fell through to a default because they were missing from the
table, and a dead `coast` entry was removed since no province in the map data carries that
landscape) also live in this service.

### Research progress (per-turn accrual, not instant-complete)
Selecting a tech no longer pays a cost out of a stockpile and completes instantly — it just
sets `User.active_research_key` (a single active research slot; selecting a different tech
switches the slot, **not** losing progress on the old one). Unlike every other player action,
this is **not** a queued `ActionQueue` row: `POST /techs/select` (`TechsService.
selectActiveResearch`) applies immediately, synchronously, in its own transaction — the same
"can't wait for a turn tick" reasoning as instant CAPITAL placement on province setup. If it
were queued like `BUILD`/`ARMY_MOVE`, the selection itself would take a full tick to be picked
up before `active_research_key` even changes, on top of the tick income already runs before
actions execute — costing up to two wasted turns of research before accrual starts. `RESEARCH`
is a retired/rejected `ActionType` (see API.md) for this reason. `research_points` is now a
**per-turn rate** (research speed from CAPITAL/LIBRARY buildings + `research_points` tech
effects), recomputed and overwritten every income tick rather than accumulated.

Each income tick, `IncomeActionService` adds that turn's research rate to a per-`(user, tech)`
`UserTechProgress.progress` row (`UserTechProgressService`, lazily created, one row per tech
ever started). Once `progress >= tech.cost`, the tech completes: added to
`completed_research`, the progress row is deleted, `active_research_key` is cleared, and
class is assigned if `tech.isClassRoot`. `GET /techs` annotates every tech with the caller's
saved `progress` (`0` if never started) for the tech-tree UI to render partial-progress bars.

### Prerequisite System
- Each tech has a `prerequisites` array of tech keys
- Must research all prerequisites before unlocking
- Class-root techs only visible if not yet classed or already that class
- Non-root techs in a class branch (any branch matching a `PlayerClass.key`) require the player
  to already hold that class
- Techs in a **hidden** class branch (`PlayerClass.is_visible = false`) are never visible or
  selectable, by anyone — see [Class System](#class-system)

## Province Setup (New Player)
1. Player selects unclaimed province
2. CAPITAL building placed automatically — this is a direct, synchronous write in `ProvincesService.setupStart` (all in one transaction), **not** queued as a BUILD action, since the player can't wait for the next turn tick to get their capital
3. Player receives 3000 troops + 5000 money + 10 research points
4. Starting goods granted directly to the `UserGood` ledger in the same transaction: 200 Lumber, 500 Food (see `STARTING_GOODS` in `provinces.service.ts`)
5. `is_new` flag set to false

## Colonization
- Target must be a **land** province (water cannot be colonized), unowned, and
  adjacent to a player-owned province
- Costs 500 money
- Queued as COLONIZE action
