export type ProvinceType = 'land' | 'coastal' | 'water';

export type Landscape = 'plains' | 'forest' | 'mountain' | 'desert' | 'hills' | 'swamp';

export interface Province {
  id: string;
  resourceId: string | null;
  buildings: string[];
  ownerId: string | null;
  userColor: string | null;
  landscape: Landscape;
  troops: number;
  type: ProvinceType;
  polygon: string;
  regionId: string; // логический регион для объединения/деления
}
