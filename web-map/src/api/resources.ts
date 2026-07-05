import { apiClient } from './config';
import { Resource } from '../types';

export const resourcesApi = {
  getAll: async (): Promise<Resource[]> => {
    const response = await apiClient.get<Resource[]>('/resources');
    return response.data;
  },
};
