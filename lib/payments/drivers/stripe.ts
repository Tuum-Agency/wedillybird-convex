import Stripe from 'stripe';
import type {
  CheckoutInput,
  CheckoutSession,
  PaymentDriver,
  SessionStatus,
  VerifiedWebhookEvent,
} from '../provider';
import type { Currency } from '../plans';
import { isCurrency, priceIdForPlan } from '../plans';
import {
  priceIdForTier,
  tierForPriceId,
  type SubscriptionBilling,
  type SubscriptionStatus,
  type SubscriptionTier,
} from '../subscriptions';

let cached: Stripe | null = null;

function getStripe(): Stripe {
  if (cached) return cached;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_DRIVER_NOT_CONFIGURED');
  cached = new Stripe(key);
  return cached;
}

const PLAN_LABEL: Record<string, string> = {
  essential: 'Wedillybird — Essentiel',
  premium: 'Wedillybird — Premium',
};

// Description affichée sur Stripe Checkout. Les forfaits particuliers sont
// désormais features-based (galerie 30j vs 6 mois + album PDF) — pas de quota
// invitations.
const PLAN_STRIPE_DESCRIPTION: Record<string, string> = {
  essential:
    'Invitations WhatsApp + RSVP temps réel + check-in offline + tableau de bord + galerie partagée 30 jours après le mariage.',
  premium:
    "Tout l'Essentiel + galerie partagée 6 mois après le mariage + album PDF final imprimable.",
};

// Stripe expects ISO 4217 currency codes lowercase. We store XOF in centimes
// internally (divisor 100), but Stripe represents XOF as zero-decimal. Ditto
// TND uses millimes (divisor 1000), which Stripe handles natively for TND.
// Conversion only matters for currencies Stripe supports.
const STRIPE_CURRENCY_DIVISOR_OVERRIDE: Partial<Record<Currency, number>> = {
  XOF: 100, // we store XOF as centimes internally; Stripe wants whole units
};

function toStripeAmount(minor: number, currency: Currency): number {
  const override = STRIPE_CURRENCY_DIVISOR_OVERRIDE[currency];
  return override ? Math.round(minor / override) : minor;
}

export const stripeDriver: PaymentDriver = {
  name: 'stripe',
  async createCheckout(input: CheckoutInput): Promise<CheckoutSession> {
    const stripe = getStripe();

    // Préfère un Stripe Price stable (env var STRIPE_PRICE_<PLAN>_<CURRENCY>
    // ou alias EUR `STRIPE_PRICE_<PLAN>`) — créé par scripts/sync-stripe-prices.ts.
    // Si l'env var n'est pas configurée, tombe sur price_data inline pour ne
    // pas bloquer le checkout en dev. Couvre EUR + MAD + TND. XOF passe par
    // le driver CinetPay et n'arrive normalement jamais ici.
    const stablePrice = priceIdForPlan(input.plan, input.currency);
    const lineItem = stablePrice
      ? { quantity: 1, price: stablePrice }
      : {
          quantity: 1,
          price_data: {
            currency: input.currency.toLowerCase(),
            unit_amount: toStripeAmount(input.amountMinor, input.currency),
            product_data: {
              name: PLAN_LABEL[input.plan] ?? input.plan,
              description: PLAN_STRIPE_DESCRIPTION[input.plan],
              metadata: {
                plan: input.plan,
                wedillybird_plan_id: input.plan,
              },
            },
          },
        };

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [lineItem],
      success_url: appendSessionIdParam(input.successUrl),
      cancel_url: input.cancelUrl,
      metadata: {
        eventId: input.eventId,
        userId: input.userId,
        plan: input.plan,
      },
      client_reference_id: `${input.userId}:${input.eventId}`,
      locale: 'auto',
    });

    if (!session.url) throw new Error('STRIPE_NO_REDIRECT_URL');

    return {
      providerSessionId: session.id,
      redirectUrl: session.url,
    };
  },

  async verifyAndParseWebhook(
    rawBody: string,
    signature: string | null,
  ): Promise<VerifiedWebhookEvent> {
    if (!signature) throw new Error('INVALID_SIGNATURE');
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) throw new Error('STRIPE_DRIVER_NOT_CONFIGURED');

    const stripe = getStripe();
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, secret);
    } catch {
      throw new Error('INVALID_SIGNATURE');
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      return parseSession(session, event.id, 'succeeded');
    }
    if (event.type === 'checkout.session.async_payment_failed') {
      const session = event.data.object as Stripe.Checkout.Session;
      return parseSession(session, event.id, 'failed');
    }
    if (event.type === 'checkout.session.expired') {
      const session = event.data.object as Stripe.Checkout.Session;
      return parseSession(session, event.id, 'cancelled');
    }
    throw new Error('UNSUPPORTED_EVENT');
  },

  async retrieveSessionStatus(providerSessionId: string): Promise<SessionStatus> {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(providerSessionId);
    const currencyRaw = (session.currency ?? '').toUpperCase();
    if (!isCurrency(currencyRaw)) throw new Error('INVALID_CURRENCY');
    const stripeAmount = session.amount_total ?? 0;
    const override = STRIPE_CURRENCY_DIVISOR_OVERRIDE[currencyRaw];
    const amountMinor = override ? stripeAmount * override : stripeAmount;
    return {
      paid: session.payment_status === 'paid',
      providerSessionId: session.id,
      providerEventId: session.id,
      amountMinor,
      currency: currencyRaw,
    };
  },
};

