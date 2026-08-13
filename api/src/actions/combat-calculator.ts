import { EntityManager } from 'typeorm';
import { BuildingTypes } from '../buildings/types/building.types';
import { Army } from '../armies/entities/army.entity';
import { ArmyUnit } from '../armies/entities/army-unit.entity';

export const DEFENSIVE_BUILDING_TYPES = new Set<string>([
  BuildingTypes.FORT,
  BuildingTypes.CAPITOL,
  BuildingTypes.CAPITAL,
  BuildingTypes.CASTLE,
  BuildingTypes.CATHEDRAL,
]);

export const ARMY_MIN_SIZE = 100;
export const CASUALTY_FLOOR = 0.05;

/** Combat power multiplier applied to a bankruptcy-debuffed user's side (attacker or defender). */
export const BANKRUPTCY_COMBAT_PENALTY_MULTIPLIER = 0.5;

export const isBankruptcyDebuffed = (
  user: { bankruptcy_debuff_turns?: number | null } | null | undefined,
): boolean => Number(user?.bankruptcy_debuff_turns ?? 0) > 0;

export interface CombatBuilding {
  type: string;
  modifier?: string | null;
}

export interface CombatTroopType {
  attack: number;
  defense: number;
  /** Power multiplier applied while fighting on a water province (default 1.0 = no penalty). */
  water_combat_modifier?: number;
  /** TroopCategory string (INFANTRY/RANGED/CAVALRY/SPECIAL/PEASANT) — drives the counter matrix below. */
  category?: string | null;
}

export interface CombatArmyUnit {
  count: number;
  troopType: CombatTroopType;
}

export interface CombatArmy<Unit extends CombatArmyUnit = CombatArmyUnit> {
  units: Unit[];
}

/** Fraction of a force's total troops in each category, e.g. { INFANTRY: 0.6, CAVALRY: 0.4 }. */
export type CategoryMix = Partial<Record<string, number>>;

/**
 * Rock-paper-scissors triangle: INFANTRY (pikes) stops CAVALRY, CAVALRY rides down RANGED,
 * RANGED shoots INFANTRY. SPECIAL (the class units, including the elite capstones) and
 * PEASANT are absent from this table entirely, so they're neutral on *both* sides of every
 * matchup — they win or lose on raw stats alone, and never dilute or benefit from composition.
 *
 * Each entry is a delta added to a base multiplier of 1.0, weighted by how much of the *enemy*
 * force's troop count sits in the countered/countering category — see counterFactor below. A
 * mono-category enemy force gives the full swing; a 50/50 mix only gives half.
 */
export const TROOP_COUNTER_MATRIX: Record<string, CategoryMix> = {
  INFANTRY: { CAVALRY: 0.4, RANGED: -0.3 },
  RANGED: { INFANTRY: 0.4, CAVALRY: -0.3 },
  CAVALRY: { RANGED: 0.4, INFANTRY: -0.3 },
};

/** Category composition of a single army, as a fraction of its own total troops. */
export const armyCategoryMix = (army: CombatArmy): CategoryMix => armyGroupCategoryMix([army]);

/** Category composition across a group of armies (e.g. every defender in a province), as a
 *  fraction of the group's combined total troops — used when several armies fight as one side. */
export const armyGroupCategoryMix = (armies: CombatArmy[]): CategoryMix => {
  const total = armies.reduce((sum, a) => sum + armyTotalTroops(a), 0);
  if (total === 0) return {};
  const mix: CategoryMix = {};
  for (const army of armies) {
    for (const u of army.units ?? []) {
      const cat = u.troopType.category;
      if (!cat) continue;
      mix[cat] = (mix[cat] ?? 0) + u.count / total;
    }
  }
  return mix;
};

/** Composition-weighted counter multiplier for a single unit's category against the enemy's mix. */
const counterFactor = (category: string | null | undefined, enemyMix: CategoryMix): number => {
  if (!category) return 1;
  const row = TROOP_COUNTER_MATRIX[category];
  if (!row) return 1;
  let factor = 1;
  for (const [enemyCategory, share] of Object.entries(enemyMix)) {
    const delta = row[enemyCategory];
    if (delta) factor += delta * (share ?? 0);
  }
  return factor;
};

export const parseBuildingModifier = (modifier: string | null | undefined): number => {
  const n = Number(modifier);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

export const computeBuildModifier = (buildings: CombatBuilding[] | undefined): number => {
  if (!buildings?.length) {
    return 1;
  }

  let sum = 0;
  for (const b of buildings) {
    if (DEFENSIVE_BUILDING_TYPES.has(b.type)) {
      sum += parseBuildingModifier(b.modifier);
    }
  }

  return sum > 0 ? sum : 1;
};

export const armyTotalTroops = (army: CombatArmy): number =>
  (army.units ?? []).reduce((sum, u) => sum + u.count, 0);

/** Per-unit water penalty multiplier, or 1 (no penalty) when not fighting on water. */
const waterFactor = (troopType: CombatTroopType, onWater: boolean): number =>
  onWater ? (troopType.water_combat_modifier ?? 1) : 1;

/**
 * `enemyMix` defaults to {} (every counterFactor resolves to 1, i.e. no composition effect) so
 * existing callers that don't pass it keep the pre-counter-matrix behavior rather than silently
 * changing — pass the *opposing* side's armyGroupCategoryMix() to get the counter bonus/penalty.
 */
export const armyAttackPower = (army: CombatArmy, onWater = false, enemyMix: CategoryMix = {}): number =>
  (army.units ?? []).reduce(
    (sum, u) => sum + u.count * u.troopType.attack * waterFactor(u.troopType, onWater) * counterFactor(u.troopType.category, enemyMix),
    0,
  );

export const armyDefensePower = (army: CombatArmy, onWater = false, enemyMix: CategoryMix = {}): number =>
  (army.units ?? []).reduce(
    (sum, u) => sum + u.count * u.troopType.defense * waterFactor(u.troopType, onWater) * counterFactor(u.troopType.category, enemyMix),
    0,
  );

export const applyCasualties = <ArmyType extends CombatArmy>(
  army: ArmyType,
  rate: number,
): void => {
  for (const unit of army.units) {
    unit.count = Math.max(0, unit.count - Math.floor(unit.count * rate));
  }
  army.units = army.units.filter((u) => u.count > 0) as ArmyType['units'];
};

/**
 * Fully removes an army: its units, then the army row itself. Shared by weak-army disbanding,
 * land-combat loser wipes, water-overstay deletion, and water-combat loser wipes (on water the
 * loser is always fully removed — no partial-casualty survival).
 */
export const deleteArmy = async (manager: EntityManager, armyId: string): Promise<void> => {
  await manager.delete(ArmyUnit, { army_id: armyId });
  await manager.delete(Army, armyId);
};
