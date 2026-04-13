import fs from 'fs';
import path from 'path';
import { Province, ProvinceType, Landscape } from './types';

interface GenerateGridOptions {
  rows: number;
  cols: number;
  width: number;
  height: number;
  outputDir: string;
  seed?: number;
  continentScale?: number; // noise frequency: lower = bigger landmasses
  landThreshold?: number;  // elevation cutoff for land (0–1), default 0.48
  riverCount?: number;     // number of rivers to attempt
  maxRiverLength?: number; // max tiles per river
}

const resources = ['iron', 'wood', 'grain', 'stone', 'gold'];
const resourcesSea = ['fish'];

// ─── Seeded RNG (LCG) ────────────────────────────────────────────────────────

function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = Math.imul(s, 1664525) + 1013904223 >>> 0;
    return s / 0x100000000;
  };
}

// ─── 2D Value Noise with smoothstep interpolation ────────────────────────────

function hash2d(ix: number, iy: number, seed: number): number {
  const n = Math.sin(ix * 127.1 + iy * 311.7 + seed * 74.3) * 43758.5453;
  return n - Math.floor(n);
}

function smoothNoise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash2d(ix,     iy,     seed);
  const b = hash2d(ix + 1, iy,     seed);
  const c = hash2d(ix,     iy + 1, seed);
  const d = hash2d(ix + 1, iy + 1, seed);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

// Fractal Brownian Motion: stacks 4 octaves of noise
function fbm(x: number, y: number, seed: number): number {
  let value = 0, amplitude = 0.5, frequency = 1, maxAmp = 0;
  for (let i = 0; i < 4; i++) {
    value     += smoothNoise(x * frequency, y * frequency, seed + i * 100) * amplitude;
    maxAmp    += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }
  return value / maxAmp;
}

// ─── Elevation → Landscape ───────────────────────────────────────────────────

function getLandscape(elev: number, rng: () => number): Landscape {
  const roll = rng();
  if (elev > 0.68) return roll < 0.7 ? 'mountain' : 'hills';
  if (elev > 0.60) return roll < 0.5 ? 'hills' : (roll < 0.8 ? 'forest' : 'mountain');
  if (elev > 0.52) return roll < 0.4 ? 'forest' : (roll < 0.75 ? 'plains' : 'hills');
  // Low land — wetter, flatter
  if (roll < 0.35) return 'plains';
  if (roll < 0.55) return 'swamp';
  if (roll < 0.75) return 'desert';
  return 'forest';
}

// ─── Main ────────────────────────────────────────────────────────────────────

