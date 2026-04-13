export type ProvinceType = 'land' | 'coastal' | 'water';

export type Landscape = 'plains' | 'forest' | 'mountain' | 'desert' | 'hills' | 'swamp';

export interface Province {
  polygon: string;
  type: ProvinceType;
  landscape: Landscape;
  local_troops: number;
  resource_type: string | null;
  user_id: string | null;
  region_id: string;
  neighbor_regions: string[];
}
