import { apiClient } from './config';

export interface AuthUser {
  id: string;
  login: string;
  role: string;
}

export const authApi = {
  login: (login: string, password: string) =>
    apiClient.post<{ user: { id: string; login: string }; message: string }>('/auth/login', { login, password }),
  logout: () => apiClient.post('/auth/logout'),
  getMe: () => apiClient.get<AuthUser>('/auth/me'),
  refresh: () => apiClient.post('/auth/refresh'),
};
