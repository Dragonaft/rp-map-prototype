# rp-map-prototype — Map Generator

Local TypeScript CLI that produces `provinces.json`, the map data the API imports and every
frontend renders. Not containerized, not part of the runtime system — you run it locally, copy
its output into `api/data/`, then run the API's import script.

For the full algorithm writeup (fBm noise, river carving, GeoJSON clipping, flood fill) see
[`.ai-docs/MAP-GENERATOR.md`](../.ai-docs/MAP-GENERATOR.md). This README covers setup and the
current CLI surface.

## Installation

```bash
cd map-generator
npm install
```

## Commands

Run any command with no arguments (`npx ts-node src/index.ts`) to print the full in-CLI usage
summary, which is always kept in sync with the flags below.

### `generate` — procedural grid map

Fractal Brownian motion (fBm) noise with a radial island bias produces natural-looking continent
shapes; rivers are carved as greedy downhill walks from high-elevation land tiles to water.

```bash
npx ts-node src/index.ts generate \
  --rows 12 --cols 16 --seed 42 \
  --continent-scale 0.25 --land-threshold 0.33 \
  --rivers 3 --max-river-length 25 \
  --width 4800 --height 3600 --out ./out
```

| Flag | Default | Description |
|---|---|---|
| `--rows` | `10` | Grid rows |
| `--cols` | `10` | Grid columns |
| `--width` | `4800` | Canvas width in px (cell width = width / cols) |
| `--height` | `3600` | Canvas height in px |
| `--seed` | random | Integer seed — same seed always produces the same map |
| `--continent-scale` | `0.25` | Noise frequency — lower = bigger landmasses, higher = fragmented islands |
| `--land-threshold` | `0.33` | Elevation cutoff for land (0–1) — raise for more water |
| `--rivers` | `3` | Number of river paths to attempt |
| `--max-river-length` | `25` | Max tiles per river before giving up |
| `--wrap-x` | `false` | Pass `true` to mark left/right-edge columns as neighbors, for seamless horizontal world wrap |
| `--out` | `./out` | Output directory |

### `generate-region` — real-world GeoJSON overlay

Overlays the same procedural grid onto real-world geography via point-in-polygon classification
against Natural Earth (or any compatible) land/sea GeoJSON.

```bash
npx ts-node src/index.ts generate-region \
  --land ./ne_50m_land.geojson --seas ./ne_110m_geography_marine_polys.geojson \
  --rows 30 --cols 50 --bbox "-30,25,70,75" \
  --noise 0.4 --wrap-x true --rivers 3 --max-river-length 25 \
  --width 4800 --height 3200 --seed 42 --out ./out
```

| Flag | Default | Description |
|---|---|---|
| `--land` | *(required)* | Path to a land-polygon GeoJSON file |
| `--seas` | *(required)* | Path to a named-seas GeoJSON file — named seas (Mediterranean, Arctic, …) become single large provinces |
| `--rows` | `30` | Grid rows |
| `--cols` | `50` | Grid columns |
| `--width` | `4800` | Canvas width in px |
| `--height` | `3200` | Canvas height in px |
| `--seed` | random | Integer seed |
| `--bbox` | none | `minLon,minLat,maxLon,maxLat` — clip to a region, or omit for the full globe |
| `--noise` | `0.4` | Blurs coastlines with fBm noise (0 = crisp GeoJSON boundary) |
| `--wrap-x` | `false` | `true` for seamless world-map looping |
| `--rivers` | `3` | Number of river paths to attempt |
| `--max-river-length` | `25` | Max tiles per river |
| `--out` | `./out` | Output directory |

A flood fill from the map border removes enclosed water artifacts (gaps between adjacent land
polygons that would otherwise become spurious lakes).

**Full-globe example:**

```bash
npx ts-node src/index.ts generate-region \
  --land land-110m.geojson --seas seas-110m.geojson \
  --rows 45 --cols 90 --bbox "-180,-85,180,85" \
  --noise 0.15 --wrap-x true --out ./out
```

