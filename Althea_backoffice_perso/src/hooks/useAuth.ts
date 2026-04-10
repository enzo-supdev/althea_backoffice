'use client';

import { useEffect, useState, useCallback } from 'react';
import * as authApi from '@/lib/api/authApi';
import type { User, LoginRequest, RegisterRequest } from '@/lib/api/types';

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

  const login = useCallback(
    async (loginData: LoginRequest) => {
      setLoading(true);
      setError(null);
      try {
        const response = await authApi.authApi.login(loginData);
        localStorage.setItem('accessToken', response.accessToken);
        localStorage.setItem('refreshToken', response.refreshToken);
        localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(response.user));
        setUser(response.user);
        setIsAuthenticated(true);
        return response;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Erreur de connexion';
        setError(errorMessage);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const register = useCallback(
    async (registerData: RegisterRequest) => {
      setLoading(true);
      setError(null);
      try {
        const response = await authApi.authApi.register(registerData);
        localStorage.setItem('accessToken', response.accessToken);
        localStorage.setItem('refreshToken', response.refreshToken);
        localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(response.user));
        setUser(response.user);
        setIsAuthenticated(true);
        return response;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Erreur d\'inscription';
        setError(errorMessage);
        throw err;
      } finally {
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

  return {
    user,
    isAuthenticated,
    loading,
    error,
    login,
    register,
    logout,
    clearError,
  };
};
