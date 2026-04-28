import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { _checkFaceSearchRateLimit } from '../../../convex/photos';
import {
  FACE_SEARCH_MAX_HITS,
  FACE_SEARCH_RATE_SCOPE,
  FACE_SEARCH_WINDOW_MS,
} from '../../../convex/lib/rateLimit';

/**
 * Tests d'intégration du rate-limit de `searchPhotosByFace`.
 *
 * On invoque `_checkFaceSearchRateLimit._handler(ctx, args)` avec un ctx
 * mocké qui simule la table `rateLimitBuckets`. Vérifie l'allow/refus
 * + reset après expiration de la fenêtre, en couvrant l'intégration entre
 * la mutation Convex et la décision pure (`decideRateLimit`).
 *
 * Tests pure de la décision : `tests/unit/convex/rate-limit.test.ts`.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyMutation = { _handler: (ctx: any, args: any) => Promise<any> };
const checkRateLimitFn = _checkFaceSearchRateLimit as unknown as AnyMutation;

interface BucketRow {
  _id: string;
  scope: string;
  key: string;
  count: number;
  windowStartedAt: number;
  updatedAt: number;
}

function buildCtx() {
  const buckets = new Map<string, BucketRow>();
  let nextId = 1;

  const ctx = {
    db: {
      query: vi.fn((table: string) => {
        if (table !== 'rateLimitBuckets') {
          throw new Error(`Unexpected query on table=${table}`);
        }
        return {
          withIndex: (
            _indexName: string,
            filter: (q: {
              eq: (field: string, value: unknown) => { eq: (f: string, v: unknown) => unknown };
            }) => unknown,
          ) => {
            // On capture (scope, key) en faisant rouler le builder fluent. Le
            // helper `eq` retourne un objet stockant les paires field/value.
            const captured: Record<string, unknown> = {};
            const fluent = {
              eq: (field: string, value: unknown) => {
                captured[field] = value;
                return fluent;
              },
            };
            filter(fluent);
            const scope = captured.scope as string;
            const key = captured.key as string;

            return {
              first: async () => {
                const bucket = buckets.get(`${scope}:${key}`);
                return bucket ?? null;
              },
            };
          },
        };
      }),
      insert: vi.fn(
        async (
          _table: string,
          row: { scope: string; key: string; count: number; windowStartedAt: number },
        ) => {
          const id = `bucket_${nextId++}`;
          buckets.set(`${row.scope}:${row.key}`, { _id: id, ...row, updatedAt: Date.now() });
          return id;
        },
      ),
      patch: vi.fn(
        async (
          id: string,
          patch: { count?: number; windowStartedAt?: number; updatedAt?: number },
        ) => {
          for (const [k, v] of buckets.entries()) {
            if (v._id === id) {
              buckets.set(k, { ...v, ...patch });
              return;
            }
          }
          throw new Error(`Bucket not found: ${id}`);
        },
      ),
    },
  };

  return { ctx, buckets };
}

describe('_checkFaceSearchRateLimit — intégration mutation rate-limit', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-28T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('autorise les 10 premiers appels dans la même fenêtre, refuse le 11e', async () => {
    const { ctx, buckets } = buildCtx();
    const args = { key: 'user:user_42' };

    for (let i = 1; i <= FACE_SEARCH_MAX_HITS; i++) {
      const result = await checkRateLimitFn._handler(ctx, args);
      expect(result).toEqual({ allow: true });
    }

    // 11e appel dans la même fenêtre → refusé.
    const blocked = await checkRateLimitFn._handler(ctx, args);
    expect(blocked.allow).toBe(false);
    if (!blocked.allow) {
      expect(blocked.retryAfterMs).toBeGreaterThan(0);
      expect(blocked.retryAfterMs).toBeLessThanOrEqual(FACE_SEARCH_WINDOW_MS);
    }

    // Le bucket a bien été créé avec scope=face_search et count=10.
    const bucket = buckets.get(`${FACE_SEARCH_RATE_SCOPE}:user:user_42`);
    expect(bucket).toBeDefined();
    expect(bucket?.count).toBe(FACE_SEARCH_MAX_HITS);
  });

  it('reset le compteur quand la fenêtre de 60s expire', async () => {
    const { ctx } = buildCtx();
    const args = { key: 'guest:tok_abc' };

    // Sature la fenêtre.
    for (let i = 1; i <= FACE_SEARCH_MAX_HITS; i++) {
      await checkRateLimitFn._handler(ctx, args);
    }
    const blocked = await checkRateLimitFn._handler(ctx, args);
    expect(blocked.allow).toBe(false);

    // Avance le temps au-delà de la fenêtre (60s + 1ms).
    vi.advanceTimersByTime(FACE_SEARCH_WINDOW_MS + 1);

    // Le 1er appel après expiration est de nouveau autorisé.
    const afterReset = await checkRateLimitFn._handler(ctx, args);
    expect(afterReset).toEqual({ allow: true });

    // On peut à nouveau faire 9 appels avant d'être bloqué.
    for (let i = 2; i <= FACE_SEARCH_MAX_HITS; i++) {
      const r = await checkRateLimitFn._handler(ctx, args);
      expect(r.allow).toBe(true);
    }
    const blockedAgain = await checkRateLimitFn._handler(ctx, args);
    expect(blockedAgain.allow).toBe(false);
  });

  it('isole les buckets par clé : user_A et user_B ont des compteurs indépendants', async () => {
    const { ctx } = buildCtx();

    // user_A sature sa fenêtre.
    for (let i = 1; i <= FACE_SEARCH_MAX_HITS; i++) {
      await checkRateLimitFn._handler(ctx, { key: 'user:user_A' });
    }
    const blockedA = await checkRateLimitFn._handler(ctx, { key: 'user:user_A' });
    expect(blockedA.allow).toBe(false);

    // user_B est intouché : son 1er appel passe.
    const firstB = await checkRateLimitFn._handler(ctx, { key: 'user:user_B' });
    expect(firstB).toEqual({ allow: true });
  });

  it('isole guest tokens des userIds (différents préfixes de clé)', async () => {
    const { ctx } = buildCtx();

    for (let i = 1; i <= FACE_SEARCH_MAX_HITS; i++) {
      await checkRateLimitFn._handler(ctx, { key: 'user:user_X' });
    }
    const blockedUser = await checkRateLimitFn._handler(ctx, { key: 'user:user_X' });
    expect(blockedUser.allow).toBe(false);

    // Le guest token ne partage pas le bucket : il a son propre quota frais.
    const guest = await checkRateLimitFn._handler(ctx, { key: 'guest:user_X' });
    expect(guest).toEqual({ allow: true });
  });

  it('le 1er appel sans bucket existant crée le bucket et autorise', async () => {
    const { ctx, buckets } = buildCtx();
    expect(buckets.size).toBe(0);

    const result = await checkRateLimitFn._handler(ctx, { key: 'anonymous' });
    expect(result).toEqual({ allow: true });
    expect(buckets.size).toBe(1);

    const bucket = buckets.get(`${FACE_SEARCH_RATE_SCOPE}:anonymous`);
    expect(bucket).toBeDefined();
    expect(bucket?.count).toBe(1);
    expect(bucket?.scope).toBe(FACE_SEARCH_RATE_SCOPE);
  });
});
