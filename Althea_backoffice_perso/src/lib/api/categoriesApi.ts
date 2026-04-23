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
   * Détail d'une catégorie par id — l'API ne publie pas d'endpoint admin GET
   * par id, on reconstruit via /categories/admin (liste complète).
   */
  async getById(id: string): Promise<Category> {
    const { data } = await axiosInstance.get<ApiResponse<Category[]>>(
      '/categories/admin'
    );
    const found = data.data.find((category) => category.id === id);
    if (!found) {
      throw new Error(`Catégorie introuvable : ${id}`);
    }
    return mapCategoryToLegacy(found);
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
   * PATCH /categories/admin/:id/status
   * Mise à jour du statut pour un lot de catégories.
   */
  async updateStatus(ids: string[], status: 'active' | 'inactive'): Promise<void> {
    await Promise.all(
      ids.map((id) =>
        axiosInstance.patch<ApiResponse<Category>>(
          `/categories/admin/${id}/status`,
          { status }
        )
      )
    );
  },

  /**
   * POST /categories/admin/:id/image
   * Associe une image (référence media) à une catégorie.
   */
  async setImage(id: string, imageRef: string): Promise<Category> {
    const { data } = await axiosInstance.post<ApiResponse<Category>>(
      `/categories/admin/${id}/image`,
      { imageRef }
    );
    return mapCategoryToLegacy(data.data);
  },

  /**
   * PUT /categories/admin/reorder
   * Réordonne la liste complète des catégories.
   */
  async reorder(categories: Array<{ id: string; displayOrder: number }>): Promise<void> {
    await axiosInstance.put<ApiResponse<{ success: boolean }>>(
      '/categories/admin/reorder',
      { categories }
    );
  },

  /**
   * Suppression en lot.
   */
  async remove(ids: string[]): Promise<void> {
    await Promise.all(ids.map((id) => categoriesApi.delete(id)));
  },

  /**
   * Déplace une catégorie d'un cran dans l'ordre d'affichage.
   * Implémenté via PUT /categories/admin/reorder (échange des displayOrder
   * avec la catégorie voisine).
   */
  async move(id: string, direction: 'up' | 'down'): Promise<void> {
    const { data } = await axiosInstance.get<ApiResponse<Category[]>>(
      '/categories/admin'
    );
    const sorted = [...data.data].sort(
      (a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)
    );
    const index = sorted.findIndex((category) => category.id === id);
    if (index === -1) {
      throw new Error(`Catégorie introuvable : ${id}`);
    }

    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= sorted.length) {
      return;
    }

    [sorted[index], sorted[swapIndex]] = [sorted[swapIndex], sorted[index]];

    const payload = sorted.map((category, position) => ({
      id: category.id,
      displayOrder: position,
    }));

    await axiosInstance.put<ApiResponse<{ success: boolean }>>(
      '/categories/admin/reorder',
      { categories: payload }
    );
  },
};
