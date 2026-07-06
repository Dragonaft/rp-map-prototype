import { apiClient } from './config';
import { UserGoodHolding } from '../types';

export const goodsApi = {
  getMine: async (): Promise<UserGoodHolding[]> => {
    const response = await apiClient.get<UserGoodHolding[]>('/goods/mine');
    return response.data;
  },
};
