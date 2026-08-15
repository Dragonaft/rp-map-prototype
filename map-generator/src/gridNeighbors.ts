// Shared 4-directional grid neighbor math for the `prov-<row>-<col>` layout.
//
// Rows never wrap (the top and bottom edges are the poles), but columns can
// wrap east↔west to model a cylindrical/globe map — the west-most column
// becomes a neighbor of the east-most column and vice versa.
//
// Used by both the grid generator (generateGrid) and the `rewrap` command so
// the two never drift apart.

const DIRS: ReadonlyArray<readonly [number, number]> = [
  [-1, 0], // up
  [1, 0], // down
  [0, -1], // left
  [0, 1], // right
];

/**
 * Cell coordinates adjacent to (r, c) on a rows×cols grid.
 * When wrapX is true, column indices wrap modulo cols.
 */
export function gridNeighborCells(
  r: number,
  c: number,
  rows: number,
  cols: number,
  wrapX: boolean,
): { r: number; c: number }[] {
  const neighbors: { r: number; c: number }[] = [];
  for (const [dr, dc] of DIRS) {
    const nr = r + dr;
    let nc = c + dc;
    if (nr < 0 || nr >= rows) continue; // rows are hard edges (poles)
    if (wrapX) {
      nc = ((nc % cols) + cols) % cols;
    } else if (nc < 0 || nc >= cols) {
      continue;
    }
    if (nr === r && nc === c) continue; // guard against cols === 1 self-link
    neighbors.push({ r: nr, c: nc });
  }
  return neighbors;
}

/**
 * Region ids of the cells adjacent to (r, c) on a rows×cols grid.
 * When wrapX is true, column indices wrap modulo cols.
 */
export function gridNeighborRegions(
  r: number,
  c: number,
  rows: number,
  cols: number,
  wrapX: boolean,
): string[] {
  return gridNeighborCells(r, c, rows, cols, wrapX).map(({ r: nr, c: nc }) => `prov-${nr}-${nc}`);
}

/**
 * Grid distance between two cells, accounting for east-west wrap: the column
 * delta takes the shorter of the direct and wrapped-around paths. Rows never
 * wrap (poles are hard edges). Used to size water channels between continents
 * and to place continent seeds well spread out on the cylinder.
 */
export function toroidalDistance(
  r1: number,
  c1: number,
  r2: number,
  c2: number,
  cols: number,
  wrapX: boolean,
): number {
  const dr = r1 - r2;
  let dc = Math.abs(c1 - c2);
  if (wrapX) {
    dc = Math.min(dc, cols - dc);
  }
  return Math.sqrt(dr * dr + dc * dc);
}

/** Parsed `prov-<row>-<col>` coordinates, or null if the id isn't grid-shaped. */
export function parseRegionId(regionId: string): { r: number; c: number } | null {
  const m = /^prov-(\d+)-(\d+)$/.exec(regionId);
  if (!m) return null;
  return { r: Number(m[1]), c: Number(m[2]) };
}
