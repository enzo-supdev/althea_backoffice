import axios from 'axios';
import axiosInstance from './axiosInstance';
import {
  ApiResponse,
  CreditNote,
  CreditNoteRequest,
  Invoice,
  PaginatedResponse,
  PaginationMeta,
} from './types';

function logServerError(context: string, error: unknown): void {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status ?? 'network';
    const payload = error.response?.data;
    console.error(
      `[invoicesApi] ${context} HTTP ${status}`,
      typeof payload === 'object' ? JSON.stringify(payload, null, 2) : payload ?? error.message,
    );
  } else {
    console.error(`[invoicesApi] ${context}`, error);
  }
}

function normalizeInvoiceStatus(raw: unknown): 'paid' | 'pending' | 'cancelled' | 'refunded' {
  const value = String(raw ?? '').toLowerCase();
  if (value === 'paid') return 'paid';
  if (value === 'refunded') return 'refunded';
  if (value === 'cancelled' || value === 'canceled') return 'cancelled';
  return 'pending';
}

function toNumberOrZero(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function mapInvoiceItem(item: any): any {
  // Si l'item est déjà au format OrderItem (embedded order.items) on le laisse passer.
  if (item?.product && typeof item.product === 'object' && item.product.name) {
    return {
      id: item.id,
      product: item.product,
      quantity: Number(item.quantity ?? 0),
      price: toNumberOrZero(item.price ?? item.priceTtc ?? item.unitPriceTtc),
    };
  }

  const priceTtc = toNumberOrZero(item?.priceTtc ?? item?.unitPriceTtc ?? item?.price);
  const priceHt = toNumberOrZero(item?.priceHt ?? item?.unitPriceHt);
  const vatRate = toNumberOrZero(item?.vatRate ?? item?.tvaRate);
  const productName = item?.productName ?? item?.product?.name ?? 'Produit';

  return {
    id: item?.id ?? `item-${item?.productId ?? Math.random()}`,
    product: {
      id: item?.productId ?? item?.product?.id ?? 'product-unknown',
      name: productName,
      description: '',
      price: priceTtc,
      priceHT: priceHt,
      tva: vatRate,
      stock: 0,
      status: 'published',
      category: null,
      images: [],
      mainImageRef: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    quantity: Number(item?.quantity ?? 0),
    price: priceTtc,
    priceHt,
    vatRate,
    priceTtc,
    productName,
  };
}

function mapInvoiceToLegacy(invoice: any): any {
  // Priorité : champs directs de la facture → snapshot → order embarquée.
  // Les factures backfillées peuvent avoir totalTtc à 0 ; on retombe sur la commande liée.
  const subtotalHt = toNumberOrZero(invoice.subtotalHt ?? invoice.subtotal_ht);
  const totalVat = toNumberOrZero(invoice.totalVat ?? invoice.total_vat);
  const invoiceAmount =
    toNumberOrZero(invoice.amount) ||
    toNumberOrZero(invoice.totalTtc) ||
    toNumberOrZero(invoice.totalAmount) ||
    toNumberOrZero(invoice.total_ttc);
  const orderAmount =
    toNumberOrZero(invoice.order?.totalTtc) ||
    toNumberOrZero(invoice.order?.totalAmount) ||
    toNumberOrZero(invoice.order?.total_ttc);
  const amount = invoiceAmount || orderAmount;
  const createdAtRaw = invoice.createdAt ?? invoice.issueDate ?? invoice.issuedAt ?? Date.now();
  const issuedAtRaw = invoice.issuedAt ?? invoice.issueDate ?? invoice.createdAt ?? createdAtRaw;
  const paidAtRaw = invoice.paidAt ?? null;
  const cancelledAtRaw = invoice.cancelledAt ?? null;
  const invoiceNumber = invoice.invoiceNumber ?? invoice.number ?? `INV-${invoice.id ?? 'unknown'}`;
  const status = normalizeInvoiceStatus(invoice.status);

  // Customer peut venir de plusieurs endroits selon l'endpoint :
  // - invoice.customerSnapshot (nouveau backend — snapshot figé à l'émission)
  // - invoice.customer (ancien format)
  // - invoice.user (select firstName/lastName/email côté backend)
  // - invoice.order.customer / invoice.order.user (embedded)
  const rawCustomer =
    invoice.customerSnapshot ??
    invoice.customer ??
    invoice.user ??
    invoice.order?.customer ??
    invoice.order?.user ??
    null;

  const derivedFullName =
    rawCustomer?.fullName ??
    [rawCustomer?.firstName, rawCustomer?.lastName].filter(Boolean).join(' ').trim();
  const customerFullName = derivedFullName || invoice.customerName || 'Client';

  const customer = {
    id: rawCustomer?.id ?? invoice.userId ?? `user-${invoice.id}`,
    fullName: customerFullName,
    email: rawCustomer?.email ?? invoice.customerEmail ?? 'client@example.com',
    status: 'active',
    archived: false,
    archivedAt: null,
    createdAt: new Date(createdAtRaw),
    lastLogin: new Date(createdAtRaw),
    ordersCount: 0,
    totalRevenue: 0,
    addresses: [],
  };

  // Les items peuvent venir de :
  //  - invoice.items (endpoint détail — snapshot de ligne de facture figé)
  //  - invoice.order.items (endpoint admin list avec order embarquée — ancien format)
  const rawItems = Array.isArray(invoice.items) && invoice.items.length
    ? invoice.items
    : Array.isArray(invoice.order?.items)
      ? invoice.order.items
      : [];
  const mappedItems = rawItems.map(mapInvoiceItem);

  const rawOrder = invoice.order ?? {};
  const orderSource = {
    id: rawOrder.id ?? invoice.orderId ?? `order-${invoice.id}`,
    orderNumber:
      rawOrder.orderNumber ??
      invoiceNumber.replace(/^FACT-/, 'CMD-').replace(/^INV-/, 'CMD-'),
    customer,
    items: mappedItems,
    totalAmount: amount,
    status: rawOrder.status ?? 'completed',
    paymentMethod: rawOrder.paymentMethod ?? 'Carte bancaire',
    paymentStatus:
      rawOrder.paymentStatus ??
      (status === 'paid' ? 'validated' : status === 'cancelled' ? 'refunded' : 'pending'),
    shippingAddress: rawOrder.shippingAddress ?? null,
    billingAddress: invoice.billingAddressSnapshot ?? rawOrder.billingAddress ?? null,
    createdAt: new Date(createdAtRaw),
  };

  return {
    ...invoice,
    invoiceNumber,
    status,
    order: orderSource,
    customer,
    amount,
    subtotalHt,
    totalVat,
    totalTtc: amount,
    items: mappedItems,
    customerSnapshot: invoice.customerSnapshot ?? null,
    billingAddressSnapshot: invoice.billingAddressSnapshot ?? null,
    issuedAt: issuedAtRaw,
    paidAt: paidAtRaw,
    cancelledAt: cancelledAtRaw,
    createdAt: new Date(createdAtRaw),
  };
}

export interface InvoiceListParams {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  minAmount?: number;
  maxAmount?: number;
  sortBy?: string;
  order?: 'asc' | 'desc';
}

export interface InvoiceListResult {
  data: any[];
  meta: PaginationMeta | null;
}

export interface AdminCreditNote {
  id: string;
  number: string;
  amount: number;
  reason: 'cancellation' | 'refund' | 'error';
  notes: string | null;
  issuedAt: string;
  invoice: {
    id: string;
    number: string;
  };
}

export interface AdminCreditNoteListResult {
  creditNotes: AdminCreditNote[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ListCreditNotesParams {
  invoiceId?: string;
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
}

/**
 * Gestion des factures
 * Les endpoints invoices ne respectent pas toujours le wrapper standard.
 */
export const invoicesApi = {
  /**
   * GET /invoices/admin
   * Liste admin paginée. Les erreurs 5xx sont loguées avec leur payload pour aider le diagnostic.
   */
  async list(params?: InvoiceListParams): Promise<InvoiceListResult> {
    const query: Record<string, any> = { page: 1, limit: 20, ...params };
    Object.keys(query).forEach((key) => {
      if (query[key] === undefined || query[key] === '' || query[key] === null) {
        delete query[key];
      }
    });

    try {
      const { data } = await axiosInstance.get<any>('/invoices/admin', { params: query });
      const items: any[] = Array.isArray(data?.data)
        ? data.data
        : Array.isArray(data?.invoices)
          ? data.invoices
          : Array.isArray(data)
            ? data
            : [];
      return {
        data: items.map(mapInvoiceToLegacy),
        meta: (data?.meta as PaginationMeta | undefined) ?? null,
      };
    } catch (error) {
      logServerError(`list params=${JSON.stringify(query)}`, error);
      throw error;
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
    startDate?: string;
    endDate?: string;
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
    const { data } = await axiosInstance.get<ApiResponse<Invoice>>(`/invoices/${id}`);
    return mapInvoiceToLegacy(data.data);
  },

  /**
   * Télécharge le PDF généré côté serveur (PDFKit, streamé en application/pdf).
   *
   * Le back expose deux routes :
   *   - `/invoices/:id/pdf` — vérifie que l'utilisateur est propriétaire (403 sinon).
   *   - `/invoices/admin/:id/pdf` — route admin (pas de contrôle d'ownership).
   *
   * Depuis le backoffice on tente la route admin en premier. Si elle n'existe
   * pas (404/405), on retombe sur la route propriétaire. Timeout augmenté à 30 s,
   * car PDFKit peut dépasser le défaut axios (10 s). Les 4xx/5xx sont re-parsés
   * depuis le Blob pour exposer le message renvoyé par l'API.
   */
  async downloadPdf(id: string): Promise<Blob> {
    const attempt = async (url: string): Promise<Blob> => {
      const { data } = await axiosInstance.get<Blob>(url, {
        responseType: 'blob',
        timeout: 30000,
      });

      if (data && data.type && data.type.includes('application/json')) {
        const text = await data.text();
        throw new Error(text || 'Le serveur n\'a pas renvoyé de PDF.');
      }

      return data;
    };

    const extractAxiosBlobError = async (error: unknown): Promise<{ status: number; message: string } | null> => {
      if (!axios.isAxiosError(error) || !error.response) return null;
      const status = error.response.status;
      let message = error.message;
      if (error.response.data instanceof Blob) {
        try {
          const text = await error.response.data.text();
          const parsed = text ? JSON.parse(text) : null;
          message = parsed?.message ?? parsed?.error ?? text ?? message;
        } catch {
          /* ignore parse errors, garde message axios */
        }
      }
      return { status, message };
    };

    const adminUrl = `/invoices/admin/${id}/pdf`;
    const ownerUrl = `/invoices/${id}/pdf`;

    try {
      return await attempt(adminUrl);
    } catch (adminError) {
      const adminInfo = await extractAxiosBlobError(adminError);
      // 404/405 → route admin inexistante côté back, on tente la route propriétaire.
      if (adminInfo && (adminInfo.status === 404 || adminInfo.status === 405)) {
        try {
          return await attempt(ownerUrl);
        } catch (ownerError) {
          const ownerInfo = await extractAxiosBlobError(ownerError);
          if (ownerInfo) {
            logServerError(`downloadPdf id=${id}`, ownerInfo);
            throw new Error(ownerInfo.message || `Echec téléchargement PDF (HTTP ${ownerInfo.status}).`);
          }
          logServerError(`downloadPdf id=${id}`, ownerError);
          throw ownerError;
        }
      }
      if (adminInfo) {
        logServerError(`downloadPdf id=${id}`, adminInfo);
        throw new Error(adminInfo.message || `Echec téléchargement PDF (HTTP ${adminInfo.status}).`);
      }
      logServerError(`downloadPdf id=${id}`, adminError);
      throw adminError;
    }
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
    const { data } = await axiosInstance.get<ApiResponse<Invoice>>(`/invoices/admin/${id}`);
    return mapInvoiceToLegacy(data.data);
  },

  /**
   * POST /invoices/admin/:id/credit-note
   * Crée une note de crédit. Backend idempotent : un appel avec mêmes invoiceId +
   * reason + amount dans les 5 dernières minutes renvoie l'avoir existant.
   */
  async createCreditNote(id: string, input: CreditNoteRequest): Promise<CreditNote> {
    const { data } = await axiosInstance.post<ApiResponse<CreditNote>>(
      `/invoices/admin/${id}/credit-note`,
      input
    );
    return data.data;
  },

  /**
   * GET /invoices/admin/credit-notes
   * Liste paginée des avoirs, avec filtres optionnels.
   */
  async listCreditNotes(params?: ListCreditNotesParams): Promise<AdminCreditNoteListResult> {
    const query: Record<string, any> = { page: 1, limit: 20, ...params };
    Object.keys(query).forEach((key) => {
      if (query[key] === undefined || query[key] === '' || query[key] === null) {
        delete query[key];
      }
    });

    try {
      const { data } = await axiosInstance.get<any>('/invoices/admin/credit-notes', { params: query });
      // Supporte les deux formats : réponse directe ou wrappée { success, data }
      const payload = (data?.data ?? data) as Partial<AdminCreditNoteListResult>;
      return {
        creditNotes: Array.isArray(payload.creditNotes) ? payload.creditNotes : [],
        pagination: payload.pagination ?? {
          page: Number(query.page) || 1,
          limit: Number(query.limit) || 20,
          total: 0,
          totalPages: 1,
        },
      };
    } catch (error) {
      logServerError(`listCreditNotes params=${JSON.stringify(query)}`, error);
      throw error;
    }
  },

  /**
   * Trouve la facture associée à une commande.
   * Utilisé par le flux de remboursement : la route /orders/admin/:id/refund
   * n'existe pas côté backend, il faut passer par l'avoir sur la facture.
   */
  async findInvoiceForOrder(orderId: string, orderNumber?: string): Promise<any | null> {
    const searchTerms = [orderId, orderNumber].filter(Boolean) as string[];

    for (const term of searchTerms) {
      try {
        const response = await axiosInstance.get<any>('/invoices/admin', {
          params: { page: 1, limit: 20, search: term },
        });
        const items: any[] = Array.isArray(response.data?.data)
          ? response.data.data
          : Array.isArray(response.data?.invoices)
            ? response.data.invoices
            : [];
        const match = items.find(
          (inv: any) => inv.orderId === orderId || inv.order?.id === orderId
        );
        if (match) return mapInvoiceToLegacy(match);
      } catch (error) {
        logServerError(`findInvoiceForOrder search="${term}"`, error);
      }
    }

    // Fallback : parcourt les 100 dernières factures
    try {
      const response = await axiosInstance.get<any>('/invoices/admin', {
        params: { page: 1, limit: 100 },
      });
      const items: any[] = Array.isArray(response.data?.data)
        ? response.data.data
        : Array.isArray(response.data?.invoices)
          ? response.data.invoices
          : [];
      const match = items.find(
        (inv: any) => inv.orderId === orderId || inv.order?.id === orderId
      );
      return match ? mapInvoiceToLegacy(match) : null;
    } catch (error) {
      logServerError('findInvoiceForOrder fallback listing', error);
      return null;
    }
  },

  /**
   * Garantit qu'une facture existe pour la commande donnée.
   * 1. Tente un lookup direct (findInvoiceForOrder).
   * 2. Si rien n'est trouvé, appelle POST /invoices/admin/from-order/:orderId pour la générer.
   *    Le backend est idempotent : un 409 contient la facture déjà existante.
   */
  async ensureInvoiceForOrder(
    orderId: string,
    orderNumber?: string,
    options: { lookupFirst?: boolean } = {}
  ): Promise<any | null> {
    const lookupFirst = options.lookupFirst ?? true;

    if (lookupFirst) {
      const existing = await this.findInvoiceForOrder(orderId, orderNumber);
      if (existing) return existing;
    }

    try {
      const { data } = await axiosInstance.post<ApiResponse<Invoice>>(
        `/invoices/admin/from-order/${orderId}`
      );
      const created = data?.data ?? data;
      return created ? mapInvoiceToLegacy(created) : null;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 409) {
        const body = error.response.data as { data?: Invoice; message?: string } | undefined;
        const existing = body?.data;
        if (existing) return mapInvoiceToLegacy(existing);
        return await this.findInvoiceForOrder(orderId, orderNumber);
      }
      logServerError(`ensureInvoiceForOrder orderId=${orderId}`, error);
      return null;
    }
  },

  /**
   * Rembourse une commande via la création d'un avoir sur sa facture.
   */
  async refundOrder(params: {
    orderId: string;
    orderNumber?: string;
    amount: number;
    reason?: string;
    sendEmail?: boolean;
  }): Promise<CreditNote> {
    const invoice = await this.findInvoiceForOrder(params.orderId, params.orderNumber);
    if (!invoice) {
      throw new Error('Aucune facture associée à cette commande n\'a été trouvée.');
    }

    return this.createCreditNote(invoice.id, {
      amount: params.amount,
      reason: (params.reason as any) ?? 'refund',
      notes: params.reason,
      sendEmail: params.sendEmail ?? true,
    } as CreditNoteRequest);
  },

};
