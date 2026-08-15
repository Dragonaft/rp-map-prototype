import { Army, TroopType } from '../types';
import { CompositionEntry, calcFoodUpkeepForComposition, calcSecondaryGoodUpkeepForComposition } from './supply';

export type { CompositionEntry };

/** Mirrors `upkeep-action.service.ts`'s hardcoded `'paladins'` check — ONGOING per-turn upkeep
 *  paid in piety instead of money. NOT the same set as recruit-cost currency below: Templar
 *  Order's recruit cost is piety but its ongoing upkeep_per_100 is money (its per-turn cost
 *  instead comes from the second supply-good slot — see supply.ts). */
export const PIETY_TROOPS = new Set(['paladins']);
/** Mirrors `PIETY_COST_TROOPS` in `action-executor.service.ts` — one-time RECRUIT cost paid in piety instead of money. */
export const PIETY_RECRUIT_TROOPS = new Set(['paladins', 'templar_order']);
/** Mirrors `NO_POOL_TROOPS` in `action-executor.service.ts` — recruited with money, not the draft pool. */
export const MONEY_TROOPS = new Set(['mercenaries', 'free_company']);

export interface UpkeepTotals {
  money: number;
  piety: number;
  food: number;
  /** Second supply-good slot, keyed by good id — the class elite units' partner-good
   *  dependency (e.g. Grand Host eats Relics). Empty for any composition with no elite units. */
  secondaryGoods: Map<string, number>;
}

/**
 * Recomputes upkeep from scratch for a hypothetical composition. Mirrors
 * `api/src/actions/upkeep-action.service.ts:64-77` exactly — keep them in lockstep.
 *
 * NEVER derive a per-troop delta from this: `Math.ceil(count / 100)` is applied PER UNIT, so
 * upkeep is a step function, not a per-troop rate (a unit at 150 troops bills 2 blocks, at 250
 * bills 3 — adding 100 troops adds one block, adding 60 may add none). Every projection stage
 * must call this with the full hypothetical composition, never add a delta on top of a rate.
 */
export const calcUpkeepForComposition = (
  units: CompositionEntry[],
  flatUpkeep: number,
  supplyDistance: number | null,
): UpkeepTotals => {
  let money = flatUpkeep;
  let piety = 0;
  for (const unit of units) {
    const cost = Math.ceil(Math.max(0, unit.count) / 100) * unit.troopType.upkeep_per_100;
    if (PIETY_TROOPS.has(unit.troopType.key)) {
      piety += cost;
    } else {
      money += cost;
    }
  }
  return {
    money,
    piety,
    food: calcFoodUpkeepForComposition(units, supplyDistance),
    secondaryGoods: calcSecondaryGoodUpkeepForComposition(units, supplyDistance),
  };
};

export const calcArmyUpkeep = (army: Army): UpkeepTotals =>
  calcUpkeepForComposition(army.units, army.flat_upkeep, army.supply_distance ?? null);

export const subtractTotals = (a: UpkeepTotals, b: UpkeepTotals): UpkeepTotals => {
  const goodIds = new Set([...a.secondaryGoods.keys(), ...b.secondaryGoods.keys()]);
  const secondaryGoods = new Map<string, number>();
  for (const id of goodIds) {
    secondaryGoods.set(id, (a.secondaryGoods.get(id) ?? 0) - (b.secondaryGoods.get(id) ?? 0));
  }
  return {
    money: a.money - b.money,
    piety: a.piety - b.piety,
    food: a.food - b.food,
    secondaryGoods,
  };
};

/** Max troops of `troopType` the user can currently afford, across pool/money/piety/goods constraints.
 *  `goodsAvailable2` is the stockpile for `required_goods_2` (the elite units' second one-time
 *  recruit cost) — irrelevant and safe to omit for every troop type that doesn't set that slot. */
export const calcMaxAdd = (
  troopType: TroopType,
  userTroops: number,
  userMoney: number,
  userPiety: number,
  goodsAvailable: number,
  goodsAvailable2 = 0,
): number => {
  let max: number;
  if (MONEY_TROOPS.has(troopType.key)) {
    max = troopType.cost_per_100 ? Math.floor(userMoney * 10 / troopType.cost_per_100) * 10 : 0;
  } else if (PIETY_RECRUIT_TROOPS.has(troopType.key)) {
    max = troopType.cost_per_100 ? Math.floor(userPiety * 10 / troopType.cost_per_100) * 10 : userTroops;
  } else {
    max = userTroops;
  }
  if (troopType.required_goods && troopType.goods_amount) {
    max = Math.min(max, Math.floor(goodsAvailable * 10 / troopType.goods_amount) * 10);
  }
  if (troopType.required_goods_2 && troopType.goods_amount_2) {
    max = Math.min(max, Math.floor(goodsAvailable2 * 10 / troopType.goods_amount_2) * 10);
  }
  return max;
};

/**
 * Folds queued ARMY_RECRUIT/ARMY_EDIT actions onto a base composition, producing the hypothetical
 * composition the army will have once every already-queued action for it resolves.
 *
 * Troop types queued but not yet in `base` are inserted, resolved via `troopTypeByKey` — if the
 * type can't be resolved (e.g. `troopTypes` hasn't loaded yet), that entry is skipped rather than
 * thrown, matching the pre-existing `pendingNewTypeRows` guard in ArmyBlock.
 */
export const applyPendingToComposition = (
  base: CompositionEntry[],
  recruitsByKey: Record<string, { count: number }[]>,
  removalsByKey: Record<string, { count: number }[]>,
  troopTypeByKey: Map<string, TroopType>,
): CompositionEntry[] => {
  const map = new Map<string, CompositionEntry>(base.map((entry) => [entry.troopType.key, entry]));

  for (const [key, entries] of Object.entries(recruitsByKey)) {
    const sum = entries.reduce((s, e) => s + e.count, 0);
    const existing = map.get(key);
    if (existing) {
      map.set(key, { troopType: existing.troopType, count: existing.count + sum });
    } else {
      const troopType = troopTypeByKey.get(key);
      if (troopType) map.set(key, { troopType, count: sum });
    }
  }

  for (const [key, entries] of Object.entries(removalsByKey)) {
    const sum = entries.reduce((s, e) => s + e.count, 0);
    const existing = map.get(key);
    if (existing) {
      map.set(key, { troopType: existing.troopType, count: Math.max(0, existing.count - sum) });
    }
  }

  return Array.from(map.values());
};

/**
 * Applies one hypothetical adjustment (positive = recruit, negative = removal) to a composition —
 * used for the live slider preview, layered on top of `applyPendingToComposition`'s result.
 */
export const adjustComposition = (
  base: CompositionEntry[],
  key: string,
  delta: number,
  troopTypeByKey: Map<string, TroopType>,
): CompositionEntry[] => {
  const map = new Map<string, CompositionEntry>(base.map((entry) => [entry.troopType.key, entry]));
  const existing = map.get(key);
  if (existing) {
    map.set(key, { troopType: existing.troopType, count: Math.max(0, existing.count + delta) });
  } else if (delta > 0) {
    const troopType = troopTypeByKey.get(key);
    if (troopType) map.set(key, { troopType, count: delta });
  }
  return Array.from(map.values());
};
