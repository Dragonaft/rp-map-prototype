import fs from 'fs';
import path from 'path';
import { Province } from './types';
import { gridNeighborRegions, parseRegionId } from './gridNeighbors';

interface RewrapOptions {
  inputFile: string;
  outputFile?: string; // defaults to overwriting inputFile
  wrapX?: boolean; // default true — the whole point of this command
}

/**
 * Recompute `neighbor_regions` for an existing grid-based provinces.json.
 *
 * The grid dimensions are inferred from the `prov-<row>-<col>` ids, then each
 * province's neighbors are recomputed with optional east-west wrapping. All
 * other province fields (geometry, terrain, resources, ownership) are left
 * untouched — only `neighbor_regions` changes.
 *
 * This is for fixing the neighbor topology of a map that is already generated
 * (and possibly already loaded into a live DB) without regenerating terrain.
 */
export function rewrapNeighbors(options: RewrapOptions) {
  const { inputFile, wrapX = true } = options;
  const outputFile = options.outputFile ?? inputFile;

  if (!fs.existsSync(inputFile)) {
    console.error(`File not found: ${inputFile}`);
    process.exit(1);
  }

  let provinces: Province[];
  try {
    provinces = JSON.parse(fs.readFileSync(inputFile, 'utf-8'));
  } catch (err: any) {
    console.error(`Failed to parse ${inputFile}: ${err.message}`);
    process.exit(1);
  }

  if (!Array.isArray(provinces) || provinces.length === 0) {
    console.error('Input must be a non-empty array of provinces');
    process.exit(1);
  }

  // Infer grid dimensions from region ids. Every cell of the grid must be
  // present for pure-grid neighbor math to be valid; bail loudly otherwise.
  let maxRow = -1;
  let maxCol = -1;
  const present = new Set<string>();
  const nonGrid: string[] = [];
  for (const p of provinces) {
    const coord = parseRegionId(p.region_id);
    if (!coord) {
      nonGrid.push(p.region_id);
      continue;
    }
    present.add(`${coord.r}-${coord.c}`);
    if (coord.r > maxRow) maxRow = coord.r;
    if (coord.c > maxCol) maxCol = coord.c;
  }

  if (nonGrid.length > 0) {
    console.error(
      `rewrap only supports pure grid maps (prov-<row>-<col>). Found ${nonGrid.length} non-grid id(s), ` +
        `e.g. ${nonGrid.slice(0, 5).join(', ')}. Use the generator's own neighbor linking for named-sea maps.`,
    );
    process.exit(1);
  }

  const rows = maxRow + 1;
  const cols = maxCol + 1;

  if (rows * cols !== provinces.length || present.size !== provinces.length) {
    console.error(
      `Grid is not complete: inferred ${rows}x${cols} = ${rows * cols} cells but file has ` +
        `${provinces.length} provinces (${present.size} distinct grid cells). ` +
        `rewrap needs every cell present.`,
    );
    process.exit(1);
  }

  console.log(`Rewrapping neighbors for ${rows}x${cols} grid (${provinces.length} provinces), wrap-x: ${wrapX}`);

  let changed = 0;
  for (const p of provinces) {
    const { r, c } = parseRegionId(p.region_id)!;
    const next = gridNeighborRegions(r, c, rows, cols, wrapX);
    const prev = p.neighbor_regions ?? [];
    if (prev.length !== next.length || [...prev].sort().join() !== [...next].sort().join()) {
      changed++;
    }
    p.neighbor_regions = next;
  }

  const outDir = path.dirname(outputFile);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outputFile, JSON.stringify(provinces, null, 2), 'utf-8');

  // Distribution sanity check: with wrap-x only the pole rows (top/bottom)
  // lose a vertical neighbor, so expect 3 neighbors there and 4 everywhere else.
  const dist: Record<number, number> = {};
  for (const p of provinces) {
    const n = p.neighbor_regions.length;
    dist[n] = (dist[n] ?? 0) + 1;
  }
  console.log(`Provinces changed: ${changed}/${provinces.length}`);
  console.log(`Neighbor-count distribution: ${JSON.stringify(dist)}`);
  console.log(`Saved: ${outputFile}`);
}
