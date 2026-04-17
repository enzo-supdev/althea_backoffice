// ============================================================================
// ERROR HANDLING
// ============================================================================

export interface ApiErrorPayload {
  code: string;
  message: string;
  fieldErrors?: Record<string, string>;
}

export class ApiError extends Error {
  code: string;
  fieldErrors?: Record<string, string>;

  constructor(payload: ApiErrorPayload) {
    super(payload.message);
    this.name = 'ApiError';
    this.code = payload.code;
    this.fieldErrors = payload.fieldErrors;
  }
}

export interface ApiContext {
  latencyMs?: number;
}

// ============================================================================
// API RESPONSE WRAPPERS
// ============================================================================

export interface ApiResponse<T> {
  success: true;
  data: T;
  message?: string;
}

export interface ApiErrorResponse {
  success: false;
  message: string;
  errors?: Record<string, string[]>;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  success: true;
  data: T[];
  meta: PaginationMeta;
}

// ============================================================================
// AUTH
// ============================================================================

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: 'user' | 'admin';
  status: 'pending' | 'active' | 'suspended';
  emailVerifiedAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
  twoFactorRequired?: boolean;
  twoFactorChallengeId?: string;
}

export interface RefreshTokenResponse {
  accessToken: string;
  refreshToken: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface TwoFactorStatusResponse {
  enabled: boolean;
  method?: 'totp' | 'hotp';
  recoveryCodesCount?: number;
  provisioningUri?: string;
}

export interface TwoFactorVerifyRequest {
  code: string;
  challengeId?: string;
}

export interface TwoFactorVerifyResponse {
  verified: boolean;
  accessToken?: string;
  refreshToken?: string;
}

// ============================================================================
// PRODUCTS
// ============================================================================

export interface ProductVariant {
  id: string;
  sku: string;
  name: string;
  priceHt: number;
  stock: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProductImage {
  id: string;
  url: string;
  alt: string;
  displayOrder: number;
  createdAt: string;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  shortDescription: string;
  priceHt: number;
  vatRate: number;
  priceTtc: number;
  status: 'draft' | 'published' | 'archived';
  stock: number;
  displayOrder: number;
  categoryId: string;
  images: ProductImage[];
  variants: ProductVariant[];
  isFeatured: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProductRequest {
  name: string;
  slug: string;
  description: string;
  shortDescription: string;
  priceHt: number;
  vatRate: number;
  stock: number;
  categoryId: string;
  status?: 'draft' | 'published';
}

export interface UpdateProductRequest {
  name?: string;
  slug?: string;
  description?: string;
  shortDescription?: string;
  priceHt?: number;
  vatRate?: number;
  stock?: number;
  categoryId?: string;
  status?: 'draft' | 'published' | 'archived';
  displayOrder?: number;
}

export interface DuplicateProductRequest {
  copyImages?: boolean;
  copyVariants?: boolean;
}

export interface UpdateProductStockRequest {
  stock: number;
  operation?: 'set' | 'increment' | 'decrement';
}

export interface UpdateProductStatusRequest {
  status: 'draft' | 'published';
}

export interface BulkProductIdsRequest {
  productIds: string[];
}

export interface BulkProductStatusRequest extends BulkProductIdsRequest {
  status: 'draft' | 'published';
}

export interface BulkProductCategoryRequest extends BulkProductIdsRequest {
  categoryId: string | null;
}

export interface ProductImageRequest {
  imageRef: string;
}

export interface ReorderProductImagesRequest {
  images: Array<{ id: string; displayOrder: number }>;
}

// ============================================================================
// CATEGORIES
// ============================================================================

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  status: 'active' | 'inactive';
  image: string | null;
  displayOrder: number;
  parentId: string | null;
  children?: Category[];
  productCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCategoryRequest {
  name: string;
  slug: string;
  description: string;
  parentId?: string;
}

export interface UpdateCategoryRequest {
  name?: string;
  slug?: string;
  description?: string;
  image?: string;
  status?: 'active' | 'inactive';
  parentId?: string;
  displayOrder?: number;
}

export interface Address {
  id: string;
  firstName: string;
  lastName: string;
  address1: string;
  address2: string | null;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  phone: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface CreateAddressRequest {
  firstName: string;
  lastName: string;
  address1: string;
  address2?: string | null;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  phone: string;
  isDefault?: boolean;
}

export interface UpdateAddressRequest {
  firstName?: string;
  lastName?: string;
  address1?: string;
  address2?: string | null;
  city?: string;
  region?: string;
  postalCode?: string;
  country?: string;
  phone?: string;
  isDefault?: boolean;
}

export interface PaymentMethod {
  id: string;
  stripePaymentMethodId: string;
  stripeCustomerId: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  cardholderName: string;
  isDefault: boolean;
  createdAt: string;
}

export interface CreatePaymentMethodRequest {
  stripePaymentMethodId: string;
  cardholderName: string;
  isDefault?: boolean;
}

export interface UpdateUserStatusRequest {
  status: 'active' | 'inactive' | 'pending';
}

export interface SendUserEmailRequest {
  subject: string;
  content: string;
}

export interface AdminUserStats {
  totalOrders: number;
  totalSpent: number;
  averageOrderValue: number;
  lastOrderDate: string | null;
}

export interface AdminUserDetail extends User {
  addresses: Address[];
  orders: Order[];
  stats: AdminUserStats;
  deletedAt?: string | null;
}

// ============================================================================
// ORDERS
// ============================================================================

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  priceHt: number;
  vatRate: number;
  priceTtc: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  userId: string;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  subtotalHt: number;
  totalVat: number;
  totalTtc: number;
  shippingCost: number;
  shippingMethod: string;
  items: OrderItem[];
  createdAt: string;
  updatedAt: string;
}

export interface UpdateOrderStatusRequest {
  status: Order['status'];
  comment?: string;
}

export interface RefundOrderRequest {
  reason?: string;
}

// ============================================================================
// INVOICES / FACTURES
// ============================================================================

export interface Invoice {
  id: string;
  invoiceNumber: string;
  orderId: string;
  userId: string;
  status: 'pending' | 'paid' | 'cancelled' | 'refunded';
  subtotalHt: number;
  totalVat: number;
  totalTtc: number;
  issuedAt: string;
  dueAt: string;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreditNoteRequest {
  amount: number;
  reason: 'cancellation' | 'refund' | 'error';
  notes?: string;
}

export interface CreditNote {
  id: string;
  creditNoteNumber: string;
  invoiceId: string;
  userId: string;
  amount: number | string;
  reason: 'cancellation' | 'refund' | 'error';
  issuedAt: string;
}

// ============================================================================
// MESSAGES / CONTACT
// ============================================================================

export interface ContactMessage {
  id: string;
  email: string;
  name: string;
  subject: string;
  message: string;
  status: 'pending' | 'resolved' | 'spam';
  createdAt: string;
  updatedAt: string;
}

export interface CreateContactMessageRequest {
  email: string;
  name: string;
  subject: string;
  message: string;
}

export interface ReplyContactMessageRequest {
  reply: string;
}

export interface UpdateContactMessageStatusRequest {
  status: 'unread' | 'read' | 'processed';
}

// ============================================================================
// CART / CHECKOUT
// ============================================================================

export interface CartItem {
  id: string;
  productId: string;
  quantity: number;
  unitPriceHt: number;
  unitPriceTtc: number;
  createdAt: string;
}

export interface Cart {
  id: string;
  userId: string;
  items: CartItem[];
  createdAt: string;
  updatedAt: string;
}

export interface AddCartItemRequest {
  productId: string;
  quantity: number;
}

export interface UpdateCartItemRequest {
  quantity: number;
}

export interface MergeCartRequest {
  anonymousCartItems: Array<{ productId: string; quantity: number }>;
}

export interface ShippingOption {
  id: string;
  name: string;
  price: number;
  estimatedDays: string;
}

export interface CheckoutValidationResult {
  isValid: boolean;
  issues: Array<{ code: string; message: string; productId?: string }>;
}

export interface CheckoutTotalResult {
  subtotalHt: number;
  totalVat: number;
  subtotalTtc: number;
  shippingCost: number;
  discount: number;
  totalTtc: number;
}

export interface CreateCheckoutSessionRequest {
  addressId: string;
  shippingMethodId: string;
}

export interface CalculateTotalRequest {
  shippingMethodId: string;
  cartId?: string;
  couponCode?: string;
}

export interface ApplyCouponRequest {
  sessionId: string;
  couponCode: string;
}

export interface CreatePaymentIntentRequest {
  sessionId: string;
}

export interface PaymentIntentResponse {
  clientSecret: string;
  paymentIntentId: string;
}

export interface CheckoutSession {
  sessionId: string;
  totalAmount: number;
  shippingCost: number;
}

// ============================================================================
// SEARCH / MEDIA / ANALYTICS / LEGAL / HOMEPAGE
// ============================================================================

export interface SearchProductFacet {
  name: string;
  count: number;
}

export interface ProductSearchResults<T = Product> {
  results: T[];
  facets: {
    categories: SearchProductFacet[];
    priceRanges?: Array<{ label: string; min: number; max: number; count: number }>;
  };
  pagination: PaginationMeta;
}

export interface SearchSuggestion {
  type: 'product' | 'category';
  text: string;
  slug: string;
}

export interface SearchSuggestResponse {
  suggestions: SearchSuggestion[];
}

export interface MediaUploadResponse {
  ref: string;
  url: string;
  filename: string;
  mimeType: string;
  size: number;
}

export interface AnalyticsOverview {
  overview: {
    revenue: { total: number; change: number };
    orders: { total: number; change: number };
    customers: { total: number; new: number; change: number };
    products: { total: number; outOfStock: number; lowStock: number };
    averageOrderValue: number;
    conversionRate: number;
  };
}

export interface SalesTimelinePoint {
  period: string;
  revenue: number;
  orders: number;
}

export interface SalesAnalytics {
  sales: {
    summary: { totalRevenue: number; totalOrders: number };
    timeline: SalesTimelinePoint[];
    topProducts: Array<{ productId: string; productName: string; revenue: number; quantitySold: number }>;
  };
}

export interface CustomerAnalytics {
  customerAnalytics: {
    summary: { total: number; new: number; returning: number; inactive: number };
    topCustomers: Array<{ userId: string; fullName: string; totalSpent: number; totalOrders: number }>;
    segments: { vip: number; regular: number; occasional: number };
    retention: { rate: number; churnRate: number };
  };
}

export interface LegalPage {
  id: string;
  type: 'cgu' | 'mentions_legales' | 'about';
  content: string;
  lang: string;
  updatedAt: string;
}

export interface HomepageCarouselSlide {
  id: string;
  imageRef: string | null;
  title: string | null;
  textContent: string | null;
  redirectUrl: string | null;
  displayOrder: number;
  isMainImage: boolean;
  isActive: boolean;
}

export interface HomepageConfig {
  id: string;
  fixedText: string;
  featuredProductIds: string[];
  updatedAt: string;
}

export interface HomepageBanner {
  id: string;
  title: string;
  imageRef: string;
  redirectUrl: string | null;
  position: 'TOP' | 'MIDDLE' | 'BOTTOM' | 'SIDEBAR';
  isActive: boolean;
}
