import axiosInstance from './axiosInstance';
import { ApiResponse, LegalPage } from './types';

export const legalApi = {
  async getPage(type: 'cgu' | 'mentions_legales' | 'about'): Promise<LegalPage> {
    const { data } = await axiosInstance.get<ApiResponse<LegalPage>>(`/legal/${type}`);
    return data.data;
  },

  async listAdmin(): Promise<LegalPage[]> {
    const { data } = await axiosInstance.get<ApiResponse<LegalPage[]>>('/legal/admin');
    return data.data;
  },

  async upsertPage(type: 'cgu' | 'mentions_legales' | 'about', input: { content: string; lang?: string }): Promise<LegalPage> {
    const { data } = await axiosInstance.put<ApiResponse<LegalPage>>(`/legal/admin/${type}`, input);
    return data.data;
  },

  async getHistory(type: 'cgu' | 'mentions_legales' | 'about'): Promise<unknown[]> {
    const { data } = await axiosInstance.get<ApiResponse<unknown[]>>(`/legal/admin/${type}/history`);
    return data.data;
  },
};