'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import axios from 'axios';
import { useAuthContext } from '@/contexts/AuthContext';
import type { RegisterRequest } from '@/lib/api/types';

export const RegisterForm = () => {
  const router = useRouter();
  const { register, logout, error: authError, clearError } = useAuthContext();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const passwordRule = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,100}$/;

  const getApiErrorMessage = (err: unknown): string => {
    if (axios.isAxiosError(err)) {
      const responseData = err.response?.data as
        | { message?: string; errors?: Record<string, string[] | string> }
        | undefined;

      const apiMessage = responseData?.message;
      if (apiMessage) {
        return apiMessage;
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
    }

    return err instanceof Error ? err.message : "Erreur d'inscription";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    clearError();

    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }

    if (!passwordRule.test(password)) {
      setError(
        'Le mot de passe doit contenir 8 a 100 caracteres, avec au moins une minuscule, une majuscule et un chiffre.'
      );
      return;
    }

    setLoading(true);

    try {
      const payload: RegisterRequest = {
        firstName,
        lastName,
        email,
        password,
      };

      const response = await register(payload);

      if (response?.user?.role !== 'admin') {
        logout();
        setError('Compte créé, mais accès refusé: seul un compte administrateur peut accéder au backoffice.');
        return;
      }

      router.push('/dashboard');
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const displayError = error || authError;

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label htmlFor="firstName" className="block text-sm font-medium text-gray-700">
            Prénom
          </label>
          <input
            id="firstName"
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
            disabled={loading}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
            placeholder="Jean"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="lastName" className="block text-sm font-medium text-gray-700">
            Nom
          </label>
          <input
            id="lastName"
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
            disabled={loading}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
            placeholder="Dupont"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="email" className="block text-sm font-medium text-gray-700">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={loading}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
          placeholder="vous@example.com"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="password" className="block text-sm font-medium text-gray-700">
          Mot de passe
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={8}
          maxLength={100}
          required
          disabled={loading}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
          placeholder="••••••••"
        />
        <p className="text-xs text-gray-500">
          8 a 100 caracteres, avec minuscule, majuscule et chiffre.
        </p>
      </div>

      <div className="space-y-2">
        <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
          Confirmer le mot de passe
        </label>
        <input
          id="confirmPassword"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          disabled={loading}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
          placeholder="••••••••"
        />
      </div>

      {displayError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {displayError}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? 'Inscription...' : "Créer mon compte"}
      </button>

      <p className="text-center text-sm text-gray-600">
        Déjà un compte ?{' '}
        <Link href="/login" className="text-blue-600 hover:underline font-medium">
          Se connecter
        </Link>
      </p>
    </form>
  );
};
