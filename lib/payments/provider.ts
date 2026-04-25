import type { Currency, PlanTier } from './plans';
import type { ProviderName } from './country';

export interface CheckoutInput {
  provider: ProviderName;
  plan: PlanTier;
  currency: Currency;
  amountMinor: number;
  eventId: string;
  userId: string;
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutSession {
  providerSessionId: string;
  redirectUrl: string;
}

export interface VerifiedWebhookEvent {
  providerSessionId: string;
  providerEventId: string;
  status: 'succeeded' | 'failed' | 'cancelled';
  amountMinor: number;
  currency: Currency;
  failureReason?: string;
}

export interface SessionStatus {
  paid: boolean;
  providerSessionId: string;
  providerEventId: string;
  amountMinor: number;
  currency: Currency;
}

export interface PaymentDriver {
  readonly name: ProviderName;
  createCheckout(input: CheckoutInput): Promise<CheckoutSession>;
  verifyAndParseWebhook(rawBody: string, signature: string | null): Promise<VerifiedWebhookEvent>;
  retrieveSessionStatus(providerSessionId: string): Promise<SessionStatus>;
}
