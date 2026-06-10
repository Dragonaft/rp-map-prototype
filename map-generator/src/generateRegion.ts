import fs from 'fs';
import path from 'path';
import { Province, ProvinceType, Landscape } from './types';

// ─── Option types ─────────────────────────────────────────────────────────────

export interface GenerateRegionOptions {
  landFile: string;       // path to ne_50m_land.geojson (or similar)
  seasFile: string;       // path to ne_110m_geography_marine_polys.geojson
  rows: number;
  cols: number;
  width: number;          // canvas width in pixels
  height: number;         // canvas height in pixels
  outputDir: string;
  seed?: number;
  bbox?: [number, number, number, number]; // [minLon, minLat, maxLon, maxLat]
  noiseAmount?: number;   // 0–1; how much fBm noise blurs land/sea boundary
  wrapX?: boolean;        // east-west wrapping (globe maps)
  rivers?: number;        // number of rivers to attempt
  maxRiverLength?: number;
}

// ─── Internal types ───────────────────────────────────────────────────────────

type Coord = [number, number];
type Ring  = Coord[];

interface BboxedRing {
  ring: Ring;
  minLon: number; maxLon: number;
  minLat: number; maxLat: number;
}

interface SeaFeature {
  name: string;
  id: string;
  rings: BboxedRing[];
}

// ─── Seeded RNG (LCG) ─────────────────────────────────────────────────────────

function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = Math.imul(s, 1664525) + 1013904223 >>> 0;
    return s / 0x100000000;
  };
}

// ─── Noise ────────────────────────────────────────────────────────────────────

function hash2d(ix: number, iy: number, seed: number): number {
  const n = Math.sin(ix * 127.1 + iy * 311.7 + seed * 74.3) * 43758.5453;
  return n - Math.floor(n);
}

function smoothNoise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix,        fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash2d(ix,     iy,     seed);
  const b = hash2d(ix + 1, iy,     seed);
  const c = hash2d(ix,     iy + 1, seed);
  const d = hash2d(ix + 1, iy + 1, seed);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

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

// ─── Geometry ─────────────────────────────────────────────────────────────────

function ringBbox(ring: Ring) {
  let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const [lon, lat] of ring) {
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  return { minLon, maxLon, minLat, maxLat };
}

function bboxOverlaps(
  a: { minLon: number; maxLon: number; minLat: number; maxLat: number },
  b: { minLon: number; maxLon: number; minLat: number; maxLat: number },
): boolean {
  return a.minLon <= b.maxLon && a.maxLon >= b.minLon
      && a.minLat <= b.maxLat && a.maxLat >= b.minLat;
}

/** Ray-casting point-in-polygon. */
function pointInRing(lon: number, lat: number, ring: Ring): boolean {
  let inside = false;
  const n = ring.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) &&
        lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/** Sutherland-Hodgman polygon clipping against an axis-aligned bbox. */
