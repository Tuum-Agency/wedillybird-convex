import { afterEach, describe, expect, it, vi } from 'vitest';
import { EVENTS } from '@/lib/analytics/events';

/**
 * Audit hebdo entitlement-sans-paiement (T2-8). Route lecture seule : ne
 * mute jamais rien côté Convex, se contente de relayer le scan en alerte
 * PostHog quand des offenders existent.
 */

const queryMock = vi.fn();
const captureServerMock = vi.fn();

vi.mock('@/lib/auth/convex-server', () => ({
  getConvexServerClient: () => ({ query: queryMock }),
  convexApi: {
    scanOrphanedEntitlements: 'payments:scanOrphanedEntitlements',
  },
}));

// PAS d'`importOriginal()` ici : `posthog-server.ts` importe le marker
// `server-only`, dont la résolution échoue sous l'environnement de test
// jsdom. On remplace intégralement le module ; `EVENTS` vient du module SANS
// `server-only` (`lib/analytics/events.ts`, pur) pour ne pas dupliquer les
// noms d'events à la main (risque de dérive).
vi.mock('@/lib/analytics/posthog-server', () => ({
  captureServer: captureServerMock,
  EVENTS,
}));

afterEach(() => {
  queryMock.mockReset();
  captureServerMock.mockReset();
  vi.unstubAllEnvs();
  delete process.env.CRON_SECRET;
  delete process.env.CONVEX_WEBHOOK_SECRET;
});

function makeRequest(bearerSecret?: string): Request {
  return new Request('http://localhost/api/cron/entitlement-audit', {
    headers: bearerSecret ? { authorization: `Bearer ${bearerSecret}` } : {},
  });
}

describe('GET /api/cron/entitlement-audit', () => {
  it('401 sans CRON_SECRET valide', async () => {
    vi.stubEnv('CRON_SECRET', 'right-secret');
    const { GET } = await import('@/app/api/cron/entitlement-audit/route');
    const res = await GET(makeRequest('wrong'));
    expect(res.status).toBe(401);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it("n'émet AUCUNE alerte quand le scan ne trouve aucun offender", async () => {
    vi.stubEnv('CRON_SECRET', 'right-secret');
    vi.stubEnv('CONVEX_WEBHOOK_SECRET', 'webhook-secret');
    queryMock.mockResolvedValue({ scanned: 12, offenders: [] });

    const { GET } = await import('@/app/api/cron/entitlement-audit/route');
    const res = await GET(makeRequest('right-secret'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true, scanned: 12, offendersCount: 0 });
    expect(captureServerMock).not.toHaveBeenCalled();
  });

  it('émet UNE alerte récapitulative quand des events planTier-sans-paiement existent', async () => {
    vi.stubEnv('CRON_SECRET', 'right-secret');
    vi.stubEnv('CONVEX_WEBHOOK_SECRET', 'webhook-secret');
    queryMock.mockResolvedValue({
      scanned: 12,
      offenders: [
        { eventId: 'ev_1', planTier: 'essential' },
        { eventId: 'ev_2', planTier: 'premium' },
      ],
    });

    const { GET } = await import('@/app/api/cron/entitlement-audit/route');
    const res = await GET(makeRequest('right-secret'));
    const body = await res.json();
    expect(body).toEqual({ ok: true, scanned: 12, offendersCount: 2 });

    expect(captureServerMock).toHaveBeenCalledTimes(1);
    expect(captureServerMock).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'entitlement_without_payment',
        properties: expect.objectContaining({ count: 2, event_ids: ['ev_1', 'ev_2'] }),
      }),
    );
  });

  it('alerte webhook_processing_failed si la query Convex jette, sans planter la route', async () => {
    vi.stubEnv('CRON_SECRET', 'right-secret');
    vi.stubEnv('CONVEX_WEBHOOK_SECRET', 'webhook-secret');
    queryMock.mockRejectedValue(new Error('CONVEX_DOWN'));

    const { GET } = await import('@/app/api/cron/entitlement-audit/route');
    const res = await GET(makeRequest('right-secret'));
    expect(res.status).toBe(500);
    expect(captureServerMock).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'webhook_processing_failed' }),
    );
  });
});
