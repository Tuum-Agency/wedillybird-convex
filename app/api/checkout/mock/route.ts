import { NextResponse } from 'next/server';
import { convexApi, getConvexServerClient } from '@/lib/auth/convex-server';

// Auto-success endpoint used by the mock driver in dev/E2E. The real
// drivers (stripe, cinetpay) redirect users to their own checkout pages.
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
    if (status === 'succeeded') {
      await convex.mutation(convexApi.markPaymentSucceeded, {
        provider: 'mock',
        providerSessionId: sessionId,
        providerEventId: `mock_evt_${sessionId}`,
      });
    } else {
      await convex.mutation(convexApi.markPaymentFailed, {
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
