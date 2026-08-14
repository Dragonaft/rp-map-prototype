import { apiClient } from './config';
import { KnowledgeArticle } from '../types';

export const knowledgeApi = {
  getAll: async (): Promise<KnowledgeArticle[]> => {
    const response = await apiClient.get<KnowledgeArticle[]>('/knowledge');
    return response.data;
  },
};
