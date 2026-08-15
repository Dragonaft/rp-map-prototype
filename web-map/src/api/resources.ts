import { apiClient } from './config';
import { Resource, UserResourceHolding } from '../types';

export const resourcesApi = {
  getAll: async (): Promise<Resource[]> => {
    const response = await apiClient.get<Resource[]>('/resources');
    return response.data;
  },
  getMine: async (): Promise<UserResourceHolding[]> => {
    const response = await apiClient.get<UserResourceHolding[]>('/resources/mine');
    return response.data;
  },
};
