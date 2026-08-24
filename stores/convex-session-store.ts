'use client';

import { useEffect } from 'react';
import { create } from 'zustand';

/**
 * Jeton de session Convex côté navigateur.
 *
 * Les composants clients qui appellent Convex en direct doivent passer un
 * `sessionToken` : depuis l'audit archi 2026-08-23, Convex ne déduit plus
 * l'appelant d'un `userId` passé en argument (n'importe qui pouvait envoyer
 * celui d'autrui). Le jeton est récupéré via `/api/auth/convex-token`, qui
 * l'échange contre le cookie httpOnly.
 *
 * **En mémoire uniquement** — jamais localStorage/sessionStorage : ce jeton
 * porte une identité, le persister élargirait la fenêtre d'un vol par XSS.
 * Il est ré-obtenu à chaque chargement de page (et rafraîchi avant le TTL
 * Convex d'1 h).
 */

/** Marge de sécurité : on rafraîchit avant l'expiration côté Convex (1 h). */
const REFRESH_INTERVAL_MS = 45 * 60 * 1000;

interface ConvexSessionState {
  sessionToken: string | null;
  status: 'idle' | 'loading' | 'ready' | 'anonymous';
  fetchedAt: number;
  /** Récupère le jeton si absent ou périmé. Idempotent, dédoublonne les appels. */
  ensure: () => Promise<void>;
  clear: () => void;
}

let inFlight: Promise<void> | null = null;

export const useConvexSessionStore = create<ConvexSessionState>()((set, get) => ({
  sessionToken: null,
  status: 'idle',
  fetchedAt: 0,

  ensure: async () => {
    const { status, fetchedAt } = get();
    const fresh = Date.now() - fetchedAt < REFRESH_INTERVAL_MS;
    if (status === 'ready' && fresh) return;
    // Un seul appel réseau même si plusieurs composants montent en même temps.
    if (inFlight) return inFlight;

    set({ status: 'loading' });
    inFlight = (async () => {
      try {
        const res = await fetch('/api/auth/convex-token', {
          credentials: 'same-origin',
          cache: 'no-store',
        });
        if (!res.ok) {
          set({ sessionToken: null, status: 'anonymous', fetchedAt: Date.now() });
          return;
        }
        const data = (await res.json()) as { sessionToken?: unknown };
        if (typeof data.sessionToken !== 'string' || data.sessionToken.length === 0) {
          set({ sessionToken: null, status: 'anonymous', fetchedAt: Date.now() });
          return;
        }
        set({ sessionToken: data.sessionToken, status: 'ready', fetchedAt: Date.now() });
      } catch {
        // Réseau indisponible : on reste anonyme, les écrans afficheront leur
        // état de chargement/erreur habituel plutôt que de crasher.
        set({ sessionToken: null, status: 'anonymous', fetchedAt: Date.now() });
      } finally {
        inFlight = null;
      }
    })();
    return inFlight;
  },

  clear: () => set({ sessionToken: null, status: 'idle', fetchedAt: 0 }),
}));

/**
 * Jeton de session Convex pour un composant client.
 *
 * Renvoie `undefined` tant que le jeton n'est pas connu — valeur à passer à
 * `useQuery(..., token ? { sessionToken: token, ... } : 'skip')` pour ne pas
 * lancer de requête non authentifiée.
 */
export function useConvexSessionToken(): string | undefined {
  const sessionToken = useConvexSessionStore((s) => s.sessionToken);
  const ensure = useConvexSessionStore((s) => s.ensure);

  useEffect(() => {
    void ensure();
    const timer = setInterval(() => void ensure(), REFRESH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [ensure]);

  return sessionToken ?? undefined;
}
