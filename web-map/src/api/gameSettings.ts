import { apiClient } from './config';

export interface GameSettings {
  id: string;
  isPaused: boolean;
  pauseMessage: string | null;
  turnsEnabled: boolean;
  /** Content hash of the current map, recomputed by import-provinces.ts on every
   *  map re-import. null until the first import after this field was introduced —
   *  see provincesApi.getLayoutCached() for how the web client uses this. */
  mapChecksum: string | null;
}

export const gameSettingsApi = {
  // Public, unauthenticated endpoint — the login screen reads this before anyone is logged in.
  getPublic: async (): Promise<GameSettings> => {
    const response = await apiClient.get<GameSettings>('/game-settings');
    return response.data;
  },
};
