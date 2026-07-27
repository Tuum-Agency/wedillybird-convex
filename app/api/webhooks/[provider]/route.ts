import { NextResponse } from 'next/server';
import { convexApi, getConvexServerClient } from '@/lib/auth/convex-server';
import { captureServer, EVENTS } from '@/lib/analytics/posthog-server';
import { getPaymentDriver } from '@/lib/payments';
import type { ProviderName } from '@/lib/payments/country';
import {
  verifyAndParseSubscriptionWebhook,
  parseBudgetPaymentWebhook,
  parsePaymentLinkWebhook,
  retrieveCheckoutSessionPromotion,
  retrieveInvoicePromotion,
  type AppliedPromotion,
} from '@/lib/payments/drivers/stripe';
import type { Currency } from '@/lib/payments/plans';

function isProviderName(value: string): value is ProviderName {
  return value === 'stripe' || value === 'mock';
}

/**
 * Affiliation influenceurs — enregistre (best-effort) la commission d'une vente
 * attribuée à une influenceuse via son code promo. Volontairement TOLÉRANT aux
 * erreurs : l'attribution ne doit jamais faire échouer le webhook (la vente est
 * déjà encaissée/débloquée). La mutation Convex est idempotente par (source,
 * sourceId), donc un renvoi de webhook ne crée pas de doublon.
 */
async function recordAffiliateCommission(
  convex: ReturnType<typeof getConvexServerClient>,
  webhookSecret: string,
  input: {
    source: 'payment' | 'payg' | 'subscription';
    sourceId: string;
    saleAmountMinor: number;
    currency: Currency;
    promotion: AppliedPromotion | null;
    description?: string;
  },
): Promise<void> {
  // Pas de code promo appliqué → vente non attribuable, cas nominal.
  if (!input.promotion || (!input.promotion.couponId && !input.promotion.promotionCodeId)) {
    return;
  }
  try {
    await convex.mutation(convexApi.affiliateRecordCommissionFromSale, {
      webhookSecret,
      source: input.source,
      sourceId: input.sourceId,
      saleAmountMinor: input.saleAmountMinor,
      currency: input.currency,
      couponId: input.promotion.couponId ?? undefined,
      promotionCodeId: input.promotion.promotionCodeId ?? undefined,
      description: input.description,
    });
  } catch (err) {
    await captureServer({
      distinctId: 'system:affiliate',
      event: EVENTS.webhookProcessingFailed,
      properties: {
        provider: 'stripe',
        error: err instanceof Error ? err.message : 'UNKNOWN',
        stage: 'affiliate_commission',
        source: input.source,
      },
    });
  }
}

function readSignatureHeader(headers: Headers, provider: ProviderName): string | null {
  if (provider === 'stripe') return headers.get('stripe-signature');
  return headers.get('x-signature');
}

/**
 * Réponse d'erreur + alerte ops (T2-3, plan de lancement).
 *
 * `reconciliationFailed` (le filet best-effort de la success-page) était déjà
 * catché et affiché à l'utilisateur, mais jamais remonté ops ; ce webhook,
 * lui, ne remontait RIEN du tout sur un échec — silence total, exactement le
 * mode d'échec relevé au premortem (« rien ne surveille les coutures »).
 *
 * Chaque réponse non-2xx APRÈS identification du provider (le 404 « provider
 * inconnu » reste hors scope : bruit de bots sur une route au hasard, pas un
 * signal opérationnel) émet `webhook_processing_failed`. `captureServer`
 * n'échoue jamais (garde interne, cf. `lib/analytics/posthog-server.ts`) —
 * cette alerte ne peut pas casser la réponse HTTP renvoyée au provider.
 */
