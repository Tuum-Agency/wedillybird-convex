import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { assertSameOrigin } from '@/lib/auth/csrf';
import { convexApi, getConvexServerClient } from '@/lib/auth/convex-server';
import { PLANS } from '@/lib/payments/plans';
import { detectCountryFromHeaders, routePayment } from '@/lib/payments/country';
import { getPaymentDriver } from '@/lib/payments';
import { createOneTimeAmountCoupon } from '@/lib/payments/drivers/stripe';
import { captureServer, EVENTS } from '@/lib/analytics/posthog-server';

const bodySchema = z.object({
  eventId: z.string().min(1),
  plan: z.enum(['essential', 'premium']),
  currency: z.enum(['EUR', 'USD', 'MAD']).optional(),
});

export async function POST(req: Request): Promise<Response> {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
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

  const plan = parsed.plan;
  const country = detectCountryFromHeaders(req.headers);
  const routing = routePayment(country, {
    currency: parsed.currency,
  });
  const amountMinor = PLANS[plan].prices[routing.currency];
  if (amountMinor <= 0) {
    return NextResponse.json({ error: 'INVALID_PLAN_PRICE' }, { status: 400 });
  }

  const origin = new URL(req.url).origin;
  const successUrl = `${origin}/events/${parsed.eventId}/upgrade/success`;
  const cancelUrl = `${origin}/events/${parsed.eventId}/upgrade/cancelled`;

  // Attribution affiliation : le proxy pose le cookie `wdb_ref` sur `?ref=CODE`.
  // On le résout en id d'affilié — best-effort strict : ne jamais bloquer le
  // checkout si la résolution échoue ou si le code est inconnu/inactif.
  let affiliateId: string | undefined;
  const refCode = (await cookies()).get('wdb_ref')?.value;
  if (refCode) {
    try {
      const aff = await getConvexServerClient().query(convexApi.getAffiliateByCode, {
        code: refCode,
      });
      if (aff) affiliateId = aff.id;
    } catch {
      // best-effort — l'attribution ne bloque jamais l'achat.
    }
  }

  // Crédit de parrainage : on RÉSERVE le crédit AVANT de créer le coupon — le
  // montant réservé == le montant du coupon (jamais de sur-remise ni de crédit
  // gratuit). `reservationId` (token) est porté par la session (metadata) puis le
  // paiement, et consommé à la confirmation. Best-effort strict.
  const reservationId = crypto.randomUUID();
  let discountCouponId: string | undefined;
  let creditReserved = false;
  if (routing.provider === 'stripe') {
    try {
      const convex = getConvexServerClient();
      const reserved = await convex.mutation(convexApi.reserveCreditForCheckout, {
        userId: session.userId,
        reservationId,
        currency: routing.currency,
        orderMinor: amountMinor,
      });
      if (reserved.appliedMinor > 0) {
        creditReserved = true;
        discountCouponId = await createOneTimeAmountCoupon(reserved.appliedMinor, routing.currency);
      }
    } catch {
      // reserve OU création du coupon a échoué → relâche si on avait réservé.
      if (creditReserved) {
        try {
          await getConvexServerClient().mutation(convexApi.releaseCreditReservation, {
            reservationId,
          });
        } catch {
          // le GC cron rattrape.
        }
      }
      creditReserved = false;
      discountCouponId = undefined;
    }
  }
  const creditReservationId = creditReserved ? reservationId : undefined;

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
      affiliateId,
      discountCouponId,
      creditReservationId,
    });
  } catch (err) {
    // Session non créée → relâche le crédit réservé (sinon bloqué jusqu'au GC).
    if (creditReserved) {
      try {
        await getConvexServerClient().mutation(convexApi.releaseCreditReservation, {
          reservationId,
        });
      } catch {
        // le GC cron rattrape.
      }
    }
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
      affiliateId,
      creditReservationId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'UNKNOWN';
    if (message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }
    return NextResponse.json({ error: 'PAYMENT_RECORD_FAILED' }, { status: 500 });
  }

  // Analytics serveur : `checkout_started` est fiable même si le JS client est
  // bloqué. distinctId = userId Convex → se rattache à la personne identifiée
  // côté client. N'échoue jamais (garde interne) → ne casse pas la redirection.
  await captureServer({
    distinctId: session.userId,
    event: EVENTS.checkoutStarted,
    properties: {
      plan,
      currency: routing.currency,
      amount_minor: amountMinor,
      provider: driver.name,
      audience: 'consumer',
    },
  });

  return NextResponse.json({
    redirectUrl: session_.redirectUrl,
    provider: driver.name,
    currency: routing.currency,
    amountMinor,
  });
}
