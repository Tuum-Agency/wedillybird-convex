import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { convexApi, getConvexServerClient } from '@/lib/auth/convex-server';
import { PLANS, isCurrency, isPaidPlan, type Currency, type PlanTier } from '@/lib/payments/plans';
import { detectCountryFromHeaders, routePayment } from '@/lib/payments/country';
import { getPaymentDriver } from '@/lib/payments';

const bodySchema = z.object({
  eventId: z.string().min(1),
  plan: z.string().refine(isPaidPlan, { message: 'invalid_plan' }),
  currency: z.string().refine(isCurrency, { message: 'invalid_currency' }).optional(),
});

export async function POST(req: Request): Promise<Response> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  let parsed;
  try {
    parsed = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });
  }

  const plan = parsed.plan as PlanTier;
  const country = detectCountryFromHeaders(req.headers);
  const routing = routePayment(country, {
    currency: parsed.currency as Currency | undefined,
  });
  const amountMinor = PLANS[plan].prices[routing.currency];
  if (amountMinor <= 0) {
    return NextResponse.json({ error: 'INVALID_PLAN_PRICE' }, { status: 400 });
  }

  const origin = new URL(req.url).origin;
  const successUrl = `${origin}/events/${parsed.eventId}/upgrade/success`;
  const cancelUrl = `${origin}/events/${parsed.eventId}/upgrade/cancelled`;

  const driver = getPaymentDriver(routing.provider);
  let session_;
  try {
    session_ = await driver.createCheckout({
      provider: routing.provider,
      plan,
      currency: routing.currency,
      amountMinor,
      eventId: parsed.eventId,
      userId: session.userId,
      successUrl,
      cancelUrl,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'UNKNOWN';
    return NextResponse.json({ error: message }, { status: 502 });
  }

  try {
    const convex = getConvexServerClient();
    await convex.mutation(convexApi.recordPaymentIntent, {
      userId: session.userId,
      eventId: parsed.eventId,
      plan,
      currency: routing.currency,
      amountMinor,
      provider: driver.name,
      providerSessionId: session_.providerSessionId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'UNKNOWN';
    if (message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }
    return NextResponse.json({ error: 'PAYMENT_RECORD_FAILED' }, { status: 500 });
  }

  return NextResponse.json({
    redirectUrl: session_.redirectUrl,
    provider: driver.name,
    currency: routing.currency,
    amountMinor,
  });
}
