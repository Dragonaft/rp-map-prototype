/**
 * Pure helpers for the army food-supply mechanic — no NestJS/TypeORM dependencies, so they can be
 * imported by both SupplyActionService (the turn-tick that actually charges food and applies
 * attrition) and UsersService (the client-facing projection), without either module depending on
 * the other and without the two ever drifting out of sync on the cost formula.
 */

/** Tiles of penalty-free range from the nearest reachable supply_building. */
export const SUPPLY_FREE_RADIUS = 4;

/** Linear surcharge added to the multiplier per tile beyond SUPPLY_FREE_RADIUS. */
export const SUPPLY_PENALTY_PER_TILE = 0.25;

/**
 * Multiplier cap — also what an army with no reachable supply source at all pays. Without a cap,
 * the linear formula grows unbounded; this is reached at distance 16
 * (1 + 0.25 × (16 − 4) = 4.0), which is also why the BFS below is depth-bounded to 16.
 */
export const SUPPLY_MAX_MULTIPLIER = 4.0;

/** Fraction of each unit's troops lost per turn a starving army goes unfed. */
export const SUPPLY_ATTRITION_RATE = 0.10;

/** BFS depth bound — distances beyond this all resolve to the same SUPPLY_MAX_MULTIPLIER anyway. */
export const SUPPLY_BFS_MAX_DEPTH = 16;

/** `null` distance = no reachable supply_building within SUPPLY_BFS_MAX_DEPTH tiles. */
export const supplyMultiplierForDistance = (distance: number | null): number => {
  if (distance === null) return SUPPLY_MAX_MULTIPLIER;
  if (distance <= SUPPLY_FREE_RADIUS) return 1;
  return Math.min(SUPPLY_MAX_MULTIPLIER, 1 + SUPPLY_PENALTY_PER_TILE * (distance - SUPPLY_FREE_RADIUS));
};

export interface SupplyUnit {
  count: number;
  troopType: {
    supply_good_id?: string | null;
    supply_per_100?: number | null;
  } | null;
}

export interface SupplyArmy {
  units: SupplyUnit[];
}

/**
 * Base (pre-distance-multiplier) food need for an army, grouped by good id — a map rather than a
 * single number because different troop types could in principle draw on different supply goods,
 * even though the current seed data only ever uses Food. Troop types with no supply_good_id/
 * supply_per_100 contribute nothing (e.g. Peasants could be seeded that way, though currently
 * every troop type does eat).
 */
export const computeArmyBaseFoodNeed = (army: SupplyArmy): Map<string, number> => {
  const need = new Map<string, number>();
  for (const unit of army.units ?? []) {
    const tt = unit.troopType;
    if (!tt?.supply_good_id || !tt.supply_per_100) continue;
    const amount = Math.ceil(Math.max(0, unit.count) / 100) * tt.supply_per_100;
    need.set(tt.supply_good_id, (need.get(tt.supply_good_id) ?? 0) + amount);
  }
  return need;
};

/** Applies the distance multiplier to a base need map, rounding each good's amount up independently. */
export const scaleFoodNeed = (baseNeed: Map<string, number>, multiplier: number): Map<string, number> => {
  const scaled = new Map<string, number>();
  for (const [goodId, amount] of baseNeed) {
    scaled.set(goodId, Math.ceil(amount * multiplier));
  }
  return scaled;
};

/**
 * Multi-source BFS over a plain adjacency map (province id -> neighbor ids), bounded to
 * SUPPLY_BFS_MAX_DEPTH hops. Traverses through any province regardless of owner — supply range is
 * pure geography, not gated by territory control (unlike the road-reach BFS in
 * action-executor.service.ts, which only expands through the mover's own roaded provinces).
 */
export const bfsDistances = (
  adjacency: Map<string, string[]>,
  sources: string[],
  maxDepth: number = SUPPLY_BFS_MAX_DEPTH,
): Map<string, number> => {
  const dist = new Map<string, number>();
  let frontier: string[] = [];
  for (const s of sources) {
    if (!dist.has(s)) {
      dist.set(s, 0);
      frontier.push(s);
    }
  }

  for (let depth = 0; depth < maxDepth && frontier.length > 0; depth++) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const neighborId of adjacency.get(id) ?? []) {
        if (dist.has(neighborId)) continue;
        dist.set(neighborId, depth + 1);
        next.push(neighborId);
      }
    }
    frontier = next;
  }

  return dist;
};
