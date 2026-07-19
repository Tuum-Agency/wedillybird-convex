import { NextResponse } from 'next/server';
import { convexApi, getConvexServerClient } from '@/lib/auth/convex-server';

// Auto-success endpoint used by the mock driver in dev/E2E. The real
// stripe driver redirects users to its own checkout page.
//
// **Fix sécurité F-10 (audit avril 2026)** : refuse explicitement les
// requêtes en `NODE_ENV === 'production'` — pattern miroir de
// `/api/dev/login`. Avant le fix, cette route pouvait permettre à un
// attaquant de marquer n'importe quel paiement `succeeded` en prod en
// devinant un sessionId.
export async function GET(req: Request): Promise<Response> {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'DISABLED_IN_PRODUCTION' }, { status: 403 });
  }

  const url = new URL(req.url);
  const sessionId = url.searchParams.get('session');
  const successUrl = url.searchParams.get('successUrl');
  const cancelUrl = url.searchParams.get('cancelUrl');

  if (!sessionId || !successUrl || !cancelUrl) {
    return NextResponse.json({ error: 'INVALID_PARAMS' }, { status: 400 });
  }

  const status = url.searchParams.get('result') === 'cancelled' ? 'cancelled' : 'succeeded';

  try {
    const convex = getConvexServerClient();
    // Route dev/E2E uniquement (refusée en prod plus haut). Le secret partagé
    // est requis depuis que `markSucceeded`/`markFailed` sont verrouillées.
    const webhookSecret = process.env.CONVEX_WEBHOOK_SECRET;
    if (!webhookSecret) {
      return NextResponse.json({ error: 'WEBHOOK_SECRET_NOT_CONFIGURED' }, { status: 500 });
    }
    if (status === 'succeeded') {
      await convex.mutation(convexApi.markPaymentSucceeded, {
        webhookSecret,
        provider: 'mock',
        providerSessionId: sessionId,
        providerEventId: `mock_evt_${sessionId}`,
      });
    } else {
      await convex.mutation(convexApi.markPaymentFailed, {
        webhookSecret,
        provider: 'mock',
        providerSessionId: sessionId,
        providerEventId: `mock_evt_${sessionId}`,
        status: 'cancelled',
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'UNKNOWN';
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.redirect(status === 'succeeded' ? successUrl : cancelUrl, 303);
}
