import { apiClient } from './config';

export const adminApi = {
  // Users
  getUsers: () => apiClient.get('/admin/users'),
  createUser: (data: Record<string, any>) => apiClient.post('/admin/users', data),
  updateUser: (id: string, data: Record<string, any>) => apiClient.patch(`/admin/users/${id}`, data),
  deleteUser: (id: string) => apiClient.delete(`/admin/users/${id}`),
  deleteUserFlag: (id: string) => apiClient.delete(`/admin/users/${id}/flag`),

  // Buildings
  getBuildings: () => apiClient.get('/admin/buildings'),
  createBuilding: (data: Record<string, any>) => apiClient.post('/admin/buildings', data),
  updateBuilding: (id: string, data: Record<string, any>) => apiClient.patch(`/admin/buildings/${id}`, data),
  deleteBuilding: (id: string) => apiClient.delete(`/admin/buildings/${id}`),

  // Armies
  getArmies: () => apiClient.get('/admin/armies'),
  createArmy: (data: Record<string, any>) => apiClient.post('/admin/armies', data),
  updateArmy: (id: string, data: Record<string, any>) => apiClient.patch(`/admin/armies/${id}`, data),
  deleteArmy: (id: string) => apiClient.delete(`/admin/armies/${id}`),

  // Techs
  getTechs: () => apiClient.get('/admin/techs'),
  createTech: (data: Record<string, any>) => apiClient.post('/admin/techs', data),
  updateTech: (id: string, data: Record<string, any>) => apiClient.patch(`/admin/techs/${id}`, data),
  deleteTech: (id: string) => apiClient.delete(`/admin/techs/${id}`),

  // Troop Types
  getTroopTypes: () => apiClient.get('/admin/troop-types'),
  createTroopType: (data: Record<string, any>) => apiClient.post('/admin/troop-types', data),
  updateTroopType: (id: string, data: Record<string, any>) => apiClient.patch(`/admin/troop-types/${id}`, data),
  deleteTroopType: (id: string) => apiClient.delete(`/admin/troop-types/${id}`),

  // Resources
  getResources: () => apiClient.get('/admin/resources'),
  createResource: (data: Record<string, any>) => apiClient.post('/admin/resources', data),
  updateResource: (id: string, data: Record<string, any>) => apiClient.patch(`/admin/resources/${id}`, data),
  deleteResource: (id: string) => apiClient.delete(`/admin/resources/${id}`),

  // Goods
  getGoods: () => apiClient.get('/admin/goods'),
  createGood: (data: Record<string, any>) => apiClient.post('/admin/goods', data),
  updateGood: (id: string, data: Record<string, any>) => apiClient.patch(`/admin/goods/${id}`, data),
  deleteGood: (id: string) => apiClient.delete(`/admin/goods/${id}`),

  // Classes
  getClasses: () => apiClient.get('/admin/classes'),
  createClass: (data: Record<string, any>) => apiClient.post('/admin/classes', data),
  updateClass: (id: string, data: Record<string, any>) => apiClient.patch(`/admin/classes/${id}`, data),
  deleteClass: (id: string) => apiClient.delete(`/admin/classes/${id}`),

  // Knowledge (Codex)
  getKnowledgeArticles: () => apiClient.get('/admin/knowledge'),
  createKnowledgeArticle: (data: Record<string, any>) => apiClient.post('/admin/knowledge', data),
  updateKnowledgeArticle: (id: string, data: Record<string, any>) => apiClient.patch(`/admin/knowledge/${id}`, data),
  deleteKnowledgeArticle: (id: string) => apiClient.delete(`/admin/knowledge/${id}`),

  // Icons (building/landscape/resource art) — GET reuses the player-facing /icons list, since
  // the payload (kind/key/hash, no blob) is identical either way and admins are authenticated
  // too; only upload/delete are admin-gated.
  getIcons: () => apiClient.get('/icons'),
  uploadIcon: (kind: string, key: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    // Let axios set Content-Type itself (multipart boundary) — the apiClient default of
    // application/json would otherwise override it and the upload would fail server-side.
    return apiClient.post(`/admin/icons/${kind}/${key}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  deleteIcon: (kind: string, key: string) => apiClient.delete(`/admin/icons/${kind}/${key}`),

  // Game Settings (singleton — no :id)
  getGameSettings: () => apiClient.get('/admin/game-settings'),
  updateGameSettings: (data: Record<string, any>) => apiClient.patch('/admin/game-settings', data),

  // Notifications
  broadcastNotification: (data: { title: string; message: string; severity: string }) =>
    apiClient.post('/admin/notifications/broadcast', data),

  // News Wall
  getNewsAgencies: () => apiClient.get('/admin/news-agencies'),
  deleteNewsAgency: (id: string) => apiClient.delete(`/admin/news-agencies/${id}`),
  getNewsArticles: () => apiClient.get('/admin/news-articles'),
  deleteNewsArticle: (id: string) => apiClient.delete(`/admin/news-articles/${id}`),
};
