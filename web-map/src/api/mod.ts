import { apiClient } from './config';

// The /mod/* endpoints mirror the admin-panel's /admin/* convention: raw entity fields
// (snake_case), not the camelCase-transformed shape /users/:id returns.
export interface ModNpc {
  id: string;
  login: string;
  country_name: string;
  color: string;
  money: number;
  troops: number;
  piety: number;
  role: string;
  is_npc: boolean;
}

export interface SpawnArmyUnit {
  troop_type_key: string;
  count: number;
}

export interface SetStocksPayload {
  money?: number;
  troops?: number;
  piety?: number;
  goods?: { goodId: string; quantity: number }[];
  resources?: { resourceKey: string; quantity: number }[];
}

export const modApi = {
  createNpc: async (data: { login: string; country_name: string; color: string; money?: number; troops?: number; piety?: number }): Promise<ModNpc> => {
    const response = await apiClient.post<ModNpc>('/mod/npc', data);
    return response.data;
  },

  listNpcs: async (): Promise<ModNpc[]> => {
    const response = await apiClient.get<ModNpc[]>('/mod/npcs');
    return response.data;
  },

  setProvinceOwner: async (provinceId: string, userId: string | null): Promise<void> => {
    await apiClient.patch(`/mod/province/${provinceId}/owner`, { userId });
  },

  spawnArmy: async (data: { userId: string; provinceId: string; name?: string; units: SpawnArmyUnit[] }): Promise<void> => {
    await apiClient.post('/mod/army', data);
  },

  placeBuilding: async (provinceId: string, buildingId: string): Promise<void> => {
    await apiClient.post('/mod/building', { provinceId, buildingId });
  },

  /** provinceBuildingId is the built instance id (ProvinceBuilding.instanceId), not the building template id. */
  removeBuilding: async (provinceBuildingId: string): Promise<void> => {
    await apiClient.delete(`/mod/building/${provinceBuildingId}`);
  },

  setStocks: async (userId: string, data: SetStocksPayload): Promise<void> => {
    await apiClient.patch(`/mod/user/${userId}/stocks`, data);
  },
};
