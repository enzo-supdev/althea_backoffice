import axiosInstance from './axiosInstance';
import axios from 'axios';
import {
  Product,
  ApiResponse,
  PaginatedResponse,
  CreateProductRequest,
  UpdateProductRequest,
  DuplicateProductRequest,
  UpdateProductStockRequest,
  UpdateProductStatusRequest,
  BulkProductIdsRequest,
  BulkProductStatusRequest,
  BulkProductCategoryRequest,
  ProductImageRequest,
  ReorderProductImagesRequest,
} from './types';

function normalizePaginatedResponse<T>(payload: any): PaginatedResponse<T> {
  if (Array.isArray(payload?.data) && payload?.meta) {
    return payload as PaginatedResponse<T>;
  }

  if (Array.isArray(payload?.data?.data) && payload?.data?.meta) {
    return payload.data as PaginatedResponse<T>;
  }

  if (Array.isArray(payload?.data)) {
    return {
      success: true,
      data: payload.data,
      meta: {
        total: payload.data.length,
        page: 1,
        limit: payload.data.length,
        totalPages: 1,
      },
    } as PaginatedResponse<T>;
  }

  throw new Error('Format de reponse paginee invalide pour les produits.');
}

function mapProductToLegacy(product: any): any {
  const category = product.category ?? {
    id: product.categoryId,
    name: product.categoryName ?? 'Catégorie',
    description: product.categoryDescription ?? '',
    image: product.categoryImage ?? '',
    slug: product.categorySlug ?? '',
    productCount: product.categoryProductCount ?? 0,
    order: product.displayOrder ?? 0,
    status: 'active',
    createdAt: new Date(product.createdAt),
  };

  return {
    ...product,
    price: product.priceTtc ?? product.price ?? product.priceHt ?? 0,
    priceHT: product.priceHt ?? product.priceHT ?? 0,
    tva: product.vatRate ?? product.tva ?? 0,
    category,
    images: Array.isArray(product.images)
      ? product.images.map((image: any) => (typeof image === 'string' ? image : image.url))
      : [],
    createdAt: new Date(product.createdAt),
    updatedAt: new Date(product.updatedAt),
  };
}

/**
 * Gestion des produits (catalogue public + admin)
 */
