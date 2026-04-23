import axiosInstance from './axiosInstance';
import axios from 'axios';
import type { Product as LegacyProduct, ProductImage as LegacyProductImage } from '@/types';
import { resolveMediaUrl } from './mediaApi';
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

function mapApiImages(images: any[]): LegacyProductImage[] {
  return images.map((img: any, index: number): LegacyProductImage => {
    if (typeof img === 'string') {
      return {
        id: img,
        url: resolveMediaUrl(img),
        imageRef: img,
        isMain: index === 0,
        displayOrder: index,
      };
    }
    const ref: string = img.imageRef ?? img.ref ?? '';
    const url = ref ? resolveMediaUrl(ref) : (img.url ?? '');
    return {
      id: img.id ?? ref,
      url,
      imageRef: ref,
      isMain: Boolean(img.isMain),
      displayOrder: typeof img.displayOrder === 'number' ? img.displayOrder : index,
    };
  });
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

  const deletedAtRaw = product.deletedAt ?? product.deleted_at ?? null;

  return {
    ...product,
    price: product.priceTtc ?? product.price ?? product.priceHt ?? 0,
    priceHT: product.priceHt ?? product.priceHT ?? 0,
    tva: product.vatRate ?? product.tva ?? 0,
    category,
    images: Array.isArray(product.images) ? mapApiImages(product.images) : [],
    mainImageRef: product.mainImageRef ?? null,
    createdAt: new Date(product.createdAt),
    updatedAt: new Date(product.updatedAt),
    deletedAt: deletedAtRaw ? new Date(deletedAtRaw) : null,
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
  async list(): Promise<LegacyProduct[]> {
    const { data } = await axiosInstance.get('/products');
    const normalized = normalizePaginatedResponse<Product>(data);
    return normalized.data.map(mapProductToLegacy);
  },

  /**
   * GET /products/admin
   * Liste backoffice (admin) avec fallback sur la liste publique
   */
  async listBackoffice(): Promise<LegacyProduct[]> {
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
  async getTopProducts(): Promise<LegacyProduct[]> {
    const { data } = await axiosInstance.get<ApiResponse<Product[]>>(
      '/products/top'
    );
    return data.data.map(mapProductToLegacy);
  },

  /**
   * GET /products/:slug
   * Détail d'un produit par slug — l'API retourne { data: { product, images } }.
   */
  async getBySlug(slug: string): Promise<LegacyProduct> {
    const { data } = await axiosInstance.get<ApiResponse<any>>(
      `/products/${slug}`
    );
    const payload = data.data;
    const product = payload?.product ?? payload;
    const images = payload?.images ?? product?.images ?? [];
    return mapProductToLegacy({ ...product, images });
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
   * Récupère un produit admin — l'API retourne { product, images } imbriqué
   */
  async getAdminById(id: string): Promise<LegacyProduct> {
    const { data } = await axiosInstance.get<ApiResponse<any>>(
      `/products/admin/${id}`
    );
    const payload = data.data;
    const product = payload?.product ?? payload;
    const images = payload?.images ?? product.images ?? [];
    return mapProductToLegacy({ ...product, images });
  },

  /**
   * POST /products/admin
   * Crée un produit
   */
  async create(input: CreateProductRequest): Promise<LegacyProduct> {
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
  async update(id: string, input: UpdateProductRequest): Promise<LegacyProduct> {
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
  async duplicate(id: string, input: DuplicateProductRequest = {}): Promise<LegacyProduct> {
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
  async updateStock(id: string, input: UpdateProductStockRequest): Promise<LegacyProduct> {
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
  async updateStatus(id: string, input: UpdateProductStatusRequest): Promise<LegacyProduct> {
    const { data } = await axiosInstance.patch<ApiResponse<Product>>(
      `/products/admin/${id}/status`,
      input
    );
    return mapProductToLegacy(data.data);
  },

  /**
   * DELETE /products/admin/:id
   * Soft delete par defaut. `{ force: true }` tente un hard delete via
   * `?force=true` (parametre repandu cote backend avec soft-delete).
   */
  async delete(
    id: string,
    opts?: { force?: boolean },
  ): Promise<{ message: string }> {
    const { data } = await axiosInstance.delete<ApiResponse<{ message: string }>>(
      `/products/admin/${id}`,
      opts?.force ? { params: { force: true } } : undefined,
    );
    return data.data;
  },

  /**
   * DELETE /products/admin/bulk
   * Supprime plusieurs produits. `{ force: true }` tente un hard delete.
   */
  async bulkDelete(
    input: BulkProductIdsRequest,
    opts?: { force?: boolean },
  ): Promise<any> {
    const { data } = await axiosInstance.delete<ApiResponse<any>>(
      '/products/admin/bulk',
      {
        data: input,
        ...(opts?.force ? { params: { force: true } } : {}),
      },
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
   * Associe des images existantes (déjà uploadées via /media/upload) à un produit.
   * Body : { imageRefs: string[] }
   */
  async addImage(id: string, input: ProductImageRequest): Promise<LegacyProductImage[]> {
    const { data } = await axiosInstance.post<ApiResponse<any>>(
      `/products/admin/${id}/images`,
      input
    );
    const raw = Array.isArray(data.data) ? data.data : [data.data];
    return mapApiImages(raw);
  },

  /**
   * DELETE /products/admin/:id/images/:imageId
   * Supprime une image du produit (imageId = UUID de l'image, pas la ref media).
   */
  async deleteImage(id: string, imageId: string): Promise<void> {
    await axiosInstance.delete(`/products/admin/${id}/images/${imageId}`);
  },

  /**
   * PUT /products/admin/:id/images/reorder
   * Réordonne les images — Body : { imageIds: UUID[] } dans l'ordre voulu.
   */
  async reorderImages(id: string, input: ReorderProductImagesRequest): Promise<LegacyProductImage[]> {
    const { data } = await axiosInstance.put<ApiResponse<any>>(
      `/products/admin/${id}/images/reorder`,
      input
    );
    const raw = Array.isArray(data.data) ? data.data : [];
    return mapApiImages(raw);
  },

  /**
   * GET /products/admin/export
   * Export CSV des produits (admin).
   */
  async exportCsv(): Promise<Blob> {
    const { data } = await axiosInstance.get<Blob>('/products/admin/export', {
      responseType: 'blob',
    });
    return data;
  },

  /**
   * GET /products/admin/export/advanced
   * Export avancé (CSV/JSON) avec filtres.
   */
  async exportAdvanced(params?: {
    format?: 'csv' | 'json';
    categoryId?: string;
    status?: 'draft' | 'published';
    minPrice?: number;
    maxPrice?: number;
    minStock?: number;
    maxStock?: number;
  }): Promise<Blob> {
    const { data } = await axiosInstance.get<Blob>('/products/admin/export/advanced', {
      params,
      responseType: 'blob',
    });
    return data;
  },

  /**
   * Compatibilité legacy avec les écrans mockés.
   */
  async save(_nextProducts: any[]): Promise<void> {
    return;
  },
};
