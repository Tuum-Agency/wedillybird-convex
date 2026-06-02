#!/usr/bin/env -S pnpm tsx
/**
 * Vérification post-sync des Stripe Prices.
 *
 * Lit les `STRIPE_PRICE_*_*` configurées dans `.env.local`, interroge l'API
 * Stripe (read-only — `prices.retrieve`) et confirme que chaque Price a :
 *   - le bon `unit_amount`
 *   - la bonne `currency`
 *   - le bon `type` (one-shot vs recurring)
 *   - le bon `recurring.interval` (month / year)
 *   - bien `active: true`
 *
 * Usage :
 *   pnpx tsx scripts/verify-stripe-prices.ts
 *
 * Sortie : ✓ OK ou ✗ FAIL pour chaque Price, puis un résumé. Exit code 0 si
 * tout passe, 1 sinon. Ne fait AUCUN write — safe à lancer en live.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import Stripe from 'stripe';

loadDotEnvLocal();

const SECRET_KEY = process.env.STRIPE_SECRET_KEY;
if (!SECRET_KEY) {
  console.error('❌ STRIPE_SECRET_KEY manquant dans .env.local');
  process.exit(1);
}

const stripe = new Stripe(SECRET_KEY);

interface ExpectedPrice {
  envVar: string;
  /** Identifiant interne (cf. PLANS_TO_SYNC dans sync-stripe-prices.ts). */
  planId: string;
  unitAmount: number;
  currency: string; // lowercase ISO 4217
  type: 'one_time' | 'recurring';
  interval?: 'month' | 'year';
}

/**
 * Grille canonique attendue côté Stripe — doit rester synchro avec
 * `scripts/sync-stripe-prices.ts:PLANS_TO_SYNC`.
 *
 * USD = americas overlay : Essentiel $39, Premium $99, Upsell +$59 (B2C).
 * Pour les pros = parité 1:1 avec EUR. PAYG = $69.
 */
