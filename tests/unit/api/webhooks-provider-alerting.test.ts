import { afterEach, describe, expect, it, vi } from 'vitest';
import { EVENTS } from '@/lib/analytics/events';

/**
 * T2-3 : chaque réponse non-2xx du webhook de paiement (une fois le provider
 * identifié) doit émettre `webhook_processing_failed` — silence total avant
 * ce lot (le premortem : « rien ne surveille les coutures »). Le 404
 * « provider inconnu » reste volontairement hors scope (bruit de bots).
 *
 * On exerce ces chemins via le driver `mock` (provider='mock') : il
 * court-circuite tout le bloc Stripe-only (abonnements/budget/liens), donc ce
 * test n'a besoin de mocker que `getPaymentDriver` + le bridge Convex —
 * pas les parseurs webhook Stripe.
 */

const mutationMock = vi.fn();
const queryMock = vi.fn();
const verifyAndParseWebhookMock = vi.fn();
const captureServerMock = vi.fn();

vi.mock('@/lib/auth/convex-server', () => ({
  getConvexServerClient: () => ({ mutation: mutationMock, query: queryMock }),
  convexApi: {
    markPaymentSucceeded: 'payments:markSucceeded',
    markPaymentFailed: 'payments:markFailed',
    findPaymentBySession: 'payments:findBySession',
  },
}));

vi.mock('@/lib/payments', () => ({
  getPaymentDriver: () => ({
    name: 'mock',
    verifyAndParseWebhook: verifyAndParseWebhookMock,
    retrieveSessionStatus: vi.fn(),
    createCheckout: vi.fn(),
  }),
}));

// PAS d'`importOriginal()` : `posthog-server.ts` importe `server-only`, dont
// la résolution échoue sous jsdom. `EVENTS` vient du module pur (sans
// `server-only`) pour ne pas dupliquer les noms d'events à la main.
vi.mock('@/lib/analytics/posthog-server', () => ({
  captureServer: captureServerMock,
  EVENTS,
}));

afterEach(() => {
  mutationMock.mockReset();
  queryMock.mockReset();
  verifyAndParseWebhookMock.mockReset();
  captureServerMock.mockReset();
  vi.unstubAllEnvs();
  delete process.env.CONVEX_WEBHOOK_SECRET;
});

function postTo(provider: string, body = '{}'): Promise<Response> {
  return Promise.resolve().then(async () => {
    const { POST } = await import('@/app/api/webhooks/[provider]/route');
    return POST(
      new Request('http://localhost/api/webhooks/' + provider, { method: 'POST', body }),
      {
        params: Promise.resolve({ provider }),
      },
    );
  });
}

describe('POST /api/webhooks/[provider] — alerting T2-3', () => {
  it("404 provider inconnu : PAS d'alerte (bruit de bots, hors scope volontaire)", async () => {
    const res = await postTo('paypal');
    expect(res.status).toBe(404);
    expect(captureServerMock).not.toHaveBeenCalled();
  });

  it('400 signature/parse invalide : alerte webhook_processing_failed', async () => {
    vi.stubEnv('CONVEX_WEBHOOK_SECRET', 'secret');
    verifyAndParseWebhookMock.mockRejectedValue(new Error('INVALID_SIGNATURE'));

    const res = await postTo('mock');
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({ error: 'INVALID_SIGNATURE' });
    expect(captureServerMock).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'webhook_processing_failed',
        properties: expect.objectContaining({ provider: 'mock', status: 400 }),
      }),
    );
  });

  it("UNSUPPORTED_EVENT reste un ack 200 — PAS une erreur, PAS d'alerte", async () => {
    verifyAndParseWebhookMock.mockRejectedValue(new Error('UNSUPPORTED_EVENT'));

    const res = await postTo('mock');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true, ignored: true });
    expect(captureServerMock).not.toHaveBeenCalled();
  });

  it('500 WEBHOOK_SECRET_NOT_CONFIGURED : alerte + court-circuite avant toute mutation', async () => {
    delete process.env.CONVEX_WEBHOOK_SECRET;
    verifyAndParseWebhookMock.mockResolvedValue({
      providerSessionId: 'sess_1',
      providerEventId: 'evt_1',
      status: 'succeeded',
      amountMinor: 2900,
      currency: 'EUR',
    });

    const res = await postTo('mock');
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ error: 'WEBHOOK_SECRET_NOT_CONFIGURED' });
    expect(mutationMock).not.toHaveBeenCalled();
    expect(captureServerMock).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'webhook_processing_failed',
        properties: expect.objectContaining({
          status: 500,
          error: 'WEBHOOK_SECRET_NOT_CONFIGURED',
        }),
      }),
    );
  });

  it('404 PAYMENT_NOT_FOUND depuis la mutation : alerte avec le bon statut', async () => {
    vi.stubEnv('CONVEX_WEBHOOK_SECRET', 'secret');
    verifyAndParseWebhookMock.mockResolvedValue({
      providerSessionId: 'sess_1',
      providerEventId: 'evt_1',
      status: 'succeeded',
      amountMinor: 2900,
      currency: 'EUR',
    });
    mutationMock.mockRejectedValue(new Error('PAYMENT_NOT_FOUND'));

    const res = await postTo('mock');
    expect(res.status).toBe(404);
    expect(captureServerMock).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'webhook_processing_failed',
        properties: expect.objectContaining({ status: 404, error: 'PAYMENT_NOT_FOUND' }),
      }),
    );
  });

  it('200 chemin heureux (provider mock) : AUCUNE alerte, sémantique de succès inchangée', async () => {
    vi.stubEnv('CONVEX_WEBHOOK_SECRET', 'secret');
    verifyAndParseWebhookMock.mockResolvedValue({
      providerSessionId: 'sess_1',
      providerEventId: 'evt_1',
      status: 'succeeded',
      amountMinor: 2900,
      currency: 'EUR',
    });
    mutationMock.mockResolvedValue({ ok: true, alreadyApplied: false });

    const res = await postTo('mock');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true, alreadyApplied: false });
    // provider === 'mock' → jamais de capture purchase_completed (exclusion
    // déjà existante, préservée) ; et un succès ne doit jamais alerter.
    expect(captureServerMock).not.toHaveBeenCalled();
    expect(queryMock).not.toHaveBeenCalled();
  });
});
