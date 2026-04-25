import { NextResponse } from 'next/server';
import { convexApi, getConvexServerClient } from '@/lib/auth/convex-server';
import { getPaymentDriver } from '@/lib/payments';
import type { ProviderName } from '@/lib/payments/country';

function isProviderName(value: string): value is ProviderName {
  return value === 'stripe' || value === 'cinetpay' || value === 'mock';
}

function readSignatureHeader(headers: Headers, provider: ProviderName): string | null {
  if (provider === 'stripe') return headers.get('stripe-signature');
  if (provider === 'cinetpay') return headers.get('x-token') ?? headers.get('x-signature');
  return headers.get('x-signature');
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ provider: string }> },
): Promise<Response> {
  const { provider } = await ctx.params;
  if (!isProviderName(provider)) {
    return NextResponse.json({ error: 'UNKNOWN_PROVIDER' }, { status: 404 });
  }

  const rawBody = await req.text();
  const signature = readSignatureHeader(req.headers, provider);

  const driver = getPaymentDriver(provider);
  let event;
  try {
    event = await driver.verifyAndParseWebhook(rawBody, signature);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'UNKNOWN';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const convex = getConvexServerClient();
    if (event.status === 'succeeded') {
      const result = await convex.mutation(convexApi.markPaymentSucceeded, {
        provider,
        providerSessionId: event.providerSessionId,
        providerEventId: event.providerEventId,
      });
      return NextResponse.json({ ok: true, alreadyApplied: result.alreadyApplied });
    }
    const result = await convex.mutation(convexApi.markPaymentFailed, {
      provider,
      providerSessionId: event.providerSessionId,
      providerEventId: event.providerEventId,
      status: event.status,
      failureReason: event.failureReason,
    });
    return NextResponse.json({ ok: true, alreadyApplied: result.alreadyApplied });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'UNKNOWN';
    if (message === 'PAYMENT_NOT_FOUND') {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
