import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Health-check post-déploiement indépendant du money-path (T2-1). Deux
 * vérifications séparées : l'URL Convex (seulement contrainte en prod) et le
 * round-trip du secret webhook (query Convex, aucune écriture).
 */

const queryMock = vi.fn();

vi.mock('@/lib/auth/convex-server', () => ({
  getConvexServerClient: () => ({ query: queryMock }),
  convexApi: { verifyWebhookSecretHealth: 'health:verifyWebhookSecret' },
}));

afterEach(() => {
  queryMock.mockReset();
  vi.unstubAllEnvs();
  delete process.env.CONVEX_WEBHOOK_SECRET;
});

describe('GET /api/health/webhook-secret', () => {
  it('500 URL_MISMATCH en prod si NEXT_PUBLIC_CONVEX_URL ne pointe pas le déploiement prod attendu', async () => {
    vi.stubEnv('VERCEL_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_CONVEX_URL', 'https://capable-crocodile-720.convex.cloud');
    vi.stubEnv('CONVEX_WEBHOOK_SECRET', 'secret');

    const { GET } = await import('@/app/api/health/webhook-secret/route');
    const res = await GET();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toMatchObject({ ok: false, reason: 'URL_MISMATCH' });
    // Court-circuité avant tout appel Convex — la dérive d'URL est détectée
    // localement, pas besoin d'un aller-retour réseau pour la prouver.
    expect(queryMock).not.toHaveBeenCalled();
  });

  it("ne contraint PAS l'URL hors prod (preview/dev) — seul le secret compte", async () => {
    vi.stubEnv('VERCEL_ENV', 'preview');
    vi.stubEnv('NEXT_PUBLIC_CONVEX_URL', 'https://capable-crocodile-720.convex.cloud');
    vi.stubEnv('CONVEX_WEBHOOK_SECRET', 'secret');
    queryMock.mockResolvedValue({ ok: true });

    const { GET } = await import('@/app/api/health/webhook-secret/route');
    const res = await GET();
    expect(res.status).toBe(200);
  });

  it('500 SECRET_NOT_CONFIGURED si CONVEX_WEBHOOK_SECRET est absente côté Vercel', async () => {
    vi.stubEnv('VERCEL_ENV', 'preview');
    delete process.env.CONVEX_WEBHOOK_SECRET;

    const { GET } = await import('@/app/api/health/webhook-secret/route');
    const res = await GET();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toMatchObject({ ok: false, reason: 'SECRET_NOT_CONFIGURED' });
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('500 avec la raison Convex (ex. MISMATCH) si le round-trip du secret échoue', async () => {
    vi.stubEnv('VERCEL_ENV', 'preview');
    vi.stubEnv('CONVEX_WEBHOOK_SECRET', 'secret');
    queryMock.mockResolvedValue({ ok: false, reason: 'MISMATCH' });

    const { GET } = await import('@/app/api/health/webhook-secret/route');
    const res = await GET();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toMatchObject({ ok: false, reason: 'MISMATCH' });
  });

  it('500 CONVEX_UNREACHABLE si la query échoue (réseau, déploiement injoignable)', async () => {
    vi.stubEnv('VERCEL_ENV', 'preview');
    vi.stubEnv('CONVEX_WEBHOOK_SECRET', 'secret');
    queryMock.mockRejectedValue(new Error('NETWORK_ERROR'));

    const { GET } = await import('@/app/api/health/webhook-secret/route');
    const res = await GET();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toMatchObject({ ok: false, reason: 'CONVEX_UNREACHABLE' });
  });

  it('200 { ok: true } quand tout est aligné en prod', async () => {
    vi.stubEnv('VERCEL_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_CONVEX_URL', 'https://fearless-poodle-133.convex.cloud');
    vi.stubEnv('CONVEX_WEBHOOK_SECRET', 'secret');
    queryMock.mockResolvedValue({ ok: true });

    const { GET } = await import('@/app/api/health/webhook-secret/route');
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true, convexUrl: 'https://fearless-poodle-133.convex.cloud' });
    expect(queryMock).toHaveBeenCalledWith('health:verifyWebhookSecret', { secret: 'secret' });
  });
});
