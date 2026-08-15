import fs from 'fs';
import path from 'path';
import { Province, ProvinceType, Landscape } from './types';
import { gridNeighborCells, gridNeighborRegions, toroidalDistance } from './gridNeighbors';

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
  wrapX?: boolean;         // east-west wrapping (cylinder/globe maps)
  continents?: number;     // number of landmasses; >1 switches to the Voronoi-margin generator below
  gaps?: number[];         // water-channel width per continent pair, matched widest-gap-to-furthest-pair
  gap?: number;            // fallback channel width applied to every pair when `gaps` is omitted
  coastNoise?: number;     // noise amplitude added to the Voronoi margin — wiggles coastlines without changing mean width
  lakes?: number;          // inland lakes to carve (2-3 water cells each)
  polarRows?: number;      // rows forced to water at the top/bottom edges (poles); default 1 when continents > 1
}

// Land resource spawn weights — gold and stone are deliberately much rarer.
const resourceWeights: { value: string; weight: number }[] = [
  { value: 'iron',  weight: 10 },
  { value: 'wood',  weight: 10 },
  { value: 'grain', weight: 10 },
  { value: 'stone', weight: 2 },
  { value: 'gold',  weight: 1 },
];
const resourcesSea = ['fish'];

// Weighted pick using the seeded RNG so maps stay reproducible.
function pickWeighted(rng: () => number, entries: { value: string; weight: number }[]): string {
  const total = entries.reduce((sum, e) => sum + e.weight, 0);
  let roll = rng() * total;
  for (const e of entries) {
    roll -= e.weight;
    if (roll < 0) return e.value;
  }
  return entries[entries.length - 1].value;
}

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

// ─── Multi-continent land mask (Voronoi margin) ──────────────────────────────
//
// Each continent gets a seed cell. For every grid cell, find the two nearest
// seeds (d1 = nearest, d2 = second-nearest). The margin m = d2 - d1 is zero
// exactly on the boundary between two continents' territories and grows the
// deeper a cell sits inside its own continent. Declaring a cell water when
// m < gap carves a channel of ~`gap` tiles centred on that boundary — the
// gap is a direct, per-pair gameplay dial (crossing width vs. water-turns),
// not an emergent side effect of noise/threshold tuning like the single-blob
// mode below.

function placeContinentSeeds(
  count: number, rows: number, cols: number, wrapX: boolean, polarRows: number, rng: () => number,
): { r: number; c: number }[] {
  // Mitchell's best-candidate: for each seed, sample several candidates and
  // keep the one furthest (toroidal distance) from every seed placed so far.
  // Deterministic from the seeded rng, wrap-aware, so continents spread out
  // well on the cylinder instead of clumping.
  const CANDIDATES_PER_SEED = 20;
  const seeds: { r: number; c: number }[] = [];
  const usableRows = Math.max(rows - 2 * polarRows, 1);

  for (let i = 0; i < count; i++) {
    let best: { r: number; c: number } | null = null;
    let bestScore = -Infinity;
    for (let k = 0; k < CANDIDATES_PER_SEED; k++) {
      const cand = { r: polarRows + Math.floor(rng() * usableRows), c: Math.floor(rng() * cols) };
      const score = seeds.length === 0
        ? 0
        : Math.min(...seeds.map(s => toroidalDistance(cand.r, cand.c, s.r, s.c, cols, wrapX)));
      if (score > bestScore) { bestScore = score; best = cand; }
    }
    seeds.push(best!);
  }
  return seeds;
}