const EXPECTED: ExpectedPrice[] = [
  // Essential
  {
    envVar: 'STRIPE_PRICE_ESSENTIAL_EUR',
    planId: 'essential',
    unitAmount: 2900,
    currency: 'eur',
    type: 'one_time',
  },
  {
    envVar: 'STRIPE_PRICE_ESSENTIAL_USD',
    planId: 'essential',
    unitAmount: 3900,
    currency: 'usd',
    type: 'one_time',
  },
  {
    envVar: 'STRIPE_PRICE_ESSENTIAL_MAD',
    planId: 'essential',
    unitAmount: 21000,
    currency: 'mad',
    type: 'one_time',
  },
  {
    envVar: 'STRIPE_PRICE_ESSENTIAL_TND',
    planId: 'essential',
    unitAmount: 64600,
    currency: 'tnd',
    type: 'one_time',
  },
  // Premium
  {
    envVar: 'STRIPE_PRICE_PREMIUM_EUR',
    planId: 'premium',
    unitAmount: 4900,
    currency: 'eur',
    type: 'one_time',
  },
  {
    envVar: 'STRIPE_PRICE_PREMIUM_USD',
    planId: 'premium',
    unitAmount: 9900,
    currency: 'usd',
    type: 'one_time',
  },
  {
    envVar: 'STRIPE_PRICE_PREMIUM_MAD',
    planId: 'premium',
    unitAmount: 53000,
    currency: 'mad',
    type: 'one_time',
  },
  {
    envVar: 'STRIPE_PRICE_PREMIUM_TND',
    planId: 'premium',
    unitAmount: 166600,
    currency: 'tnd',
    type: 'one_time',
  },
  // Upsell
  {
    envVar: 'STRIPE_PRICE_POST_EVENT_UPSELL_EUR',
    planId: 'post_event_upsell',
    unitAmount: 2900,
    currency: 'eur',
    type: 'one_time',
  },
  {
    envVar: 'STRIPE_PRICE_POST_EVENT_UPSELL_USD',
    planId: 'post_event_upsell',
    unitAmount: 5900,
    currency: 'usd',
    type: 'one_time',
  },
  {
    envVar: 'STRIPE_PRICE_POST_EVENT_UPSELL_MAD',
    planId: 'post_event_upsell',
    unitAmount: 32000,
    currency: 'mad',
    type: 'one_time',
  },
  {
    envVar: 'STRIPE_PRICE_POST_EVENT_UPSELL_TND',
    planId: 'post_event_upsell',
    unitAmount: 98600,
    currency: 'tnd',
    type: 'one_time',
  },
  // Pros monthly
  {
    envVar: 'STRIPE_PRICE_STARTER_EUR',
    planId: 'starter_monthly',
    unitAmount: 8900,
    currency: 'eur',
    type: 'recurring',
    interval: 'month',
  },
  {
    envVar: 'STRIPE_PRICE_STARTER_USD',
    planId: 'starter_monthly',
    unitAmount: 8900,
    currency: 'usd',
    type: 'recurring',
    interval: 'month',
  },
  {
    envVar: 'STRIPE_PRICE_STARTER_MAD',
    planId: 'starter_monthly',
    unitAmount: 95200,
    currency: 'mad',
    type: 'recurring',
    interval: 'month',
  },
  {
    envVar: 'STRIPE_PRICE_STARTER_TND',
    planId: 'starter_monthly',
    unitAmount: 302600,
    currency: 'tnd',
    type: 'recurring',
    interval: 'month',
  },
  {
    envVar: 'STRIPE_PRICE_BUSINESS_EUR',
    planId: 'business_monthly',
    unitAmount: 17900,
    currency: 'eur',
    type: 'recurring',
    interval: 'month',
  },
  {
    envVar: 'STRIPE_PRICE_BUSINESS_USD',
    planId: 'business_monthly',
    unitAmount: 17900,
    currency: 'usd',
    type: 'recurring',
    interval: 'month',
  },
  {
    envVar: 'STRIPE_PRICE_BUSINESS_MAD',
    planId: 'business_monthly',
    unitAmount: 191500,
    currency: 'mad',
    type: 'recurring',
    interval: 'month',
  },
  {
    envVar: 'STRIPE_PRICE_BUSINESS_TND',
    planId: 'business_monthly',
    unitAmount: 608600,
    currency: 'tnd',
    type: 'recurring',
    interval: 'month',
  },
  {
    envVar: 'STRIPE_PRICE_AGENCY_EUR',
    planId: 'agency_monthly',
    unitAmount: 34900,
    currency: 'eur',
    type: 'recurring',
    interval: 'month',
  },
  {
    envVar: 'STRIPE_PRICE_AGENCY_USD',
    planId: 'agency_monthly',
    unitAmount: 34900,
    currency: 'usd',
    type: 'recurring',
    interval: 'month',
  },
  {
    envVar: 'STRIPE_PRICE_AGENCY_MAD',
    planId: 'agency_monthly',
    unitAmount: 373400,
    currency: 'mad',
    type: 'recurring',
    interval: 'month',
  },
  {
    envVar: 'STRIPE_PRICE_AGENCY_TND',
    planId: 'agency_monthly',
    unitAmount: 1186600,
    currency: 'tnd',
    type: 'recurring',
    interval: 'month',
  },
  // Pros annual
  {
    envVar: 'STRIPE_PRICE_STARTER_ANNUAL_EUR',
    planId: 'starter_annual',
    unitAmount: 85500,
    currency: 'eur',
    type: 'recurring',
    interval: 'year',
  },
  {
    envVar: 'STRIPE_PRICE_STARTER_ANNUAL_USD',
    planId: 'starter_annual',
    unitAmount: 85500,
    currency: 'usd',
    type: 'recurring',
    interval: 'year',
  },
  {
    envVar: 'STRIPE_PRICE_STARTER_ANNUAL_MAD',
    planId: 'starter_annual',
    unitAmount: 914800,
    currency: 'mad',
    type: 'recurring',
    interval: 'year',
  },
  {
    envVar: 'STRIPE_PRICE_STARTER_ANNUAL_TND',
    planId: 'starter_annual',
    unitAmount: 2907000,
    currency: 'tnd',
    type: 'recurring',
    interval: 'year',
  },
  {
    envVar: 'STRIPE_PRICE_BUSINESS_ANNUAL_EUR',
    planId: 'business_annual',
    unitAmount: 171900,
    currency: 'eur',
    type: 'recurring',
    interval: 'year',
  },
  {
    envVar: 'STRIPE_PRICE_BUSINESS_ANNUAL_USD',
    planId: 'business_annual',
    unitAmount: 171900,
    currency: 'usd',
    type: 'recurring',
    interval: 'year',
  },
  {
    envVar: 'STRIPE_PRICE_BUSINESS_ANNUAL_MAD',
    planId: 'business_annual',
    unitAmount: 1839300,
    currency: 'mad',
    type: 'recurring',
    interval: 'year',
  },
  {
    envVar: 'STRIPE_PRICE_BUSINESS_ANNUAL_TND',
    planId: 'business_annual',
    unitAmount: 5844600,
    currency: 'tnd',
    type: 'recurring',
    interval: 'year',
  },
  {
    envVar: 'STRIPE_PRICE_AGENCY_ANNUAL_EUR',
    planId: 'agency_annual',
    unitAmount: 335100,
    currency: 'eur',
    type: 'recurring',
    interval: 'year',
  },
  {
    envVar: 'STRIPE_PRICE_AGENCY_ANNUAL_USD',
    planId: 'agency_annual',
    unitAmount: 335100,
    currency: 'usd',
    type: 'recurring',
    interval: 'year',
  },
  {
    envVar: 'STRIPE_PRICE_AGENCY_ANNUAL_MAD',
    planId: 'agency_annual',
    unitAmount: 3585600,
    currency: 'mad',
    type: 'recurring',
    interval: 'year',
  },
  {
    envVar: 'STRIPE_PRICE_AGENCY_ANNUAL_TND',
    planId: 'agency_annual',
    unitAmount: 11393400,
    currency: 'tnd',
    type: 'recurring',
    interval: 'year',
  },
  // PAYG
  {
    envVar: 'STRIPE_PRICE_PAYG_EVENT_EUR',
    planId: 'payg_event',
    unitAmount: 6900,
    currency: 'eur',
    type: 'one_time',
  },
  {
    envVar: 'STRIPE_PRICE_PAYG_EVENT_USD',
    planId: 'payg_event',
    unitAmount: 6900,
    currency: 'usd',
    type: 'one_time',
  },
  {
    envVar: 'STRIPE_PRICE_PAYG_EVENT_MAD',
    planId: 'payg_event',
    unitAmount: 73800,
    currency: 'mad',
    type: 'one_time',
  },
  {
    envVar: 'STRIPE_PRICE_PAYG_EVENT_TND',
    planId: 'payg_event',
    unitAmount: 234600,
    currency: 'tnd',
    type: 'one_time',
  },
];

