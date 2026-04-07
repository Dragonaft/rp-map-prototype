import { apiClient } from './config';
import { ActionData, ActionType } from "../types.ts";

export const actionsApi = {
  getUserActions: async (): Promise<any[]> => {
    const response = await apiClient.get<any[]>(`/actions`);
    return response.data;
  },

  createAction: async (data: { type: ActionType, actionData: ActionData }): Promise<any> => {
    const response = await apiClient.post(`/actions`, data);
    return response.data;
  },

  removeAction: async (actionId: string): Promise<any> => {
    const response = await apiClient.delete(`/actions/pending/${actionId}`);
    return response.data;
  },
};
