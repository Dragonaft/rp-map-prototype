import { createHash } from 'crypto';

interface ChecksumInputProvince {
  region_id: string;
  polygon: string;
  type: string;
  landscape: string;
  resource_type: string | null;
  neighbor_regions?: string[];
}

/**
 * Content checksum of the map's static layout (everything GET /provinces/layout serves),
 * computed from the source provinces.json at import time — see import-provinces.ts, which
 * calls this before wiping/reinserting, and GameSettings.map_checksum, where the result is
 * stored so the web client can detect a re-imported map without polling the full layout.
 *
 * Pure and dependency-free (no NestJS/TypeORM) so import-provinces.ts — a standalone script,
 * not a Nest app context — can use it directly, same convention as supply-utils.ts.
 *
 * Canonicalized (sorted by region_id, neighbor_regions sorted too) so cosmetic re-saves of
 * provinces.json (whitespace, key order, generator's row ordering) that don't change any
 * province's actual content produce the same checksum — only real map changes bust the cache.
 */
export function computeMapChecksum(provinces: ChecksumInputProvince[]): string {
  const canonical = provinces
    .map((p) => ({
      region_id: p.region_id,
      polygon: p.polygon,
      type: p.type,
      landscape: p.landscape,
      resource_type: p.resource_type ?? null,
      neighbor_regions: [...(p.neighbor_regions ?? [])].sort(),
    }))
    .sort((a, b) => a.region_id.localeCompare(b.region_id));

  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}
