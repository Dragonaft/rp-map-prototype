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

export interface Province {
  id: string;
  type: ProvinceType;
  landscape: Landscape;
  polygon: string;
  resourceType: string;
  regionId: string;
  userId: string | null;
  localTroops: number;
  buildings?: Building[];
  neighbors?: string[] | null;
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
