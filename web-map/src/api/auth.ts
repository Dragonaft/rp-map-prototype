import { apiClient } from './config';

export const authApi = {
  login: async (data: { login: string, password: string }): Promise<any> => {
    const response = await apiClient.post(`/auth/login`, data, {
      // @ts-ignore - custom flag: don't try token refresh on auth endpoints
      _skipAuthRedirect: true,
    });
    return response.data;
  },

  register: async (data: { login: string, password: string, countryName: string, color: string }): Promise<any> => {
    const response = await apiClient.post(`/auth/register`, data, {
      // @ts-ignore - custom flag: don't try token refresh on auth endpoints
      _skipAuthRedirect: true,
    });
    return response.data;
  },

  logout: async (): Promise<void> => {
    await apiClient.post('/auth/logout');
  },

  refresh: async (): Promise<void> => {
    await apiClient.post('/auth/refresh', {}, {
      // @ts-ignore - custom flag for interceptor
      _skipAuthRedirect: true,
    });
  },

  getMe: async (): Promise<any> => {
    const response = await apiClient.get('/auth/me', {
      // @ts-ignore - custom flag for interceptor
      _skipAuthRedirect: true,
    });
    return response.data;
  },
};
