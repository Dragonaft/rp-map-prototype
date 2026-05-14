import { apiClient } from './config';
import { Tech } from '../types';

export const techsApi = {
  getAll: async (): Promise<Tech[]> => {
    const response = await apiClient.get<Tech[]>('/techs');
    return response.data;
  },
};
