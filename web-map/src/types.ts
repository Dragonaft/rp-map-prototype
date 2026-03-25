export type ProvinceType = 'land' | 'coastal' | 'water';

export type Landscape = 'plains' | 'forest' | 'mountain' | 'desert' | 'hills' | 'swamp';

export interface Province {
  id: string;
  type: ProvinceType;
  landscape: Landscape;
  polygon: string;
  resourceType: string;
  regionId: string;
  userId: string | null;
  localTroops: number;
}

export interface User {
  id: string;
  login: string;
  countryName: string;
  color: string;
  troops: number;
  money: number;
  isNew: boolean;
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
