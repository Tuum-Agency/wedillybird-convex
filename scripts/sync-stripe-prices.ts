#!/usr/bin/env -S pnpm tsx
/**
 * Script ops — synchronise les Stripe Products + Prices avec la grille
 * canonique (`.context/redesign-direction.md` section "Pricing figé").
 *
 * Usage :
 *   pnpx tsx scripts/sync-stripe-prices.ts            # crée/réutilise les Prices
 *   pnpx tsx scripts/sync-stripe-prices.ts --dry-run  # simule, n'appelle pas Stripe
 *
 * Variables d'environnement requises (lues depuis `.env.local` via `dotenv`) :
 *   - STRIPE_SECRET_KEY : clé secrète test ou live (sk_test_… / sk_live_…)
 *
 * Comportement :
 *  1. Pour chaque plan canonique (cf. `PLANS_TO_SYNC` ci-dessous) ET chaque
 *     devise supportée par Stripe (EUR, USD, MAD, TND) :
 *      a. Cherche un Product Stripe avec `metadata.wedillybird_plan_id` = id
 *      b. Crée le Product s'il n'existe pas (un Product partagé entre devises)
 *      c. Cherche un Price actif sur ce Product matchant amount + currency +
 *         interval (mensuel/annuel/one-shot) ET `metadata.currency`
 *      d. Crée le Price s'il n'existe pas (idempotent)
 *  2. Désactive les anciens Stripe Prices listés dans `LEGACY_PRICE_ENV_VARS`
 *     (`STRIPE_PRICE_STARTER` / BUSINESS / AGENCY actuellement à des montants
 *     divergents 29/79/199 €). En `--dry-run` affiche juste ce qui serait
 *     désactivé sans toucher.
 *  3. Imprime sur stdout un bloc copy-pastable d'env vars à coller dans
 *     `.env.local` (Vercel Production + Preview à mettre à jour aussi).
 *
 * ⚠ XOF n'est PAS dans la liste des `supported_currencies` Stripe → aucun Price
 * XOF n'est créé ici. XOF reste une devise d'affichage uniquement (pas de
 * processeur de paiement).
 *
 * ⚠ Les arrondis annual : convention figée "arrondi à l'euro supérieur"
 * (Math.ceil(month × 12 × 0.80)). Cf. `subscriptions.ts`.
 *
 * ⚠ Les conversions MAD/TND : EUR × 10,7 (MAD) / × 3,4 (TND), arrondi à
 * 100 unités mineures les plus proches. Source : `lib/payments/plans.ts:PLANS`
 * et `lib/payments/subscriptions.ts:SUBSCRIPTION_TIER_PRICES`.
 *
 * ✓ Pay-as-you-go pro : entièrement câblé côté code (Stripe checkout +
 * webhook + Convex `paygPurchases:markPurchase` + publish gate qui consomme
 * le crédit, cf. `convex/events.ts:decidePublishGate`). Ce script crée juste
 * les Stripe Prices manquants côté Stripe.
 *
 * ⚠ USD = grille région `americas` (US/CA) — parité psychologique 1:1 avec
 * la grille europe sauf Premium B2C qui passe à $99 (au lieu de $89) pour
 * matcher le positionnement marché US wedding tech (The Knot premium $99-149).
 * Cf. `lib/payments/region.ts:AMERICAS_PRICE_OVERRIDE`.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import Stripe from 'stripe';
import { convertFromEur } from '../lib/payments/currency';

const DRY_RUN = process.argv.includes('--dry-run');

// Charge `.env.local` à la main pour ne pas dépendre d'un préchargeur. Ne
// lance pas si le fichier manque — on fait fallback sur process.env.
loadDotEnvLocal();

const SECRET_KEY = process.env.STRIPE_SECRET_KEY;
if (!SECRET_KEY) {
  console.error(
    '❌ STRIPE_SECRET_KEY manquant. Renseigne `.env.local` ou exporte la variable avant le run.',
  );
  process.exit(1);
}

const stripe = new Stripe(SECRET_KEY);

/* -------------------------------------------------------------------------- */
/*  Devises Stripe-supportées                                                  */
/* -------------------------------------------------------------------------- */

// Devises gérées par Stripe pour notre grille. XOF **et TND** n'ont pas de
// processeur de paiement (cf. `priceIdForPlan` qui renvoie undefined pour
// XOF/TND). USD couvre la région americas (US + CA). Les montants USD/MAD sont dérivés de
// l'EUR via `convertFromEur` — donc strictement alignés sur ce que l'app
// affiche/facture.
type StripeCurrency = 'EUR' | 'USD' | 'MAD';
const SUPPORTED_STRIPE_CURRENCIES: ReadonlyArray<StripeCurrency> = ['EUR', 'USD', 'MAD'];

