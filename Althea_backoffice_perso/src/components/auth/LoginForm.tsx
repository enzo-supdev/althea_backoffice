'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthContext } from '@/contexts/AuthContext';
import { isTwoFaRequiredResponse, type LoginRequest } from '@/lib/api/types';
import { TWO_FACTOR_PENDING_KEY, TWO_FACTOR_VERIFIED_AT_KEY } from '@/lib/security';

export const LoginForm = () => {
  const router = useRouter();
  const { login, completeTwoFaLogin, logout, error: authError, clearError } = useAuthContext();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [tempToken, setTempToken] = useState('');

  const requires2fa = Boolean(tempToken);

  const resetTwoFaState = () => {
    setTempToken('');
    setOtpCode('');
    localStorage.removeItem(TWO_FACTOR_PENDING_KEY);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    clearError();
    setLoading(true);

    try {
      const credentials: LoginRequest = { email, password };
      const response = await login(credentials);
      if (!response) return;

      if (isTwoFaRequiredResponse(response)) {
        // Le tempToken reste en mémoire (state React) uniquement,
        // jamais en localStorage / sessionStorage (expire en 5 min).
        localStorage.setItem(TWO_FACTOR_PENDING_KEY, 'true');
        localStorage.removeItem(TWO_FACTOR_VERIFIED_AT_KEY);
        setTempToken(response.tempToken);
        return;
      }

      if (response.user?.role !== 'admin') {
        logout();
        setError('Accès refusé: ce compte ne dispose pas des droits administrateur.');
        return;
      }

      localStorage.removeItem(TWO_FACTOR_PENDING_KEY);
      localStorage.setItem(TWO_FACTOR_VERIFIED_AT_KEY, new Date().toISOString());
      router.push('/dashboard');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur de connexion';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const displayError = error || authError;

  const handleValidate2fa = async () => {
    setLoading(true);
    setError('');

    try {
      const result = await completeTwoFaLogin(tempToken, otpCode.trim());

      if (result.user.role !== 'admin') {
        logout();
        resetTwoFaState();
        setError('Accès refusé: ce compte ne dispose pas des droits administrateur.');
        return;
      }

      localStorage.removeItem(TWO_FACTOR_PENDING_KEY);
      localStorage.setItem(TWO_FACTOR_VERIFIED_AT_KEY, new Date().toISOString());
      setTempToken('');
      setOtpCode('');
      router.push('/dashboard');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Verification 2FA impossible';
      const isExpired = /token|expir/i.test(message);
      setError(isExpired ? 'Session 2FA expirée, recommencez la connexion.' : message);
      if (isExpired) {
        resetTwoFaState();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCancel2fa = () => {
    resetTwoFaState();
    logout();
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md space-y-6">
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
          disabled={loading || requires2fa}
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
          required
          disabled={loading || requires2fa}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
          placeholder="••••••••"
        />
      </div>

      {displayError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {displayError}
        </div>
      )}

      {!requires2fa ? (
        <button
          type="submit"
          disabled={loading}
          className="w-full px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Connexion...' : 'Se connecter'}
        </button>
      ) : (
        <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
          <p className="text-sm font-medium text-gray-800">Verification 2FA requise</p>
          <p className="text-xs text-gray-500">
            Ouvrez votre application d&apos;authentification et saisissez le code à 6 chiffres.
          </p>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={otpCode}
            onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="Code a 6 chiffres"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleValidate2fa}
              disabled={loading || otpCode.trim().length !== 6}
              className="flex-1 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Verification...' : 'Valider le code'}
            </button>
            <button
              type="button"
              onClick={handleCancel2fa}
              className="px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-100 transition-colors"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      <p className="text-center text-sm text-gray-600">
        Accès réservé aux comptes administrateur.
      </p>
    </form>
  );
};
