import { apiClient } from './config';
import { Tech } from '../types';

export const techsApi = {
  getAll: async (): Promise<Tech[]> => {
    const response = await apiClient.get<Tech[]>('/techs');
    return response.data;
  },

  /** Sets the active research slot immediately — takes effect before the next income tick. */
  selectResearch: async (techKey: string): Promise<{ activeResearch: string }> => {
    const response = await apiClient.post<{ activeResearch: string }>('/techs/select', { tech_key: techKey });
    return response.data;
  },
};
