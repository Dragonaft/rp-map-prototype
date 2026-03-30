import { apiClient } from './config';
import { ActionData, ActionType } from "../types.ts";

export const actionsApi = {
  getUserActions: async (): Promise<any[]> => {
    const response = await apiClient.get<any[]>(`/users/`);
    return response.data;
  },

  createAction: async (data: { type: ActionType, actionData: ActionData }): Promise<any> => {
    const response = await apiClient.post(`/actions`, data);
    return response.data;
  },

  register: async (data: { login: string, password: string, countryName: string, color: string }): Promise<any> => {
    const response = await apiClient.post(`/auth/register`, data);
    return response.data;
  },
};
