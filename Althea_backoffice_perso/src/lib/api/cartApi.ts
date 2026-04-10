import axiosInstance from './axiosInstance';
import {
  ApiResponse,
  Cart,
  AddCartItemRequest,
  UpdateCartItemRequest,
  MergeCartRequest,
} from './types';

export const cartApi = {
  async getCart(): Promise<Cart> {
    const { data } = await axiosInstance.get<ApiResponse<Cart>>('/cart');
    return data.data;
  },

  async getSummary(): Promise<{
    totalItems: number;
    itemCount: number;
    subtotalHt: number;
    subtotalTtc: number;
  }> {
    const { data } = await axiosInstance.get<ApiResponse<{
      totalItems: number;
      itemCount: number;
      subtotalHt: number;
      subtotalTtc: number;
    }>>('/cart/summary');
    return data.data;
  },

  async addItem(input: AddCartItemRequest): Promise<Cart> {
    const { data } = await axiosInstance.post<ApiResponse<Cart>>('/cart/items', input);
    return data.data;
  },

  async updateItem(itemId: string, input: UpdateCartItemRequest): Promise<Cart> {
    const { data } = await axiosInstance.put<ApiResponse<Cart>>(`/cart/items/${itemId}`, input);
    return data.data;
  },

  async removeItem(itemId: string): Promise<Cart> {
    const { data } = await axiosInstance.delete<ApiResponse<Cart>>(`/cart/items/${itemId}`);
    return data.data;
  },

  async clearCart(): Promise<{ message: string }> {
    const { data } = await axiosInstance.delete<ApiResponse<{ message: string }>>('/cart');
    return data.data;
  },

  async mergeCart(input: MergeCartRequest): Promise<Cart> {
    const { data } = await axiosInstance.post<ApiResponse<{ cart: Cart }>>('/cart/merge', input);
    return data.data.cart;
  },
};