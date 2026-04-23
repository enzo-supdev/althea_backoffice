import axiosInstance from './axiosInstance';
import {
  ApiResponse,
  PaginatedResponse,
  ReplyContactMessageRequest,
} from './types';

type RawContactMessage = {
  id: string;
  email: string;
  subject: string;
  message: string;
  status: string;
  userId?: string | null;
  processedBy?: string | null;
  processedAt?: string | null;
  response?: string | null;
  respondedAt?: string | null;
  notes?: string | null;
  replies?: Array<{
    id?: string;
    author?: string;
    adminName?: string;
    message?: string;
    response?: string;
    createdAt?: string;
    respondedAt?: string;
  }>;
  createdAt: string;
  updatedAt?: string;
};

type ContactListEnvelope = {
  success: boolean;
  data:
    | {
        messages: RawContactMessage[];
        pagination: { page: number; limit: number; total: number; totalPages: number };
      }
    | RawContactMessage[];
  meta?: { page: number; limit: number; total: number; totalPages: number };
};

// Map API statuses (lowercase actuels : unread/read/processed/closed + alias) vers les statuts UI.
function mapApiStatusToUi(status: string): 'unread' | 'read' | 'replied' | 'closed' {
  const normalized = (status ?? '').toLowerCase();
  switch (normalized) {
    case 'unread':
    case 'new':
    case 'pending':
      return 'unread';
    case 'read':
    case 'in_progress':
    case 'open':
      return 'read';
    case 'processed':
    case 'replied':
    case 'resolved':
      return 'replied';
    case 'closed':
    case 'spam':
      return 'closed';
    default:
      return 'read';
  }
}

// Map UI statuses vers le vocabulaire attendu par le backend (lowercase).
function mapUiStatusToApi(status: string): string {
  const normalized = status.toLowerCase();
  switch (normalized) {
    case 'unread':
      return 'unread';
    case 'read':
      return 'read';
    case 'replied':
    case 'resolved':
      return 'processed';
    case 'closed':
    case 'processed':
      return 'closed';
    default:
      return normalized;
  }
}

function mapMessageToLegacy(message: RawContactMessage) {
  const rawReplies = Array.isArray(message.replies) ? message.replies : [];
  const mappedReplies = rawReplies.map((reply) => ({
    id: String(reply.id ?? `${message.id}-reply-${reply.createdAt ?? ''}`),
    author: reply.author ?? reply.adminName ?? 'Support',
    message: reply.message ?? reply.response ?? '',
    createdAt: new Date(reply.createdAt ?? reply.respondedAt ?? message.updatedAt ?? message.createdAt),
  }));

  // Le détail d'un message peut contenir un `response` + `respondedAt` : on reconstitue un reply.
  if (mappedReplies.length === 0 && typeof message.response === 'string' && message.response.trim()) {
    mappedReplies.push({
      id: `${message.id}-response`,
      author: 'Support',
      message: message.response,
      createdAt: new Date(message.respondedAt ?? message.processedAt ?? message.updatedAt ?? message.createdAt),
    });
  }

  return {
    id: message.id,
    email: message.email,
    subject: message.subject,
    message: message.message,
    status: mapApiStatusToUi(message.status),
    replies: mappedReplies,
    userId: message.userId ?? null,
    processedBy: message.processedBy ?? null,
    processedAt: message.processedAt ? new Date(message.processedAt) : null,
    createdAt: new Date(message.createdAt),
    updatedAt: new Date(message.updatedAt ?? message.createdAt),
  };
}

function extractListPayload(envelope: ContactListEnvelope) {
  const { data } = envelope;

  if (Array.isArray(data)) {
    return {
      items: data,
      pagination: envelope.meta ?? { page: 1, limit: data.length, total: data.length, totalPages: 1 },
    };
  }

  if (data && typeof data === 'object' && Array.isArray(data.messages)) {
    return {
      items: data.messages,
      pagination: data.pagination ?? envelope.meta ?? {
        page: 1,
        limit: data.messages.length,
        total: data.messages.length,
        totalPages: 1,
      },
    };
  }

  return {
    items: [],
    pagination: envelope.meta ?? { page: 1, limit: 0, total: 0, totalPages: 0 },
  };
}

export const messagesApi = {
  /**
   * GET /contact/admin/messages
   * Renvoie la liste complète (sans pagination exposée) pour les usages legacy
   * (header de recherche, stats dashboard).
   */
  async list() {
    const { data } = await axiosInstance.get<ContactListEnvelope>('/contact/admin/messages', {
      params: { page: 1, limit: 100 },
    });
    const { items } = extractListPayload(data);
    return items.map(mapMessageToLegacy);
  },

  /**
   * GET /contact/admin/messages
   * Liste paginée.
   */
  async listContactMessages(params?: {
    status?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
    sortBy?: 'createdAt';
    order?: 'asc' | 'desc';
    sortOrder?: 'asc' | 'desc';
  }): Promise<PaginatedResponse<ReturnType<typeof mapMessageToLegacy>>> {
    const { sortOrder, status, ...rest } = params ?? {};
    const queryParams: Record<string, string | number | undefined> = {
      ...rest,
      order: rest.order ?? sortOrder,
    };
    if (status && status !== 'all') {
      queryParams.status = mapUiStatusToApi(status);
    }

    const { data } = await axiosInstance.get<ContactListEnvelope>('/contact/admin/messages', {
      params: queryParams,
    });
    const { items, pagination } = extractListPayload(data);

    return {
      success: true,
      data: items.map(mapMessageToLegacy),
      meta: pagination,
    };
  },

  /**
   * GET /contact/admin/messages/:id
   */
  async getContactMessage(id: string) {
    const { data } = await axiosInstance.get<ApiResponse<RawContactMessage>>(
      `/contact/admin/messages/${id}`,
    );
    return mapMessageToLegacy(data.data);
  },

  /**
   * PUT /contact/admin/messages/:id/status
   */
  async updateContactMessageStatus(
    id: string,
    input: { status: string; response?: string; notes?: string },
  ) {
    const { data } = await axiosInstance.put<ApiResponse<RawContactMessage>>(
      `/contact/admin/messages/${id}/status`,
      {
        status: mapUiStatusToApi(input.status),
        response: input.response,
        notes: input.notes,
      },
    );
    return mapMessageToLegacy(data.data);
  },

  /**
   * PUT /contact/admin/messages/:id/status
   * Marque le message comme traité (`processed`) avec la réponse de l'admin.
   */
  async replyContactMessage(id: string, input: ReplyContactMessageRequest) {
    const { data } = await axiosInstance.put<ApiResponse<RawContactMessage>>(
      `/contact/admin/messages/${id}/status`,
      { status: 'processed', response: input.reply },
    );
    return mapMessageToLegacy(data.data);
  },

  /**
   * DELETE /contact/admin/messages/:id
   */
  async deleteContactMessage(id: string): Promise<void> {
    await axiosInstance.delete(`/contact/admin/messages/${id}`);
  },

  async save(_nextMessages: unknown): Promise<void> {
    return;
  },
};
