import { apiClient } from './config';
import { ActionData, ActionType } from "../types.ts";

export interface ActionExecutionStatus {
  processing: boolean;
  completedBatchSeq: number;
}

export const actionsApi = {
  /** Works while other API routes return 503 during batch execution. */
  getExecutionStatus: async (): Promise<ActionExecutionStatus> => {
    const response = await apiClient.get<ActionExecutionStatus>(`/actions/execution-status`);
    return response.data;
  },

  getUserActions: async (): Promise<any[]> => {
    const response = await apiClient.get<any[]>(`/actions`);
    return response.data;
  },

  createAction: async (data: { type: ActionType, actionData: ActionData }): Promise<any> => {
    const response = await apiClient.post(`/actions`, data);
    return response.data;
  },

  removeAction: async (actionId: string): Promise<any> => {
    const response = await apiClient.delete(`/actions/pending/${actionId}`);
    return response.data;
  },
};
