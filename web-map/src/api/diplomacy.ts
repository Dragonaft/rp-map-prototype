import { apiClient } from './config';
import { DiplomaticRelation, PeaceScope, Treaty, TreatyArticle, TreatyKind, TreatyVisibility, War } from '../types';

export interface ProposeTreatyPayload {
  name: string;
  receiverId: string;
  kind: TreatyKind;
  peaceScope?: PeaceScope;
  visibility?: TreatyVisibility;
  recurring?: boolean;
  articles: TreatyArticle[];
  note?: string;
}

export const diplomacyApi = {
  getRelations: async (): Promise<DiplomaticRelation[]> => {
    const response = await apiClient.get<DiplomaticRelation[]>('/diplomacy/relations');
    return response.data;
  },
  getWars: async (): Promise<War[]> => {
    const response = await apiClient.get<War[]>('/diplomacy/wars');
    return response.data;
  },
  getTreaties: async (): Promise<Treaty[]> => {
    const response = await apiClient.get<Treaty[]>('/diplomacy/treaties');
    return response.data;
  },
  getPublicTreaties: async (userId: string): Promise<Treaty[]> => {
    const response = await apiClient.get<Treaty[]>(`/diplomacy/treaties/public/${userId}`);
    return response.data;
  },
  declareWar: async (targetUserId: string): Promise<void> => {
    await apiClient.post('/diplomacy/declare-war', { targetUserId });
  },
  sendMoney: async (targetUserId: string, amount: number): Promise<void> => {
    await apiClient.post('/diplomacy/send-money', { targetUserId, amount });
  },
  propose: async (payload: ProposeTreatyPayload): Promise<Treaty> => {
    const response = await apiClient.post<Treaty>('/diplomacy/treaties', payload);
    return response.data;
  },
  accept: async (treatyId: string): Promise<Treaty> => {
    const response = await apiClient.post<Treaty>(`/diplomacy/treaties/${treatyId}/accept`);
    return response.data;
  },
  reject: async (treatyId: string): Promise<Treaty> => {
    const response = await apiClient.post<Treaty>(`/diplomacy/treaties/${treatyId}/reject`);
    return response.data;
  },
  cancelProposal: async (treatyId: string): Promise<Treaty> => {
    const response = await apiClient.delete<Treaty>(`/diplomacy/treaties/${treatyId}`);
    return response.data;
  },
  cancelSigned: async (treatyId: string): Promise<Treaty> => {
    const response = await apiClient.post<Treaty>(`/diplomacy/treaties/${treatyId}/cancel-signed`);
    return response.data;
  },
};
