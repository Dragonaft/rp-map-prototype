import { apiClient } from './config';

export const adminApi = {
  // Users
  getUsers: () => apiClient.get('/admin/users'),
  createUser: (data: Record<string, any>) => apiClient.post('/admin/users', data),
  updateUser: (id: string, data: Record<string, any>) => apiClient.patch(`/admin/users/${id}`, data),
  deleteUser: (id: string) => apiClient.delete(`/admin/users/${id}`),

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
};
