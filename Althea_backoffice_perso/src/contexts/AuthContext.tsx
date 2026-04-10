'use client';

import React, { createContext, useContext, ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import type { User, LoginRequest, RegisterRequest } from '@/lib/api/types';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
  login: (data: LoginRequest) => Promise<any>;
  register: (data: RegisterRequest) => Promise<any>;
  logout: () => void;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Provider pour l'authentification globale
 * À utiliser au niveau du layout root
 * 
 * @example
 * <AuthProvider>
 *   <YourApp />
 * </AuthProvider>
 */
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const auth = useAuth();

  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
};

/**
 * Hook pour accéder au contexte d'authentification
 * Doit être utilisé à l'intérieur d'un <AuthProvider>
 * 
 * @example
 * const { user, login, logout } = useAuthContext();
 */
export const useAuthContext = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext doit être utilisé à l\'intérieur d\'un <AuthProvider>');
  }
  return context;
};
