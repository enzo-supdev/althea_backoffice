import axiosInstance from './axiosInstance';
import {
  AuthResponse,
  RefreshTokenResponse,
  User,
  LoginRequest,
  RegisterRequest,
  ChangePasswordRequest,
  ApiResponse,
} from './types';

/**
 * Gestion de l'authentification
 *  - Inscription, connexion, déconnexion
 *  - Refresh token, change password
 *  - Verif email, forgot password, reset password
 */
export const authApi = {
  /**
   * POST /auth/register
   * Crée un compte utilisateur et envoie un email de vérification
   */
  async register(input: RegisterRequest): Promise<AuthResponse> {
    const { data } = await axiosInstance.post<ApiResponse<AuthResponse>>(
      '/auth/register',
      input
    );
    return data.data;
  },

  /**
   * GET /auth/verify-email/:token
   * Vérifie l'email via le token reçu par email
   */
  async verifyEmail(token: string): Promise<{ message: string }> {
    const { data } = await axiosInstance.get<ApiResponse<{ message: string }>>(
      `/auth/verify-email/${token}`
    );
    return data.data;
  },

  /**
   * POST /auth/resend-verification
   * Renvoie un email de vérification
   */
  async resendVerification(email: string): Promise<{ message: string }> {
    const { data } = await axiosInstance.post<ApiResponse<{ message: string }>>(
      '/auth/resend-verification',
      { email }
    );
    return data.data;
  },

  /**
   * POST /auth/login
   * Authentifie un utilisateur
   */
  async login(input: LoginRequest): Promise<AuthResponse> {
    const { data } = await axiosInstance.post<ApiResponse<AuthResponse>>(
      '/auth/login',
      input
    );
    return data.data;
  },

  /**
   * POST /auth/logout
   * Invalide le refreshToken côté serveur
   */
  async logout(): Promise<{ message: string }> {
    const { data } = await axiosInstance.post<ApiResponse<{ message: string }>>(
      '/auth/logout'
    );
    return data.data;
  },

  /**
   * POST /auth/refresh-token
   * Renouvelle l'accessToken à partir du refreshToken
   */
  async refreshToken(refreshToken: string): Promise<RefreshTokenResponse> {
    const { data } = await axiosInstance.post<ApiResponse<RefreshTokenResponse>>(
      '/auth/refresh-token',
      { refreshToken }
    );
    return data.data;
  },

  /**
   * POST /auth/forgot-password
   * Envoie un email de réinitialisation du mot de passe
   */
  async forgotPassword(email: string): Promise<{ message: string }> {
    const { data } = await axiosInstance.post<ApiResponse<{ message: string }>>(
      '/auth/forgot-password',
      { email }
    );
    return data.data;
  },

  /**
   * POST /auth/reset-password/:token
   * Réinitialise le mot de passe via le token
   */
  async resetPassword(token: string, password: string): Promise<{ message: string }> {
    const { data } = await axiosInstance.post<ApiResponse<{ message: string }>>(
      `/auth/reset-password/${token}`,
      { password }
    );
    return data.data;
  },

  /**
   * POST /auth/change-password
   * Change le mot de passe de l'utilisateur connecté
   */
  async changePassword(input: ChangePasswordRequest): Promise<{ message: string }> {
    const { data } = await axiosInstance.post<ApiResponse<{ message: string }>>(
      '/auth/change-password',
      input
    );
    return data.data;
  },
};
