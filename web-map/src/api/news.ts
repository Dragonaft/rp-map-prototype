import { apiClient } from './config';
import { MyNewsAgency, NewsAgency, NewsArticle } from '../types';

export const newsApi = {
  getAgencies: async (): Promise<NewsAgency[]> => {
    const response = await apiClient.get<NewsAgency[]>('/news/agencies');
    return response.data;
  },
  getMine: async (): Promise<MyNewsAgency> => {
    const response = await apiClient.get<MyNewsAgency>('/news/agencies/mine');
    return response.data;
  },
  getArticles: async (agencyId: string): Promise<NewsArticle[]> => {
    const response = await apiClient.get<NewsArticle[]>(`/news/agencies/${agencyId}/articles`);
    return response.data;
  },
  createAgency: async (name: string): Promise<NewsAgency> => {
    const response = await apiClient.post<NewsAgency>('/news/agencies', { name });
    return response.data;
  },
  renameAgency: async (name: string): Promise<NewsAgency> => {
    const response = await apiClient.patch<NewsAgency>('/news/agencies/mine', { name });
    return response.data;
  },
  createArticle: async (title: string, content: string): Promise<NewsArticle> => {
    const response = await apiClient.post<NewsArticle>('/news/articles', { title, content });
    return response.data;
  },
};
