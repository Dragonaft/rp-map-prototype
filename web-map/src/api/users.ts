import { apiClient } from './config';
import { PartialUser, User, UserActive, UserUpdate } from '../types';

export const usersApi = {
  getAll: async (): Promise<PartialUser[]> => {
    const response = await apiClient.get<PartialUser[]>(`/users/`);
    return response.data;
  },

  getOne: async (id: string): Promise<UserActive> => {
    const response = await apiClient.get<UserActive>(`/users/${id}`);
    return response.data;
  },

  update: async (id: string, data: Partial<UserUpdate>): Promise<User> => {
    const response = await apiClient.patch<User>(`/users/${id}`, data);
    return response.data;
  },
};