function clipRingToBbox(
  ring: Ring,
  minLon: number, minLat: number, maxLon: number, maxLat: number,
): Ring {
  if (ring.length < 3) return [];

  const lerp = (a: Coord, b: Coord, t: number): Coord =>
    [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

  function clipEdge(
    poly: Ring,
    inside: (p: Coord) => boolean,
    intersect: (a: Coord, b: Coord) => Coord,
  ): Ring {
    if (poly.length === 0) return [];
    const out: Ring = [];
    for (let i = 0; i < poly.length; i++) {
      const curr = poly[i];
      const prev = poly[(i + poly.length - 1) % poly.length];
      const currIn = inside(curr);
      const prevIn = inside(prev);
      if (currIn) {
        if (!prevIn) out.push(intersect(prev, curr));
        out.push(curr);
      } else if (prevIn) {
        out.push(intersect(prev, curr));
      }
    }
    return out;
  }

  let poly = ring;
  // Left: lon >= minLon
  poly = clipEdge(poly, p => p[0] >= minLon, (a, b) => {
    const dLon = b[0] - a[0];
    return dLon === 0 ? [minLon, a[1]] : lerp(a, b, (minLon - a[0]) / dLon);
  });
  // Right: lon <= maxLon
  poly = clipEdge(poly, p => p[0] <= maxLon, (a, b) => {
    const dLon = b[0] - a[0];
    return dLon === 0 ? [maxLon, a[1]] : lerp(a, b, (maxLon - a[0]) / dLon);
  });
  // Bottom: lat >= minLat
  poly = clipEdge(poly, p => p[1] >= minLat, (a, b) => {
    const dLat = b[1] - a[1];
    return dLat === 0 ? [a[0], minLat] : lerp(a, b, (minLat - a[1]) / dLat);
  });
  // Top: lat <= maxLat
  poly = clipEdge(poly, p => p[1] <= maxLat, (a, b) => {
    const dLat = b[1] - a[1];
    return dLat === 0 ? [a[0], maxLat] : lerp(a, b, (maxLat - a[1]) / dLat);
  });

  return poly;
}

/** Convert geo coords to canvas pixel coords (north = top). */
function geoToPixel(
  lon: number, lat: number,
  minLon: number, maxLon: number, minLat: number, maxLat: number,
  width: number, height: number,
): [number, number] {
  const x = ((lon - minLon) / (maxLon - minLon)) * width;
  const y = ((maxLat - lat) / (maxLat - minLat)) * height;
  return [x, y];
}

/** Convert a geo ring to an SVG sub-path string. */
function ringToSvgPath(
  ring: Ring,
  minLon: number, maxLon: number, minLat: number, maxLat: number,
  width: number, height: number,
): string {
  if (ring.length < 3) return '';
  const pts = ring.map(([lon, lat]) =>
    geoToPixel(lon, lat, minLon, maxLon, minLat, maxLat, width, height)
  );
  return 'M' + pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L') + ' Z';
}

// ─── Landscape ────────────────────────────────────────────────────────────────

function getLandscape(elev: number, rng: () => number): Landscape {
  const roll = rng();
  if (elev > 0.68) return roll < 0.7 ? 'mountain' : 'hills';
  if (elev > 0.60) return roll < 0.5 ? 'hills' : (roll < 0.8 ? 'forest' : 'mountain');
  if (elev > 0.52) return roll < 0.4 ? 'forest' : (roll < 0.75 ? 'plains' : 'hills');
  if (roll < 0.35) return 'plains';
  if (roll < 0.55) return 'swamp';
  if (roll < 0.75) return 'desert';
  return 'forest';
}

// ─── GeoJSON loaders ──────────────────────────────────────────────────────────

function loadLandRings(
  filePath: string,
  minLon: number, minLat: number, maxLon: number, maxLat: number,
): BboxedRing[] {
  console.log(`Loading land polygons from ${filePath}...`);
  const geojson = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  const bboxFilter = { minLon, maxLon, minLat, maxLat };
  const result: BboxedRing[] = [];

  for (const feature of geojson.features) {
    const geom = feature.geometry;
    let polys: Coord[][][] = [];
    if (geom.type === 'Polygon') polys = [geom.coordinates];
    else if (geom.type === 'MultiPolygon') polys = geom.coordinates;

    for (const poly of polys) {
      // poly[0] is outer ring; poly[1..] are holes — we only need outer ring for classification
      const outerRing = poly[0] as Ring;
      const bb = ringBbox(outerRing);
      if (!bboxOverlaps(bb, bboxFilter)) continue;
      result.push({ ring: outerRing, ...bb });
    }
  }

  console.log(`  ${result.length} land rings intersecting bbox`);
  return result;
}

function loadSeaFeatures(
  filePath: string,
  minLon: number, minLat: number, maxLon: number, maxLat: number,
): SeaFeature[] {
  console.log(`Loading sea features from ${filePath}...`);
  const geojson = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

  // Use a Map to merge features that share the same name (e.g. split Mediterranean)
  const byId = new Map<string, SeaFeature>();

  for (const feature of geojson.features) {
    const props = feature.properties ?? {};
    const name: string = props.name ?? props.NAME ?? props.name_en ?? 'Unknown Sea';
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const id = `sea-${slug}`;

    const geom = feature.geometry;
    let polys: Coord[][][] = [];
    if (geom.type === 'Polygon') polys = [geom.coordinates];
    else if (geom.type === 'MultiPolygon') polys = geom.coordinates;

    for (const poly of polys) {
      const outerRing = poly[0] as Ring;
      const clipped = clipRingToBbox(outerRing, minLon, minLat, maxLon, maxLat);
      if (clipped.length < 3) continue;
      const bb = ringBbox(clipped);
      if (!byId.has(id)) {
        byId.set(id, { name, id, rings: [] });
      }
      byId.get(id)!.rings.push({ ring: clipped, ...bb });
    }
  }

  const result = Array.from(byId.values());
  console.log(`  ${result.length} sea features intersecting bbox`);
  return result;
}

// ─── Sea lookup ───────────────────────────────────────────────────────────────

function findSeaForPoint(lon: number, lat: number, seaFeatures: SeaFeature[]): string | null {
  for (const sea of seaFeatures) {
    for (const { ring, minLon, maxLon, minLat, maxLat } of sea.rings) {
      if (lon < minLon || lon > maxLon || lat < minLat || lat > maxLat) continue;
      if (pointInRing(lon, lat, ring)) return sea.id;
    }
  }
  return null;
}

// ─── Main export ──────────────────────────────────────────────────────────────

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

export function generateRegionMap(options: GenerateRegionOptions): void {
  const {
    landFile, seasFile,
    rows, cols, width, height, outputDir,
    seed           = Math.floor(Math.random() * 100000),
    bbox           = [-30, 25, 70, 75],  // Europe + surrounding seas default
    noiseAmount    = 0.4,
    wrapX          = false,
    rivers         = 3,
    maxRiverLength = 25,
  } = options;

  const [minLon, minLat, maxLon, maxLat] = bbox;
  const rng = makeRng(seed);
  const randomFrom = <T,>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];

  const cellWidth  = width  / cols;
  const cellHeight = height / rows;
  const lonStep    = (maxLon - minLon) / cols;
  const latStep    = (maxLat - minLat) / rows;

  console.log(`Generating region map with seed ${seed} (${rows}x${cols}, bbox [${bbox.join(', ')}])...`);
  console.log(`  wrap-x: ${wrapX}`);

  // ── 1. Load GeoJSON ────────────────────────────────────────────────────────
  const landRings   = loadLandRings(landFile, minLon, minLat, maxLon, maxLat);
  const seaFeatures = loadSeaFeatures(seasFile, minLon, minLat, maxLon, maxLat);

  // ── 2. Cell helpers ───────────────────────────────────────────────────────
  type Cell = { r: number; c: number };
  const dirs: [number, number][] = [[-1, 0], [1, 0], [0, -1], [0, 1]];

  function cellCenter(r: number, c: number): [number, number] {
    return [
      minLon + (c + 0.5) * lonStep,
      maxLat - (r + 0.5) * latStep,
    ];
  }

  function getNeighborCells(r: number, c: number): Cell[] {
    const result: Cell[] = [];
    for (const [dr, dc] of dirs) {
      const nr = r + dr;
      let nc = c + dc;
      if (nr < 0 || nr >= rows) continue;
      if (wrapX) {
        nc = ((nc % cols) + cols) % cols;
      } else {
        if (nc < 0 || nc >= cols) continue;
      }
      result.push({ r: nr, c: nc });
    }
    return result;
  }

  // ── 3. Classify cells (land vs water) with noise-perturbed boundary ───────
  console.log('Classifying cells...');

  function isOnLand(lon: number, lat: number): boolean {
    for (const { ring, minLon: rml, maxLon: rml2, minLat: rla, maxLat: rla2 } of landRings) {
      if (lon < rml || lon > rml2 || lat < rla || lat > rla2) continue;
      if (pointInRing(lon, lat, ring)) return true;
    }
    return false;
  }

  const isLandMap: boolean[][] = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => {
      const [lon, lat] = cellCenter(r, c);
      const base  = isOnLand(lon, lat) ? 1.0 : 0.0;
      // fBm noise at a frequency that gives 3–5 noise "blobs" across the map
      const nx    = (c / cols) * 3.5;
      const ny    = (r / rows) * 3.5;
      const noise = (fbm(nx, ny, seed) - 0.5) * noiseAmount;
      return (base + noise) > 0.5;
    })
  );

  const typeMap: ProvinceType[][] = isLandMap.map(row =>
    row.map(isLand => (isLand ? 'land' : 'water'))
  );

  // ── 4. Secondary elevation map (for river routing and landscape variety) ──
  const elevMap: number[][] = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => {
      const nx = (c / cols) * 4;
      const ny = (r / rows) * 4;
      return fbm(nx, ny, seed + 9999);
    })
  );

  // ── 5. Rivers ─────────────────────────────────────────────────────────────
  if (rivers > 0) {
    const landCells: (Cell & { elev: number })[] = [];
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        if (typeMap[r][c] === 'land')
          landCells.push({ r, c, elev: elevMap[r][c] });
    landCells.sort((a, b) => b.elev - a.elev); // highest elevation first

    const riverTiles = new Set<string>();
    let riversPlaced = 0;

    for (let i = 0; i < landCells.length && riversPlaced < rivers; i++) {
      const start = landCells[i];
      if (riverTiles.has(`${start.r}-${start.c}`)) continue;

      const riverPath: Cell[] = [start];
      let cr = start.r, cc = start.c;
      let reachedWater = false;

      for (let step = 0; step < maxRiverLength; step++) {
        let bestElev = Infinity, bestR = -1, bestC = -1;
        for (const { r: nr, c: nc } of getNeighborCells(cr, cc)) {
          if (elevMap[nr][nc] < bestElev) {
            bestElev = elevMap[nr][nc];
            bestR = nr; bestC = nc;
          }
        }
        if (bestR === -1) break;
        if (typeMap[bestR][bestC] === 'water') { reachedWater = true; break; }
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
    console.log(`Rivers: ${riversPlaced}/${rivers} placed`);
  }

  // ── 6. Tag water cells with their sea feature ──────────────────────────────
  console.log('Tagging water cells with sea features...');
  const cellSeaId: (string | null)[][] = Array.from({ length: rows }, () =>
    new Array<string | null>(cols).fill(null)
  );

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (typeMap[r][c] !== 'water') continue;
      const [lon, lat] = cellCenter(r, c);
      cellSeaId[r][c] = findSeaForPoint(lon, lat, seaFeatures);
    }
  }

  // ── 7. Flood-fill: convert enclosed artifact water to land ────────────────
  // Natural Earth polygons have tiny gaps between features. At low resolutions
  // some cell centers fall in these gaps and get classified as water.
  // Fix: BFS from border water cells marks all ocean-connected water.
  // Enclosed water that isn't a named sea → convert to land.
  {
    const oceanConnected = new Set<string>();
    const queue: Array<{ r: number; c: number }> = [];

    // Seed from border cells (top/bottom rows; left/right cols when no wrap-x)
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const isBorder = r === 0 || r === rows - 1
          || (!wrapX && (c === 0 || c === cols - 1));
        if (isBorder && typeMap[r][c] === 'water') {
          const key = `${r},${c}`;
          if (!oceanConnected.has(key)) {
            oceanConnected.add(key);
            queue.push({ r, c });
          }
        }
      }
    }

    // BFS through water cells (respects wrap-x via getNeighborCells)
    while (queue.length > 0) {
      const { r, c } = queue.shift()!;
      for (const { r: nr, c: nc } of getNeighborCells(r, c)) {
        const key = `${nr},${nc}`;
        if (typeMap[nr][nc] === 'water' && !oceanConnected.has(key)) {
          oceanConnected.add(key);
          queue.push({ r: nr, c: nc });
        }
      }
    }

    // Enclosed water that isn't a named sea → land (polygon gap artifact)
    let filled = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (typeMap[r][c] !== 'water') continue;
        if (oceanConnected.has(`${r},${c}`)) continue;
        if (cellSeaId[r][c] !== null) continue;
        typeMap[r][c] = 'land';
        filled++;
      }
    }
    if (filled > 0) {
      console.log(`  Filled ${filled} enclosed artifact water cells`);
    }
  }

  // ── 8. Build grid provinces (land and untagged ocean cells) ─────────────────
  // Water cells covered by a named sea province are skipped (the sea polygon
  // already represents them). Untagged ocean cells (North Sea, English Channel,
  // open Pacific, etc.) get regular grid-cell provinces so the map has no holes.
  console.log('Building grid provinces...');
  const provinces: Province[] = [];
  const gridIndex: (number | null)[][] = Array.from({ length: rows }, () =>
    new Array<number | null>(cols).fill(null)
  );

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const type = typeMap[r][c];
      // Skip water cells that are covered by a named sea province
      if (type === 'water' && cellSeaId[r][c] !== null) continue;

      const x1 = c * cellWidth,  y1 = r * cellHeight;
      const x2 = x1 + cellWidth, y2 = y1 + cellHeight;
      const isOcean = type === 'water';

      gridIndex[r][c] = provinces.length;
      provinces.push({
        polygon: `M${x1} ${y1} H${x2} V${y2} H${x1} Z`,
        type,
        landscape: isOcean ? 'plains' : getLandscape(elevMap[r][c], rng),
        local_troops: 0,
        resource_type: isOcean ? randomFrom(resourcesSea) : pickWeighted(rng, resourceWeights),
        user_id: null,
        region_id: `prov-${r}-${c}`,
        neighbor_regions: [],
      });
    }
  }

  // ── 9. Grid neighbor linking ──────────────────────────────────────────────
  // Connect any two adjacent cells that both have grid provinces
  // (land ↔ land, land ↔ ocean, ocean ↔ ocean — but skip named-sea cells)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = gridIndex[r][c];
      if (idx === null) continue;
      const prov = provinces[idx];
      for (const { r: nr, c: nc } of getNeighborCells(r, c)) {
        if (gridIndex[nr][nc] !== null) {
          prov.neighbor_regions.push(`prov-${nr}-${nc}`);
        }
      }
    }
  }

  // ── 10. Build sea provinces ───────────────────────────────────────────────
  console.log('Building sea provinces...');
  const seaProvinceMap = new Map<string, Province>();

  for (const sea of seaFeatures) {
    const pathParts = sea.rings
      .map(({ ring }) => ringToSvgPath(ring, minLon, maxLon, minLat, maxLat, width, height))
      .filter(Boolean);

    if (pathParts.length === 0) continue;

    const seaProv: Province = {
      polygon: pathParts.join(' '),
      type: 'water',
      landscape: 'plains',
      local_troops: 0,
      resource_type: randomFrom(resourcesSea),
      user_id: null,
      region_id: sea.id,
      neighbor_regions: [],
    };
    provinces.push(seaProv);
    seaProvinceMap.set(sea.id, seaProv);
  }

  // ── 11. Link land cells ↔ sea provinces ─────────────────────────────────────
  console.log('Linking land ↔ sea neighbors...');
  const seaNeighbors = new Map<string, Set<string>>();
  for (const [id] of seaProvinceMap) seaNeighbors.set(id, new Set());

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = gridIndex[r][c];
      if (idx === null) continue; // no grid province here (named-sea cell)
      const prov = provinces[idx];

      for (const { r: nr, c: nc } of getNeighborCells(r, c)) {
        const seaId = cellSeaId[nr]?.[nc];
        if (!seaId || !seaProvinceMap.has(seaId)) continue;
        if (!prov.neighbor_regions.includes(seaId)) {
          prov.neighbor_regions.push(seaId);
        }
        seaNeighbors.get(seaId)!.add(`prov-${r}-${c}`);
      }
    }
  }

  // Link adjacent sea provinces to each other (water cells from two seas touch)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const seaA = cellSeaId[r][c];
      if (!seaA || !seaProvinceMap.has(seaA)) continue;
      for (const { r: nr, c: nc } of getNeighborCells(r, c)) {
        const seaB = cellSeaId[nr]?.[nc];
        if (!seaB || seaB === seaA || !seaProvinceMap.has(seaB)) continue;
        seaNeighbors.get(seaA)!.add(seaB);
        seaNeighbors.get(seaB)!.add(seaA);
      }
    }
  }

  for (const [seaId, nbSet] of seaNeighbors) {
    seaProvinceMap.get(seaId)!.neighbor_regions = Array.from(nbSet);
  }

  // ── Output ─────────────────────────────────────────────────────────────────
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const outPath = path.join(outputDir, 'provinces.json');
  fs.writeFileSync(outPath, JSON.stringify(provinces, null, 2), 'utf-8');

  const landCount  = provinces.filter(p => p.type === 'land').length;
  const waterCount = provinces.filter(p => p.type === 'water').length;
  console.log(`Done: ${provinces.length} provinces`);
  console.log(`  Land: ${landCount}, Sea: ${waterCount}`);
  console.log(`Saved: ${outPath}`);
}
