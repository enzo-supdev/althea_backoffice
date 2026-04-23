import axiosInstance from './axiosInstance';
import {
  ApiResponse,
  MediaBulkUploadItem,
  MediaBulkUploadResponse,
  MediaUploadResponse,
} from './types';

/**
 * Construit l'URL publique d'un fichier media à partir de sa `ref`.
 * Le backend expose GET /media/:ref (pas d'auth, cache 1 an).
 *
 * Accepte aussi une URL absolue (http/https) ou un chemin relatif
 * déjà résolu — dans ces cas, retourne la valeur telle quelle.
 */
export function resolveMediaUrl(refOrUrl: string | null | undefined): string {
  if (!refOrUrl) {
    return '';
  }

  if (/^https?:\/\//i.test(refOrUrl) || refOrUrl.startsWith('/')) {
    return refOrUrl;
  }

  const baseUrl = (axiosInstance.defaults.baseURL ?? '').replace(/\/+$/, '');
  if (!baseUrl) {
    return refOrUrl;
  }

  return `${baseUrl}/media/${refOrUrl}`;
}

export const mediaApi = {
  /**
   * POST /media/upload
   * Uploade un fichier (image, vidéo, doc). Max 10 MB.
   * Le backend peut répondre soit { success, data: {...} } soit l'objet direct.
   */
  async upload(file: File): Promise<MediaUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);

    const { data } = await axiosInstance.post<any>('/media/upload', formData);
    const payload: MediaUploadResponse = (data?.data ?? data) as MediaUploadResponse;

    if (!payload?.ref) {
      throw new Error(
        `Réponse upload invalide : pas de "ref" dans ${JSON.stringify(data)?.slice(0, 200)}`,
      );
    }

    return payload;
  },

  /**
   * Fetch une URL externe (placeholder, CDN, Unsplash...) puis uploade le
   * binaire via POST /media/upload. Renvoie la `ref` du fichier uploade.
   * Utile pour l'import CSV : on colle une URL publique dans la colonne
   * `imageUrl` au lieu d'avoir a uploader chaque image a la main.
   */
  async uploadFromUrl(url: string, filename: string): Promise<MediaUploadResponse> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`fetch URL ${response.status} ${response.statusText}`);
    }
    const blob = await response.blob();
    const type = blob.type || 'image/png';
    const file = new File([blob], filename, { type });
    try {
      return await mediaApi.upload(file);
    } catch (uploadErr: any) {
      // Enrichit l'erreur avec le corps de la reponse pour diagnostiquer les 400.
      const status = uploadErr?.response?.status;
      const body = uploadErr?.response?.data;
      const detail =
        typeof body === 'string'
          ? body
          : body?.error?.message ?? body?.message ?? JSON.stringify(body ?? {}).slice(0, 300);
      const mime = type;
      const size = blob.size;
      throw new Error(
        `POST /media/upload ${status ?? '?'} (mime=${mime}, size=${size}o, name=${filename})${detail ? ` : ${detail}` : ''}`,
      );
    }
  },

  /**
   * GET /media/:ref — renvoie le Blob du fichier. Pas d'auth requise.
   * Pour un simple affichage <img>, utiliser directement resolveMediaUrl(ref).
   */
  async getByRef(ref: string): Promise<Blob> {
    const { data } = await axiosInstance.get<Blob>(`/media/${ref}`, { responseType: 'blob' });
    return data;
  },

  /**
   * DELETE /media/:ref
   */
  async delete(ref: string): Promise<{ message: string }> {
    const { data } = await axiosInstance.delete<ApiResponse<{ message: string }>>(`/media/${ref}`);
    return data.data;
  },

  /**
   * POST /media/admin/bulk-upload (max 10 fichiers).
   * Renvoie { files: [...], count }.
   */
  async bulkUpload(files: File[]): Promise<MediaBulkUploadItem[]> {
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));

    const { data } = await axiosInstance.post<ApiResponse<MediaBulkUploadResponse>>(
      '/media/admin/bulk-upload',
      formData,
    );
    return data.data.files;
  },

  /**
   * GET /media/admin/all — liste paginée des fichiers.
   */
  async listAll(params?: {
    type?: 'image' | 'video' | 'document';
    search?: string;
    uploadedBy?: string;
    page?: number;
    limit?: number;
  }): Promise<unknown> {
    const { data } = await axiosInstance.get<ApiResponse<unknown>>('/media/admin/all', { params });
    return data.data;
  },
};
