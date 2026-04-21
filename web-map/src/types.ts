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
  income: string | null;
  upkeep: string | null;
  modifier: string | null;
  cost: number;
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

export interface User {
  id: string;
  login: string;
  countryName: string;
  color: string;
  troops: number;
  money: number;
  isNew: boolean;
  provinces: Province[];
  researchPoints: number;
  completedResearch: string[];
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
