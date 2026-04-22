import { apiClient } from './config';
import type { Province, ProvinceLayout, ProvinceStateData, SetupUserResponse } from '../types';

const LAYOUT_CACHE_KEY = 'rp_provinces_layout_v1';

export const provincesApi = {
  getAll: async (): Promise<Province[]> => {
    const response = await apiClient.get<Province[]>('/provinces');
    return response.data;
  },

  getLayout: async (): Promise<ProvinceLayout[]> => {
    const response = await apiClient.get<ProvinceLayout[]>('/provinces/layout');
    return response.data;
  },

  /** Returns layout from localStorage if cached, otherwise fetches and caches it.
   *  Pass forceRefresh=true to bypass and clear the cache (e.g. for new users). */
  getLayoutCached: async (forceRefresh = false): Promise<ProvinceLayout[]> => {
    if (forceRefresh) {
      try { localStorage.removeItem(LAYOUT_CACHE_KEY); } catch { /* ignore */ }
    } else {
      try {
        const cached = localStorage.getItem(LAYOUT_CACHE_KEY);
        if (cached) return JSON.parse(cached) as ProvinceLayout[];
      } catch {
        // corrupted cache — fall through to fetch
      }
    }
    const layout = await provincesApi.getLayout();
    try {
      localStorage.setItem(LAYOUT_CACHE_KEY, JSON.stringify(layout));
    } catch {
      // storage quota exceeded — proceed without caching
    }
    return layout;
  },

  getState: async (): Promise<ProvinceStateData[]> => {
    const response = await apiClient.get<ProvinceStateData[]>('/provinces/state');
    return response.data;
  },

  getOne: async (id: string): Promise<Province> => {
    const response = await apiClient.get<Province>(`/provinces/${id}`);
    return response.data;
  },

  update: async (id: string, data: Partial<Province>): Promise<Province> => {
    const response = await apiClient.patch<Province>(`/provinces/${id}`, data);
    return response.data;
  },

  setupUser: async (id: string): Promise<SetupUserResponse> => {
    const response = await apiClient.patch<SetupUserResponse>(`/provinces/setup/${id}`);
    return response.data;
  },
};
