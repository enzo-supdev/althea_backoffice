import axiosInstance from './axiosInstance';
import {
  ApiResponse,
  AnalyticsOverview,
  ProductsAnalytics,
  CustomerAnalytics,
  SalesAnalytics,
  OrdersStatsAnalytics,
  RevenueBreakdownAnalytics,
  InventoryStatsAnalytics,
  CategoriesStatsAnalytics,
  RefundsStatsAnalytics,
  GeographicStatsAnalytics,
  ContactStatsAnalytics,
} from './types';

/**
 * Client analytics admin — aligné sur les 12 endpoints déployés
 * documentés dans `Documentation/message.txt`.
 *
 * Tous les endpoints acceptent `startDate` / `endDate` (ISO). Certains
 * acceptent en plus `groupBy` (sales) ou `limit` (products, customers,
 * categories-stats, geographic-stats).
 */

type DateRangeParams = {
  startDate?: string;
  endDate?: string;
};

/**
 * Convertit une date (YYYY-MM-DD ou ISO complet) vers l'ISO datetime attendu
 * par le backend. startDate → début de journée, endDate → fin de journée.
 */
function normalizeDate(value: string, bound: 'start' | 'end'): string {
  if (!value) return value;
  if (value.includes('T')) return value;
  const suffix = bound === 'start' ? 'T00:00:00.000Z' : 'T23:59:59.999Z';
  return `${value}${suffix}`;
}

function buildParams(params?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!params) return undefined;
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    if (key === 'startDate' && typeof value === 'string') {
      cleaned[key] = normalizeDate(value, 'start');
    } else if (key === 'endDate' && typeof value === 'string') {
      cleaned[key] = normalizeDate(value, 'end');
    } else {
      cleaned[key] = value;
    }
  }
  return Object.keys(cleaned).length > 0 ? cleaned : undefined;
}

export const analyticsApi = {
  async getOverview(params?: DateRangeParams): Promise<AnalyticsOverview> {
    const { data } = await axiosInstance.get<ApiResponse<AnalyticsOverview>>(
      '/analytics/admin/overview',
      { params: buildParams(params) }
    );
    return data.data;
  },

  async getSales(params?: DateRangeParams & { groupBy?: 'day' | 'week' | 'month' }): Promise<SalesAnalytics> {
    const { data } = await axiosInstance.get<ApiResponse<SalesAnalytics>>(
      '/analytics/admin/sales',
      { params: buildParams(params) }
    );
    return data.data;
  },

  async getProducts(params?: DateRangeParams & { limit?: number }): Promise<ProductsAnalytics> {
    const { data } = await axiosInstance.get<ApiResponse<ProductsAnalytics>>(
      '/analytics/admin/products',
      { params: buildParams(params) }
    );
    return data.data;
  },

  async getCustomers(params?: DateRangeParams & { limit?: number }): Promise<CustomerAnalytics> {
    const { data } = await axiosInstance.get<ApiResponse<CustomerAnalytics>>(
      '/analytics/admin/customers',
      { params: buildParams(params) }
    );
    return data.data;
  },

  async getOrdersStats(params?: DateRangeParams): Promise<OrdersStatsAnalytics> {
    const { data } = await axiosInstance.get<ApiResponse<OrdersStatsAnalytics>>(
      '/analytics/admin/orders-stats',
      { params: buildParams(params) }
    );
    return data.data;
  },

  async getRevenueBreakdown(params?: DateRangeParams): Promise<RevenueBreakdownAnalytics> {
    const { data } = await axiosInstance.get<ApiResponse<RevenueBreakdownAnalytics>>(
      '/analytics/admin/revenue-breakdown',
      { params: buildParams(params) }
    );
    return data.data;
  },

  async getInventoryStats(params?: DateRangeParams): Promise<InventoryStatsAnalytics> {
    const { data } = await axiosInstance.get<ApiResponse<InventoryStatsAnalytics>>(
      '/analytics/admin/inventory-stats',
      { params: buildParams(params) }
    );
    return data.data;
  },

  async getCategoriesStats(params?: DateRangeParams & { limit?: number }): Promise<CategoriesStatsAnalytics> {
    const { data } = await axiosInstance.get<ApiResponse<CategoriesStatsAnalytics>>(
      '/analytics/admin/categories-stats',
      { params: buildParams(params) }
    );
    return data.data;
  },

  async getRefundsStats(params?: DateRangeParams): Promise<RefundsStatsAnalytics> {
    const { data } = await axiosInstance.get<ApiResponse<RefundsStatsAnalytics>>(
      '/analytics/admin/refunds-stats',
      { params: buildParams(params) }
    );
    return data.data;
  },

  async getGeographicStats(params?: DateRangeParams & { limit?: number }): Promise<GeographicStatsAnalytics> {
    const { data } = await axiosInstance.get<ApiResponse<GeographicStatsAnalytics>>(
      '/analytics/admin/geographic-stats',
      { params: buildParams(params) }
    );
    return data.data;
  },

  async getContactStats(params?: DateRangeParams): Promise<ContactStatsAnalytics> {
    const { data } = await axiosInstance.get<ApiResponse<ContactStatsAnalytics>>(
      '/analytics/admin/contact-stats',
      { params: buildParams(params) }
    );
    return data.data;
  },

  async exportReport(params: {
    reportType:
      | 'overview'
      | 'sales'
      | 'products'
      | 'customers'
      | 'orders'
      | 'revenue'
      | 'inventory'
      | 'categories'
      | 'refunds'
      | 'geographic'
      | 'contact';
    format?: 'csv' | 'json';
    startDate?: string;
    endDate?: string;
  }): Promise<Blob> {
    const { data } = await axiosInstance.get<Blob>('/analytics/admin/export', {
      params: buildParams(params),
      responseType: 'blob',
    });
    return data;
  },
};