function appendSessionIdParam(url: string): string {
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}session_id={CHECKOUT_SESSION_ID}`;
}

/* -------------------------------------------------------------------------- */
/*  Subscriptions (Pro plans: Starter / Business / Agency)                    */
/* -------------------------------------------------------------------------- */

export type SubscriptionCheckoutInput = {
  organizationId: string;
  requesterId: string;
  tier: SubscriptionTier;
  /** Mensuel par défaut. Annuel = -20 % sur le total. */
  billing?: SubscriptionBilling;
  /** Devise de la subscription. Défaut EUR. XOF non supporté côté Stripe. */
  currency?: Currency;
  customerEmail: string;
  /** Existing Stripe customer to attach the new subscription to (preferred). */
  stripeCustomerId?: string;
  successUrl: string;
  cancelUrl: string;
};

export async function createSubscriptionCheckout(
  input: SubscriptionCheckoutInput,
): Promise<CheckoutSession> {
  const stripe = getStripe();
  const billing = input.billing ?? 'monthly';
  const currency = input.currency ?? 'EUR';
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ quantity: 1, price: priceIdForTier(input.tier, billing, currency) }],
    success_url: appendSessionIdParam(input.successUrl),
    cancel_url: input.cancelUrl,
    customer: input.stripeCustomerId,
    customer_email: input.stripeCustomerId ? undefined : input.customerEmail,
    client_reference_id: input.organizationId,
    metadata: {
      organizationId: input.organizationId,
      requesterId: input.requesterId,
      tier: input.tier,
      billing,
    },
    subscription_data: {
      metadata: {
        organizationId: input.organizationId,
        tier: input.tier,
        billing,
      },
    },
    locale: 'auto',
    allow_promotion_codes: true,
  });
  if (!session.url) throw new Error('STRIPE_NO_REDIRECT_URL');
  return { providerSessionId: session.id, redirectUrl: session.url };
}

export async function openCustomerPortal(
  customerId: string,
  returnUrl: string,
): Promise<{ url: string }> {
  const stripe = getStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
    locale: 'auto',
  });
  return { url: session.url };
}

/* -------------------------------------------------------------------------- */
/*  Pay-as-you-go pro (one-shot, 1 event)                                     */
/* -------------------------------------------------------------------------- */

export type PaygCheckoutInput = {
  organizationId: string;
  requesterId: string;
  /** Devise de l'achat. Défaut EUR. XOF non supporté côté Stripe. */
  currency?: Currency;
  customerEmail: string;
  stripeCustomerId?: string;
  successUrl: string;
  cancelUrl: string;
};

/**
 * Crée un Stripe Checkout one-shot pour un achat Pay-as-you-go pro (69 €,
 * crédite l'organisation de +1 event activable). Le `metadata.kind === 'payg'`
 * est lu par `verifyAndParseSubscriptionWebhook` pour router vers la mutation
 * Convex `paygPurchases:markPurchase`.
 */
export async function createPaygCheckout(input: PaygCheckoutInput): Promise<CheckoutSession> {
  const stripe = getStripe();
  const currency = input.currency ?? 'EUR';
  if (currency === 'XOF') throw new Error('UNSUPPORTED_STRIPE_CURRENCY');
  const envName = `STRIPE_PRICE_PAYG_EVENT_${currency}` as const;
  const priceId = process.env[envName] ?? process.env.STRIPE_PRICE_PAYG_EVENT;
  if (!priceId) throw new Error(`MISSING_${envName}`);

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [{ quantity: 1, price: priceId }],
    success_url: appendSessionIdParam(input.successUrl),
    cancel_url: input.cancelUrl,
    customer: input.stripeCustomerId,
    customer_email: input.stripeCustomerId ? undefined : input.customerEmail,
    client_reference_id: input.organizationId,
    metadata: {
      kind: 'payg',
      organizationId: input.organizationId,
      requesterId: input.requesterId,
    },
    locale: 'auto',
    allow_promotion_codes: true,
  });
  if (!session.url) throw new Error('STRIPE_NO_REDIRECT_URL');
  return { providerSessionId: session.id, redirectUrl: session.url };
}

export type SubscriptionWebhookEvent =
  | {
      kind: 'subscription.upserted';
      organizationId: string;
      stripeCustomerId: string;
      stripeSubscriptionId: string;
      tier: SubscriptionTier;
      billing: SubscriptionBilling;
      status: SubscriptionStatus;
      currentPeriodEnd: number;
    }
  | {
      kind: 'subscription.deleted';
      organizationId: string | null;
      stripeCustomerId: string;
      stripeSubscriptionId: string;
    }
  | {
      kind: 'invoice.paid';
      stripeCustomerId: string;
      stripeSubscriptionId: string;
      amountMinor: number;
      currency: Currency;
    }
  | {
      kind: 'invoice.payment_failed';
      stripeCustomerId: string;
      stripeSubscriptionId: string;
    }
  | {
      kind: 'payg.purchased';
      organizationId: string;
      requesterId: string;
      stripeSessionId: string;
      amountMinor: number;
      currency: Currency;
    };

/**
 * Verify a webhook signature and parse it as a subscription-related event.
 * Returns null when the event is unrelated to subscriptions (caller should
 * fall back to the one-shot payment driver's `verifyAndParseWebhook`).
 */
export async function verifyAndParseSubscriptionWebhook(
  rawBody: string,
  signature: string | null,
): Promise<SubscriptionWebhookEvent | null> {
  if (!signature) throw new Error('INVALID_SIGNATURE');
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error('STRIPE_DRIVER_NOT_CONFIGURED');

  const stripe = getStripe();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch {
    throw new Error('INVALID_SIGNATURE');
  }

  if (
    event.type === 'customer.subscription.created' ||
    event.type === 'customer.subscription.updated'
  ) {
    const sub = event.data.object as Stripe.Subscription;
    const item = sub.items.data[0];
    if (!item) return null;
    const tierMatch = tierForPriceId(item.price.id);
    if (!tierMatch) return null;
    const orgId = (sub.metadata?.organizationId as string | undefined) ?? null;
    if (!orgId) return null;
    return {
      kind: 'subscription.upserted',
      organizationId: orgId,
      stripeCustomerId: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
      stripeSubscriptionId: sub.id,
      tier: tierMatch.tier,
      billing: tierMatch.billing,
      status: sub.status as SubscriptionStatus,
      currentPeriodEnd: item.current_period_end * 1000,
    };
  }

  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object as Stripe.Subscription;
    return {
      kind: 'subscription.deleted',
      organizationId: (sub.metadata?.organizationId as string | undefined) ?? null,
      stripeCustomerId: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
      stripeSubscriptionId: sub.id,
    };
  }

  if (event.type === 'invoice.payment_succeeded' || event.type === 'invoice.paid') {
    const invoice = event.data.object as Stripe.Invoice;
    const subId =
      'subscription' in invoice && typeof invoice.subscription === 'string'
        ? invoice.subscription
        : null;
    if (!subId) return null;
    const currencyRaw = (invoice.currency ?? '').toUpperCase();
    if (!isCurrency(currencyRaw)) return null;
    const stripeAmount = invoice.amount_paid ?? 0;
    const override = STRIPE_CURRENCY_DIVISOR_OVERRIDE[currencyRaw];
    return {
      kind: 'invoice.paid',
      stripeCustomerId:
        typeof invoice.customer === 'string' ? invoice.customer : (invoice.customer?.id ?? ''),
      stripeSubscriptionId: subId,
      amountMinor: override ? stripeAmount * override : stripeAmount,
      currency: currencyRaw,
    };
  }

  if (event.type === 'invoice.payment_failed') {
    const invoice = event.data.object as Stripe.Invoice;
    const subId =
      'subscription' in invoice && typeof invoice.subscription === 'string'
        ? invoice.subscription
        : null;
    if (!subId) return null;
    return {
      kind: 'invoice.payment_failed',
      stripeCustomerId:
        typeof invoice.customer === 'string' ? invoice.customer : (invoice.customer?.id ?? ''),
      stripeSubscriptionId: subId,
    };
  }

  // Pay-as-you-go pro : checkout one-shot en mode `payment` avec
  // `metadata.kind === 'payg'`. Distinct des paiements particuliers
  // (essential/premium) qui passent par le driver one-shot standard.
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.metadata?.kind !== 'payg') return null;
    const organizationId = session.metadata.organizationId;
    const requesterId = session.metadata.requesterId;
    if (!organizationId || !requesterId) return null;
    const currencyRaw = (session.currency ?? '').toUpperCase();
    if (!isCurrency(currencyRaw)) return null;
    const stripeAmount = session.amount_total ?? 0;
    const override = STRIPE_CURRENCY_DIVISOR_OVERRIDE[currencyRaw];
    return {
      kind: 'payg.purchased',
      organizationId,
      requesterId,
      stripeSessionId: session.id,
      amountMinor: override ? stripeAmount * override : stripeAmount,
      currency: currencyRaw,
    };
  }

  return null;
}

/* -------------------------------------------------------------------------- */
/*  One-shot payment helpers (existing)                                       */
/* -------------------------------------------------------------------------- */

function parseSession(
  session: Stripe.Checkout.Session,
  eventId: string,
  status: 'succeeded' | 'failed' | 'cancelled',
): VerifiedWebhookEvent {
  const currencyRaw = (session.currency ?? '').toUpperCase();
  if (!isCurrency(currencyRaw)) throw new Error('INVALID_CURRENCY');

  const stripeAmount = session.amount_total ?? 0;
  const override = STRIPE_CURRENCY_DIVISOR_OVERRIDE[currencyRaw];
  const amountMinor = override ? stripeAmount * override : stripeAmount;

  return {
    providerSessionId: session.id,
    providerEventId: eventId,
    status,
    amountMinor,
    currency: currencyRaw,
    failureReason:
      typeof session.payment_status === 'string' && status !== 'succeeded'
        ? session.payment_status
        : undefined,
  };
}
