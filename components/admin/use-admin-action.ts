'use client';

import { useState, useCallback, useTransition } from 'react';

export function useServerAction<
  T extends (...args: never[]) => Promise<{ ok?: boolean; error?: string } | undefined>,
>(action: T) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(
    (...args: Parameters<T>) => {
      setError(null);
      startTransition(async () => {
        const result = await action(...args);
        if (result && !result.ok) {
          setError(result.error ?? 'Erreur inconnue');
        }
      });
    },
    [action],
  );

  return { execute, loading: isPending, error };
}
