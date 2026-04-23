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
  twoFaEnabled?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface TwoFaRequiredResponse {
  twoFaRequired: true;
  tempToken: string;
}

export type LoginResponse = AuthResponse | TwoFaRequiredResponse;

export const isTwoFaRequiredResponse = (
  response: LoginResponse,
): response is TwoFaRequiredResponse =>
  (response as TwoFaRequiredResponse).twoFaRequired === true;

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

export interface TwoFaSetupResponse {
  secret: string;
  qrCodeDataUrl: string;
}

export interface TwoFaVerifyLoginRequest {
  tempToken: string;
  code: string;
}

export interface TwoFaConfirmRequest {
  code: string;
}

export interface TwoFaDisableRequest {
  code: string;
  password: string;
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
  mainImageRef?: string;
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
  mainImageRef?: string;
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
  categoryId: string;
}

export interface ProductImageRequest {
  imageRefs: string[];
}

export interface ReorderProductImagesRequest {
  imageIds: string[];
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
  imageRef?: string;
  parentId?: string;
}

export interface UpdateCategoryRequest {
  name?: string;
  slug?: string;
  description?: string;
  imageRef?: string;
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
  message: string;
  template?: 'NOTIFICATION' | 'MARKETING' | 'SUPPORT';
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
  status: 'pending' | 'processing' | 'completed' | 'cancelled';
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
  /** Texte libre côté backend (ex: "Produit retourné défectueux"). */
  reason: string;
  notes?: string;
  sendEmail?: boolean;
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
  status: 'NEW' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  response?: string | null;
  notes?: string | null;
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
  status: 'NEW' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  response?: string;
  notes?: string;
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

/**
 * Réponse de POST /media/upload (upload unitaire).
 * Le backend renvoie `mimetype` (tout en minuscules), pas `mimeType`.
 */
export interface MediaUploadResponse {
  ref: string;
  url: string;
  mimetype: string;
  size: number;
}

/**
 * Un fichier renvoyé par POST /media/admin/bulk-upload. Shape différente
 * de l'upload unitaire (contient filename et `mimeType` en camelCase).
 */
export interface MediaBulkUploadItem {
  ref: string;
  url: string;
  filename: string;
  mimeType: string;
  size: number;
}

export interface MediaBulkUploadResponse {
  files: MediaBulkUploadItem[];
  count: number;
}

/**
 * Période renvoyée par la plupart des endpoints analytics.
 */
export interface AnalyticsPeriod {
  startDate: string;
  endDate: string;
}

/**
 * GET /analytics/admin/overview
 * Shape plate renvoyée par l'API déployée.
 */
export interface AnalyticsOverview {
  overview: {
    totalRevenue: number;
    totalOrders: number;
    totalUsers: number;
    totalProducts: number;
    averageOrderValue: number;
    revenueGrowth: number;
    newUsers: number;
    conversionRate: number;
    period: AnalyticsPeriod;
  };
}

/**
 * GET /analytics/admin/sales
 * Tableau plat, un point par période groupée.
 */
export interface SalesTimelinePoint {
  period: string;
  startDate: string;
  endDate: string;
  revenue: number;
  orderCount: number;
  averageOrderValue: number;
}

export interface SalesAnalytics {
  sales: SalesTimelinePoint[];
}

/**
 * GET /analytics/admin/products
 */
export interface TopProductItem {
  productId: string;
  productName: string;
  quantitySold: number;
  totalRevenue: number;
  averagePrice: number;
}

export interface StockProductItem {
  productId: string;
  productName: string;
  stock: number;
  status: string;
}

export interface ProductsAnalytics {
  topSellingProducts: TopProductItem[];
  topRevenueProducts: TopProductItem[];
  lowStockProducts: StockProductItem[];
  outOfStockProducts: StockProductItem[];
}

/**
 * GET /analytics/admin/customers
 */
export interface TopCustomerItem {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  totalSpent: number;
  orderCount: number;
  averageOrderValue: number;
  lifetimeValue: number;
}

export interface CustomerAnalytics {
  topCustomers: TopCustomerItem[];
  newCustomers: number;
  averageOrdersPerCustomer: number;
}

/**
 * GET /analytics/admin/orders-stats
 */
export interface OrdersStatusBreakdown {
  status: string;
  count: number;
  percentage: number;
}

export interface OrdersStatsAnalytics {
  byOrderStatus: OrdersStatusBreakdown[];
  byPaymentStatus: OrdersStatusBreakdown[];
  cancellationRate: number;
  avgShippingDelayHours: number | null;
  avgDeliveryDelayHours: number | null;
  period: AnalyticsPeriod;
}

/**
 * GET /analytics/admin/revenue-breakdown
 */
export interface RevenueByCategory {
  categoryId: string;
  categoryName: string;
  revenue: number;
  orderCount: number;
  percentage: number;
}

export interface RevenueByPaymentMethod {
  method: string;
  revenue: number;
  orderCount: number;
  percentage: number;
}

export interface RevenueBreakdownAnalytics {
  byCategory: RevenueByCategory[];
  byPaymentMethod: RevenueByPaymentMethod[];
  period: AnalyticsPeriod;
}

/**
 * GET /analytics/admin/inventory-stats
 */
export interface ImmobilizedStockItem {
  productId: string;
  productName: string;
  stock: number;
  price: number;
  immobilizedValue: number;
}

export interface InventoryStatsAnalytics {
  totalStockValue: number;
  byProductStatus: Array<{ status: string; count: number }>;
  neverSoldProducts: number;
  top10ImmobilizedStock: ImmobilizedStockItem[];
}

/**
 * GET /analytics/admin/categories-stats
 */
export interface CategoryStatsItem {
  categoryId: string;
  categoryName: string;
  revenue: number;
  distinctOrderCount: number;
  quantitySold: number;
  revenuePercentage: number;
}

export type CategoriesStatsAnalytics = CategoryStatsItem[];

/**
 * GET /analytics/admin/refunds-stats
 */
export interface RefundReasonBreakdown {
  reason: 'cancellation' | 'refund' | 'error';
  amount: number;
  count: number;
}

export interface RefundTimelinePoint {
  month: string;
  amount: number;
  count: number;
}

export interface RefundsStatsAnalytics {
  totalAmount: number;
  totalCount: number;
  refundRate: number;
  byReason: RefundReasonBreakdown[];
  monthlyTimeline: RefundTimelinePoint[];
  period: AnalyticsPeriod;
}

/**
 * GET /analytics/admin/geographic-stats
 */
export interface CountryBreakdown {
  country: string;
  orderCount: number;
  revenue: number;
  percentage: number;
}

export interface CityBreakdown {
  city: string;
  country: string;
  orderCount: number;
  revenue: number;
}

export interface GeographicStatsAnalytics {
  byCountry: CountryBreakdown[];
  topCities: CityBreakdown[];
  period: AnalyticsPeriod;
}

/**
 * GET /analytics/admin/contact-stats
 */
export interface ContactStatusBreakdown {
  status: string;
  count: number;
}

export interface ContactDailyPoint {
  date: string;
  count: number;
}

export interface ContactStatsAnalytics {
  totalMessages: number;
  byStatus: ContactStatusBreakdown[];
  dailyTimeline: ContactDailyPoint[];
  avgResponseTimeHours: number | null;
  processingRate: number;
  period: AnalyticsPeriod;
}

export type LegalPageType =
  | 'CGV'
  | 'CGU'
  | 'MENTIONS_LEGALES'
  | 'POLITIQUE_CONFIDENTIALITE'
  | 'COOKIES';

export interface LegalPage {
  type: LegalPageType;
  title: string;
  content: string;
  version: string;
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
