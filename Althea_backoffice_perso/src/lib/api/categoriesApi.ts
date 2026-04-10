import axiosInstance from './axiosInstance';
import {
  Category,
  CreateCategoryRequest,
  UpdateCategoryRequest,
  ApiResponse,
  PaginatedResponse,
} from './types';

function mapCategoryToLegacy(category: Category): any {
  return {
    ...category,
    order: category.displayOrder ?? 0,
    createdAt: new Date(category.createdAt),
    updatedAt: new Date(category.updatedAt ?? category.createdAt),
  };
}

/**
 * Gestion des catégories de produits
 * Endpoints admin pour créer, modifier, supprimer, réorganiser
 */
export const categoriesApi = {
  /**
   * GET /categories
   * Liste publique des catégories (utilisée par Produits/Header)
   */
  async list(): Promise<any[]> {
    const { data } = await axiosInstance.get<ApiResponse<Category[]>>(
      '/categories'
    );
    return data.data.map(mapCategoryToLegacy);
  },

  /**
   * GET /categories/admin
   * Liste admin des catégories (backoffice gestion)
   */
  async listAdmin(): Promise<any[]> {
    const { data } = await axiosInstance.get<ApiResponse<Category[]>>(
      '/categories/admin'
    );
    return data.data.map(mapCategoryToLegacy);
  },

  /**
   * GET /categories/admin
   * Liste paginée des catégories
   */
  async listPaginated(params?: {
    page?: number;
    limit?: number;
    sortBy?: 'name' | 'displayOrder' | 'createdAt';
    sortOrder?: 'asc' | 'desc';
  }): Promise<PaginatedResponse<Category>> {
    const { data } = await axiosInstance.get<PaginatedResponse<Category>>(
      '/categories/admin',
      { params }
    );
    return data;
  },

  /**
   * GET /categories/admin/:id
   * Détail d'une catégorie
   */
  async getById(id: string): Promise<Category> {
    const { data } = await axiosInstance.get<ApiResponse<Category>>(
      `/categories/admin/${id}`
    );
    return mapCategoryToLegacy(data.data);
  },

  /**
   * POST /categories/admin
   * Crée une nouvelle catégorie
   */
  async create(input: CreateCategoryRequest): Promise<Category> {
    const { data } = await axiosInstance.post<ApiResponse<Category>>(
      '/categories/admin',
      input
    );
    return mapCategoryToLegacy(data.data);
  },

  /**
   * PUT /categories/admin/:id
   * Met à jour une catégorie
   */
  async update(id: string, input: UpdateCategoryRequest): Promise<Category> {
    const { data } = await axiosInstance.put<ApiResponse<Category>>(
      `/categories/admin/${id}`,
      input
    );
    return mapCategoryToLegacy(data.data);
  },

  /**
   * DELETE /categories/admin/:id
   * Supprime une catégorie
   */
  async delete(id: string): Promise<void> {
    await axiosInstance.delete(`/categories/admin/${id}`);
  },

  /**
   * Compatibilité legacy : mise à jour du statut pour un lot de catégories.
   */
  async updateStatus(ids: string[], status: 'active' | 'inactive'): Promise<void> {
    await Promise.all(ids.map((id) => categoriesApi.update(id, { status })));
  },

  /**
   * Compatibilité legacy : suppression en lot.
   */
  async remove(ids: string[]): Promise<void> {
    await Promise.all(ids.map((id) => categoriesApi.delete(id)));
  },

  /**
   * POST /categories/admin/:id/move
   * Déplace une catégorie (up/down dans l'ordre d'affichage)
   */
  async move(id: string, direction: 'up' | 'down'): Promise<Category> {
    const { data } = await axiosInstance.post<ApiResponse<Category>>(
      `/categories/admin/${id}/move`,
      { direction }
    );
    return mapCategoryToLegacy(data.data);
  },
};