function buildContinentMask(opts: {
  rows: number; cols: number; wrapX: boolean; rng: () => number; seed: number;
  continents: number; gaps?: number[]; gap: number; coastNoise: number; polarRows: number;
}): { typeMap: ProvinceType[][]; seeds: { r: number; c: number }[] } {
  const { rows, cols, wrapX, rng, seed, continents, gaps, gap, coastNoise, polarRows } = opts;

  const seeds = placeContinentSeeds(continents, rows, cols, wrapX, polarRows, rng);

  // Gap assignment: sort continent pairs by seed distance descending, sort
  // requested gaps descending, zip them — the widest ocean always lands
  // between the two furthest-apart continents.
  const pairs: { i: number; j: number; dist: number }[] = [];
  for (let i = 0; i < continents; i++)
    for (let j = i + 1; j < continents; j++)
      pairs.push({ i, j, dist: toroidalDistance(seeds[i].r, seeds[i].c, seeds[j].r, seeds[j].c, cols, wrapX) });
  pairs.sort((a, b) => b.dist - a.dist);

  const requestedGaps = (gaps && gaps.length > 0 ? [...gaps] : pairs.map(() => gap)).sort((a, b) => b - a);
  if (gaps && gaps.length !== pairs.length) {
    console.warn(
      `--gaps has ${gaps.length} value(s) but ${continents} continents form ${pairs.length} pair(s) ` +
      `(C(${continents},2)); values will be reused/truncated to fit.`,
    );
  }

  const gapMatrix: number[][] = Array.from({ length: continents }, () => Array(continents).fill(gap));
  pairs.forEach((pair, idx) => {
    const g = requestedGaps[idx % requestedGaps.length];
    gapMatrix[pair.i][pair.j] = g;
    gapMatrix[pair.j][pair.i] = g;
    console.log(`  seed[${pair.i}]-seed[${pair.j}]: ${pair.dist.toFixed(1)} tiles apart, target gap ${g}`);
  });

  const typeMap: ProvinceType[][] = Array.from({ length: rows }, () => Array<ProvinceType>(cols).fill('land'));
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (r < polarRows || r >= rows - polarRows) { typeMap[r][c] = 'water'; continue; }

      const dists = seeds.map(s => toroidalDistance(r, c, s.r, s.c, cols, wrapX));
      let i1 = 0;
      for (let i = 1; i < dists.length; i++) if (dists[i] < dists[i1]) i1 = i;
      if (continents === 1) continue; // no boundary, stays land

      const noiseVal = (fbm(c * 0.3, r * 0.3, seed + 9999) - 0.5) * 2 * coastNoise; // ~[-coastNoise, coastNoise]

      // Check against EVERY other seed's exclusion zone, not just the nearest
      // one — with 3+ continents, near a three-way junction the nearest-other
      // seed can carry a *smaller* required gap than the seed on the far side
      // of the intended channel, letting land sneak across using the weaker
      // constraint and silently shrinking the wide ocean down toward the
      // narrow one. Margin moves at rate 2 per unit distance off a bisector
      // (d1 and dj shift oppositely), so a corridor of total width `gap`
      // needs threshold `gap` itself, not `gap / 2`.
      let isWater = false;
      for (let j = 0; j < dists.length; j++) {
        if (j === i1) continue;
        const margin = dists[j] - dists[i1];
        if (margin + noiseVal < gapMatrix[i1][j]) { isWater = true; break; }
      }
      typeMap[r][c] = isWater ? 'water' : 'land';
    }
  }

  return { typeMap, seeds };
}

// ─── Connectivity helpers (landmass reporting + lake-safety check) ──────────

// Flood-fills land into connected components (wrap-aware), largest first.
function labelLandComponents(
  typeMap: ProvinceType[][], rows: number, cols: number, wrapX: boolean,
): { r: number; c: number }[][] {
  const seen: boolean[][] = Array.from({ length: rows }, () => Array(cols).fill(false));
  const components: { r: number; c: number }[][] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (typeMap[r][c] !== 'land' || seen[r][c]) continue;
      const cells: { r: number; c: number }[] = [];
      const queue: { r: number; c: number }[] = [{ r, c }];
      seen[r][c] = true;
      let qi = 0;
      while (qi < queue.length) {
        const cur = queue[qi++];
        cells.push(cur);
        for (const n of gridNeighborCells(cur.r, cur.c, rows, cols, wrapX)) {
          if (typeMap[n.r][n.c] === 'land' && !seen[n.r][n.c]) {
            seen[n.r][n.c] = true;
            queue.push(n);
          }
        }
      }
      components.push(cells);
    }
  }
  return components.sort((a, b) => b.length - a.length);
}