interface CheckResult {
  envVar: string;
  status: 'ok' | 'missing_env' | 'not_found' | 'inactive' | 'mismatch';
  details?: string;
}

async function retrieveWithRetry(priceId: string, attempt = 0): Promise<Stripe.Price> {
  try {
    return await stripe.prices.retrieve(priceId);
  } catch (err) {
    const stripeErr = err as { code?: string; type?: string; message?: string };
    const isRateLimit =
      stripeErr.type === 'StripeRateLimitError' ||
      (stripeErr.message ?? '').toLowerCase().includes('rate limit');
    if (isRateLimit && attempt < 3) {
      // Backoff exponentiel : 1s, 2s, 4s.
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
      return retrieveWithRetry(priceId, attempt + 1);
    }
    throw err;
  }
}

async function checkPrice(spec: ExpectedPrice): Promise<CheckResult> {
  const priceId = process.env[spec.envVar];
  if (!priceId) {
    return { envVar: spec.envVar, status: 'missing_env' };
  }

  let price: Stripe.Price;
  try {
    price = await retrieveWithRetry(priceId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { envVar: spec.envVar, status: 'not_found', details: `${priceId}: ${msg}` };
  }

  if (!price.active) {
    return {
      envVar: spec.envVar,
      status: 'inactive',
      details: `Price ${priceId} exists but is inactive`,
    };
  }

  const issues: string[] = [];
  if (price.unit_amount !== spec.unitAmount) {
    issues.push(`unit_amount=${price.unit_amount} (expected ${spec.unitAmount})`);
  }
  if (price.currency !== spec.currency) {
    issues.push(`currency=${price.currency} (expected ${spec.currency})`);
  }
  if (price.type !== spec.type) {
    issues.push(`type=${price.type} (expected ${spec.type})`);
  }
  if (spec.type === 'recurring') {
    if (price.recurring?.interval !== spec.interval) {
      issues.push(`recurring.interval=${price.recurring?.interval} (expected ${spec.interval})`);
    }
  }

  if (issues.length > 0) {
    return {
      envVar: spec.envVar,
      status: 'mismatch',
      details: `${priceId}: ${issues.join(', ')}`,
    };
  }

  return { envVar: spec.envVar, status: 'ok' };
}

async function main(): Promise<void> {
  console.log(`Stripe key: ${SECRET_KEY!.startsWith('sk_test_') ? 'TEST mode' : 'LIVE mode'}`);
  console.log(`Vérification de ${EXPECTED.length} Stripe Prices (read-only, séquentiel)…\n`);

  // Séquentiel + retry sur rate limit (cf. retrieveWithRetry). Stripe burst
  // limit en live ≈ 100/s, mais en parallèle les 40 reqs partent en même
  // microseconde et trippent le limiter — l'enchaînement séquentiel évite ça.
  const results: CheckResult[] = [];
  for (const spec of EXPECTED) {
    results.push(await checkPrice(spec));
  }

  const ok = results.filter((r) => r.status === 'ok');
  const missingEnv = results.filter((r) => r.status === 'missing_env');
  const failed = results.filter(
    (r) => r.status === 'not_found' || r.status === 'inactive' || r.status === 'mismatch',
  );

  for (const r of results) {
    const icon = r.status === 'ok' ? '✓' : r.status === 'missing_env' ? '⏭' : '✗';
    const label =
      r.status === 'ok'
        ? 'OK'
        : r.status === 'missing_env'
          ? 'env var absente'
          : r.status.toUpperCase();
    console.log(`  ${icon}  ${r.envVar.padEnd(45)} ${label}${r.details ? ` — ${r.details}` : ''}`);
  }

  console.log(
    `\nRésumé : ${ok.length} OK · ${missingEnv.length} env absente · ${failed.length} échec(s)`,
  );

  if (missingEnv.length > 0) {
    console.log(
      `\nNote : les ${missingEnv.length} env var(s) absente(s) sont normales si ton compte Stripe ne supporte pas la devise (TND souvent) ou si tu n'as pas encore poussé les env vars vers Vercel.`,
    );
  }

  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('❌ Vérification échouée :', err);
  process.exit(1);
});

/** Mini-loader `.env.local` sans dépendance à `dotenv`. */
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
    /* pas de .env.local → on continue avec process.env existant */
  }
}
