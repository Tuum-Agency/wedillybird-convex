import { NextResponse } from 'next/server';
import { convexApi, getConvexServerClient } from '@/lib/auth/convex-server';
import { getPaymentDriver } from '@/lib/payments';
import type { ProviderName } from '@/lib/payments/country';
import {
  verifyAndParseSubscriptionWebhook,
  parseBudgetPaymentWebhook,
  parsePaymentLinkWebhook,
} from '@/lib/payments/drivers/stripe';

function isProviderName(value: string): value is ProviderName {
  return value === 'stripe' || value === 'mock';
}

function readSignatureHeader(headers: Headers, provider: ProviderName): string | null {
  if (provider === 'stripe') return headers.get('stripe-signature');
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

        // Secret partagé Vercel ⇄ Convex (fix sécurité F-01, audit avril
        // 2026). La mutation `organizations:updateSubscription` est passée
        // en internal — on ne peut plus la déclencher sans ce secret. Pas
        // de fallback silencieux : si l'env n'est pas configurée, on
        // refuse plutôt que de retomber dans l'IDOR.
        const webhookSecret = process.env.CONVEX_WEBHOOK_SECRET;
        if (!webhookSecret) {
          return NextResponse.json({ error: 'WEBHOOK_SECRET_NOT_CONFIGURED' }, { status: 500 });
        }

        if (subscriptionEvent.kind === 'subscription.upserted') {
          await convex.mutation(convexApi.updateOrgSubscriptionFromWebhook, {
            webhookSecret,
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
            await convex.mutation(convexApi.updateOrgSubscriptionFromWebhook, {
              webhookSecret,
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
    // Pas une souscription — paiement de budget (Wedillybird Pay) ?
    let budgetEvent;
    try {
      budgetEvent = await parseBudgetPaymentWebhook(rawBody, signature);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'UNKNOWN';
      return NextResponse.json({ error: message }, { status: 400 });
    }

    if (budgetEvent) {
      const webhookSecret = process.env.CONVEX_WEBHOOK_SECRET;
      if (!webhookSecret) {
        return NextResponse.json({ error: 'WEBHOOK_SECRET_NOT_CONFIGURED' }, { status: 500 });
      }
      try {
        const convex = getConvexServerClient();
        if (budgetEvent.status === 'succeeded') {
          const result = await convex.mutation(convexApi.markBudgetOnlinePaymentSucceeded, {
            webhookSecret,
            paymentId: budgetEvent.budgetPaymentId,
            providerSessionId: budgetEvent.providerSessionId,
            stripeConnectAccountId: budgetEvent.stripeAccountId ?? undefined,
            receiptUrl: budgetEvent.receiptUrl,
          });
          return NextResponse.json({
            ok: true,
            kind: 'budget_payment',
            alreadyApplied: result.alreadyApplied,
          });
        }
        const result = await convex.mutation(convexApi.markBudgetOnlinePaymentFailed, {
          webhookSecret,
          paymentId: budgetEvent.budgetPaymentId,
          providerSessionId: budgetEvent.providerSessionId,
        });
        return NextResponse.json({
          ok: true,
          kind: 'budget_payment',
          alreadyApplied: result.alreadyApplied,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'UNKNOWN';
        if (message === 'PAYMENT_NOT_FOUND') {
          return NextResponse.json({ error: message }, { status: 404 });
        }
        return NextResponse.json({ error: message }, { status: 500 });
      }
    }

    // Pas un budget — lien de paiement générique (facture / libre) ?
    let linkEvent;
    try {
      linkEvent = await parsePaymentLinkWebhook(rawBody, signature);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'UNKNOWN';
      return NextResponse.json({ error: message }, { status: 400 });
    }

    if (linkEvent) {
      const webhookSecret = process.env.CONVEX_WEBHOOK_SECRET;
      if (!webhookSecret) {
        return NextResponse.json({ error: 'WEBHOOK_SECRET_NOT_CONFIGURED' }, { status: 500 });
      }
      try {
        const convex = getConvexServerClient();
        if (linkEvent.status === 'succeeded') {
          const result = await convex.mutation(convexApi.markPaymentLinkSucceeded, {
            webhookSecret,
            paymentLinkId: linkEvent.paymentLinkId,
            providerSessionId: linkEvent.providerSessionId,
            stripeConnectAccountId: linkEvent.stripeAccountId ?? undefined,
            receiptUrl: linkEvent.receiptUrl,
          });
          return NextResponse.json({
            ok: true,
            kind: 'payment_link',
            alreadyApplied: result.alreadyApplied,
          });
        }
        const result = await convex.mutation(convexApi.markPaymentLinkFailed, {
          webhookSecret,
          paymentLinkId: linkEvent.paymentLinkId,
          providerSessionId: linkEvent.providerSessionId,
        });
        return NextResponse.json({
          ok: true,
          kind: 'payment_link',
          alreadyApplied: result.alreadyApplied,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'UNKNOWN';
        if (message === 'PAYMENT_NOT_FOUND') {
          return NextResponse.json({ error: message }, { status: 404 });
        }
        return NextResponse.json({ error: message }, { status: 500 });
      }
    }

    // Not a subscription/budget/payment-link event — fall through to the one-shot driver.
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
