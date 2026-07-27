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
import { affiliateBuyerDiscountMinor } from '@/lib/payments/affiliate-discount';
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
  let buyerDiscountBps = 0;
  const refCode = (await cookies()).get('wdb_ref')?.value;
  if (refCode) {
    try {
      const aff = await getConvexServerClient().query(convexApi.getAffiliateByCode, {
        code: refCode,
      });
      if (aff) {
        affiliateId = aff.id;
        // Remise « communauté » que ce code partenaire accorde à son audience.
        buyerDiscountBps = aff.buyerDiscountBps ?? 0;
      }
    } catch {
      // best-effort — l'attribution ne bloque jamais l'achat.
    }
  }
  const affiliateDiscountMinor = affiliateBuyerDiscountMinor(amountMinor, buyerDiscountBps);

  // Crédit de parrainage : on RÉSERVE le crédit AVANT de créer le coupon — le
  // montant réservé == le montant du coupon (jamais de sur-remise ni de crédit
  // gratuit). `reservationId` (token) est porté par la session (metadata) puis le
  // paiement, et consommé à la confirmation. Best-effort strict.
  const reservationId = crypto.randomUUID();
  let discountCouponId: string | undefined;
  let creditReserved = false;
  // Remise affilié réellement appliquée (= 0 si le coupon n'a pas pu être créé) :
  // c'est CETTE valeur qu'on enregistre, pour que la base de commission colle au
  // montant réellement encaissé.
  let appliedAffiliateDiscountMinor = 0;
  if (routing.provider === 'stripe') {
    try {
      const convex = getConvexServerClient();
      // Le crédit de parrainage ne réserve que ce qui RESTE après la remise
      // affilié (remise + crédit ≤ prix) → jamais de sur-remise ni de crédit gratuit.
      const creditRoomMinor = Math.max(0, amountMinor - affiliateDiscountMinor);
      const reserved =
        creditRoomMinor > 0
          ? await convex.mutation(convexApi.reserveCreditForCheckout, {
              userId: session.userId,
              reservationId,
              currency: routing.currency,
              orderMinor: creditRoomMinor,
            })
          : { appliedMinor: 0 };
      // Marqué AVANT la création du coupon : si celle-ci échoue, le catch relâche
      // la réservation déjà posée (sinon crédit bloqué jusqu'au GC).
      if (reserved.appliedMinor > 0) creditReserved = true;
      // Stripe n'accepte qu'UN coupon par session → on cumule remise + crédit.
      const totalDiscountMinor = affiliateDiscountMinor + reserved.appliedMinor;
      if (totalDiscountMinor > 0) {
        discountCouponId = await createOneTimeAmountCoupon(totalDiscountMinor, routing.currency);
      }
      // Coupon créé (ou aucune remise à appliquer) → la remise affilié est actée.
      appliedAffiliateDiscountMinor = affiliateDiscountMinor;
    } catch {
      // reserve OU création du coupon a échoué → relâche si on avait réservé, et
      // on abandonne AUSSI la remise affilié (pas de coupon = pas de remise).
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
      appliedAffiliateDiscountMinor = 0;
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
      ...(appliedAffiliateDiscountMinor > 0
        ? { affiliateDiscountMinor: appliedAffiliateDiscountMinor }
        : {}),
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