// Multi-source BFS from every cell of landmass `a`, through water only, to
// the nearest cell of landmass `b`. Graph distance minus 1 is the number of
// water tiles an army must cross directly between the two — this is the
// number that matters against DEFAULT_WATER_TURNS. Cells belonging to a
// third landmass are walls here (not shortcuts): stepping onto free land
// resets an army's water-turn counter, so routing through a stepping-stone
// continent is a materially easier crossing than this pair's direct gap and
// must not be reported as if it were this pair's width.
function measuredGap(
  a: { r: number; c: number }[], b: { r: number; c: number }[], typeMap: ProvinceType[][],
  rows: number, cols: number, wrapX: boolean,
): number {
  const aSet = new Set(a.map(({ r, c }) => `${r}-${c}`));
  const bSet = new Set(b.map(({ r, c }) => `${r}-${c}`));
  const passable = (r: number, c: number) =>
    typeMap[r][c] === 'water' || aSet.has(`${r}-${c}`) || bSet.has(`${r}-${c}`);

  const dist: number[][] = Array.from({ length: rows }, () => Array(cols).fill(-1));
  const queue: { r: number; c: number }[] = [];
  for (const { r, c } of a) { dist[r][c] = 0; queue.push({ r, c }); }

  let qi = 0;
  while (qi < queue.length) {
    const cur = queue[qi++];
    if (bSet.has(`${cur.r}-${cur.c}`)) return Math.max(dist[cur.r][cur.c] - 1, 0);
    for (const n of gridNeighborCells(cur.r, cur.c, rows, cols, wrapX)) {
      if (dist[n.r][n.c] === -1 && passable(n.r, n.c)) {
        dist[n.r][n.c] = dist[cur.r][cur.c] + 1;
        queue.push(n);
      }
    }
  }
  return Infinity; // no direct sea route between the two (blocked by a third landmass)
}

