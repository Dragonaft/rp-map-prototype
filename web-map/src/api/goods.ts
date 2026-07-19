import { apiClient } from './config';
import { Good, UserGoodHolding } from '../types';

export const goodsApi = {
  getAll: async (): Promise<Good[]> => {
    const response = await apiClient.get<Good[]>('/goods');
    return response.data;
  },
  getMine: async (): Promise<UserGoodHolding[]> => {
    const response = await apiClient.get<UserGoodHolding[]>('/goods/mine');
    return response.data;
  },
};
