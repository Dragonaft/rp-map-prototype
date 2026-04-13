import React, { useState, useEffect, useCallback } from 'react';

export function useQuery<T>(apiCall: () => Promise<T>, initialData: T): {
  data: T;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<T>;
  setData: React.Dispatch<React.SetStateAction<T>>;
};
export function useQuery<T>(apiCall: () => Promise<T>): {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<T>;
  setData: React.Dispatch<React.SetStateAction<T | null>>;
};
export function useQuery<T>(apiCall: () => Promise<T>, initialData?: T) {
  const [data, setData] = useState<T | null>(initialData ?? null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    try {
      setLoading(true);
      const result = await apiCall();
      setData(result);
      setError(null);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('API Error:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [apiCall]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch, setData };
}

export function useMutation<TData, TVariables = void>(
  apiCall: (variables: TVariables) => Promise<TData>
) {
  const [data, setData] = useState<TData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutate = useCallback(async (variables: TVariables) => {
    try {
      setLoading(true);
      setError(null);
      const result = await apiCall(variables);
      setData(result);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      console.error('Mutation Error:', err);
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

  return { mutate, data, loading, error, reset };
}
