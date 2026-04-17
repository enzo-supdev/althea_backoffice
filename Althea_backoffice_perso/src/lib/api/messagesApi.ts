import axiosInstance from './axiosInstance';
import {
  ApiResponse,
  PaginatedResponse,
  ReplyContactMessageRequest,
  UpdateContactMessageStatusRequest,
} from './types';

function mapMessageToLegacy(message: any): any {
  const statusMap: Record<string, any> = {
    pending: 'unread',
    unread: 'unread',
    read: 'read',
    replied: 'replied',
    processed: 'closed',
    resolved: 'closed',
    spam: 'closed',
    closed: 'closed',
  };

  return {
    ...message,
    status: statusMap[message.status] ?? 'read',
    replies: Array.isArray(message.replies)
      ? message.replies.map((reply: any) => ({
          ...reply,
          createdAt: new Date(reply.createdAt),
        }))
      : [],
    createdAt: new Date(message.createdAt),
    updatedAt: new Date(message.updatedAt ?? message.createdAt),
  };
}

/**
 * Gestion des messages de contact (chat, support)
 */
export const messagesApi = {
  /**
   * GET /contact/admin/messages
   * Compatibilité legacy : liste de messages sans pagination
   */
  async list(): Promise<any[]> {
    const { data } = await axiosInstance.get<any>('/contact/admin/messages');
    const items: any[] = Array.isArray(data.data)
      ? data.data
      : Array.isArray((data as any).messages)
        ? (data as any).messages
        : Array.isArray(data)
          ? data
          : [];
    return items.map(mapMessageToLegacy);
  },

  /**
   * GET /contact/admin/messages
   * Liste paginée des messages de contact
   */
  async listContactMessages(params?: {
    status?: 'unread' | 'read' | 'processed';
    page?: number;
    limit?: number;
    sortBy?: 'createdAt';
    sortOrder?: 'asc' | 'desc';
  }): Promise<PaginatedResponse<any>> {
    const { data } = await axiosInstance.get<any>(
      '/contact/admin/messages',
      { params }
    );
    const items: any[] = Array.isArray(data.data)
      ? data.data
      : Array.isArray((data as any).messages)
        ? (data as any).messages
        : Array.isArray(data)
          ? data
          : [];
    return {
      ...data,
      data: items.map(mapMessageToLegacy),
    };
  },

  /**
   * GET /contact/admin/messages/:id
   * Détail d'un message
   */
  async getContactMessage(id: string): Promise<any> {
    const { data } = await axiosInstance.get<ApiResponse<any>>(
      `/contact/admin/messages/${id}`
    );
    return mapMessageToLegacy(data.data);
  },

  /**
   * PUT /contact/admin/messages/:id/status
   * Marquer comme lu ou résolu
   */
  async updateContactMessageStatus(
    id: string,
    input: UpdateContactMessageStatusRequest
  ): Promise<any> {
    const { data } = await axiosInstance.put<ApiResponse<any>>(
      `/contact/admin/messages/${id}/status`,
      input
    );
    return mapMessageToLegacy(data.data);
  },

  /**
   * POST /contact/admin/messages/:id/reply
   * Répond à un message de contact
   */
  async replyContactMessage(id: string, input: ReplyContactMessageRequest): Promise<any> {
    const { data } = await axiosInstance.post<ApiResponse<any>>(
      `/contact/admin/messages/${id}/reply`,
      input
    );
    return mapMessageToLegacy(data.data);
  },

  /**
   * DELETE /contact/admin/messages/:id
   * Supprimer un message
   * Retourne 204 No Content
   */
  async deleteContactMessage(id: string): Promise<void> {
    await axiosInstance.delete(
      `/contact/admin/messages/${id}`
    );
  },

  /**
   * Compatibilité legacy : persistance factice pour l'UI historique.
   */
  async save(_nextMessages: any[]): Promise<void> {
    return;
  },
};
