import { apiClient } from './config';
import { PartialUser, User } from '../types';

export const usersApi = {
  getAll: async (): Promise<PartialUser[]> => {
    const response = await apiClient.get<PartialUser[]>(`/users/`);
    return response.data;
  },

  getOne: async (id: string): Promise<User> => {
    const response = await apiClient.get<User>(`/users/${id}`);
    return response.data;
  },

  update: async (id: string, data: Partial<User>): Promise<User> => {
    const response = await apiClient.patch<User>(`/users/${id}`, data);
    return response.data;
  },
};
