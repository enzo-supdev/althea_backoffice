'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { AxiosError } from 'axios';

/**
 * Hook custom pour les appels API
 * Gère : loading, error, data, retry
 * 
 * Usage:
 * const { data, loading, error, execute } = useApi(
 *   () => productsApi.list({ page: 1 })
 * );
 */

interface UseApiState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

interface UseApiReturn<T> extends UseApiState<T> {
  execute: (deps?: unknown[]) => Promise<T | null>;
  retry: () => Promise<T | null>;
  reset: () => void;
}

export function useApi<T>(
  fn: () => Promise<T>,
  autoExecute: boolean = false
): UseApiReturn<T> {
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    loading: false,
    error: null,
  });

  const fnRef = useRef(fn);
  fnRef.current = fn;

  const execute = useCallback(async () => {
    setState({ data: null, loading: true, error: null });
    try {
      const result = await fnRef.current();
      setState({ data: result, loading: false, error: null });
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setState({
        data: null,
        loading: false,
        error,
      });
      return null;
    }
  }, []);

  const retry = useCallback(execute, [execute]);

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null });
  }, []);

  // Auto-execute on mount
  useEffect(() => {
    if (autoExecute) {
      execute();
    }
  }, [autoExecute, execute]);

  return {
    ...state,
    execute,
    retry,
    reset,
  };
}

/**
 * Hook pour les formulaires (mutation)
 * Gère : pending, error, success, submit
 * 
 * Usage:
 * const { pending, error, success, submit } = useMutation(
 *   (data) => authApi.register(data)
 * );
 */

interface UseMutationState {
  pending: boolean;
  error: Error | null;
  success: boolean;
}

interface UseMutationReturn<TData, TResponse> extends UseMutationState {
  submit: (data: TData) => Promise<TResponse | null>;
  reset: () => void;
}

export function useMutation<TData, TResponse>(
  fn: (data: TData) => Promise<TResponse>
): UseMutationReturn<TData, TResponse> {
  const [state, setState] = useState<UseMutationState>({
    pending: false,
    error: null,
    success: false,
  });

  const fnRef = useRef(fn);
  fnRef.current = fn;

  const submit = useCallback(async (data: TData) => {
    setState({ pending: true, error: null, success: false });
    try {
      const result = await fnRef.current(data);
      setState({ pending: false, error: null, success: true });
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setState({
        pending: false,
        error,
        success: false,
      });
      return null;
    }
  }, []);

  const reset = useCallback(() => {
    setState({ pending: false, error: null, success: false });
  }, []);

  return {
    ...state,
    submit,
    reset,
  };
}

/**
 * Hook pour les appels API avec pagination
 * 
 * Usage:
 * const { data, loading, error, page, setPage, hasMore } = usePaginatedApi(
 *   (page) => productsApi.list({ page, limit: 20 })
 * );
 */

interface UsePaginatedApiState<T> {
  data: T[];
  loading: boolean;
  error: Error | null;
  page: number;
  totalPages: number;
  hasMore: boolean;
}

interface UsePaginatedApiReturn<T> extends UsePaginatedApiState<T> {
  setPage: (page: number) => void;
  loadMore: () => void;
  retry: () => void;
}

export function usePaginatedApi<T>(
  fn: (page: number) => Promise<{ data: T[]; meta: { totalPages: number } }>
): UsePaginatedApiReturn<T> {
  const [state, setState] = useState<UsePaginatedApiState<T>>({
    data: [],
    loading: false,
    error: null,
    page: 1,
    totalPages: 0,
    hasMore: true,
  });

  const fnRef = useRef(fn);
  fnRef.current = fn;

  const fetch = useCallback(async (page: number) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const result = await fnRef.current(page);
      setState((prev) => ({
        ...prev,
        data: result.data,
        page,
        totalPages: result.meta.totalPages,
        hasMore: page < result.meta.totalPages,
        loading: false,
      }));
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setState((prev) => ({
        ...prev,
        error,
        loading: false,
      }));
    }
  }, []);

  const setPage = useCallback(
    (page: number) => {
      fetch(page);
    },
    [fetch]
  );

  const loadMore = useCallback(() => {
    setState((prev) => {
      const nextPage = prev.page + 1;
      fetch(nextPage);
      return prev;
    });
  }, [fetch]);

  const retry = useCallback(() => {
    fetch(state.page);
  }, [state.page, fetch]);

  // Auto-fetch on mount
  useEffect(() => {
    fetch(1);
  }, [fetch]);

  return {
    ...state,
    setPage,
    loadMore,
    retry,
  };
}
