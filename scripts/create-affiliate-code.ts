#!/usr/bin/env -S pnpm tsx
/**
 * Script ops — crée un **code d'affilié créateur** : un coupon Stripe `-10 %`
 * restreint aux forfaits couple (Essentiel / Premium), plus un code promo
 * lisible rattaché. Pensé pour les partenariats micro-créatrices « future
 * mariée » (ex. @ocekmb) : le code donne une remise à SON audience et son
 * compteur `times_redeemed` sert d'attribution. La commission éventuelle
 * versée à la créatrice est gérée à la main (hors de ce script).
 *
 * Usage :
 *   pnpx tsx scripts/create-affiliate-code.ts            # DRY-RUN (n'écrit rien)
 *   pnpx tsx scripts/create-affiliate-code.ts --apply    # crée réellement en Stripe
 *
 * Variables d'environnement requises (lues depuis `.env.local`) :
 *   - STRIPE_SECRET_KEY        : clé secrète (sk_test_… ou sk_live_…)
 *   - STRIPE_PRICE_ESSENTIAL   : Price EUR Essentiel (pour résoudre le produit)
 *   - STRIPE_PRICE_PREMIUM     : Price EUR Premium   (pour résoudre le produit)
 *
 * Sécurité :
 *  - DRY-RUN par défaut. Rien n'est écrit tant que `--apply` n'est pas passé.
 *  - Le coupon est restreint aux PRODUITS couple via `applies_to.products`,
 *    sinon le code pourrait s'appliquer à un abonnement pro (les checkouts pros
 *    ont aussi `allow_promotion_codes: true`). Cette restriction est IMMUABLE.
 *  - `restrictToFirstTime` : réservé aux nouveaux clients (anti-abus).
 *  - Réversible : un code promo se désactive depuis /admin ou le Dashboard.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import Stripe from 'stripe';
import { priceIdForPlan } from '../lib/payments/plans';
import { createCoupon, createPromotionCode } from '../lib/payments/drivers/stripe';

/* -------------------------------------------------------------------------- */
/*  Paramètres du code — édite ici                                            */
/* -------------------------------------------------------------------------- */

const CODE = 'OCE10'; // code lisible tapé au checkout (cohérent avec -10 %)
const PERCENT_OFF = 10; // remise audience
const VALIDITY_DAYS = 365; // ~12 mois → garde le code « frais »
const RESTRICT_TO_FIRST_TIME = true; // nouveaux clients seulement
const MAX_REDEMPTIONS: number | undefined = undefined; // illimité (du volume)
const COUPON_NAME = `Affilié créateur — ${CODE} (-${PERCENT_OFF}%)`;

/* -------------------------------------------------------------------------- */

const APPLY = process.argv.includes('--apply');
loadDotEnvLocal();

const SECRET_KEY = process.env.STRIPE_SECRET_KEY;
if (!SECRET_KEY) {
  console.error('❌ STRIPE_SECRET_KEY manquant. Renseigne `.env.local`.');
  process.exit(1);
}
const LIVE = SECRET_KEY.startsWith('sk_live_');
const stripe = new Stripe(SECRET_KEY);