/* -------------------------------------------------------------------------- */
/*  Plans canoniques à synchroniser                                            */
/* -------------------------------------------------------------------------- */

interface PlanSpec {
  /** Identifiant interne Wedillybird, persisté dans `metadata.wedillybird_plan_id`. */
  id: string;
  productName: string;
  productDescription: string;
  /** Montant EUR en unités mineures (source de vérité v2). MAD dérivé via convertFromEur. */
  eurMinor: number;
  /** Prix US en cents, posé en valeur marché (décision 2026-07-06) — prioritaire sur la conversion EUR. */
  usdMinor?: number;
  /** undefined = one-shot, 'month' / 'year' = recurring. */
  interval: 'month' | 'year' | undefined;
  /** Préfixe d'env var. Le suffix `_<CURRENCY>` est ajouté automatiquement. */
  envVarBase: string;
}

// Grille v2 (cf. CLAUDE.md / `.context/pricing-v2.md`). EUR = source de vérité ;
// USD/MAD dérivés via `convertFromEur` (taux USD 1,08 / MAD 10,7).
const PLANS_TO_SYNC: ReadonlyArray<PlanSpec> = [
  // Particuliers — one-shot
  {
    id: 'essential',
    productName: 'Wedillybird — Essentiel',
    productDescription:
      'Forfait particulier 29 €. 100 invités, invitations WhatsApp/SMS, RSVP temps réel, check-in offline, galerie 5 Go 12 mois.',
    eurMinor: 2900,
    usdMinor: 4000,
    interval: undefined,
    envVarBase: 'STRIPE_PRICE_ESSENTIAL',
  },
  {
    id: 'premium',
    productName: 'Wedillybird — Premium',
    productDescription:
      'Forfait particulier 59 €. 250 invités, galerie 25 Go HD 12 mois, recherche par visage, plan de table, album PDF, invitation cinématique.',
    eurMinor: 5900,
    usdMinor: 8000,
    interval: undefined,
    envVarBase: 'STRIPE_PRICE_PREMIUM',
  },
  {
    id: 'post_event_upsell',
    productName: 'Wedillybird — Upsell post-mariage',
    productDescription:
      'Extension post-mariage +29 €. Archive HD perpétuelle + export ZIP haute définition.',
    eurMinor: 2900,
    usdMinor: 3000,
    interval: undefined,
    envVarBase: 'STRIPE_PRICE_POST_EVENT_UPSELL',
  },
  // Pros — mensuel
  {
    id: 'starter_monthly',
    productName: 'Wedillybird Pro — Starter',
    productDescription:
      '99 €/mois. 5 événements × 150 invités, 3 000 messages inclus, 50 Go, branding Wedillybird.',
    eurMinor: 9900,
    interval: 'month',
    envVarBase: 'STRIPE_PRICE_STARTER',
  },
  {
    id: 'business_monthly',
    productName: 'Wedillybird Pro — Business',
    productDescription:
      '219 €/mois. 20 événements × 150 invités, 10 000 messages, 200 Go, logo personnalisé + sous-domaine.',
    eurMinor: 21900,
    interval: 'month',
    envVarBase: 'STRIPE_PRICE_BUSINESS',
  },
  {
    id: 'agency_monthly',
    productName: 'Wedillybird Pro — Agency',
    productDescription:
      '449 €/mois. 50 événements × 150 invités, 25 000 messages, 500 Go, marque blanche.',
    eurMinor: 44900,
    interval: 'month',
    envVarBase: 'STRIPE_PRICE_AGENCY',
  },
  // Pros — annuel (-20 % : Math.ceil(mensuel × 12 × 0,80))
  {
    id: 'starter_annual',
    productName: 'Wedillybird Pro — Starter (annuel)',
    productDescription: '951 €/an (équiv. 79,25 €/mois). 5 événements actifs, 3 000 messages/mois.',
    eurMinor: 95100,
    interval: 'year',
    envVarBase: 'STRIPE_PRICE_STARTER_ANNUAL',
  },
  {
    id: 'business_annual',
    productName: 'Wedillybird Pro — Business (annuel)',
    productDescription:
      '2 103 €/an (équiv. 175,25 €/mois). 20 événements actifs, 10 000 messages/mois.',
    eurMinor: 210300,
    interval: 'year',
    envVarBase: 'STRIPE_PRICE_BUSINESS_ANNUAL',
  },
  {
    id: 'agency_annual',
    productName: 'Wedillybird Pro — Agency (annuel)',
    productDescription:
      '4 311 €/an (équiv. 359,25 €/mois). 50 événements actifs, 25 000 messages/mois.',
    eurMinor: 431100,
    interval: 'year',
    envVarBase: 'STRIPE_PRICE_AGENCY_ANNUAL',
  },
  // Pay-as-you-go pro (one-shot, 1 event)
  {
    id: 'payg_event',
    productName: 'Wedillybird Pro — Pay-as-you-go (1 événement)',
    productDescription: '79 €/événement, sans abonnement. 150 invités, 25 Go.',
    eurMinor: 7900,
    interval: undefined,
    envVarBase: 'STRIPE_PRICE_PAYG_EVENT',
  },
];

