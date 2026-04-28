import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Fix sécurité F-10 (audit avril 2026) — `/api/checkout/mock` doit refuser
 * `NODE_ENV === 'production'` avec un 403, miroir de `/api/dev/login`.
 * Sans ce garde-fou, un attaquant pouvait marquer n'importe quel paiement
 * `succeeded` en prod en devinant un sessionId.
 */

const mutationMock = vi.fn();

vi.mock('@/lib/auth/convex-server', () => ({
  getConvexServerClient: () => ({ mutation: mutationMock }),
  convexApi: {
    markPaymentSucceeded: 'payments:markSucceeded',
    markPaymentFailed: 'payments:markFailed',
  },
}));

const originalNodeEnv = process.env.NODE_ENV;

afterEach(() => {
  vi.stubEnv('NODE_ENV', originalNodeEnv ?? 'test');
  mutationMock.mockReset();
});

describe('GET /api/checkout/mock — F-10 prod block', () => {
  it('retourne 403 quand NODE_ENV === "production"', async () => {
    vi.stubEnv('NODE_ENV', 'production');

    const { GET } = await import('@/app/api/checkout/mock/route');
    const res = await GET(
      new Request(
        'http://localhost/api/checkout/mock?session=foo&successUrl=http://x&cancelUrl=http://y',
      ),
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body).toEqual({ error: 'DISABLED_IN_PRODUCTION' });
    // Le client Convex n'a JAMAIS été appelé : on a court-circuité avant.
    expect(mutationMock).not.toHaveBeenCalled();
  });

  it('autorise NODE_ENV !== "production" (route fonctionnelle en dev/test)', async () => {
    vi.stubEnv('NODE_ENV', 'test');

    const { GET } = await import('@/app/api/checkout/mock/route');
    // Pas de params → 400, ce qui prouve qu'on a passé le check NODE_ENV.
    const res = await GET(new Request('http://localhost/api/checkout/mock'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({ error: 'INVALID_PARAMS' });
  });
});
