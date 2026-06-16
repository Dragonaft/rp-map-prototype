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
  const neighbors: string[] = [];
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
    neighbors.push(`prov-${nr}-${nc}`);
  }
  return neighbors;
}

/** Parsed `prov-<row>-<col>` coordinates, or null if the id isn't grid-shaped. */
export function parseRegionId(regionId: string): { r: number; c: number } | null {
  const m = /^prov-(\d+)-(\d+)$/.exec(regionId);
  if (!m) return null;
  return { r: Number(m[1]), c: Number(m[2]) };
}