const LEGACY_PRICE_ENV_VARS = [
  'STRIPE_PRICE_STARTER',
  'STRIPE_PRICE_BUSINESS',
  'STRIPE_PRICE_AGENCY',
];

/* -------------------------------------------------------------------------- */
/*  Logique principale                                                         */
/* -------------------------------------------------------------------------- */

interface SyncResult {
  envVarName: string;
  priceId: string;
  productId: string;
  reused: boolean;
  planId: string;
  currency: StripeCurrency;
}

async function findProductByPlanId(planId: string): Promise<Stripe.Product | null> {
  // Pas d'index API direct sur metadata → on liste et on filtre. Acceptable :
  // ce script tourne au plus une fois par sprint, et on plafonne à 100 produits
  // (largement plus que la grille canonique).
  const products = await stripe.products.list({ limit: 100, active: true });
  return products.data.find((p) => p.metadata?.wedillybird_plan_id === planId) ?? null;
}

async function findPriceForProduct(
  productId: string,
  unitAmount: number,
  currency: StripeCurrency,
  interval: 'month' | 'year' | undefined,
): Promise<Stripe.Price | null> {
  const stripeCurrency = currency.toLowerCase();
  const prices = await stripe.prices.list({ product: productId, limit: 100, active: true });
  return (
    prices.data.find((p) => {
      if (p.unit_amount !== unitAmount) return false;
      if (p.currency !== stripeCurrency) return false;
      if (interval === undefined) return p.type === 'one_time';
      return p.type === 'recurring' && p.recurring?.interval === interval;
    }) ?? null
  );
}

async function syncPlanCurrency(
  spec: PlanSpec,
  currency: StripeCurrency,
): Promise<SyncResult | null> {
  const envVarName =
    currency === 'EUR' ? `${spec.envVarBase}_EUR` : `${spec.envVarBase}_${currency}`;
  // MAD dérivé de l'EUR via convertFromEur ; USD = valeur marché posée (spec.usdMinor)
  // quand présente (grille consumer $40/$80/$30, cf. lib/payments/plans.ts) —
  // strictement aligné sur l'app.
  const unitAmount =
    currency === 'USD' && spec.usdMinor !== undefined
      ? spec.usdMinor
      : convertFromEur(spec.eurMinor, currency);

  if (DRY_RUN) {
    return {
      envVarName,
      priceId: `price_DRY_RUN_${spec.id}_${currency}`,
      productId: `prod_DRY_RUN_${spec.id}`,
      reused: false,
      planId: spec.id,
      currency,
    };
  }

  let product = await findProductByPlanId(spec.id);
  const productReused = !!product;
  if (!product) {
    product = await stripe.products.create({
      name: spec.productName,
      description: spec.productDescription,
      metadata: { wedillybird_plan_id: spec.id },
    });
  }

  let price = await findPriceForProduct(product.id, unitAmount, currency, spec.interval);
  const priceReused = !!price;
  if (!price) {
    try {
      price = await stripe.prices.create({
        product: product.id,
        currency: currency.toLowerCase(),
        unit_amount: unitAmount,
        ...(spec.interval ? { recurring: { interval: spec.interval } } : {}),
        metadata: { wedillybird_plan_id: spec.id, currency },
      });
    } catch (err: unknown) {
      // Si le compte Stripe ne supporte pas cette devise (test mode parfois
      // limité, ou compte sans bank account dans la devise cible), on log un
      // warning et on ignore — le script reste idempotent pour les autres
      // devises. À résoudre côté Stripe Dashboard (ajouter un bank account
      // dans la devise) si la devise est requise.
      const stripeErr = err as { type?: string; raw?: { message?: string }; message?: string };
      if (
        stripeErr.type === 'StripeInvalidRequestError' &&
        (stripeErr.raw?.message ?? stripeErr.message ?? '')
          .toLowerCase()
          .includes('invalid currency')
      ) {
        console.warn(
          `  ⚠  ${spec.id} [${currency}] non créé — devise non supportée par ce compte Stripe (${stripeErr.raw?.message ?? stripeErr.message})`,
        );
        return null;
      }
      throw err;
    }
  }

  return {
    envVarName,
    priceId: price.id,
    productId: product.id,
    reused: productReused && priceReused,
    planId: spec.id,
    currency,
  };
}

