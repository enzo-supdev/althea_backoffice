import axiosInstance from './axiosInstance';
import {
  User,
  ApiResponse,
  PaginatedResponse,
  Order,
  Invoice,
  Address,
  CreateAddressRequest,
  UpdateAddressRequest,
  PaymentMethod,
  CreatePaymentMethodRequest,
  AdminUserDetail,
  UpdateUserStatusRequest,
  SendUserEmailRequest,
} from './types';

function mapUserToLegacy(user: User): any {
  const firstName = user.firstName ?? '';
  const lastName = user.lastName ?? '';
  const status = user.status === 'suspended' ? 'inactive' : user.status;

  return {
    ...user,
    fullName: `${firstName} ${lastName}`.trim(),
    status,
    archived: user.status === 'suspended',
    archivedAt: user.status === 'suspended' ? new Date(user.updatedAt) : null,
    lastLogin: user.lastLoginAt ? new Date(user.lastLoginAt) : new Date(user.createdAt),
    ordersCount: 0,
    totalRevenue: 0,
    addresses: [],
    createdAt: new Date(user.createdAt),
    updatedAt: new Date(user.updatedAt),
  };
}

/**
 * Gestion du profil utilisateur, adresses, paiements et administration.
 */
export const usersApi = {
  /**
   * GET /admin/users
   * Compatibilité legacy : liste des utilisateurs sans pagination pour l'UI historique.
   */
  async list(): Promise<any[]> {
    const { data } = await axiosInstance.get<PaginatedResponse<User>>('/admin/users');
    return data.data.map(mapUserToLegacy);
  },

  /**
   * GET /users/me
   * Récupère le profil de l'utilisateur connecté.
   */
  async getProfile(): Promise<User> {
    const { data } = await axiosInstance.get<ApiResponse<User>>('/users/me');
    return mapUserToLegacy(data.data);
  },

  /**
   * PUT /users/me
   * Met à jour le profil.
   */
  async updateProfile(input: {
    firstName?: string;
    lastName?: string;
  }): Promise<User> {
    const { data } = await axiosInstance.put<ApiResponse<User>>('/users/me', input);
    return mapUserToLegacy(data.data);
  },

  /**
   * PUT /users/me/email
   * Change l'email avec validation du mot de passe.
   */
  async updateEmail(email: string, password: string): Promise<{ message: string }> {
    const { data } = await axiosInstance.put<ApiResponse<{ message: string }>>(
      '/users/me/email',
      { email, password },
    );
    return data.data;
  },

  /**
   * GET /users/me/orders
   */
  async getOrders(params?: {
    status?: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
    page?: number;
    limit?: number;
    sortBy?: 'createdAt' | 'total';
    sortOrder?: 'asc' | 'desc';
  }): Promise<PaginatedResponse<Order>> {
    const { data } = await axiosInstance.get<PaginatedResponse<Order>>('/users/me/orders', {
      params,
    });
    return data;
  },

  /**
   * GET /users/me/invoices
   */
  async getInvoices(params?: {
    status?: 'pending' | 'paid' | 'cancelled' | 'refunded';
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<Invoice>> {
    const { data } = await axiosInstance.get<PaginatedResponse<Invoice>>('/users/me/invoices', {
      params,
    });
    return data;
  },

  /**
   * GET /users/me/addresses
   */
  async getAddresses(): Promise<Address[]> {
    const { data } = await axiosInstance.get<ApiResponse<Address[]>>('/users/me/addresses');
    return data.data;
  },

  /**
   * POST /users/me/addresses
   */
  async addAddress(input: CreateAddressRequest): Promise<Address> {
    const { data } = await axiosInstance.post<ApiResponse<Address>>('/users/me/addresses', input);
    return data.data;
  },

  /**
   * PUT /users/me/addresses/:id
   */
  async updateAddress(id: string, input: UpdateAddressRequest): Promise<Address> {
    const { data } = await axiosInstance.put<ApiResponse<Address>>(
      `/users/me/addresses/${id}`,
      input,
    );
    return data.data;
  },

  /**
   * DELETE /users/me/addresses/:id
   */
  async deleteAddress(id: string): Promise<{ message: string }> {
    const { data } = await axiosInstance.delete<ApiResponse<{ message: string }>>(
      `/users/me/addresses/${id}`,
    );
    return data.data;
  },

  /**
   * GET /users/me/payment-methods
   */
  async getPaymentMethods(): Promise<PaymentMethod[]> {
    const { data } = await axiosInstance.get<ApiResponse<PaymentMethod[]>>(
      '/users/me/payment-methods',
    );
    return data.data;
  },

  /**
   * POST /users/me/payment-methods
   */
  async addPaymentMethod(input: CreatePaymentMethodRequest): Promise<PaymentMethod> {
    const { data } = await axiosInstance.post<ApiResponse<PaymentMethod>>(
      '/users/me/payment-methods',
      input,
    );
    return data.data;
  },

  /**
   * PUT /users/me/payment-methods/:id/default
   */
  async setDefaultPaymentMethod(id: string): Promise<PaymentMethod> {
    const { data } = await axiosInstance.put<ApiResponse<PaymentMethod>>(
      `/users/me/payment-methods/${id}/default`,
    );
    return data.data;
  },

  /**
   * DELETE /users/me/payment-methods/:id
   */
  async deletePaymentMethod(id: string): Promise<{ message: string }> {
    const { data } = await axiosInstance.delete<ApiResponse<{ message: string }>>(
      `/users/me/payment-methods/${id}`,
    );
    return data.data;
  },

  /**
   * GET /admin/users/:id
   */
  async getById(id: string): Promise<AdminUserDetail> {
    const { data } = await axiosInstance.get<ApiResponse<AdminUserDetail>>(
      `/admin/users/${id}`,
    );
    return {
      ...data.data,
      ...mapUserToLegacy(data.data),
    };
  },

  /**
   * PATCH /admin/users/:id/status
   */
  async updateStatus(id: string, input: UpdateUserStatusRequest): Promise<User> {
    const { data } = await axiosInstance.patch<ApiResponse<User>>(
      `/admin/users/${id}/status`,
      input,
    );
    return mapUserToLegacy(data.data);
  },

  /**
   * POST /admin/users/:id/send-email
   */
  async sendEmail(id: string, input: SendUserEmailRequest): Promise<{ message: string }> {
    const { data } = await axiosInstance.post<ApiResponse<{ message: string }>>(
      `/admin/users/${id}/send-email`,
      input,
    );
    return data.data;
  },

  /**
   * POST /admin/users/:id/reset-password
   */
  async resetPassword(id: string): Promise<{ message: string }> {
    const { data } = await axiosInstance.post<ApiResponse<{ message: string }>>(
      `/admin/users/${id}/reset-password`,
    );
    return data.data;
  },

  /**
   * DELETE /admin/users/:id
   */
  async delete(id: string): Promise<{ message: string }> {
    const { data } = await axiosInstance.delete<ApiResponse<{ message: string }>>(
      `/admin/users/${id}`,
    );
    return data.data;
  },

  /**
   * Compatibilité legacy : sauvegarde factice pour l'UI historique.
   */
  async save(_nextUsers: any[]): Promise<void> {
    return;
  },
};
