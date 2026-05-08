// TODO: sort types

export type ProvinceType = 'land' | 'coastal' | 'water';

export type Landscape = 'plains' | 'forest' | 'mountain' | 'desert' | 'hills' | 'swamp';

export enum BuildingTypes {
  CAPITOL = 'CAPITOL',
  CAPITAL = 'CAPITAL',
  FARM = 'FARM',
  BARRACKS = 'BARRACKS',
  FORT = 'FORT',
  MARKET = 'MARKET',
  LIBRARY = 'LIBRARY',
  MINE = 'MINE',
  FORESTRY = 'FORESTRY',
  GARDEN = 'GARDEN',
  BAZAAR = 'BAZAAR',
  ARMORY = 'ARMORY',
  ROAD = 'ROAD',
  TEMPLE = 'TEMPLE',
  CATHEDRAL = 'CATHEDRAL',
  TRADE_HOUSE = 'TRADE_HOUSE',
  CASTLE = 'CASTLE',
}

export interface Tech {
  id: string;
  key: string;
  name: string;
  description: string;
  branch: string;
  isClassRoot: boolean;
  cost: number;
  prerequisites: string[];
}


export interface Building {
  id: string;
  type: string;
  name: string;
  description: string;
  income: number | null;
  upkeep: number | null;
  modifier: string | null;
  cost: number;
  upgradeTo: string | null;
  requirementTech: string[] | null;
  requirementBuilding: string | null;
}

/** Static fields — never change after map import. Safe to cache in localStorage. */
export interface ProvinceLayout {
  id: string;
  polygon: string;
  type: ProvinceType;
  landscape: Landscape;
  resourceType: string;
  regionId: string;
  neighbors: string[] | null;
}

/** Dynamic fields — change only at turn end. Always fetched fresh. */
export interface ProvinceStateData {
  id: string;
  userId: string | null;
  localTroops: number | null;
  enemyHere?: boolean;
  buildings?: Building[];
  buildingCap: number | null;
}

export interface Province {
  id: string;
  type: ProvinceType;
  landscape: Landscape;
  polygon: string;
  resourceType: string;
  regionId: string;
  userId: string | null;
  localTroops: number;
  enemyHere?: boolean;
  buildings?: Building[];
  neighbors?: string[] | null;
  buildingCap: number;
}

export enum UserClasses {
  GUILD = 'guild',
  HOLY = 'holy',
  NOBLE = 'noble',
}

export interface User {
  id: string;
  login: string;
  countryName: string;
  color: string;
  troops: number;
  money: number;
  piety: number;
  class: string | null;
  isNew: boolean;
  provinces: Province[];
  researchPoints: number;
  completedResearch: string[];
}

export interface UserActive extends User {
  projectedIncome: number;
  projectedPiety: number | null;
  projectedResearch: number;
  projectedTroops: number;
}

export enum TroopCategory {
  INFANTRY = 'INFANTRY',
  RANGED = 'RANGED',
  CAVALRY = 'CAVALRY',
  SPECIAL = 'SPECIAL',
  PEASANT = 'PEASANT',
}

export interface TroopType {
  id: string;
  key: string;
  name: string;
  description: string;
  category: TroopCategory;
  cost_per_100: number;
  attack: number;
  defense: number;
  upkeep_per_100: number;
  tech_requirement: string | null;
  building_requirement: string | null;
}

export interface ArmyUnit {
  id: string;
  army_id: string;
  troop_type_id: string;
  troopType: TroopType;
  count: number;
}

export interface Army {
  id: string;
  name: string | null;
  user_id: string;
  province_id: string;
  flat_upkeep: number;
  units: ArmyUnit[];
  /** Only present for enemy armies. null = present but count unknown; number = spy network revealed total. */
  totalTroops?: number | null;
}

export interface PartialUser {
  id: string;
  countryName: string;
  color: string;
}

export interface SetupUserResponse {
  user: {
    id: string;
    login: string;
    country_name: string;
    color: string;
    troops: number;
    money: number;
    is_new: boolean;
    provinces: Province[];
    researchPoints: number;
  };
  province: {
    id: string;
    type: ProvinceType;
    landscape: Landscape;
    polygon: string;
    resource_type: string;
    region_id: string;
    user_id: string;
    local_troops: number;
  };
}

export enum ActionType {
  BUILD = 'BUILD',
  INVADE = 'INVADE',
  DEPLOY = 'DEPLOY',
  UPGRADE = 'UPGRADE',
  TRANSFER_TROOPS = 'TRANSFER_TROOPS',
  RESEARCH = 'RESEARCH',
  REMOVE = 'REMOVE',
  ARMY_CREATE = 'ARMY_CREATE',
  ARMY_MOVE = 'ARMY_MOVE',
  ARMY_RECRUIT = 'ARMY_RECRUIT',
  ARMY_MERGE = 'ARMY_MERGE',
  ARMY_DISBAND = 'ARMY_DISBAND',
  ARMY_EDIT = 'ARMY_EDIT',
}

export interface ActionData {
  provinceId?: number;
  buildingType?: string;
  buildingId?: number;
  targetProvinceId?: number;
  troopCount?: number;
  upgradeLevel?: number;
  [key: string]: any; // Flexible for future action types
}

export const RESOURCE_BUILDING_REQUIREMENTS: Partial<Record<BuildingTypes, string[]>> = {
  [BuildingTypes.MINE]: ['iron', 'gold', 'stone'],
  [BuildingTypes.FORESTRY]: ['wood'],
  [BuildingTypes.FARM]: ['grain'],
};