### `import-svg` — hand-drawn SVG map

Each `<path>` is one province. `id` becomes the province's `region_id` — any string, not just
`prov-N`.

```xml
<path id="prov-1" d="M10 10 L110 10 L110 110 L10 110 Z" data-type="land" data-landscape="forest" />
<path id="sea-1"  d="..." data-type="water" />
```

`data-type` other than `land`/`water` (e.g. `coastal`) falls back to `land`. `data-landscape` is
optional. Neighbor detection works by matching shared path points between provinces.

```bash
npx ts-node src/index.ts import-svg --svg ./map.svg --out ./out
```

### `import-png` — color-coded PNG map

Flood fill detects contiguous colored regions, a hand-rolled border tracer extracts their
outlines into SVG paths, and Douglas-Peucker simplification cleans up the result.

```bash
npx ts-node src/index.ts import-png --png ./map.png --min-size 10 --simplify 2.0 --out ./out
```

| Flag | Default | Description |
|---|---|---|
| `--png` | *(required)* | Source PNG |
| `--min-size` | `10` | Discard flood-filled regions smaller than this many pixels |
| `--simplify` | `2.0` | Douglas-Peucker tolerance for outline simplification |
| `--out` | `./out` | Output directory |

### `rewrap` — recompute neighbors on an existing map

Recomputes `neighbor_regions` for an already-generated grid map to add or remove east-west wrap
(turning a flat map into a cylinder/globe, or vice versa) without regenerating terrain.

```bash
npx ts-node src/index.ts rewrap --file ./out/provinces.json --wrap-x true
```

| Flag | Default | Description |
|---|---|---|
| `--file` | *(required)* | Input `provinces.json` |
| `--out` | overwrites `--file` | Output path |
| `--wrap-x` | `true` | Pass `false` to unwrap |

### `parse` — validate output

```bash
npx ts-node src/index.ts parse --file ./out/provinces.json
```

Prints province counts by type/landscape and flags structural problems (missing neighbors,
malformed polygons) before you hand the file to the API.

## Output Format

```json
{
  "polygon": "M220 150 H260 V190 H220 Z",
  "type": "land",
  "landscape": "plains",
  "resource_type": "iron",
  "user_id": null,
  "region_id": "prov-0-0",
  "neighbor_regions": ["prov-0-1", "prov-1-0"]
}
```

`resource_type` is a resource **key** string (`iron`, `gold`, `stone`, `wood`, `grain`, `fish`, or
`null`), resolved to a `resource_id` at import time — the DB's `resources` table must already be
seeded with matching keys before import runs.

## Integration Workflow

```bash
# 1. Generate (or import) a map
npx ts-node src/index.ts generate --rows 12 --cols 16 --seed 42 --out ./out

# 2. Copy the output into the API's data directory
cp ./out/provinces.json ../api/data/provinces.json

# 3. From api/, seed resources first, then import
cd ../api
npm run seed:resources
npm run import:provinces
```

`import:provinces` wipes and reinserts every province with brand-new UUIDs, and recomputes a
content checksum stored on the singleton `game_settings` row — every web client's cached map
layout compares against that checksum and auto-refetches on mismatch, so there's no manual
frontend cache-busting step after a map swap. See
[`.ai-docs/GAME-MECHANICS.md`](../.ai-docs/GAME-MECHANICS.md#map-checksum--layout-cache-invalidation).

A live re-import while players hold references to old province IDs (selected province, pending
actions, army locations) is inherently disruptive — pair a production map swap with `reset:game`
(see `api/README.md`) unless you're setting up a fresh world.

## npm Scripts

```bash
npm start generate -- --rows 12 --cols 20 --seed 42 --out ./maps/europe
npm run build   # tsc — compiles to dist/, not required for local CLI use (ts-node runs src/ directly)
```
