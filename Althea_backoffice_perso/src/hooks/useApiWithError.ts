import { useState, useCallback } from 'react';
import type { AxiosError } from 'axios';

interface ApiErrorDetail {
  status: number;
  message: string;
  fieldErrors?: Record<string, string[]>;
}

/**
 * Hook pour gestion détaillée des erreurs API
 * Gère codes HTTP spécifiques : 422, 409, 429, 403, etc.
 * 
 * @example
 * const { data, loading, error, execute } = useApiWithError(() => createUser(data));
 */
export const useApiWithError = <T,>(apiCall: () => Promise<T>) => {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiErrorDetail | null>(null);

  const execute = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiCall();
      setData(result);
      return result;
    } catch (err) {
      const axiosError = err as AxiosError<any>;
      const status = axiosError.response?.status || 500;
      const errorData = axiosError.response?.data;

      let errorDetail: ApiErrorDetail = {
        status,
        message: 'Une erreur est survenue',
      };

      if (status === 422) {
        // Validation échouée - afficher erreurs par champ
        errorDetail.message = errorData?.message || 'Validation échouée';
        errorDetail.fieldErrors = errorData?.errors;
      } else if (status === 409) {
        // Conflit - ressource déjà existante
        errorDetail.message = errorData?.message || 'Ressource déjà existante';
      } else if (status === 429) {
        // Rate limited
        errorDetail.message = 'Trop de requêtes. Veuillez réessayer plus tard.';
      } else if (status === 403) {
        // Forbidden
        errorDetail.message =
          errorData?.message || "Vous n'avez pas accès à cette ressource.";
      } else if (status === 404) {
        // Not found
        errorDetail.message = errorData?.message || 'Ressource introuvable';
      } else if (status === 401) {
        // Unauthorized - devrait être géré par interceptor
        errorDetail.message = 'Session expirée, veuillez vous reconnecter';
      } else if (status >= 500) {
        // Erreur serveur
        errorDetail.message =
          errorData?.message || 'Erreur serveur. Veuillez réessayer plus tard.';
      } else {
        errorDetail.message = errorData?.message || 'Une erreur est survenue';
      }

      setError(errorDetail);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [apiCall]);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  return { data, loading, error, execute, reset };
};
