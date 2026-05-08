import { apiClient } from './config';
import { Army, TroopType } from '../types';
import { ActionType } from '../types';

export const armiesApi = {
  getUserArmies: async (): Promise<Army[]> => {
    const response = await apiClient.get<Army[]>('/armies/all');
    return response.data;
  },

  getTroopTypes: async (): Promise<TroopType[]> => {
    const response = await apiClient.get<TroopType[]>('/armies/troop-types');
    return response.data;
  },

  createArmy: async (data: {
    province_id: string;
    name?: string;
    units: { troop_type_key: string; count: number }[];
  }): Promise<{ action: any }> => {
    const response = await apiClient.post('/armies', data);
    return response.data;
  },

  updateArmyName: async (id: string, name: string): Promise<Army> => {
    const response = await apiClient.patch<Army>(`/armies/${id}`, { name });
    return response.data;
  },

  disbandArmy: async (id: string): Promise<{ action: any }> => {
    const response = await apiClient.delete(`/armies/${id}`);
    return response.data;
  },

  recruitTroops: async (data: {
    army_id: string;
    units: { troop_type_key: string; count: number }[];
  }): Promise<any> => {
    const response = await apiClient.post('/actions', {
      type: ActionType.ARMY_RECRUIT,
      actionData: data,
    });
    return response.data;
  },

  removeTroops: async (data: {
    army_id: string;
    troop_type_key: string;
    count: number;
  }): Promise<any> => {
    const response = await apiClient.post('/actions', {
      type: ActionType.ARMY_EDIT,
      actionData: data,
    });
    return response.data;
  },

  moveArmy: async (data: {
    army_id: string;
    to_province_id: string;
  }): Promise<any> => {
    const response = await apiClient.post('/actions', {
      type: ActionType.ARMY_MOVE,
      actionData: data,
    });
    return response.data;
  },
};
