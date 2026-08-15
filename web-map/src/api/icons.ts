import { apiClient } from './config';
import { GameIconMeta } from '../types';

export const iconsApi = {
  getAll: async (): Promise<GameIconMeta[]> => {
    const response = await apiClient.get<GameIconMeta[]>('/icons');
    return response.data;
  },
};
