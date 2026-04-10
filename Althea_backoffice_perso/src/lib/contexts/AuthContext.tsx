'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { User, AuthResponse } from '@/lib/api/types';
import { authApi } from '@/lib/api/authApi';
import { usersApi } from '@/lib/api/usersApi';
import { storageManager } from '@/lib/storageManager';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (
    firstName: string,
    lastName: string,
    email: string,
    password: string
  ) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialiser depuis le localStorage au montage
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (storageManager.token.hasTokens()) {
          // Essayer de récupérer le profil
          const profile = await usersApi.getProfile();
          if (profile) {
            setUser(profile);
            storageManager.user.setUser(profile);
          }
        }
      } catch (err) {
        // Tokens invalides, clear tout
        storageManager.logout();
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const authResponse: AuthResponse = await authApi.login({ email, password });
      
      // Stocker les tokens
      storageManager.token.setAccessToken(authResponse.accessToken);
      storageManager.token.setRefreshToken(authResponse.refreshToken);
      
      // Stocker l'user
      setUser(authResponse.user);
      storageManager.user.setUser(authResponse.user);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur de connexion';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const register = useCallback(
    async (
      firstName: string,
      lastName: string,
      email: string,
      password: string
    ) => {
      setIsLoading(true);
      setError(null);
      try {
        const authResponse: AuthResponse = await authApi.register({
          firstName,
          lastName,
          email,
          password,
        });
        
        // Stocker les tokens
        storageManager.token.setAccessToken(authResponse.accessToken);
        storageManager.token.setRefreshToken(authResponse.refreshToken);
        
        // Stocker l'user
        setUser(authResponse.user);
        storageManager.user.setUser(authResponse.user);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erreur d\'inscription';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const logout = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      await authApi.logout?.();
    } catch (err) {
      // Même si la requête échoue, on logout localement
      console.error('Logout error:', err);
    } finally {
      setUser(null);
      storageManager.logout();
      setIsLoading(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    error,
    login,
    register,
    logout,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth doit être utilisé à l\'intérieur de AuthProvider');
  }
  return context;
};
