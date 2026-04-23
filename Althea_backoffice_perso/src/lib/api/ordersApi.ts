import axiosInstance from './axiosInstance';
import {
  Order,
  ApiResponse,
  PaginatedResponse,
} from './types';

function toNumber(value: unknown): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function normalizePaginatedOrdersResponse(payload: any): PaginatedResponse<Order> {
  if (Array.isArray(payload?.data) && payload?.meta) {
    return payload as PaginatedResponse<Order>;
  }

  if (Array.isArray(payload?.data?.data) && payload?.data?.meta) {
    return payload.data as PaginatedResponse<Order>;
  }

  if (Array.isArray(payload?.data?.orders)) {
    const pagination = payload.data.pagination ?? payload.data.meta ?? payload.meta ?? {};
    const total = Number(pagination.total ?? payload.data.orders.length);
    const page = Number(pagination.page ?? 1);
    const limit = Number(pagination.limit ?? (payload.data.orders.length || 1));
    const totalPages = Number(pagination.totalPages ?? Math.max(1, Math.ceil(total / Math.max(1, limit))));

    return {
      success: true,
      data: payload.data.orders,
      meta: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  }

  if (Array.isArray(payload?.data)) {
    return {
      success: true,
      data: payload.data,
      meta: {
        total: payload.data.length,
        page: 1,
        limit: payload.data.length || 1,
        totalPages: 1,
      },
    };
  }

  throw new Error('Format de reponse paginee invalide pour les commandes.');
}

function mapOrderToLegacy(order: any): any {
  const customerSource = order.customer ?? order.user ?? {};
  const firstName = customerSource.firstName ?? '';
  const lastName = customerSource.lastName ?? '';
  const customer = customerSource.fullName
    ? customerSource
    : {
        id: customerSource.id ?? order.userId ?? order.customerId ?? `customer-${order.id}`,
        fullName: `${firstName} ${lastName}`.trim() || customerSource.email || 'Client',
        email: customerSource.email ?? 'client@example.com',
        status: customerSource.status ?? 'active',
        archived: Boolean(customerSource.archived),
        archivedAt: customerSource.archivedAt ? new Date(customerSource.archivedAt) : null,
        createdAt: customerSource.createdAt ? new Date(customerSource.createdAt) : new Date(order.createdAt),
        lastLogin: customerSource.lastLogin ? new Date(customerSource.lastLogin) : new Date(order.createdAt),
        ordersCount: customerSource.ordersCount ?? 0,
        totalRevenue: customerSource.totalRevenue ?? Number(order.totalTtc ?? order.totalAmount ?? 0),
        addresses: customerSource.addresses ?? [],
      };

  const statusMap: Record<string, any> = {
    pending: 'pending',
    processing: 'processing',
    // Conservé pour compat si l'API renvoyait un jour `shipped`/`delivered`.
    shipped: 'processing',
    delivered: 'completed',
    completed: 'completed',
    cancelled: 'cancelled',
  };

  const paymentStatusMap: Record<string, string> = {
    paid: 'validated',
    validated: 'validated',
    pending: 'pending',
    failed: 'failed',
    refunded: 'refunded',
  };

  const paymentStatusRaw = order.paymentStatus ?? (order.status === 'cancelled' ? 'refunded' : 'pending');
  const paymentStatus = paymentStatusMap[paymentStatusRaw] ?? 'pending';

  const addressSnapshot = order.addressSnapshot ?? order.shippingAddress ?? customer.addresses?.[0] ?? {};
  const billingSnapshot = order.billingAddressSnapshot ?? order.billingAddress ?? addressSnapshot;

  const shippingAddress = {
    id: addressSnapshot.id ?? `addr-${order.id}`,
    firstName: addressSnapshot.firstName ?? customerSource.firstName ?? 'Client',
    lastName: addressSnapshot.lastName ?? customerSource.lastName ?? '',
    address1: addressSnapshot.address1 ?? '',
    address2: addressSnapshot.address2 ?? '',
    city: addressSnapshot.city ?? '',
    region: addressSnapshot.region ?? '',
    postalCode: addressSnapshot.postalCode ?? '',
    country: addressSnapshot.country ?? '',
    phone: addressSnapshot.phone ?? '',
  };

  const billingAddress = {
    id: billingSnapshot.id ?? `bill-${order.id}`,
    firstName: billingSnapshot.firstName ?? shippingAddress.firstName,
    lastName: billingSnapshot.lastName ?? shippingAddress.lastName,
    address1: billingSnapshot.address1 ?? shippingAddress.address1,
    address2: billingSnapshot.address2 ?? shippingAddress.address2,
    city: billingSnapshot.city ?? shippingAddress.city,
    region: billingSnapshot.region ?? shippingAddress.region,
    postalCode: billingSnapshot.postalCode ?? shippingAddress.postalCode,
    country: billingSnapshot.country ?? shippingAddress.country,
    phone: billingSnapshot.phone ?? shippingAddress.phone,
  };

  const paymentMethod = typeof order.paymentMethodSnapshot === 'string'
    ? order.paymentMethodSnapshot
    : order.paymentMethodSnapshot?.brand
      ? `${order.paymentMethodSnapshot.brand}${order.paymentMethodSnapshot.last4 ? ` •••• ${order.paymentMethodSnapshot.last4}` : ''}`
      : order.paymentMethod ?? 'Carte bancaire';

  const createdAt = new Date(order.createdAt);

  return {
    ...order,
    customer,
    items: Array.isArray(order.items)
      ? order.items.map((item: any) => {
          const itemPriceTtc = toNumber(item.priceTtc ?? item.unitPriceTtc ?? item.price ?? item.totalTtc);
          const itemQuantity = Number(item.quantity ?? 0);

          return {
            ...item,
            product: item.product ?? {
              id: item.productId ?? `product-${item.id}`,
              name: item.productNameSnapshot ?? item.productName ?? 'Produit',
              description: '',
              price: itemPriceTtc,
              priceHT: toNumber(item.priceHt ?? item.unitPriceHt ?? 0),
              tva: toNumber(item.vatRate ?? 0),
              stock: item.stock ?? 0,
              status: 'published',
              category: { name: item.categoryName ?? 'Catégorie' },
              images: [],
              createdAt,
              updatedAt: createdAt,
            },
            price: itemPriceTtc,
            quantity: itemQuantity,
            totalTtc: toNumber(item.totalTtc ?? itemPriceTtc * itemQuantity),
          };
        })
      : [],
    totalAmount: toNumber(order.totalAmount ?? order.totalTtc ?? 0),
    status: statusMap[order.status] ?? order.status,
    paymentMethod,
    paymentStatus,
    shippingAddress,
    billingAddress,
    createdAt,
    updatedAt: order.updatedAt ? new Date(order.updatedAt) : createdAt,
  };
}

/**
 * Gestion des commandes
 */
export const ordersApi = {
  /**
   * GET /orders/admin
   * Compatibilité legacy : liste des commandes sans pagination
   */
  async list(): Promise<any[]> {
    const { data } = await axiosInstance.get('/orders/admin');
    const normalized = normalizePaginatedOrdersResponse(data);
    return normalized.data.map(mapOrderToLegacy);
  },

  /**
   * POST /orders/checkout
   * Crée une commande depuis le panier utilisateur courant.
   * Body requis : shippingAddressId, paymentMethodId, shippingMethod.
   */
  async createFromCheckout(input: {
    shippingAddressId: string;
    paymentMethodId: string;
    shippingMethod: 'STANDARD' | 'EXPRESS' | 'PICKUP';
    couponCode?: string;
  }): Promise<any> {
    const { data } = await axiosInstance.post<ApiResponse<Order>>('/orders/checkout', input);
    return mapOrderToLegacy(data.data);
  },

  /**
   * POST /orders/:id/cancel
   * Annule une commande (utilisateur propriétaire).
   */
  async cancel(id: string): Promise<any> {
    const { data } = await axiosInstance.post<ApiResponse<Order>>(`/orders/${id}/cancel`);
    return mapOrderToLegacy(data.data);
  },

  /**
   * GET /orders/admin/export
   * Export CSV des commandes (admin).
   */
  async exportAdmin(params?: {
    startDate?: string;
    endDate?: string;
    status?: 'pending' | 'processing' | 'completed' | 'cancelled';
  }): Promise<Blob> {
    const { data } = await axiosInstance.get<Blob>('/orders/admin/export', {
      params,
      responseType: 'blob',
    });
    return data;
  },

  /**
   * GET /users/me/orders
   * Liste les commandes de l'utilisateur connecté
   */
  async listMyOrders(params?: {
    status?: 'pending' | 'processing' | 'completed' | 'cancelled';
    page?: number;
    limit?: number;
    sortBy?: 'createdAt' | 'total';
    sortOrder?: 'asc' | 'desc';
  }): Promise<PaginatedResponse<Order>> {
    const { data } = await axiosInstance.get(
      '/users/me/orders',
      { params }
    );
    const normalized = normalizePaginatedOrdersResponse(data);

    return {
      ...normalized,
      data: normalized.data.map(mapOrderToLegacy),
    };
  },

  /**
   * GET /orders/admin
   * Liste admin des commandes
   */
  async listAdmin(params?: {
    page?: number;
    limit?: number;
    status?: 'pending' | 'processing' | 'completed' | 'cancelled';
    search?: string;
    startDate?: string;
    endDate?: string;
    sortBy?: 'createdAt' | 'total';
    sortOrder?: 'asc' | 'desc';
  }): Promise<PaginatedResponse<Order>> {
    const { data } = await axiosInstance.get(
      '/orders/admin',
      { params }
    );
    const normalized = normalizePaginatedOrdersResponse(data);

    return {
      ...normalized,
      data: normalized.data.map(mapOrderToLegacy),
    };
  },

  /**
   * GET /orders/admin/:id
   * Détail d'une commande
   */
  async getById(id: string): Promise<any> {
    const { data } = await axiosInstance.get<ApiResponse<Order>>(
      `/orders/admin/${id}`
    );
    return mapOrderToLegacy(data.data);
  },

  /**
   * PUT /orders/admin/:id/status
   * Met à jour le statut d'une commande.
   * Le backend attend les statuts en lowercase (`pending`, `processing`,
   * `shipped`, `delivered`, `cancelled`). On normalise les alias UI ici.
   */
  async updateStatus(
    id: string,
    input: { status: string; trackingNumber?: string; notes?: string; comment?: string }
  ): Promise<any> {
    // Le backend utilise l'enum `pending | processing | completed | cancelled`
    // (confirmé via GET /orders/admin). Les alias legacy UI (`shipped`,
    // `delivered`) sont rabattus sur les valeurs réelles.
    const statusMap: Record<string, string> = {
      pending: 'pending',
      processing: 'processing',
      shipped: 'processing',
      delivered: 'completed',
      completed: 'completed',
      cancelled: 'cancelled',
    };
    const normalizedStatus = statusMap[input.status.toLowerCase()] ?? input.status.toLowerCase();

    // Payload minimal : on ne relaie que les champs documentés côté backend
    // (status + trackingNumber/notes optionnels). On omet tout champ undefined.
    const payload: Record<string, unknown> = { status: normalizedStatus };
    if (input.trackingNumber) payload.trackingNumber = input.trackingNumber;
    if (input.notes) payload.notes = input.notes;

    console.info('[ordersApi.updateStatus] payload envoyé:', JSON.stringify(payload));

    const { data } = await axiosInstance.put<ApiResponse<Order>>(
      `/orders/admin/${id}/status`,
      payload
    );
    return mapOrderToLegacy(data.data);
  },

  /**
   * ⚠️ Endpoint non documenté côté backend (API_ENDPOINTS.md).
   * Le flux officiel de remboursement passe par POST /invoices/admin/:invoiceId/credit-note
   * (voir invoicesApi.createCreditNote). Cette méthode est conservée pour compat UI.
   */
  async processRefund(id: string, input?: { reason?: string }): Promise<{ message: string }> {
    const { data } = await axiosInstance.post<ApiResponse<{ message: string }>>(
      `/orders/admin/${id}/refund`,
      input ?? {}
    );
    return data.data;
  },

  /**
   * Compatibilité legacy avec les anciens écrans mockés.
   */
  async save(_nextOrders: any[]): Promise<void> {
    return;
  },
};
