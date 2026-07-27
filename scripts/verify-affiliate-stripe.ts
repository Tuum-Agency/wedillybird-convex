/**
 * Vérification des chemins Stripe LIVE (mode test) du programme d'affiliation.
 * NE tourne qu'avec une clé `sk_test_…` — refuse toute clé live.
 *
 *   pnpm exec tsx scripts/verify-affiliate-stripe.ts
 *
 * Exerce : création coupon + code promo, lecture du code appliqué à une
 * Checkout Session (cœur de l'attribution), création du compte Connect Express
 * de versement + lien d'onboarding, tentative de transfer (informatif). Nettoie
 * les objets de test créés en best-effort.
 */
import {
  createCoupon,
  createPromotionCode,
  setPromotionCodeActive,
  deleteCoupon,
  retrieveCheckoutSessionPromotion,
  createInfluencerPayoutAccount,
  createAccountOnboardingLink,
  retrieveConnectedAccountStatus,
  createInfluencerTransfer,
} from '../lib/payments/drivers/stripe';
import Stripe from 'stripe';

const key = process.env.STRIPE_SECRET_KEY ?? '';
if (!key.startsWith('sk_test_')) {
  console.error('✖ STRIPE_SECRET_KEY doit être une clé MODE TEST (sk_test_…). Abandon.');
  process.exit(1);
}
const stripe = new Stripe(key);
const suffix = Math.random().toString(36).slice(2, 7).toUpperCase();

function ok(msg: string) {
  console.log(`✓ ${msg}`);
}
function warn(msg: string) {
  console.log(`⚠ ${msg}`);
}

async function main() {
  let accountId: string | undefined;

  // 1. Coupon + code promo (remise communauté + attribution)
  const coupon = await createCoupon({
    name: `VERIF affiliation ${suffix}`,
    percentOff: 15,
    duration: 'forever',
    metadata: { wedillybird_influencer_id: `verif_${suffix}` },
  });
  const couponId = coupon.id;
  const code = `VERIFAFF${suffix}`;
  const promo = await createPromotionCode({
    couponId: coupon.id,
    code,
    metadata: { wedillybird_influencer_id: `verif_${suffix}` },
  });
  ok(`coupon ${coupon.id} (−15%) + code promo ${promo.code} (${promo.id})`);

  // 2. Lecture du code appliqué à une Checkout Session (cœur de l'attribution)
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'eur',
          product_data: { name: `Vérif affiliation ${suffix}` },
          unit_amount: 5900,
        },
      },
    ],
    discounts: [{ promotion_code: promo.id }],
    success_url: 'https://example.com/ok',
    cancel_url: 'https://example.com/ko',
  });
  const applied = await retrieveCheckoutSessionPromotion(session.id);
  if (applied?.promotionCodeId === promo.id && applied?.couponId === coupon.id) {
    ok(
      `attribution OK : session ${session.id} → promo ${applied.promotionCodeId} / coupon ${applied.couponId}`,
    );
  } else {
    warn(
      `attribution INCERTAINE : retrieveCheckoutSessionPromotion a renvoyé ${JSON.stringify(applied)} (attendu promo=${promo.id}, coupon=${coupon.id})`,
    );
  }

  // 3. Compte Connect Express de versement + onboarding
  try {
    const acct = await createInfluencerPayoutAccount({
      email: `verif+${suffix.toLowerCase()}@example.com`,
      name: `Vérif ${suffix}`,
      country: 'FR',
    });
    accountId = acct.accountId;
    const status = await retrieveConnectedAccountStatus(acct.accountId);
    const link = await createAccountOnboardingLink({
      accountId: acct.accountId,
      refreshUrl: 'https://example.com/refresh',
      returnUrl: 'https://example.com/return',
    });
    ok(
      `compte Express ${acct.accountId} (payouts=${status.payoutsEnabled}) + lien onboarding ${link.url.slice(0, 40)}…`,
    );
  } catch (e) {
    warn(
      `Connect indisponible : ${(e as Error).message} — active Connect (transfers) en mode test sur le compte.`,
    );
  }

  // 4. Transfer (nécessite solde test + capability transfers acceptée)
  if (accountId) {
    try {
      const tr = await createInfluencerTransfer({
        destinationAccountId: accountId,
        amountMinor: 100,
        currency: 'EUR',
        description: 'Vérif commission',
      });
      ok(`transfer OK : ${tr.transferId}`);
    } catch (e) {
      warn(
        `transfer non effectué : ${(e as Error).message} — normal tant que l'onboarding KYC n'est pas fini et/ou sans solde test.`,
      );
    }
  }

  // Cleanup best-effort
  try {
    await setPromotionCodeActive(promo.id, false);
    if (couponId) await deleteCoupon(couponId);
    if (accountId) await stripe.accounts.del(accountId);
    ok('nettoyage des objets de test effectué');
  } catch (e) {
    warn(
      `nettoyage partiel : ${(e as Error).message} (supprime manuellement coupon/compte de test au besoin)`,
    );
  }

  console.log(
    '\nRésumé : ✓ = vérifié · ⚠ = à finaliser (config Stripe test / onboarding / solde).',
  );
}

main().catch((e) => {
  console.error('✖ Échec :', e);
  process.exit(1);
});
