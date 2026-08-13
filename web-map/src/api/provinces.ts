import { apiClient } from './config';
import type { Province, ProvinceLayout, ProvinceStateData, SetupUserResponse } from '../types';
import { gameSettingsApi } from './gameSettings';

// v2: stores { checksum, layout } instead of a bare layout array — see getLayoutCached below.
// The old v1 key (a bare array, no checksum) is left to age out of localStorage rather than
// actively removed, matching this codebase's existing key-bump convention.
const LAYOUT_CACHE_KEY = 'rp_provinces_layout_v2';

interface LayoutCacheEntry {
  checksum: string | null;
  layout: ProvinceLayout[];
}

export const provincesApi = {
  getAll: async (): Promise<Province[]> => {
    const response = await apiClient.get<Province[]>('/provinces');
    return response.data;
  },

  getLayout: async (): Promise<ProvinceLayout[]> => {
    const response = await apiClient.get<ProvinceLayout[]>('/provinces/layout');
    return response.data;
  },

  /**
   * Returns layout from localStorage if its cached checksum matches the server's current
   * `game_settings.map_checksum`, otherwise fetches fresh and re-caches. This replaces the
   * old `forceRefresh`-for-new-users-only design: an admin re-importing provinces.json (see
   * import-provinces.ts) changes every province id, and previously an *existing* player's
   * cache never noticed — it only ever refreshed for brand-new users. The checksum check
   * subsumes that case too (a new user simply has no cache yet), so no special-casing is
   * needed here anymore.
   */
  getLayoutCached: async (): Promise<ProvinceLayout[]> => {
    const { mapChecksum: serverChecksum } = await gameSettingsApi.getPublic();

    let cached: LayoutCacheEntry | null = null;
    try {
      const raw = localStorage.getItem(LAYOUT_CACHE_KEY);
      if (raw) cached = JSON.parse(raw) as LayoutCacheEntry;
    } catch {
      // corrupted cache — fall through to fetch
    }

    if (cached && cached.checksum === serverChecksum) {
      return cached.layout;
    }

    console.info(`[provinces] Map layout checksum changed (${cached?.checksum ?? 'none'} → ${serverChecksum}); refetching layout.`);
    const layout = await provincesApi.getLayout();
    try {
      const entry: LayoutCacheEntry = { checksum: serverChecksum, layout };
      localStorage.setItem(LAYOUT_CACHE_KEY, JSON.stringify(entry));
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
