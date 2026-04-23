'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import axios from 'axios';
import { authApi } from '@/lib/api/authApi';
import {
  isTwoFaRequiredResponse,
  type AuthResponse,
  type LoginRequest,
  type LoginResponse,
  type RegisterRequest,
  type User,
} from '@/lib/api/types';

const AUTH_USER_STORAGE_KEY = 'authUser';

/**
 * Hook pour gestion de l'authentification
 * Gère login, logout, register, refresh token
 * État persisté en localStorage
 */
export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestInFlightRef = useRef(false);

  const getApiErrorMessage = (err: unknown, fallback: string): string => {
    if (axios.isAxiosError(err)) {
      const status = err.response?.status;
      const responseData = err.response?.data as
        | { message?: string; errors?: Record<string, string[] | string> }
        | undefined;

      if (status === 429) {
        return responseData?.message || 'Trop de tentatives de connexion. Attendez quelques minutes puis réessayez.';
      }

      if (responseData?.message) {
        return responseData.message;
      }

      const fieldErrors = responseData?.errors;
      if (fieldErrors) {
        const messages = Object.values(fieldErrors)
          .flatMap((value) => (Array.isArray(value) ? value : [value]))
          .filter(Boolean)
          .join(' ');

        if (messages) {
          return messages;
        }
      }

      return err.message || fallback;
    }

    return err instanceof Error ? err.message : fallback;
  };

  // Initialiser auth au mount
  useEffect(() => {
    const initAuth = async () => {
      try {
        const accessToken = localStorage.getItem('accessToken');
        const userData = localStorage.getItem(AUTH_USER_STORAGE_KEY);

        if (userData) {
          try {
            const parsedUser = JSON.parse(userData) as User;
            setUser(parsedUser);
          } catch {
            localStorage.removeItem(AUTH_USER_STORAGE_KEY);
          }
        }

        if (accessToken) {
          // Vérifier que le token existe, la vraie vérification se fait en appel API
          setIsAuthenticated(true);
        } else {
          setUser(null);
        }
      } catch (err) {
        console.error('Erreur lors de l\'initialisation auth:', err);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  const persistAuthResponse = useCallback((response: AuthResponse) => {
    localStorage.setItem('accessToken', response.accessToken);
    localStorage.setItem('refreshToken', response.refreshToken);
    localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(response.user));
    setUser(response.user);
    setIsAuthenticated(true);
  }, []);

  const login = useCallback(
    async (loginData: LoginRequest): Promise<LoginResponse | undefined> => {
      if (requestInFlightRef.current) {
        return;
      }

      requestInFlightRef.current = true;
      setLoading(true);
      setError(null);
      try {
        const response = await authApi.login(loginData);
        if (!isTwoFaRequiredResponse(response)) {
          persistAuthResponse(response);
        }
        return response;
      } catch (err) {
        const errorMessage = getApiErrorMessage(err, 'Erreur de connexion');
        setError(errorMessage);
        throw new Error(errorMessage);
      } finally {
        requestInFlightRef.current = false;
        setLoading(false);
      }
    },
    [persistAuthResponse]
  );

  const completeTwoFaLogin = useCallback(
    async (tempToken: string, code: string): Promise<AuthResponse> => {
      setLoading(true);
      setError(null);
      try {
        const response = await authApi.verifyTwoFaLogin({ tempToken, code });
        persistAuthResponse(response);
        return response;
      } catch (err) {
        const errorMessage = getApiErrorMessage(err, 'Vérification 2FA impossible');
        setError(errorMessage);
        throw new Error(errorMessage);
      } finally {
        setLoading(false);
      }
    },
    [persistAuthResponse]
  );

  const register = useCallback(
    async (registerData: RegisterRequest) => {
      if (requestInFlightRef.current) {
        return;
      }

      requestInFlightRef.current = true;
      setLoading(true);
      setError(null);
      try {
        const response = await authApi.register(registerData);
        localStorage.setItem('accessToken', response.accessToken);
        localStorage.setItem('refreshToken', response.refreshToken);
        localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(response.user));
        setUser(response.user);
        setIsAuthenticated(true);
        return response;
      } catch (err) {
        const errorMessage = getApiErrorMessage(err, 'Erreur d\'inscription');
        setError(errorMessage);
        throw new Error(errorMessage);
      } finally {
        requestInFlightRef.current = false;
        setLoading(false);
      }
    },
    []
  );

  const logout = useCallback(() => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem(AUTH_USER_STORAGE_KEY);
    setUser(null);
    setIsAuthenticated(false);
    setError(null);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const updateUser = useCallback((updater: (prev: User) => User) => {
    setUser((previous) => {
      if (!previous) return previous;
      const next = updater(previous);
      localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return {
    user,
    isAuthenticated,
    loading,
    error,
    login,
    completeTwoFaLogin,
    register,
    logout,
    clearError,
    updateUser,
  };
};
