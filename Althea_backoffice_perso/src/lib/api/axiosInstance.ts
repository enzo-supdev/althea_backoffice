import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';

const DEFAULT_API_BASE_URL = 'https://api-pslt.matheovieilleville.fr/api/v1';
const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || DEFAULT_API_BASE_URL).replace(/\/+$/, '');

const TOKEN_KEYS = {
  access: ['accessToken', 'althea_access_token'],
  refresh: ['refreshToken', 'althea_refresh_token'],
} as const;

const PUBLIC_AUTH_PATHS = [
  '/auth/login',
  '/auth/register',
  '/auth/logout',
  '/auth/refresh-token',
  '/auth/forgot-password',
  '/auth/resend-verification',
  '/auth/reset-password',
  '/auth/verify-email',
  '/auth/2fa/verify',
];

function shouldSkipAuthHeader(url?: string): boolean {
  if (!url) {
    return false;
  }

  return PUBLIC_AUTH_PATHS.some((path) => url.includes(path));
}

function getToken(keys: readonly string[]): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  for (const key of keys) {
    const value = localStorage.getItem(key);
    if (value) {
      return value;
    }
  }

  return null;
}

function setToken(keys: readonly string[], value: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  keys.forEach((key) => localStorage.setItem(key, value));
}

function clearToken(keys: readonly string[]): void {
  if (typeof window === 'undefined') {
    return;
  }

  keys.forEach((key) => localStorage.removeItem(key));
}

/**
 * Instance Axios configurée pour l'API Althea Systems
 * - Base URL : https://api-pslt.matheovieilleville.fr/api/v1
 * - Gestion automatique des tokens JWT
 * - Refresh token sur 401
 * - Interceptors pour authentification
 */
export const axiosInstance: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

/**
 * Request interceptor : ajouter le token JWT dans le header
 */
axiosInstance.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (shouldSkipAuthHeader(config.url)) {
      return config;
    }

    const accessToken = getToken(TOKEN_KEYS.access);
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

/**
 * Response interceptor : gérer 401 et autres erreurs
 * - Si 401 : tenter refresh token
 * - Si refresh échoue : logout
 * - Si autre erreur : rejeter
 */
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Éviter boucles infinies
    if (error.response?.status === 401 && !originalRequest._retry && !shouldSkipAuthHeader(originalRequest.url)) {
      originalRequest._retry = true;

      if (typeof window !== 'undefined') {
        const refreshToken = getToken(TOKEN_KEYS.refresh);

        if (refreshToken) {
          try {
            // Appeler refresh-token avec une instance Axios sans interceptor
            const { data } = await axios.post(`${API_BASE_URL}/auth/refresh-token`, {
              refreshToken,
            });

            // Stocker nouveaux tokens
            setToken(TOKEN_KEYS.access, data.data.accessToken);
            setToken(TOKEN_KEYS.refresh, data.data.refreshToken);

            // Ajouter nouveau token à la requête originale
            originalRequest.headers.Authorization = `Bearer ${data.data.accessToken}`;

            // Rejouer la requête originale
            return axiosInstance(originalRequest);
          } catch (refreshError) {
            // Refresh échoué → logout
            clearToken(TOKEN_KEYS.access);
            clearToken(TOKEN_KEYS.refresh);

            // Rediriger vers /login si on est en client-side
            if (typeof window !== 'undefined') {
              window.location.href = '/login';
            }

            return Promise.reject(refreshError);
          }
        } else {
          // Pas de refreshToken → logout
          clearToken(TOKEN_KEYS.access);
          clearToken(TOKEN_KEYS.refresh);
          if (typeof window !== 'undefined') {
            window.location.href = '/login';
          }
        }
      }
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;
