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

  update: async (id: string, data: Partial<UserUpdate>): Promise<{ countryName: string, color: string }> => {
    const response = await apiClient.patch<User>(`/users/${id}`, data);
    return response.data;
  },

  uploadFlag: async (id: string, file: File): Promise<{ flagUrl: string }> => {
    const formData = new FormData();
    formData.append('file', file);
    // Let axios set Content-Type itself (multipart boundary) — the apiClient default of
    // application/json would otherwise override it and the upload would fail server-side.
    const response = await apiClient.post<{ flagUrl: string }>(`/users/${id}/flag`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  deleteFlag: async (id: string): Promise<void> => {
    await apiClient.delete(`/users/${id}/flag`);
  },
};
