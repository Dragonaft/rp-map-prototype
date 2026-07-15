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
}

export interface CombatArmyUnit {
  count: number;
  troopType: CombatTroopType;
}

export interface CombatArmy<Unit extends CombatArmyUnit = CombatArmyUnit> {
  units: Unit[];
}

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

export const armyAttackPower = (army: CombatArmy, onWater = false): number =>
  (army.units ?? []).reduce((sum, u) => sum + u.count * u.troopType.attack * waterFactor(u.troopType, onWater), 0);

export const armyDefensePower = (army: CombatArmy, onWater = false): number =>
  (army.units ?? []).reduce((sum, u) => sum + u.count * u.troopType.defense * waterFactor(u.troopType, onWater), 0);

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