async function main(): Promise<void> {
  console.log(`\n=== Création code d'affilié « ${CODE} » ===`);
  console.log(
    `Mode      : ${APPLY ? (LIVE ? '🔴 APPLY (Stripe LIVE)' : '🟢 APPLY (Stripe test)') : '🧪 DRY-RUN (rien écrit)'}`,
  );
  console.log(`Remise    : -${PERCENT_OFF}% (duration: once)`);
  console.log(`Validité  : ${VALIDITY_DAYS} j`);
  console.log(`Nouveaux  : ${RESTRICT_TO_FIRST_TIME ? 'oui (first_time_transaction)' : 'non'}`);

  // 1. Résout les PRODUITS couple à partir de leurs Prices EUR.
  const productIds = await resoudreProduitsCouple();
  if (productIds.length === 0) {
    console.error(
      '❌ Aucun produit couple résolu (STRIPE_PRICE_ESSENTIAL / STRIPE_PRICE_PREMIUM manquants ?).',
    );
    process.exit(1);
  }
  console.log(`Restreint : ${productIds.length} produit(s) couple → ${productIds.join(', ')}`);

  // 2. Garde anti-doublon : un code identique existe-t-il déjà ?
  const existing = await stripe.promotionCodes.list({ code: CODE, limit: 1 });
  const duplicate = existing.data[0];
  if (duplicate) {
    console.error(
      `❌ Un code promo « ${CODE} » existe déjà (${duplicate.id}, active=${duplicate.active}). Abandon.`,
    );
    process.exit(1);
  }

  if (!APPLY) {
    console.log('\n🧪 DRY-RUN — voici ce qui serait créé :');
    console.log(`  • Coupon « ${COUPON_NAME} » : percent_off=${PERCENT_OFF}, duration=once,`);
    console.log(`    applies_to.products=[${productIds.join(', ')}], redeem_by=+${VALIDITY_DAYS}j`);
    console.log(
      `  • Code promo « ${CODE} » rattaché, first_time=${RESTRICT_TO_FIRST_TIME}, expires=+${VALIDITY_DAYS}j`,
    );
    console.log('\n→ Relance avec `--apply` pour créer réellement.\n');
    return;
  }

  const horizon = Date.now() + VALIDITY_DAYS * 24 * 60 * 60 * 1000;

  // 3. Crée le coupon (restreint aux produits couple).
  const coupon = await createCoupon({
    name: COUPON_NAME,
    percentOff: PERCENT_OFF,
    duration: 'once',
    redeemBy: horizon,
    appliesToProducts: productIds,
    ...(MAX_REDEMPTIONS != null ? { maxRedemptions: MAX_REDEMPTIONS } : {}),
  });
  console.log(`\n✅ Coupon créé : ${coupon.id}`);

  // 4. Crée le code promo lisible rattaché.
  const promo = await createPromotionCode({
    couponId: coupon.id,
    code: CODE,
    restrictToFirstTime: RESTRICT_TO_FIRST_TIME,
    expiresAt: horizon,
    ...(MAX_REDEMPTIONS != null ? { maxRedemptions: MAX_REDEMPTIONS } : {}),
  });
  console.log(`✅ Code promo créé : ${promo.code} (${promo.id})`);
  console.log(
    `\n→ Attribution : suis « ${promo.code} » dans /admin (times_redeemed) ou le Dashboard Stripe.\n`,
  );
}

/** Retrieve les Prices EUR Essentiel + Premium → déduplique leurs produits. */
async function resoudreProduitsCouple(): Promise<string[]> {
  const priceIds = (['essential', 'premium'] as const)
    .map((plan) => priceIdForPlan(plan, 'EUR'))
    .filter((id): id is string => Boolean(id));

  const products = new Set<string>();
  for (const priceId of priceIds) {
    const price = await stripe.prices.retrieve(priceId);
    const product = typeof price.product === 'string' ? price.product : price.product?.id;
    if (product) products.add(product);
  }
  return [...products];
}

/** Mini-loader `.env.local` (même pattern que sync-stripe-prices.ts). */
function loadDotEnvLocal(): void {
  try {
    const raw = readFileSync(join(process.cwd(), '.env.local'), 'utf8');
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq < 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      const hashIdx = value.indexOf(' #');
      if (hashIdx >= 0) value = value.slice(0, hashIdx).trim();
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
      if (process.env[key] === undefined) process.env[key] = value;
    }
  } catch {
    // Pas de .env.local → on continue (variable peut-être exportée ailleurs).
  }
}

main().catch((e) => {
  console.error('❌ Échec :', e instanceof Error ? e.message : e);
  process.exit(1);
});