async function respondError(
  provider: ProviderName,
  status: number,
  error: string,
): Promise<Response> {
  await captureServer({
    distinctId: `system:webhook:${provider}`,
    event: EVENTS.webhookProcessingFailed,
    properties: { provider, status, error },
  });
  return NextResponse.json({ error }, { status });
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
      return respondError(provider, 400, message);
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
          return respondError(provider, 500, 'WEBHOOK_SECRET_NOT_CONFIGURED');
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
            webhookSecret,
            organizationId: subscriptionEvent.organizationId,
            requesterId: subscriptionEvent.requesterId,
            stripeSessionId: subscriptionEvent.stripeSessionId,
            amountMinor: subscriptionEvent.amountMinor,
            currency: subscriptionEvent.currency,
          });
          // Affiliation : PAYG one-shot via code promo influenceur.
          const promotion = await retrieveCheckoutSessionPromotion(
            subscriptionEvent.stripeSessionId,
          ).catch(() => null);
          await recordAffiliateCommission(convex, webhookSecret, {
            source: 'payg',
            sourceId: subscriptionEvent.stripeSessionId,
            saleAmountMinor: subscriptionEvent.amountMinor,
            currency: subscriptionEvent.currency,
            promotion,
            description: 'Pay-as-you-go pro',
          });
          return NextResponse.json({ ok: true, kind: 'payg.purchased' });
        }

        // Facture d'abonnement pro payée → commission récurrente si code promo
        // influenceur. `invoice.payment_failed` reste sans persistance ici.
        if (subscriptionEvent.kind === 'invoice.paid' && subscriptionEvent.invoiceId) {
          const promotion = await retrieveInvoicePromotion(subscriptionEvent.invoiceId).catch(
            () => null,
          );
          await recordAffiliateCommission(convex, webhookSecret, {
            source: 'subscription',
            sourceId: subscriptionEvent.invoiceId,
            saleAmountMinor: subscriptionEvent.amountMinor,
            currency: subscriptionEvent.currency,
            promotion,
            description: 'Abonnement pro',
          });
          return NextResponse.json({ ok: true, kind: 'invoice.paid' });
        }

        // invoice.payment_failed: schema unchanged here.
        // Pro-notification emails are queued by Convex via the org subscription
        // mutation flow when needed.
        return NextResponse.json({ ok: true, kind: subscriptionEvent.kind });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'UNKNOWN';
        return respondError(provider, 500, message);
      }
    }
    // Pas une souscription — paiement de budget (Wedillybird Pay) ?
    let budgetEvent;
    try {
      budgetEvent = await parseBudgetPaymentWebhook(rawBody, signature);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'UNKNOWN';
      return respondError(provider, 400, message);
    }

    if (budgetEvent) {
      const webhookSecret = process.env.CONVEX_WEBHOOK_SECRET;
      if (!webhookSecret) {
        return respondError(provider, 500, 'WEBHOOK_SECRET_NOT_CONFIGURED');
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
          return respondError(provider, 404, message);
        }
        return respondError(provider, 500, message);
      }
    }

    // Pas un budget — lien de paiement générique (facture / libre) ?
    let linkEvent;
    try {
      linkEvent = await parsePaymentLinkWebhook(rawBody, signature);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'UNKNOWN';
      return respondError(provider, 400, message);
    }

    if (linkEvent) {
      const webhookSecret = process.env.CONVEX_WEBHOOK_SECRET;
      if (!webhookSecret) {
        return respondError(provider, 500, 'WEBHOOK_SECRET_NOT_CONFIGURED');
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
          return respondError(provider, 404, message);
        }
        return respondError(provider, 500, message);
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
    return respondError(provider, 400, message);
  }

  try {
    const convex = getConvexServerClient();
    // Secret partagé Vercel ⇄ Convex : `markSucceeded`/`markFailed` débloquent
    // la galerie payante. Sans ce secret, un appel direct à `*.convex.cloud`
    // pouvait marquer un paiement encaissé sans jamais payer (forge F-01).
    const webhookSecret = process.env.CONVEX_WEBHOOK_SECRET;
    if (!webhookSecret) {
      return respondError(provider, 500, 'WEBHOOK_SECRET_NOT_CONFIGURED');
    }
    if (event.status === 'succeeded') {
      const result = await convex.mutation(convexApi.markPaymentSucceeded, {
        webhookSecret,
        provider,
        providerSessionId: event.providerSessionId,
        providerEventId: event.providerEventId,
      });

      // Analytics serveur : event de revenu `purchase_completed`. On ne le tire
      // QUE pour un paiement réellement confirmé pour la 1re fois — `alreadyApplied`
      // garde contre les renvois (retries) de webhook Stripe. On exclut `mock`
      // pour ne pas polluer l'analytics avec les paiements de test.
      if (provider === 'stripe' && !result.alreadyApplied) {
        const payment = await convex.query(convexApi.findPaymentBySession, {
          provider,
          providerSessionId: event.providerSessionId,
        });
        if (payment) {
          await captureServer({
            distinctId: payment.userId,
            event: EVENTS.purchaseCompleted,
            properties: {
              plan: payment.plan,
              currency: payment.currency,
              amount_minor: payment.amountMinor,
              revenue: payment.amountMinor / 100,
              event_id: payment.eventId,
              provider,
              $set: { plan_tier: payment.plan },
            },
          });

          // Affiliation : forfait couple one-shot (Essentiel/Premium/upsell)
          // acheté via un code promo influenceur.
          const promotion = await retrieveCheckoutSessionPromotion(event.providerSessionId).catch(
            () => null,
          );
          await recordAffiliateCommission(convex, webhookSecret, {
            source: 'payment',
            sourceId: payment._id,
            saleAmountMinor: payment.amountMinor,
            currency: payment.currency,
            promotion,
            description: `Forfait ${payment.plan}`,
          });
        }
      }

      return NextResponse.json({ ok: true, alreadyApplied: result.alreadyApplied });
    }
    const result = await convex.mutation(convexApi.markPaymentFailed, {
      webhookSecret,
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
      return respondError(provider, 404, message);
    }
    return respondError(provider, 500, message);
  }
}
