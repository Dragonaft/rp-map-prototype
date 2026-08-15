import { apiClient } from './config';
import { AppNotification, NotificationType } from '../types';

export const notificationsApi = {
  getMine: async (): Promise<AppNotification[]> => {
    const response = await apiClient.get<AppNotification[]>('/notifications');
    return response.data;
  },
  markAllRead: async (type?: NotificationType): Promise<void> => {
    await apiClient.post('/notifications/mark-read', type ? { type } : {});
  },
};
