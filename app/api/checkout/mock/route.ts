import { NextResponse } from 'next/server';
import { convexApi, getConvexServerClient } from '@/lib/auth/convex-server';

// Auto-success endpoint used by the mock driver in dev/E2E. The real
// drivers (stripe, cinetpay) redirect users to their own checkout pages.
export async function GET(req: Request): Promise<Response> {
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
