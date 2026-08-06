import { apiClient } from './config';

export interface GameSettings {
  id: string;
  isPaused: boolean;
  pauseMessage: string | null;
  turnsEnabled: boolean;
}

export const gameSettingsApi = {
  // Public, unauthenticated endpoint — the login screen reads this before anyone is logged in.
  getPublic: async (): Promise<GameSettings> => {
    const response = await apiClient.get<GameSettings>('/game-settings');
    return response.data;
  },
};
