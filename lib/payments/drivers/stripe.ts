import type {
  CheckoutInput,
  CheckoutSession,
  PaymentDriver,
  VerifiedWebhookEvent,
} from '../provider';

// Real Stripe wiring: requires STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET env vars
// and the `stripe` package installed. Until those are configured, this driver
// throws so callers fall back to the mock driver via PAYMENTS_DRIVER=mock.

export const stripeDriver: PaymentDriver = {
  name: 'stripe',
  async createCheckout(_input: CheckoutInput): Promise<CheckoutSession> {
    throw new Error('STRIPE_DRIVER_NOT_CONFIGURED');
  },
  async verifyAndParseWebhook(
    _rawBody: string,
    _signature: string | null,
  ): Promise<VerifiedWebhookEvent> {
    throw new Error('STRIPE_DRIVER_NOT_CONFIGURED');
  },
};
