import axiosInstance from './axiosInstance';
import { ApiResponse, AnalyticsOverview, CustomerAnalytics, SalesAnalytics } from './types';

export const analyticsApi = {
  async getOverview(params?: { startDate?: string; endDate?: string; compareWithPrevious?: boolean }): Promise<AnalyticsOverview> {
    const { data } = await axiosInstance.get<ApiResponse<AnalyticsOverview>>('/analytics/admin/overview', { params });
    return data.data;
  },

  async getSales(params?: {
    startDate?: string;
    endDate?: string;
    groupBy?: 'day' | 'week' | 'month' | 'year';
    includeRefunds?: boolean;
  }): Promise<SalesAnalytics> {
    const { data } = await axiosInstance.get<ApiResponse<SalesAnalytics>>('/analytics/admin/sales', { params });
    return data.data;
  },

  async getProducts(params?: {
    startDate?: string;
    endDate?: string;
    limit?: number;
    sortBy?: 'revenue' | 'quantity' | 'views' | 'conversionRate';
    categoryId?: string;
  }): Promise<unknown> {
    const requestParams = {
      startDate: params?.startDate,
      endDate: params?.endDate,
      limit: params?.limit,
      categoryId: params?.categoryId,
    };

    try {
      const { data } = await axiosInstance.get<ApiResponse<unknown>>('/analytics/admin/products', {
        params: requestParams,
      });
      return data.data;
    } catch {
      try {
        const { data } = await axiosInstance.get<ApiResponse<unknown>>('/analytics/admin/products');
        return data.data;
      } catch {
        return {
          productAnalytics: {
            topSellers: [],
          },
        };
      }
    }
  },

  async getCustomers(params?: {
    startDate?: string;
    endDate?: string;
    limit?: number;
    segment?: 'all' | 'new' | 'returning' | 'vip' | 'inactive';
  }): Promise<CustomerAnalytics> {
    const { data } = await axiosInstance.get<ApiResponse<CustomerAnalytics>>('/analytics/admin/customers', { params });
    return data.data;
  },

  async exportReport(params: {
    reportType: 'overview' | 'sales' | 'products' | 'customers';
    format?: 'csv' | 'json' | 'xlsx';
    startDate?: string;
    endDate?: string;
    groupBy?: 'day' | 'week' | 'month';
  }): Promise<Blob> {
    const { data } = await axiosInstance.get<Blob>('/analytics/admin/export', {
      params,
      responseType: 'blob',
    });
    return data;
  },
};