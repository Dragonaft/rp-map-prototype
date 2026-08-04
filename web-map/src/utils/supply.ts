import { Army } from '../types';

/**
 * Client-side mirror of the cost formula in `api/src/actions/supply-utils.ts` (SupplyActionService).
 * Duplicated rather than shared across the two npm packages — same convention this file's caller
 * (ArmyBlock.tsx's calcArmyUpkeep) already follows for money/piety upkeep, which mirrors
 * upkeep-action.service.ts purely for display. Keep the constants and formula here in lockstep
 * with the backend if either changes.
 */
export const SUPPLY_FREE_RADIUS = 4;
export const SUPPLY_PENALTY_PER_TILE = 0.25;
export const SUPPLY_MAX_MULTIPLIER = 4.0;

export const supplyMultiplierForDistance = (distance: number | null): number => {
  if (distance === null) return SUPPLY_MAX_MULTIPLIER;
  if (distance <= SUPPLY_FREE_RADIUS) return 1;
  return Math.min(SUPPLY_MAX_MULTIPLIER, 1 + SUPPLY_PENALTY_PER_TILE * (distance - SUPPLY_FREE_RADIUS));
};

/** Total distance-scaled food cost for an army this turn, summed across every good it draws on (in practice just Food). */
export const calcArmyFoodUpkeep = (army: Army): number => {
  const multiplier = supplyMultiplierForDistance(army.supply_distance ?? null);
  let base = 0;
  for (const unit of army.units) {
    if (!unit.troopType.supply_good_id || !unit.troopType.supply_per_100) continue;
    base += Math.ceil(Math.max(0, unit.count) / 100) * unit.troopType.supply_per_100;
  }
  return Math.ceil(base * multiplier);
};