async function deactivateLegacyPrices(): Promise<void> {
  console.log('\n--- Désactivation des anciens Stripe Prices divergents ---');
  for (const envName of LEGACY_PRICE_ENV_VARS) {
    const legacyId = process.env[envName];
    if (!legacyId) {
      console.log(`  ⏭  ${envName} non défini, rien à désactiver`);
      continue;
    }

    // Trouve le Price actuel — peut déjà être inactif si on relance.
    let current: Stripe.Price | null = null;
    try {
      current = await stripe.prices.retrieve(legacyId);
    } catch {
      console.log(`  ⏭  ${envName}=${legacyId} introuvable côté Stripe, ignoré`);
      continue;
    }

    if (!current.active) {
      console.log(`  ✓  ${envName}=${legacyId} déjà inactif`);
      continue;
    }

    // Si le legacy ID correspond exactement à un nouveau Price qu'on vient de
    // créer/réutiliser, on ne le désactive PAS — c'est qu'il était déjà aligné.
    if (
      current.metadata?.wedillybird_plan_id &&
      PLANS_TO_SYNC.some((p) => p.id === current.metadata!.wedillybird_plan_id)
    ) {
      console.log(`  ✓  ${envName}=${legacyId} déjà aligné sur la grille, conservé`);
      continue;
    }

    if (DRY_RUN) {
      console.log(`  [dry-run] ${envName}=${legacyId} sera marqué active=false`);
      continue;
    }

    await stripe.prices.update(legacyId, { active: false });
    console.log(`  ✗  ${envName}=${legacyId} désactivé (active: false)`);
  }
}

/* -------------------------------------------------------------------------- */
/*  Entrée                                                                     */
/* -------------------------------------------------------------------------- */

async function main(): Promise<void> {
  console.log(`${DRY_RUN ? '[DRY RUN] ' : ''}Sync Stripe Prices — grille canonique avril 2026`);
  console.log(`Stripe key: ${SECRET_KEY!.startsWith('sk_test_') ? 'TEST mode' : 'LIVE mode'}`);
  console.log(`Devises Stripe : ${SUPPORTED_STRIPE_CURRENCIES.join(', ')} (XOF non supporté)`);

  const results: SyncResult[] = [];
  for (const spec of PLANS_TO_SYNC) {
    for (const currency of SUPPORTED_STRIPE_CURRENCIES) {
      const result = await syncPlanCurrency(spec, currency);
      if (!result) continue; // currency non supportée par le compte Stripe
      results.push(result);
      const tag = result.reused ? '↻ réutilisé' : '+ créé';
      console.log(
        `  ${tag.padEnd(13)} ${spec.id.padEnd(20)} [${currency}] → ${result.priceId} (product ${result.productId})`,
      );
    }
  }

  await deactivateLegacyPrices();

  console.log('\n--- Bloc à coller dans `.env.local` ---');
  console.log(
    '# Stripe Prices — grille canonique multi-devises (cf. .context/redesign-direction.md)',
  );
  console.log(
    "# EUR/USD/MAD via Stripe. XOF/TND : devises d'affichage uniquement (non listé ici).",
  );
  console.log(
    '# Les variantes sans suffix devise (STRIPE_PRICE_ESSENTIAL=…) restent des alias EUR.',
  );
  for (const r of results) {
    console.log(`${r.envVarName}=${r.priceId}`);
  }
  console.log('--- Fin du bloc ---\n');

  if (DRY_RUN) {
    console.log(
      '⚠ Dry-run actif : aucun appel Stripe écrit. Relance sans `--dry-run` pour appliquer.',
    );
  }
}

main().catch((err) => {
  console.error('❌ Sync échouée :', err);
  process.exit(1);
});

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

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
      // Retire les commentaires inline et guillemets potentiels.
      const hashIdx = value.indexOf(' #');
      if (hashIdx >= 0) value = value.slice(0, hashIdx).trim();
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
      // Ne pas écraser ce qui est déjà défini dans l'environnement parent.
      if (process.env[key] === undefined) process.env[key] = value;
    }
  } catch {
    // Pas de .env.local → on continue, l'utilisateur exporte peut-être
    // STRIPE_SECRET_KEY ailleurs.
  }
}