// Carves `count` small inland lakes (2-3 water cells each). Candidates that
// touch existing water are rejected (keeps lakes genuinely inland rather than
// notching an existing coastline), and any carve that would split its
// landmass in two is reverted.
function carveLakes(
  typeMap: ProvinceType[][], rows: number, cols: number, wrapX: boolean, count: number, rng: () => number,
): number {
  let carved = 0;
  const maxAttempts = count * 25;

  for (let attempt = 0; attempt < maxAttempts && carved < count; attempt++) {
    const r = Math.floor(rng() * rows);
    const c = Math.floor(rng() * cols);
    if (typeMap[r][c] !== 'land') continue;

    const blobSize = 2 + Math.floor(rng() * 2); // 2-3 cells
    const blob: { r: number; c: number }[] = [{ r, c }];
    const seen = new Set([`${r}-${c}`]);
    const frontier = [...gridNeighborCells(r, c, rows, cols, wrapX)];
    while (blob.length < blobSize && frontier.length) {
      const idx = Math.floor(rng() * frontier.length);
      const cand = frontier.splice(idx, 1)[0];
      const key = `${cand.r}-${cand.c}`;
      if (seen.has(key) || typeMap[cand.r][cand.c] !== 'land') continue;
      seen.add(key);
      blob.push(cand);
      frontier.push(...gridNeighborCells(cand.r, cand.c, rows, cols, wrapX));
    }
    if (blob.length < 2) continue;

    const touchesWater = blob.some(cell =>
      gridNeighborCells(cell.r, cell.c, rows, cols, wrapX).some(
        n => !seen.has(`${n.r}-${n.c}`) && typeMap[n.r][n.c] === 'water',
      ));
    if (touchesWater) continue;

    const before = labelLandComponents(typeMap, rows, cols, wrapX).length;
    for (const cell of blob) typeMap[cell.r][cell.c] = 'water';
    const after = labelLandComponents(typeMap, rows, cols, wrapX).length;
    if (after > before) {
      for (const cell of blob) typeMap[cell.r][cell.c] = 'land'; // would have split the landmass — revert
      continue;
    }
    carved++;
  }
  return carved;
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
    wrapX           = false,
    continents      = 1,
    gaps,
    gap             = 4,
    coastNoise      = 1.0,
    lakes           = 0,
    polarRows       = continents > 1 ? 1 : 0,
  } = options;

  const rng = makeRng(seed);
  const randomFrom = <T,>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];

  const cellWidth  = width  / cols;
  const cellHeight = height / rows;

  console.log(`Generating map with seed ${seed} (${rows}x${cols})${continents > 1 ? `, ${continents} continents` : ''}...`);

  // ── Step 1: Elevation map ────────────────────────────────────────────────
  // Single-continent mode keeps the legacy radial island bias (land forms one
  // central blob). Multi-continent mode decides land/water via the Voronoi
  // mask below instead, so elevation here only shapes landscape and rivers —
  // no bias needed since the mask already carves the coastlines.
  const elevation: number[][] = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => {
      const nx = c * continentScale;
      const ny = r * continentScale;
      const noiseVal = fbm(nx, ny, seed); // ~0.3–0.7

      if (continents > 1) return noiseVal;

      // Additive island bias: +0.3 at center, −0.3 at corners
      // so edges naturally become water without suppressing center values
      const dx = (c / Math.max(cols - 1, 1)) * 2 - 1; // −1 … 1
      const dy = (r / Math.max(rows - 1, 1)) * 2 - 1;
      const dist = Math.sqrt(dx * dx + dy * dy) / Math.SQRT2; // 0 center, 1 corners
      const bias = (1 - dist) * 0.3 - 0.1; // +0.2 at center, −0.1 at corners

      return noiseVal + bias;
    })
  );

  // ── Step 2: Initial type from elevation, or multi-continent Voronoi mask ──
  let typeMap: ProvinceType[][];
  if (continents > 1) {
    ({ typeMap } = buildContinentMask({ rows, cols, wrapX, rng, seed, continents, gaps, gap, coastNoise, polarRows }));
  } else {
    typeMap = elevation.map(row => row.map(elev => (elev >= landThreshold ? 'land' : 'water')));
  }

  // ── Step 3: Lakes ─────────────────────────────────────────────────────────
  const lakesCarved = lakes > 0 ? carveLakes(typeMap, rows, cols, wrapX, lakes, rng) : 0;

  // ── Step 4: Rivers ───────────────────────────────────────────────────────
  type Cell = { r: number; c: number };

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
      // Walk to adjacent cell with lowest elevation (wrap-aware)
      let bestElev = Infinity, bestR = -1, bestC = -1;
      for (const { r: nr, c: nc } of gridNeighborCells(cr, cc, rows, cols, wrapX)) {
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

  // ── Step 5: Build province objects ────────────────────────────────────────
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
        resource_type: isWater ? randomFrom(resourcesSea) : pickWeighted(rng, resourceWeights),
        user_id: null,
        region_id: `prov-${r}-${c}`,
        neighbor_regions: [],
      });
    }
  }

  // ── Step 6: 4-directional neighbors ───────────────────────────────────────
  console.log(`Calculating neighbors${wrapX ? ' (east-west wrap)' : ''}...`);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      provinces[r * cols + c].neighbor_regions = gridNeighborRegions(r, c, rows, cols, wrapX);
    }
  }

  // ── Output ───────────────────────────────────────────────────────────────
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const outPath = path.join(outputDir, 'provinces.json');
  fs.writeFileSync(outPath, JSON.stringify(provinces, null, 2), 'utf-8');

  const landCount  = provinces.filter(p => p.type === 'land').length;
  const waterCount = provinces.filter(p => p.type === 'water').length;
  console.log(`Done: ${provinces.length} provinces — ${landCount} land, ${waterCount} water, ${riversPlaced}/${riverCount} rivers placed`);

  if (continents > 1) {
    // Final landmass census (post-lake, post-river) — the numbers a player
    // will actually experience, not just what the seed placement intended.
    const finalTypeMap: ProvinceType[][] = Array.from({ length: rows }, (_, r) =>
      Array.from({ length: cols }, (_, c) => provinces[r * cols + c].type));
    const components = labelLandComponents(finalTypeMap, rows, cols, wrapX);
    const landmasses = components.slice(0, continents);
    const extraIslands = components.length - landmasses.length;

    console.log(`Landmasses: ${landmasses.map(l => l.length).join(', ')} provinces` +
      (extraIslands > 0 ? ` (+${extraIslands} small island${extraIslands === 1 ? '' : 's'})` : ''));

    for (let i = 0; i < landmasses.length; i++) {
      for (let j = i + 1; j < landmasses.length; j++) {
        const g = measuredGap(landmasses[i], landmasses[j], finalTypeMap, rows, cols, wrapX);
        if (!isFinite(g)) {
          console.log(`  gap[${i}-${j}]: no direct sea route (blocked by a third landmass)`);
          continue;
        }
        console.log(`  gap[${i}-${j}]: ${g} water tile(s)`);
        if (g > 10) {
          console.warn(`  WARNING: gap[${i}-${j}] is ${g} tiles — uncrossable even with Seafaring (max allowance is 10).`);
        }
      }
    }
  }

  if (lakes > 0) {
    console.log(`Lakes: ${lakesCarved}/${lakes} carved`);
  }

  console.log(`Saved: ${outPath}`);
}
