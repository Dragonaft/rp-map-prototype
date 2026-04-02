import { apiClient } from './config';
import { Building } from '../types';

export const buildingsApi = {
  getAll: async (): Promise<Building[]> => {
    const response = await apiClient.get<Building[]>('/buildings');
    return response.data;
  },
};
