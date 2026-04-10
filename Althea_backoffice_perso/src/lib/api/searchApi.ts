import axiosInstance from './axiosInstance';
import { ApiResponse, ProductSearchResults, SearchSuggestResponse } from './types';

export const searchApi = {
  async searchProducts(params?: {
    q?: string;
    category?: string;
    minPrice?: number;
    maxPrice?: number;
    inStock?: boolean;
    featured?: boolean;
    sort?: 'name' | 'price' | 'createdAt' | 'relevance';
    order?: 'asc' | 'desc';
    page?: number;
    limit?: number;
  }): Promise<ProductSearchResults> {
    const { data } = await axiosInstance.get<ApiResponse<ProductSearchResults>>('/search/products', { params });
    return data.data;
  },

  async suggest(params: { q: string; limit?: number }): Promise<SearchSuggestResponse> {
    const { data } = await axiosInstance.get<ApiResponse<SearchSuggestResponse>>('/search/suggest', { params });
    return data.data;
  },
};