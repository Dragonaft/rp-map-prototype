import { Army, TroopType } from '../types';

/**
 * Client-side mirror of the cost formula in `api/src/actions/supply-utils.ts` (SupplyActionService).
 * Duplicated rather than shared across the two npm packages — same convention this file's caller
 * (utils/armyUpkeep.ts's calcArmyUpkeep) already follows for money/piety upkeep, which mirrors
 * upkeep-action.service.ts purely for display. Keep the constants and formula here in lockstep
 * with the backend if either changes.
 */
export const SUPPLY_FREE_RADIUS = 4;
export const SUPPLY_PENALTY_PER_TILE = 0.25;
export const SUPPLY_MAX_MULTIPLIER = 4.0;

/** A troop-type + count pair — shared shape for both a real army's units and a hypothetical composition (queued/preview). `ArmyUnit` satisfies this structurally. */
export interface CompositionEntry {
  troopType: TroopType;
  count: number;
}

export const supplyMultiplierForDistance = (distance: number | null): number => {
  if (distance === null) return SUPPLY_MAX_MULTIPLIER;
  if (distance <= SUPPLY_FREE_RADIUS) return 1;
  return Math.min(SUPPLY_MAX_MULTIPLIER, 1 + SUPPLY_PENALTY_PER_TILE * (distance - SUPPLY_FREE_RADIUS));
};

/** Total distance-scaled food cost for a hypothetical composition this turn, summed across every good it draws on (in practice just Food). */
export const calcFoodUpkeepForComposition = (units: CompositionEntry[], supplyDistance: number | null): number => {
  const multiplier = supplyMultiplierForDistance(supplyDistance);
  let base = 0;
  for (const unit of units) {
    if (!unit.troopType.supply_good_id || !unit.troopType.supply_per_100) continue;
    base += Math.ceil(Math.max(0, unit.count) / 100) * unit.troopType.supply_per_100;
  }
  return Math.ceil(base * multiplier);
};

/** Total distance-scaled food cost for an army this turn. */
export const calcArmyFoodUpkeep = (army: Army): number =>
  calcFoodUpkeepForComposition(army.units, army.supply_distance ?? null);
