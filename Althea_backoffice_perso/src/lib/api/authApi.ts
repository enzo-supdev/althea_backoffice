import axiosInstance from './axiosInstance';
import {
  AuthResponse,
  RefreshTokenResponse,
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  ChangePasswordRequest,
  ApiResponse,
  TwoFaSetupResponse,
  TwoFaVerifyLoginRequest,
  TwoFaConfirmRequest,
  TwoFaDisableRequest,
} from './types';

/**
 * Gestion de l'authentification
 *  - Inscription, connexion, déconnexion
 *  - Refresh token, change password
 *  - Vérif email, forgot password, reset password
 *  - 2FA admin (setup / confirm / verify login / disable)
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
   * Authentifie un utilisateur. Pour un admin avec 2FA activé, la réponse
   * contient `{ twoFaRequired: true, tempToken }` au lieu des tokens —
   * le front doit alors appeler `verifyTwoFaLogin`.
   */
  async login(input: LoginRequest): Promise<LoginResponse> {
    const { data } = await axiosInstance.post<ApiResponse<LoginResponse>>(
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
   */
  async changePassword(input: ChangePasswordRequest): Promise<{ message: string }> {
    const { data } = await axiosInstance.post<ApiResponse<{ message: string }>>(
      '/auth/change-password',
      input
    );
    return data.data;
  },

  /**
   * POST /auth/2fa/setup (admin only, JWT Bearer requis).
   * Génère un secret TOTP + un QR code. Le 2FA reste inactif tant que
   * `confirmTwoFa` n'a pas été appelé avec un code valide.
   */
  async setupTwoFa(): Promise<TwoFaSetupResponse> {
    const { data } = await axiosInstance.post<ApiResponse<TwoFaSetupResponse>>(
      '/auth/2fa/setup'
    );
    return data.data;
  },

  /**
   * POST /auth/2fa/confirm (admin only).
   * Active effectivement le 2FA après vérification d'un premier code TOTP.
   */
  async confirmTwoFa(input: TwoFaConfirmRequest): Promise<{ success: true }> {
    const { data } = await axiosInstance.post<ApiResponse<{ success: true }>>(
      '/auth/2fa/confirm',
      input
    );
    return data.data;
  },

  /**
   * POST /auth/2fa/verify (public, utilise le tempToken renvoyé par /login).
   * Retourne les tokens d'accès définitifs si le code TOTP est valide.
   */
  async verifyTwoFaLogin(input: TwoFaVerifyLoginRequest): Promise<AuthResponse> {
    const { data } = await axiosInstance.post<ApiResponse<AuthResponse>>(
      '/auth/2fa/verify',
      input
    );
    return data.data;
  },

  /**
   * POST /auth/2fa/disable (admin only).
   * Nécessite code TOTP + mot de passe courant.
   */
  async disableTwoFa(input: TwoFaDisableRequest): Promise<{ success: true }> {
    const { data } = await axiosInstance.post<ApiResponse<{ success: true }>>(
      '/auth/2fa/disable',
      input
    );
    return data.data;
  },
};
