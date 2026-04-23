import axiosInstance from './axiosInstance';
import { ApiResponse, LegalPage, LegalPageType } from './types';

export const legalApi = {
  /**
   * GET /legal/:type
   * Récupère une page légale publique.
   */
  async getPage(type: LegalPageType): Promise<LegalPage> {
    const { data } = await axiosInstance.get<ApiResponse<LegalPage>>(`/legal/${type}`);
    return data.data;
  },

  /**
   * GET /legal/admin
   * Liste toutes les pages légales (admin).
   */
  async listAdmin(): Promise<LegalPage[]> {
    const { data } = await axiosInstance.get<ApiResponse<LegalPage[]>>('/legal/admin');
    return data.data;
  },

  /**
   * PUT /legal/admin/:type
   * Crée ou met à jour une page légale.
   */
  async upsertPage(
    type: LegalPageType,
    input: { title: string; content: string; version?: string },
  ): Promise<LegalPage> {
    const { data } = await axiosInstance.put<ApiResponse<LegalPage>>(`/legal/admin/${type}`, input);
    return data.data;
  },

  /**
   * GET /legal/admin/:type/history
   * Historique des versions d'une page légale.
   */
  async getHistory(type: LegalPageType): Promise<unknown[]> {
    const { data } = await axiosInstance.get<ApiResponse<unknown[]>>(`/legal/admin/${type}/history`);
    return data.data;
  },
};
