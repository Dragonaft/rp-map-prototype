import { BuildingTypes } from '../buildings/types/building.types';

export const DEFENSIVE_BUILDING_TYPES = new Set<string>([
  BuildingTypes.FORT,
  BuildingTypes.CAPITOL,
  BuildingTypes.CAPITAL,
  BuildingTypes.CASTLE,
  BuildingTypes.CATHEDRAL,
]);

export const ARMY_MIN_SIZE = 100;
export const CASUALTY_FLOOR = 0.05;

export interface CombatBuilding {
  type: string;
  modifier?: string | null;
}

export interface CombatTroopType {
  attack: number;
  defense: number;
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

export const armyAttackPower = (army: CombatArmy): number =>
  (army.units ?? []).reduce((sum, u) => sum + u.count * u.troopType.attack, 0);

export const armyDefensePower = (army: CombatArmy): number =>
  (army.units ?? []).reduce((sum, u) => sum + u.count * u.troopType.defense, 0);

export const applyCasualties = <ArmyType extends CombatArmy>(
  army: ArmyType,
  rate: number,
): void => {
  for (const unit of army.units) {
    unit.count = Math.max(0, unit.count - Math.floor(unit.count * rate));
  }
  army.units = army.units.filter((u) => u.count > 0) as ArmyType['units'];
};
