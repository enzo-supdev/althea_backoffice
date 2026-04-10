import axiosInstance from './axiosInstance';
import {
  ApiResponse,
  ApplyCouponRequest,
  CalculateTotalRequest,
  CheckoutSession,
  CheckoutTotalResult,
  CheckoutValidationResult,
  CreateCheckoutSessionRequest,
  CreatePaymentIntentRequest,
  PaymentIntentResponse,
  ShippingOption,
} from './types';

export const checkoutApi = {
  async validate(): Promise<CheckoutValidationResult> {
    const { data } = await axiosInstance.post<ApiResponse<CheckoutValidationResult>>('/checkout/validate');
    return data.data;
  },

  async getShippingOptions(): Promise<ShippingOption[]> {
    const { data } = await axiosInstance.get<ApiResponse<ShippingOption[]>>('/checkout/shipping-options');
    return data.data;
  },

  async createSession(input: CreateCheckoutSessionRequest): Promise<CheckoutSession> {
    const { data } = await axiosInstance.post<ApiResponse<CheckoutSession>>('/checkout/shipping', input);
    return data.data;
  },

  async calculateTotal(input: CalculateTotalRequest): Promise<CheckoutTotalResult> {
    const { data } = await axiosInstance.post<ApiResponse<CheckoutTotalResult>>('/checkout/calculate-total', input);
    return data.data;
  },

  async applyCoupon(input: ApplyCouponRequest): Promise<{ discountAmount: number; discountPercentage: number }> {
    const { data } = await axiosInstance.post<ApiResponse<{ discountAmount: number; discountPercentage: number }>>(
      '/checkout/apply-coupon',
      input
    );
    return data.data;
  },

  async createPaymentIntent(input: CreatePaymentIntentRequest): Promise<PaymentIntentResponse> {
    const { data } = await axiosInstance.post<ApiResponse<PaymentIntentResponse>>('/checkout/payment-intent', input);
    return data.data;
  },

  async confirmPayment(paymentIntentId: string): Promise<{ order: unknown }> {
    const { data } = await axiosInstance.post<ApiResponse<{ order: unknown }>>('/checkout/confirm', {
      paymentIntentId,
    });
    return data.data;
  },

  async getSession(id: string): Promise<unknown> {
    const { data } = await axiosInstance.get<ApiResponse<unknown>>(`/checkout/session/${id}`);
    return data.data;
  },

  async cancelSession(): Promise<{ message: string }> {
    const { data } = await axiosInstance.delete<ApiResponse<{ message: string }>>('/checkout/session');
    return data.data;
  },

  async getPaymentMethods(): Promise<unknown[]> {
    const { data } = await axiosInstance.get<ApiResponse<unknown[]>>('/checkout/payment-methods');
    return data.data;
  },
};