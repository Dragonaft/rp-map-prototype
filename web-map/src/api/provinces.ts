import { apiClient } from './config';
import type { Province, SetupUserResponse } from '../types';

export const provincesApi = {
  getAll: async (): Promise<Province[]> => {
    const response = await apiClient.get<Province[]>('/provinces');
    return response.data;
  },

  getOne: async (id: string): Promise<Province> => {
    const response = await apiClient.get<Province>(`/provinces/${id}`);
    return response.data;
  },

  update: async (id: string, data: Partial<Province>): Promise<Province> => {
    const response = await apiClient.patch<Province>(`/provinces/${id}`, data);
    return response.data;
  },

  setupUser: async (id: string): Promise<SetupUserResponse> => {
    const response = await apiClient.patch<SetupUserResponse>(`/provinces/setup/${id}`);
    return response.data;
  },
};
