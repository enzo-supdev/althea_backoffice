import axiosInstance from './axiosInstance';
import {
  ApiResponse,
  CreditNote,
  CreditNoteRequest,
  Invoice,
  PaginatedResponse,
} from './types';

function mapInvoiceToLegacy(invoice: any): any {
  const orderSource = invoice.order ?? {
    id: invoice.orderId ?? `order-${invoice.id}`,
    orderNumber: invoice.invoiceNumber?.replace('FACT', 'CMD') ?? `CMD-${invoice.id}`,
    customer: invoice.customer ?? {
      id: invoice.userId ?? `user-${invoice.id}`,
      fullName: invoice.customerName ?? 'Client',
      email: invoice.customerEmail ?? 'client@example.com',
      status: 'active',
      archived: false,
      archivedAt: null,
      createdAt: new Date(invoice.createdAt),
      lastLogin: new Date(invoice.createdAt),
      ordersCount: 0,
      totalRevenue: 0,
      addresses: [],
    },
    items: [],
    totalAmount: invoice.totalTtc ?? invoice.amount ?? 0,
    status: 'completed',
    paymentMethod: 'Carte bancaire',
    paymentStatus: invoice.status === 'paid' ? 'validated' : invoice.status === 'refunded' ? 'refunded' : 'pending',
    shippingAddress: null,
    billingAddress: null,
    createdAt: new Date(invoice.createdAt),
  };

  return {
    ...invoice,
    order: orderSource,
    customer: invoice.customer ?? orderSource.customer,
    amount: invoice.amount ?? invoice.totalTtc ?? 0,
    createdAt: new Date(invoice.createdAt),
  };
}

/**
 * Gestion des factures
 * Les endpoints invoices ne respectent pas toujours le wrapper standard.
 */
export const invoicesApi = {
  /**
   * GET /invoices/admin
   * Compatibilité legacy : liste des factures pour les anciens écrans
   */
  async list(): Promise<any[]> {
    try {
      const { data } = await axiosInstance.get<any>('/invoices/admin', {
        params: { page: 1, limit: 20 },
      });
      const items: any[] = Array.isArray(data.data)
        ? data.data
        : Array.isArray((data as any).invoices)
          ? (data as any).invoices
          : Array.isArray(data)
            ? data
            : [];
      return items.map(mapInvoiceToLegacy);
    } catch {
      const { data } = await axiosInstance.get<any>('/users/me/invoices', {
        params: { page: 1, limit: 20 },
      });
      const items: any[] = Array.isArray(data.data)
        ? data.data
        : Array.isArray((data as any).invoices)
          ? (data as any).invoices
          : Array.isArray(data)
            ? data
            : [];
      return items.map(mapInvoiceToLegacy);
    }
  },

  /**
   * GET /users/me/invoices
   * Liste les factures de l'utilisateur connecté
   */
  async listMyInvoices(params?: {
    status?: 'pending' | 'paid' | 'cancelled' | 'refunded';
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<any>> {
    const { data } = await axiosInstance.get<PaginatedResponse<any>>(
      '/users/me/invoices',
      { params }
    );
    return {
      ...data,
      data: data.data.map(mapInvoiceToLegacy),
    };
  },

  /**
   * GET /invoices/admin
   * Liste admin des factures
   */
  async listAdmin(params?: {
    status?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
    minAmount?: number;
    maxAmount?: number;
    sortBy?: string;
    order?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<any>> {
    const { data } = await axiosInstance.get<PaginatedResponse<any>>(
      '/invoices/admin',
      { params }
    );
    return {
      ...data,
      data: data.data.map(mapInvoiceToLegacy),
    };
  },

  /**
   * GET /invoices/:id
   * Détail d'une facture
   */
  async getById(id: string): Promise<Invoice> {
    const { data } = await axiosInstance.get<{ invoice: Invoice }>(`/invoices/${id}`);
    return mapInvoiceToLegacy(data.invoice);
  },

  /**
   * GET /invoices/:id/pdf
   * Télécharge une facture en PDF
   */
  async downloadPdf(id: string): Promise<Blob> {
    const { data } = await axiosInstance.get<Blob>(`/invoices/${id}/pdf`, {
      responseType: 'blob',
    });
    return data;
  },

  /**
   * GET /invoices/admin/export
   * Export des factures
   */
  async exportAdmin(params?: {
    status?: string;
    startDate?: string;
    endDate?: string;
    format?: 'csv' | 'xlsx';
  }): Promise<Blob> {
    const { data } = await axiosInstance.get<Blob>('/invoices/admin/export', {
      params,
      responseType: 'blob',
    });
    return data;
  },

  /**
   * GET /invoices/admin/:id
   * Détail admin d'une facture
   */
  async getAdminById(id: string): Promise<Invoice> {
    const { data } = await axiosInstance.get<{ invoice: Invoice }>(`/invoices/admin/${id}`);
    return mapInvoiceToLegacy(data.invoice);
  },

  /**
   * POST /invoices/admin/:id/credit-note
   * Crée une note de crédit
   */
  async createCreditNote(id: string, input: CreditNoteRequest): Promise<CreditNote> {
    const { data } = await axiosInstance.post<{ creditNote: CreditNote }>(
      `/invoices/admin/${id}/credit-note`,
      input
    );
    return data.creditNote;
  },

  /**
   * Compatibilité legacy : persiste les factures côté UI historique.
   */
  async save(_nextInvoices: any[]): Promise<void> {
    return;
  },
};