export const productsApi = {
  /**
   * GET /products
   * Liste legacy des produits publiés
   */
  async list(): Promise<any[]> {
    const { data } = await axiosInstance.get('/products');
    const normalized = normalizePaginatedResponse<Product>(data);
    return normalized.data.map(mapProductToLegacy);
  },

  /**
   * GET /products/admin
   * Liste backoffice (admin) avec fallback sur la liste publique
   */
  async listBackoffice(): Promise<any[]> {
    try {
      const { data } = await axiosInstance.get('/products/admin', {
        params: {
          page: 1,
          limit: 20,
        },
      });

      const normalized = normalizePaginatedResponse<Product>(data);

      return normalized.data.map(mapProductToLegacy);
    } catch (error) {
      // Le fallback ne s'applique que si la route admin n'existe pas.
      // En cas de 401/403, on laisse remonter l'erreur pour rendre le problème visible.
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return this.list();
      }

      throw error;
    }
  },

  /**
   * GET /products
   * Liste paginée des produits publiés
   */
  async listPaginated(params?: {
    search?: string;
    category?: string;
    availability?: string;
    minPrice?: number;
    maxPrice?: number;
    vatRate?: number;
    sortBy?: 'name' | 'priceHt' | 'createdAt' | 'displayOrder';
    sortOrder?: 'asc' | 'desc';
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<Product>> {
    const { data } = await axiosInstance.get(
      '/products',
      { params }
    );
    return normalizePaginatedResponse<Product>(data);
  },

  /**
   * GET /products/top
   * Top 10 produits featured
   */
  async getTopProducts(): Promise<Product[]> {
    const { data } = await axiosInstance.get<ApiResponse<Product[]>>(
      '/products/top'
    );
    return data.data.map(mapProductToLegacy);
  },

  /**
   * GET /products/:slug
   * Détail d'un produit par slug
   */
  async getBySlug(slug: string): Promise<Product> {
    const { data } = await axiosInstance.get<ApiResponse<Product>>(
      `/products/${slug}`
    );
    return mapProductToLegacy(data.data);
  },

  /**
   * GET /products/admin
   * Liste admin avec filtres étendus
   */
  async listAdmin(params?: {
    page?: number;
    limit?: number;
    sortBy?: 'name' | 'priceHt' | 'createdAt';
    sortOrder?: 'asc' | 'desc';
  }): Promise<PaginatedResponse<Product>> {
    const { data } = await axiosInstance.get(
      '/products/admin',
      { params }
    );
    return normalizePaginatedResponse<Product>(data);
  },

  /**
   * GET /products/admin/:id
   * Récupère un produit admin
   */
  async getAdminById(id: string): Promise<Product> {
    const { data } = await axiosInstance.get<ApiResponse<Product>>(
      `/products/admin/${id}`
    );
    return mapProductToLegacy(data.data);
  },

  /**
   * POST /products/admin
   * Crée un produit
   */
  async create(input: CreateProductRequest): Promise<Product> {
    const { data } = await axiosInstance.post<ApiResponse<Product>>(
      '/products/admin',
      input
    );
    return mapProductToLegacy(data.data);
  },

  /**
   * PUT /products/admin/:id
   * Met à jour un produit
   */
  async update(id: string, input: UpdateProductRequest): Promise<Product> {
    const { data } = await axiosInstance.put<ApiResponse<Product>>(
      `/products/admin/${id}`,
      input
    );
    return mapProductToLegacy(data.data);
  },

  /**
   * POST /products/admin/:id/duplicate
   * Duplique un produit
   */
  async duplicate(id: string, input: DuplicateProductRequest = {}): Promise<Product> {
    const { data } = await axiosInstance.post<ApiResponse<Product>>(
      `/products/admin/${id}/duplicate`,
      input
    );
    return mapProductToLegacy(data.data);
  },

  /**
   * PUT /products/admin/:id/stock
   * Met à jour le stock
   */
  async updateStock(id: string, input: UpdateProductStockRequest): Promise<Product> {
    const { data } = await axiosInstance.put<ApiResponse<Product>>(
      `/products/admin/${id}/stock`,
      input
    );
    return mapProductToLegacy(data.data);
  },

  /**
   * PATCH /products/admin/:id/status
   * Met à jour le statut
   */
  async updateStatus(id: string, input: UpdateProductStatusRequest): Promise<Product> {
    const { data } = await axiosInstance.patch<ApiResponse<Product>>(
      `/products/admin/${id}/status`,
      input
    );
    return mapProductToLegacy(data.data);
  },

  /**
   * DELETE /products/admin/:id
   * Supprime un produit
   */
  async delete(id: string): Promise<{ message: string }> {
    const { data } = await axiosInstance.delete<ApiResponse<{ message: string }>>(
      `/products/admin/${id}`
    );
    return data.data;
  },

  /**
   * DELETE /products/admin/bulk
   * Supprime plusieurs produits
   */
  async bulkDelete(input: BulkProductIdsRequest): Promise<any> {
    const { data } = await axiosInstance.delete<ApiResponse<any>>(
      '/products/admin/bulk',
      { data: input }
    );
    return data.data;
  },

  /**
   * PATCH /products/admin/bulk/status
   * Change le statut de plusieurs produits
   */
  async bulkUpdateStatus(input: BulkProductStatusRequest): Promise<any> {
    const { data } = await axiosInstance.patch<ApiResponse<any>>(
      '/products/admin/bulk/status',
      input
    );
    return data.data;
  },

  /**
   * PATCH /products/admin/bulk/category
   * Change la catégorie de plusieurs produits
   */
  async bulkUpdateCategory(input: BulkProductCategoryRequest): Promise<any> {
    const { data } = await axiosInstance.patch<ApiResponse<any>>(
      '/products/admin/bulk/category',
      input
    );
    return data.data;
  },

  /**
   * POST /products/admin/:id/images
   * Ajoute une image
   */
  async addImage(id: string, input: ProductImageRequest): Promise<any> {
    const { data } = await axiosInstance.post<ApiResponse<any>>(
      `/products/admin/${id}/images`,
      input
    );
    return data.data;
  },

  /**
   * DELETE /products/admin/:id/images/:imageId
   * Supprime une image
   */
  async deleteImage(id: string, imageId: string): Promise<{ message: string }> {
    const { data } = await axiosInstance.delete<ApiResponse<{ message: string }>>(
      `/products/admin/${id}/images/${imageId}`
    );
    return data.data;
  },

  /**
   * PUT /products/admin/:id/images/reorder
   * Réordonne les images
   */
  async reorderImages(id: string, input: ReorderProductImagesRequest): Promise<any> {
    const { data } = await axiosInstance.put<ApiResponse<any>>(
      `/products/admin/${id}/images/reorder`,
      input
    );
    return data.data;
  },

  /**
   * Compatibilité legacy avec les écrans mockés.
   */
  async save(_nextProducts: any[]): Promise<void> {
    return;
  },
};