export function generateGridMap(options: GenerateGridOptions) {
  const {
    rows, cols, width, height, outputDir,
    seed            = Math.floor(Math.random() * 100000),
    continentScale  = 0.25,
    landThreshold   = 0.33,
    riverCount      = 3,
    maxRiverLength  = 25,
  } = options;

  const rng = makeRng(seed);
  const randomFrom = <T,>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];

  const cellWidth  = width  / cols;
  const cellHeight = height / rows;

  console.log(`Generating map with seed ${seed} (${rows}x${cols})...`);

  // ── Step 1: Elevation map (noise + island falloff) ──────────────────────
  const elevation: number[][] = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => {
      const nx = c * continentScale;
      const ny = r * continentScale;
      const noiseVal = fbm(nx, ny, seed); // ~0.3–0.7

      // Additive island bias: +0.3 at center, −0.3 at corners
      // so edges naturally become water without suppressing center values
      const dx = (c / Math.max(cols - 1, 1)) * 2 - 1; // −1 … 1
      const dy = (r / Math.max(rows - 1, 1)) * 2 - 1;
      const dist = Math.sqrt(dx * dx + dy * dy) / Math.SQRT2; // 0 center, 1 corners
      const bias = (1 - dist) * 0.3 - 0.1; // +0.2 at center, −0.1 at corners

      return noiseVal + bias;
    })
  );

  // ── Step 2: Initial type from elevation ──────────────────────────────────
  const typeMap: ProvinceType[][] = elevation.map(row =>
    row.map(elev => (elev >= landThreshold ? 'land' : 'water'))
  );

  // ── Step 3: Rivers ───────────────────────────────────────────────────────
  type Cell = { r: number; c: number };
  const dirs: [number, number][] = [[-1, 0], [1, 0], [0, -1], [0, 1]];

  // Sort land cells by elevation descending → mountain peaks first
  const landCells = [] as (Cell & { elev: number })[];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      if (typeMap[r][c] === 'land')
        landCells.push({ r, c, elev: elevation[r][c] });
  landCells.sort((a, b) => b.elev - a.elev);

  const riverTiles = new Set<string>();
  let riversPlaced = 0;

  for (let i = 0; i < landCells.length && riversPlaced < riverCount; i++) {
    const start = landCells[i];
    if (riverTiles.has(`${start.r}-${start.c}`)) continue;

    const riverPath: Cell[] = [{ r: start.r, c: start.c }];
    let cr = start.r, cc = start.c;
    let reachedWater = false;

    for (let step = 0; step < maxRiverLength; step++) {
      // Walk to adjacent cell with lowest elevation
      let bestElev = Infinity, bestR = -1, bestC = -1;
      for (const [dr, dc] of dirs) {
        const nr = cr + dr, nc = cc + dc;
        if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
        if (elevation[nr][nc] < bestElev) {
          bestElev = elevation[nr][nc];
          bestR = nr; bestC = nc;
        }
      }
      if (bestR === -1) break;

      if (typeMap[bestR][bestC] === 'water') { reachedWater = true; break; }

      // Don't merge into existing river tiles (prevents pooling)
      if (riverTiles.has(`${bestR}-${bestC}`)) break;

      riverPath.push({ r: bestR, c: bestC });
      cr = bestR; cc = bestC;
    }

    if (reachedWater && riverPath.length >= 3) {
      for (const cell of riverPath) {
        riverTiles.add(`${cell.r}-${cell.c}`);
        typeMap[cell.r][cell.c] = 'water';
      }
      riversPlaced++;
    }
  }

  // ── Step 4: Coastal pass — land tiles adjacent to any water ─────────────
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (typeMap[r][c] !== 'land') continue;
      for (const [dr, dc] of dirs) {
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && typeMap[nr][nc] === 'water') {
          typeMap[r][c] = 'coastal';
          break;
        }
      }
    }
  }

  // ── Step 5: Build province objects ──────────────────────────────────────
  const provinces: Province[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x1 = c * cellWidth,  y1 = r * cellHeight;
      const x2 = x1 + cellWidth, y2 = y1 + cellHeight;
      const type = typeMap[r][c];
      const isWater = type === 'water';

      provinces.push({
        polygon: `M${x1} ${y1} H${x2} V${y2} H${x1} Z`,
        type,
        landscape: isWater ? 'plains' : getLandscape(elevation[r][c], rng),
        local_troops: 0,
        resource_type: isWater ? randomFrom(resourcesSea) : randomFrom(resources),
        user_id: null,
        region_id: `prov-${r}-${c}`,
        neighbor_regions: [],
      });
    }
  }

  // ── Step 6: 4-directional neighbors ─────────────────────────────────────
  console.log('Calculating neighbors...');
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const neighbors: string[] = [];
      if (r > 0)        neighbors.push(`prov-${r-1}-${c}`);
      if (r < rows - 1) neighbors.push(`prov-${r+1}-${c}`);
      if (c > 0)        neighbors.push(`prov-${r}-${c-1}`);
      if (c < cols - 1) neighbors.push(`prov-${r}-${c+1}`);
      provinces[r * cols + c].neighbor_regions = neighbors;
    }
  }

  // ── Output ───────────────────────────────────────────────────────────────
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const outPath = path.join(outputDir, 'provinces.json');
  fs.writeFileSync(outPath, JSON.stringify(provinces, null, 2), 'utf-8');

  const landCount    = provinces.filter(p => p.type === 'land').length;
  const coastalCount = provinces.filter(p => p.type === 'coastal').length;
  const waterCount   = provinces.filter(p => p.type === 'water').length;
  console.log(`Done: ${provinces.length} provinces — ${landCount} land, ${coastalCount} coastal, ${waterCount} water, ${riversPlaced}/${riverCount} rivers placed`);
  console.log(`Saved: ${outPath}`);
}
