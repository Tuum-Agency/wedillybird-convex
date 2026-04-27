import { describe, expect, it } from 'vitest';
import {
  FACE_SEARCH_MAX_HITS,
  FACE_SEARCH_WINDOW_MS,
  decideRateLimit,
  type RateLimitBucketState,
} from '../../../convex/lib/rateLimit';

/**
 * Tests de la décision pure du rate-limiter générique. La logique d'IO
 * (read/write Convex DB) est triviale et juste un câblage autour de cette
 * fonction.
 */

describe('decideRateLimit — initialisation (pas de bucket existant)', () => {
  it('autorise le 1er appel et démarre le compteur à 1', () => {
    const decision = decideRateLimit(null, 1_000, 10, 60_000);
    expect(decision.allow).toBe(true);
    if (decision.allow) {
      expect(decision.nextState).toEqual({ count: 1, windowStartedAt: 1_000 });
    }
  });
});

describe('decideRateLimit — fenêtre courante', () => {
  it('autorise un hit dans la fenêtre tant que count < maxHits', () => {
    const state: RateLimitBucketState = { count: 5, windowStartedAt: 1_000 };
    const decision = decideRateLimit(state, 30_000, 10, 60_000);
    expect(decision.allow).toBe(true);
    if (decision.allow) {
      // windowStartedAt préservé : on est encore dans la même fenêtre.
      expect(decision.nextState).toEqual({ count: 6, windowStartedAt: 1_000 });
    }
  });

  it('rejette quand count atteint maxHits exactement', () => {
    const state: RateLimitBucketState = { count: 10, windowStartedAt: 1_000 };
    const decision = decideRateLimit(state, 30_000, 10, 60_000);
    expect(decision.allow).toBe(false);
    if (!decision.allow) {
      // Reste 30s avant reset : 60_000 - (30_000 - 1_000) = 31_000.
      expect(decision.retryAfterMs).toBe(31_000);
    }
  });

  it('rejette quand count dépasse maxHits (état corrompu en DB)', () => {
    const state: RateLimitBucketState = { count: 999, windowStartedAt: 1_000 };
    const decision = decideRateLimit(state, 1_500, 10, 60_000);
    expect(decision.allow).toBe(false);
  });
});

describe('decideRateLimit — reset après fenêtre expirée', () => {
  it('reset le compteur quand now - windowStartedAt >= windowMs', () => {
    const state: RateLimitBucketState = { count: 10, windowStartedAt: 1_000 };
    const decision = decideRateLimit(state, 70_000, 10, 60_000);
    expect(decision.allow).toBe(true);
    if (decision.allow) {
      expect(decision.nextState).toEqual({ count: 1, windowStartedAt: 70_000 });
    }
  });

  it('reset à exactement la limite (now - windowStartedAt == windowMs)', () => {
    const state: RateLimitBucketState = { count: 10, windowStartedAt: 1_000 };
    const decision = decideRateLimit(state, 61_000, 10, 60_000);
    expect(decision.allow).toBe(true);
  });

  it('garde la fenêtre quand now - windowStartedAt < windowMs', () => {
    const state: RateLimitBucketState = { count: 9, windowStartedAt: 1_000 };
    const decision = decideRateLimit(state, 60_999, 10, 60_000);
    expect(decision.allow).toBe(true);
    if (decision.allow) {
      expect(decision.nextState).toEqual({ count: 10, windowStartedAt: 1_000 });
    }
  });
});

describe('decideRateLimit — face search constants', () => {
  it('FACE_SEARCH_MAX_HITS = 10', () => {
    expect(FACE_SEARCH_MAX_HITS).toBe(10);
  });

  it('FACE_SEARCH_WINDOW_MS = 60s', () => {
    expect(FACE_SEARCH_WINDOW_MS).toBe(60_000);
  });

  it('un caller peut faire 10 appels dans la même fenêtre, puis est bloqué', () => {
    let state: RateLimitBucketState | null = null;
    const now = 1_000;
    for (let i = 1; i <= FACE_SEARCH_MAX_HITS; i++) {
      const decision = decideRateLimit(state, now, FACE_SEARCH_MAX_HITS, FACE_SEARCH_WINDOW_MS);
      expect(decision.allow).toBe(true);
      if (decision.allow) {
        expect(decision.nextState.count).toBe(i);
        state = decision.nextState;
      }
    }
    // Le 11e dans la même fenêtre est bloqué.
    const blocked = decideRateLimit(state, now, FACE_SEARCH_MAX_HITS, FACE_SEARCH_WINDOW_MS);
    expect(blocked.allow).toBe(false);
  });

  it('après reset de la fenêtre, le compteur repart à 1', () => {
    const state: RateLimitBucketState = { count: 10, windowStartedAt: 1_000 };
    const after = decideRateLimit(state, 1_000 + FACE_SEARCH_WINDOW_MS, 10, FACE_SEARCH_WINDOW_MS);
    expect(after.allow).toBe(true);
    if (after.allow) {
      expect(after.nextState.count).toBe(1);
    }
  });
});
