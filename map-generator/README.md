# Map Generator 🚀

CLI tool for creating province maps from **SVG** files or generating **grids**. Creates `provinces.json` for React map.

## ✨ Features

- ✅ Import "live" SVG maps (`id`, `data-type`, `data-landscape`)
- ✅ Generate `N×M` province grids
- ✅ Parse/validate `provinces.json`
- ✅ TypeScript typing
- ✅ Compatible with React Map Editor

## 📦 Installation

```bash
cd map-project/map-generator
npm install
```

## 🚀 Quick Start

### Grid Generation

The grid generator uses **fractal Brownian motion (fBm) noise** with a radial island bias to produce natural-looking continent shapes. Rivers are carved as single-tile-wide water paths flowing downhill from mountain peaks to the sea.

**How it works:**
1. An elevation map is computed per cell using 4-octave value noise
2. An additive island bias (+0.2 at center, −0.1 at edges) pushes borders toward water
3. Cells above `--land-threshold` become land, the rest become water
4. `--rivers` river paths are traced from the highest-elevation land tiles, walking greedily downhill until reaching water
5. Land tiles adjacent to any water tile become `coastal`
6. Landscapes (plains, forest, mountain, hills, swamp, desert) are assigned based on elevation

**Landscapes by elevation:**
| Elevation | Landscape |
|-----------|-----------|
| > 0.68 | mountain / hills |
| 0.60–0.68 | hills / forest |
| 0.52–0.60 | forest / plains |
| < 0.52 | plains / swamp / desert |

#### Basic usage

```bash
npx ts-node src/index.ts generate \
  --rows 12 --cols 16 \
  --out ./out
```

#### Reproducible map with a fixed seed

```bash
npx ts-node src/index.ts generate \
  --rows 12 --cols 16 \
  --seed 42 \
  --out ./out
```

#### More water, larger landmasses

```bash
npx ts-node src/index.ts generate \
  --rows 20 --cols 30 \
  --seed 42 \
  --land-threshold 0.42 \
  --continent-scale 0.15 \
  --out ./out
```

#### Archipelago (fragmented islands, many rivers)

```bash
npx ts-node src/index.ts generate \
  --rows 20 --cols 30 \
  --seed 77 \
  --land-threshold 0.40 \
  --continent-scale 0.4 \
  --rivers 6 \
  --max-river-length 15 \
  --out ./out
```

#### Custom canvas size

```bash
npx ts-node src/index.ts generate \
  --rows 10 --cols 15 \
  --width 4800 --height 3600 \
  --out ./out
```

**Result:**
```
out/
└── provinces.json  ← province data for React
```

### SVG Import (recommended)

1. Create SVG in **Figma/Inkscape**:
```xml
<path id="prov-1" d="..." data-type="land" data-landscape="forest" />
```

2. Import:
```bash
npx ts-node src/index.ts import-svg \
  --svg ./map.svg \
  --out ./out
```

### Verification

```bash
npx ts-node src/index.ts parse --file ./out/provinces.json
```

## 📋 Commands

### `generate`

| Argument | Default | Description |
|----------|---------|-------------|
| `--rows` | `10` | Number of grid rows |
| `--cols` | `10` | Number of grid columns |
| `--width` | `4800` | Canvas width in pixels (cell width = width/cols) |
| `--height` | `3600` | Canvas height in pixels (cell height = height/rows) |
| `--out` | `./out` | Output directory |
| `--seed` | random | Integer seed for reproducible maps |
| `--continent-scale` | `0.25` | Noise frequency — lower = bigger landmasses, higher = fragmented islands |
| `--land-threshold` | `0.33` | Elevation cutoff for land (0–1) — raise for more water |
| `--rivers` | `3` | Number of river paths to carve |
| `--max-river-length` | `25` | Maximum tiles per river before giving up |

### Other commands

| Command | Description | Arguments |
|---------|-------------|-----------|
| `import-svg` | SVG → JSON | `--svg ./map.svg --out ./out` |
| `import-png` | PNG → JSON | `--png ./map.png --out ./out [--min-size 10] [--simplify 2.0]` |
| `parse` | Validate JSON | `--file ./out/provinces.json` |

## 🎨 SVG Format

**Each `<path>` = province**:

```xml
<!-- Land -->
<path id="prov-1" 
      d="M10 10 L110 10 L110 110 L10 110 Z" 
      data-type="land" 
      data-landscape="forest" />

<!-- Water -->
<path id="sea-1" 
      d="..." 
      data-type="water" />
```

**Required**: `id`, `d`  
**Optional**: `data-type`, `data-landscape`

## 🗄 provinces.json

```json
[
  {
    "polygon": "M220 150...",
    "type": "land",
    "landscape": "plains",
    "local_troops": 0,
    "resource_id": "iron",
    "buildings": [],
    "user_id": null,
    "region_id": "continent-center"
  }
]
```

**Copy to**: `api/data` and run import on BE side

## 🛠 npm Scripts

```bash
# Generate a continent map with fixed seed
npm start generate -- --rows 12 --cols 20 --seed 42 --out ./maps/europe

# Generate archipelago
npm start generate -- --rows 20 --cols 30 --continent-scale 0.4 --land-threshold 0.42 --rivers 5 --out ./maps/islands

# Validate output
npm start parse -- --file ./maps/europe/provinces.json
```

## 🔗 Integration

```
1. map-generator → out/provinces.json
     ↓
2. web-map/src/data/provinces.json  
     ↓
3. npm run dev (web-map)
     ↓
4. Map + editor ready! 🎉
```

## 🐛 Debugging

```bash
# Province count and types
npx ts-node src/index.ts parse --file bad.json

# First 10 provinces
Total provinces: 25
- prov-0-0 [water] region=prov-0-0
- prov-0-1 [coastal] region=prov-0-1
...
```
