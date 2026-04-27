import { NextResponse } from 'next/server';
import { convexApi, getConvexServerClient } from '@/lib/auth/convex-server';
import { getPaymentDriver } from '@/lib/payments';
import type { ProviderName } from '@/lib/payments/country';
import { verifyAndParseSubscriptionWebhook } from '@/lib/payments/drivers/stripe';

function isProviderName(value: string): value is ProviderName {
  // CinetPay désactivé : décommenter la clause `value === 'cinetpay'` quand les
  // credentials prod (CINETPAY_API_KEY + CINETPAY_SITE_ID) seront disponibles.
  return value === 'stripe' || /* value === 'cinetpay' || */ value === 'mock';
}

function readSignatureHeader(headers: Headers, provider: ProviderName): string | null {
  if (provider === 'stripe') return headers.get('stripe-signature');
  // CinetPay désactivé — header `x-token` ignoré tant que webhook non actif.
  // if (provider === 'cinetpay') return headers.get('x-token') ?? headers.get('x-signature');
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

  // Stripe-only: try parsing as a subscription/invoice event first; if it
  // matches, route to Convex organizations.* mutations and short-circuit.
  if (provider === 'stripe') {
    let subscriptionEvent;
    try {
      subscriptionEvent = await verifyAndParseSubscriptionWebhook(rawBody, signature);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'UNKNOWN';
      return NextResponse.json({ error: message }, { status: 400 });
    }

    if (subscriptionEvent) {
      try {
        const convex = getConvexServerClient();

        if (subscriptionEvent.kind === 'subscription.upserted') {
          await convex.mutation(convexApi.updateOrgSubscription, {
            organizationId: subscriptionEvent.organizationId,
            stripeCustomerId: subscriptionEvent.stripeCustomerId,
            stripeSubscriptionId: subscriptionEvent.stripeSubscriptionId,
            subscriptionTier: subscriptionEvent.tier,
            subscriptionStatus: subscriptionEvent.status,
            subscriptionPeriodEnd: subscriptionEvent.currentPeriodEnd,
          });
          return NextResponse.json({ ok: true, kind: 'subscription.upserted' });
        }

        if (subscriptionEvent.kind === 'subscription.deleted') {
          const org = await convex.query(convexApi.findOrgByStripeSubscription, {
            stripeSubscriptionId: subscriptionEvent.stripeSubscriptionId,
          });
          if (org) {
            await convex.mutation(convexApi.updateOrgSubscription, {
              organizationId: org._id,
              subscriptionStatus: 'canceled',
            });
          }
          return NextResponse.json({ ok: true, kind: 'subscription.deleted' });
        }

        if (subscriptionEvent.kind === 'payg.purchased') {
          await convex.mutation(convexApi.markPaygPurchase, {
            organizationId: subscriptionEvent.organizationId,
            requesterId: subscriptionEvent.requesterId,
            stripeSessionId: subscriptionEvent.stripeSessionId,
            amountMinor: subscriptionEvent.amountMinor,
            currency: subscriptionEvent.currency,
          });
          return NextResponse.json({ ok: true, kind: 'payg.purchased' });
        }

        // invoice.paid / invoice.payment_failed: schema unchanged here.
        // Pro-notification emails are queued by Convex via the org subscription
        // mutation flow when needed.
        return NextResponse.json({ ok: true, kind: subscriptionEvent.kind });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'UNKNOWN';
        return NextResponse.json({ error: message }, { status: 500 });
      }
    }
    // Not a subscription event — fall through to the one-shot payment driver.
  }

  const driver = getPaymentDriver(provider);
  let event;
  try {
    event = await driver.verifyAndParseWebhook(rawBody, signature);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'UNKNOWN';
    if (message === 'UNSUPPORTED_EVENT') {
      // Stripe events we don't handle yet (e.g. subscription_schedule.*) — ack 200.
      return NextResponse.json({ ok: true, ignored: true });
    }
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
