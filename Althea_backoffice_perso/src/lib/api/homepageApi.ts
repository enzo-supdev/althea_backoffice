import axiosInstance from './axiosInstance';
import {
  ApiResponse,
  HomepageBanner,
  HomepageCarouselSlide,
  HomepageConfig,
  Product,
} from './types';

export interface CreateCarouselSlideInput {
  imageRef: string;
  title?: string | null;
  textContent?: string | null;
  redirectUrl?: string | null;
  displayOrder?: number;
  isActive?: boolean;
  isMainImage?: boolean;
}

export interface UpdateCarouselSlideInput {
  imageRef?: string | null;
  title?: string | null;
  textContent?: string | null;
  redirectUrl?: string | null;
  displayOrder?: number;
  isActive?: boolean;
  isMainImage?: boolean;
}

function normalizeCarouselList(payload: any): HomepageCarouselSlide[] {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.data)) {
    return payload.data;
  }

  if (Array.isArray(payload?.slides)) {
    return payload.slides;
  }

  if (Array.isArray(payload?.carousel)) {
    return payload.carousel;
  }

  return [];
}

function normalizeCarouselSlide(payload: any): HomepageCarouselSlide {
  return (payload?.slide ?? payload?.carouselSlide ?? payload) as HomepageCarouselSlide;
}

export const homepageApi = {
  /**
   * GET /homepage/carousel — lecture publique (slides actifs uniquement).
   */
  async getCarousel(): Promise<HomepageCarouselSlide[]> {
    const { data } = await axiosInstance.get<ApiResponse<HomepageCarouselSlide[]>>('/homepage/carousel');
    return normalizeCarouselList(data.data);
  },

  /**
   * GET /homepage/admin/carousel — liste admin (slides actifs + inactifs).
   */
  async getAdminCarousel(): Promise<HomepageCarouselSlide[]> {
    const { data } = await axiosInstance.get<ApiResponse<HomepageCarouselSlide[]>>('/homepage/admin/carousel');
    return normalizeCarouselList(data.data);
  },

  async getConfig(): Promise<HomepageConfig> {
    const { data } = await axiosInstance.get<ApiResponse<HomepageConfig>>('/homepage/config');
    return data.data;
  },

  async getFeaturedProducts(params?: { limit?: number }): Promise<{ featuredProducts: Product[] }> {
    const { data } = await axiosInstance.get<ApiResponse<{ featuredProducts: Product[] }>>('/homepage/featured-products', {
      params,
    });
    return data.data;
  },

  async getBanners(params?: { position?: 'TOP' | 'MIDDLE' | 'BOTTOM' | 'SIDEBAR' }): Promise<{ banners: HomepageBanner[] }> {
    const { data } = await axiosInstance.get<ApiResponse<{ banners: HomepageBanner[] }>>('/homepage/banners', {
      params,
    });
    return data.data;
  },

  /**
   * POST /homepage/admin/carousel
   * `imageRef` requis par la doc. Uploader d'abord l'image via /media/upload.
   */
  async createCarouselSlide(input: CreateCarouselSlideInput): Promise<HomepageCarouselSlide> {
    const { data } = await axiosInstance.post<ApiResponse<HomepageCarouselSlide>>('/homepage/admin/carousel', input);
    return normalizeCarouselSlide(data.data);
  },

  /**
   * PUT /homepage/admin/carousel/:id
   */
  async updateCarouselSlide(id: string, input: UpdateCarouselSlideInput): Promise<HomepageCarouselSlide> {
    const { data } = await axiosInstance.put<ApiResponse<HomepageCarouselSlide>>(`/homepage/admin/carousel/${id}`, input);
    return normalizeCarouselSlide(data.data);
  },

  /**
   * DELETE /homepage/admin/carousel/:id
   */
  async deleteCarouselSlide(id: string): Promise<{ message: string }> {
    const { data } = await axiosInstance.delete<ApiResponse<{ message: string }>>(`/homepage/admin/carousel/${id}`);
    return data.data;
  },

  async addFeaturedProduct(productId: string): Promise<{ featuredProduct: Product }> {
    const { data } = await axiosInstance.post<ApiResponse<{ featuredProduct: Product }>>('/homepage/admin/featured-products', {
      productId,
    });
    return data.data;
  },

  async removeFeaturedProduct(id: string): Promise<void> {
    await axiosInstance.delete(`/homepage/admin/featured-products/${id}`);
  },

  async createBanner(input: Partial<HomepageBanner>): Promise<{ banner: HomepageBanner }> {
    const { data } = await axiosInstance.post<ApiResponse<{ banner: HomepageBanner }>>('/homepage/admin/banners', input);
    return data.data;
  },

  async updateBanner(id: string, input: Partial<HomepageBanner>): Promise<{ banner: HomepageBanner }> {
    const { data } = await axiosInstance.put<ApiResponse<{ banner: HomepageBanner }>>(`/homepage/admin/banners/${id}`, input);
    return data.data;
  },

  async deleteBanner(id: string): Promise<void> {
    await axiosInstance.delete(`/homepage/admin/banners/${id}`);
  },
};
