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

## Output Format

Array of province objects:
```json
{
  "polygon": "M220 150 H260 V190 H220 Z",   // SVG path commands
  "type": "land|water",
  "landscape": "plains|forest|mountain|hills|swamp|desert",
  "local_troops": 0,
  "resource_type": "iron|wood|grain|stone|gold|fish|null",
  "user_id": null,
  "region_id": "prov-0-0",
  "neighbor_regions": ["prov-0-1", "prov-1-0"]
}
```

## Four Generation Modes

### 1. Grid Generation (`generate`)
Procedural via Fractal Brownian Motion (fBm) noise + radial island bias.

```bash
npx ts-node src/index.ts generate \
  --rows 12 --cols 16 --seed 42 \
  --continent-scale 0.25 --land-threshold 0.33 \
  --rivers 3 --max-river-length 25 \
  --width 4800 --height 3600 --out ./out
```

- Seeded RNG (LCG) for reproducible maps
- 4-octave noise with smoothstep interpolation
- Radial bias creates natural island/continent shapes
- River carving: greedy downhill walk from peaks to water
- Landscape assignment by elevation bands (mountain > hills > forest > plains)

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
