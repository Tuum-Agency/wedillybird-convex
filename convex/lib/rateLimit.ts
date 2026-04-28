/**
 * Rate-limit générique basé sur un bucket DB par (scope, key). Pattern
 * "fixed window" simple : on stocke `count` + `windowStartedAt`, et au-delà
 * de `windowMs` on réinitialise.
 *
 * Volontairement simple (pas de sliding window) : pour le cas anti-abus
 * `searchPhotosByFace`, un fixed window de 60s avec cap 10 fait largement
 * le job. Si on veut plus précis ailleurs (par ex. login), on basculera
 * sur un sliding window basé sur les timestamps des hits.
 *
 * Pure : la logique de décision est extraite ici pour pouvoir être testée
 * sans environnement Convex. Le caller gère la lecture/écriture DB.
 */

export type RateLimitBucketState = {
  count: number;
  windowStartedAt: number;
};

export type RateLimitDecision =
  | { allow: true; nextState: RateLimitBucketState }
  | { allow: false; retryAfterMs: number };

/**
 * Décide si le bucket peut accepter un hit supplémentaire.
 *
 * @param state état actuel du bucket (ou null si aucun bucket n'existe encore)
 * @param now timestamp courant (Date.now() typiquement)
 * @param maxHits nombre max de hits par fenêtre
 * @param windowMs durée de la fenêtre en ms
 */
export function decideRateLimit(
  state: RateLimitBucketState | null,
  now: number,
  maxHits: number,
  windowMs: number,
): RateLimitDecision {
  if (!state || now - state.windowStartedAt >= windowMs) {
    // Nouvelle fenêtre : on commence à 1.
    return {
      allow: true as const,
      nextState: { count: 1, windowStartedAt: now },
    };
  }
  if (state.count >= maxHits) {
    const retryAfterMs = Math.max(0, windowMs - (now - state.windowStartedAt));
    return { allow: false as const, retryAfterMs };
  }
  return {
    allow: true as const,
    nextState: { count: state.count + 1, windowStartedAt: state.windowStartedAt },
  };
}

/** Constantes pour le scope `face_search`. Centralisées ici pour réutilisation. */
export const FACE_SEARCH_RATE_SCOPE = 'face_search' as const;
export const FACE_SEARCH_MAX_HITS = 10;
export const FACE_SEARCH_WINDOW_MS = 60 * 1000;
