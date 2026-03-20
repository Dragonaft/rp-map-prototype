```markdown
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

```bash
npx ts-node src/index.ts generate \
  --rows 10 --cols 15 \
  --width 800 --height 600 \
  --out ./out
  
  OR
  
npx ts-node src/index.ts import-svg --svg ./test-map.svg --out ./out
```

**Result**:
```
out/
├── provinces.json  ← data for React
└── map.svg        ← SVG for verification
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

| Command | Description | Arguments |
|---------|-------------|-----------|
| `generate` | Province grid | `--rows=10 --cols=15 --width=800 --height=600 --out=./out` |
| `import-svg` | SVG → JSON | `--svg=./map.svg --out=./out` |
| `parse` | JSON analysis | `--file=./out/provinces.json` |

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
npm start generate -- --rows 12 --cols 20 --out ./maps/europe
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
