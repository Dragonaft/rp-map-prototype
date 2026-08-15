# Map Generator — CLI Tool

## Stack

- **TypeScript** (ts-node for dev, tsc for build)
- **Dependencies:** fast-xml-parser, pngjs, potrace (note: `potrace` is declared but currently unused — PNG import uses a hand-rolled border tracer + Douglas-Peucker)

## Purpose

Generates `provinces.json` — the map data consumed by the API. This is a **local CLI tool**, not containerized, not part of the runtime system.

## Integration Workflow

```
1. Run CLI locally to generate map
2. Copy output to api/data/provinces.json
3. Run `npm run import:provinces` in api/ to insert into MySQL
4. API serves provinces via REST endpoints
5. Frontend renders SVG polygons from province.polygon strings
```

Step 3 also recomputes and stores a content checksum of the map
(`game_settings.map_checksum`) so every web client's localStorage layout cache
automatically detects and refreshes past this re-import — no manual cache-busting
step needed on the frontend side. See
[GAME-MECHANICS.md](GAME-MECHANICS.md#map-checksum--layout-cache-invalidation).

## Output Format

Array of province objects:
```json
{
  "polygon": "M220 150 H260 V190 H220 Z",   // SVG path commands
  "type": "land|water",
  "landscape": "plains|forest|mountain|hills|swamp|desert",
  "resource_type": "iron|wood|grain|stone|gold|fish|null",
  "user_id": null,
  "region_id": "prov-0-0",
  "neighbor_regions": ["prov-0-1", "prov-1-0"]
}
```

## Four Generation Modes

### 1. Grid Generation (`generate`)
Procedural via Fractal Brownian Motion (fBm) noise + radial island bias (single-landmass
default), or a Voronoi-margin multi-continent mask when `--continents > 1`.

```bash
npx ts-node src/index.ts generate \
  --rows 12 --cols 16 --seed 42 \
  --continent-scale 0.25 --land-threshold 0.33 \
  --rivers 3 --max-river-length 25 \
  --wrap-x true \
  --width 4800 --height 3600 --out ./out
```

- Seeded RNG (LCG) for reproducible maps
- 4-octave noise with smoothstep interpolation
- Radial bias creates natural island/continent shapes
- River carving: greedy downhill walk from peaks to water (wrap-aware — respects `--wrap-x`)
- Landscape assignment by elevation bands (mountain > hills > forest > plains)
- `--wrap-x true` makes columns wrap east↔west (cylinder/globe map) — the west-most column
  becomes a neighbor of the east-most. Rows never wrap; top/bottom are hard poles. Also
  accepted by `generate-region` (below) and by the standalone `rewrap` command.

#### Multiple continents (`--continents`)

Separate landmasses with sized water channels between them — built for the water-armies
feature: armies need a **Port** to embark, move freely once at sea, and are lost after
`DEFAULT_WATER_TURNS` (6, `api/src/techs/tech-effects.service.ts`) consecutive turns on
water, or 10 with the `military.seafaring` tech (+4). A channel wider than 10 tiles is
uncrossable by anyone; size gaps with that ceiling in mind.

```bash
npx ts-node src/index.ts generate \
  --rows 20 --cols 30 --continents 3 --gaps "4,4,8" \
  --lakes 3 --polar-rows 1 --coast-noise 0.8 \
  --rivers 4 --max-river-length 25 \
  --wrap-x true --seed 13 \
  --width 4800 --height 3600 --out ./out
```

- `--continents N` — number of landmasses. Each gets a seed placed via Mitchell's
  best-candidate sampling (wrap-aware), spreading continents out on the map/cylinder.
- `--gaps "4,4,8"` — water-channel width per continent pair, comma-separated,
  `continents*(continents-1)/2` values required. Sorted descending and matched to continent
  pairs sorted by seed distance descending, so the widest value always lands between the two
  furthest-apart continents. `--gap 4` sets a single fallback width for every pair instead.
- Land/water is decided by a Voronoi margin: for each cell, `d1`/`d2` are the distances to the
  nearest and second-nearest continent seed; a cell is water if it's within the pair's `gap`
  of the boundary between them. **This replaces `--continent-scale`/`--land-threshold` as the
  land/water decision** in this mode — elevation noise still exists and still drives
  landscape/river placement, but no longer decides the coastline.
- `--coast-noise` (default `1.0`) adds fBm jitter to the margin so coastlines aren't perfectly
  straight bisector lines.
- `--polar-rows N` (default `1` when `--continents > 1`) forces the top/bottom N rows to
  water. With `--wrap-x` there are no east/west map edges, so this is the only coastline the
  map gets for free.
- `--lakes N` carves N small (2-3 cell) inland lakes, rejecting any candidate that touches
  existing water (keeps them genuinely inland) or that would split a landmass in two.
- **Geometry note:** with 3+ continents, a straight line between the two furthest-apart seeds
  can pass near a third continent, and the direct sea route detours around its landmass —
  so a requested gap can come out wider than asked. This is real map topology, not a bug: the
  command prints the *measured* gap (shortest direct-water-only route) for every continent
  pair after generation, plus a warning if any pair exceeds 10 tiles (uncrossable even with
  Seafaring). Treat `--gaps`/`--gap` as a target and `--seed` as the tuning knob — rerun with a
  different seed if a measured gap lands where you don't want it.

### 2. GeoJSON Region (`generate-region`)
Overlays procedural grid on real-world geography.

```bash
npx ts-node src/index.ts generate-region \
  --land ne_50m_land.geojson --seas ne_110m_geography_marine_polys.geojson \
  --rows 30 --cols 50 --bbox "-30,25,70,75" \
  --noise 0.4 --wrap-x true --rivers 3 --max-river-length 25 \
  --width 4800 --height 3600 --seed 42 --out ./out
```

Also accepts `--width`, `--height`, `--seed`, and `--max-river-length` (same
meaning as in `generate`).

- Point-in-polygon test against Natural Earth land polygons
- Optional noise blurs coastlines
- Named seas (Mediterranean, Arctic) become single large provinces
- Flood fill removes enclosed water artifacts
- Supports `--wrap-x true` for seamless world looping

### 3. SVG Import (`import-svg`)
```bash
npx ts-node src/index.ts import-svg --svg ./map.svg --out ./out
```

- Parses `<path id="..." d="..." data-type="land" data-landscape="forest" />` — any `id` becomes the `region_id` (not just `prov-N`); `data-type` other than `water`/`land` (e.g. `coastal`) falls back to `land`
- Point-matching detects shared path points for neighbor detection

### 4. PNG Import (`import-png`)
```bash
npx ts-node src/index.ts import-png --png ./map.png --min-size 10 --simplify 2.0 --out ./out
```

- Flood fill detects colored regions
- Border tracing extracts outlines → SVG paths
- Douglas-Peucker simplification

### Rewrap Neighbors (`rewrap`)
Recomputes `neighbor_regions` on an existing pure-grid (`prov-<row>-<col>`) map with east-west
wrap, without regenerating terrain — e.g. to turn a previously-generated flat map into a
globe, or to undo wrapping.

```bash
npx ts-node src/index.ts rewrap --file ./out/provinces.json [--out ./out/provinces.json] [--wrap-x true]
```

- `--wrap-x` defaults to `true` here (opposite of `generate`'s default); pass `--wrap-x false`
  to unwrap instead.
- Only neighbors change — polygon, type, landscape, and resources are preserved.
- Requires every cell of the grid to be present; errors out on non-grid region ids.
- Omit `--out` to overwrite the input file in place.
- Prints a neighbor-count distribution as a sanity check: with wrap-x, pole rows (top/bottom)
  should show 3 neighbors and every other cell 4.

### Validation
```bash
npx ts-node src/index.ts parse --file ./out/provinces.json
```

## File Structure

```
map-generator/
├── src/
│   ├── index.ts           CLI entry point, argument parser, command router
│   ├── generateGrid.ts    Grid generation (fBm, rivers, landscapes)
│   ├── generateRegion.ts  GeoJSON overlay generation (~650 lines)
│   ├── importSvg.ts       SVG path parsing & neighbor detection
│   ├── importPng.ts       PNG flood fill, border tracing, simplification
│   ├── parseMap.ts        JSON validation utility
│   └── types.ts           TypeScript interfaces
├── ne_50m_land.geojson           Natural Earth land polygons (2.3 MB)
├── ne_110m_geography_marine_polys.geojson  Sea features (1 MB)
├── test-map.svg                  SVG example
├── test-usa-subdivision-map.png  PNG example
└── test-world-subdivision-map.png  Large world map example
```

## Key Algorithms

| Algorithm | Usage |
|-----------|-------|
| Fractal Brownian Motion (fBm) | Elevation/terrain noise |
| Linear Congruential Generator | Seeded RNG for reproducible maps |
| Ray-casting point-in-polygon | GeoJSON land detection |
| Sutherland-Hodgman clipping | GeoJSON polygon clipping |
| Greedy downhill flood fill | River generation |
| BFS (4-directional) | Connectivity, ocean flood fill |
| Douglas-Peucker | Path simplification (PNG import) |
