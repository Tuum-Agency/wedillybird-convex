import Stripe from 'stripe';
import type {
  CheckoutInput,
  CheckoutSession,
  PaymentDriver,
  SessionStatus,
  VerifiedWebhookEvent,
} from '../provider';
import type { Currency } from '../plans';
import { isCurrency } from '../plans';

let cached: Stripe | null = null;

function getStripe(): Stripe {
  if (cached) return cached;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_DRIVER_NOT_CONFIGURED');
  cached = new Stripe(key);
  return cached;
}

const PLAN_LABEL: Record<string, string> = {
  essential: 'Wedillybird — Sérénité',
  premium: 'Wedillybird — Prestige',
};

// Description shown on Stripe Checkout under the line item. The quota is
// counted in invitations sent (un QR code par invité principal, accompagnants
// illimités), pas en personnes physiques.
const PLAN_STRIPE_DESCRIPTION: Record<string, string> = {
  essential:
    "Jusqu'à 150 invitations envoyées (1 QR code par invité principal, accompagnants illimités). Page d'invitation personnalisée, RSVP temps réel, check-in offline, galerie partagée, branding, export CSV, support prioritaire.",
  premium:
    "Jusqu'à 1000 invitations envoyées (1 QR code par invité principal, accompagnants illimités). Tout Sérénité + galerie illimitée, sans filigrane Wedillybird, support dédié 7j/7.",
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
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: input.currency.toLowerCase(),
            unit_amount: toStripeAmount(input.amountMinor, input.currency),
            product_data: {
              name: PLAN_LABEL[input.plan] ?? input.plan,
              description: PLAN_STRIPE_DESCRIPTION[input.plan],
              metadata: {
                plan: input.plan,
                quotaUnit: 'invitations',
              },
            },
          },
        },
      ],
      success_url: appendSessionIdParam(input.successUrl),
      cancel_url: input.cancelUrl,
      metadata: {
        eventId: input.eventId,
        userId: input.userId,
        plan: input.plan,
      },
      client_reference_id: `${input.userId}:${input.eventId}`,
      locale: 'fr',
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
