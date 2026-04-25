import type {
  CheckoutInput,
  CheckoutSession,
  PaymentDriver,
  SessionStatus,
  VerifiedWebhookEvent,
} from '../provider';
import { isCurrency } from '../plans';

function randomId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 12)}`;
}

export const mockDriver: PaymentDriver = {
  name: 'mock',
  async createCheckout(input: CheckoutInput): Promise<CheckoutSession> {
    const sessionId = randomId('mock_sess');
    const sep = input.successUrl.includes('?') ? '&' : '?';
    const successWithSession = `${input.successUrl}${sep}session_id=${sessionId}&provider=mock`;
    const params = new URLSearchParams({
      session: sessionId,
      eventId: input.eventId,
      plan: input.plan,
      currency: input.currency,
      amount: String(input.amountMinor),
      successUrl: successWithSession,
      cancelUrl: input.cancelUrl,
    });
    return {
      providerSessionId: sessionId,
      redirectUrl: `/api/checkout/mock?${params.toString()}`,
    };
  },

  async retrieveSessionStatus(providerSessionId: string): Promise<SessionStatus> {
    // Mock: assumes the auto-success endpoint already marked the payment.
    // Returns paid:true so the success page reconciliation succeeds idempotently.
    return {
      paid: true,
      providerSessionId,
      providerEventId: `mock_evt_${providerSessionId}`,
      amountMinor: 0,
      currency: 'EUR',
    };
  },

  async verifyAndParseWebhook(
    rawBody: string,
    signature: string | null,
  ): Promise<VerifiedWebhookEvent> {
    if (!signature || signature !== 'mock-signature') {
      throw new Error('INVALID_SIGNATURE');
    }
    const parsed = JSON.parse(rawBody) as {
      providerSessionId?: unknown;
      providerEventId?: unknown;
      status?: unknown;
      amountMinor?: unknown;
      currency?: unknown;
      failureReason?: unknown;
    };

    const providerSessionId = String(parsed.providerSessionId ?? '');
    const providerEventId = String(parsed.providerEventId ?? '');
    const status = parsed.status;
    const amountMinor = Number(parsed.amountMinor);
    const currency = parsed.currency;

    if (!providerSessionId || !providerEventId) throw new Error('INVALID_PAYLOAD');
    if (status !== 'succeeded' && status !== 'failed' && status !== 'cancelled') {
      throw new Error('INVALID_STATUS');
    }
    if (!Number.isFinite(amountMinor) || amountMinor < 0) throw new Error('INVALID_AMOUNT');
    if (typeof currency !== 'string' || !isCurrency(currency)) throw new Error('INVALID_CURRENCY');

    return {
      providerSessionId,
      providerEventId,
      status,
      amountMinor,
      currency,
      failureReason: typeof parsed.failureReason === 'string' ? parsed.failureReason : undefined,
    };
  },
};
