'use client';

import React, { createContext, useContext, ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import type {
  AuthResponse,
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  User,
} from '@/lib/api/types';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
  login: (data: LoginRequest) => Promise<LoginResponse | undefined>;
  completeTwoFaLogin: (tempToken: string, code: string) => Promise<AuthResponse>;
  register: (data: RegisterRequest) => Promise<AuthResponse | undefined>;
  logout: () => void;
  clearError: () => void;
  updateUser: (updater: (prev: User) => User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const auth = useAuth();

  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
};

export const useAuthContext = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext doit être utilisé à l\'intérieur d\'un <AuthProvider>');
  }
  return context;
};
