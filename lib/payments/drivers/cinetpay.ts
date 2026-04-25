import type {
  CheckoutInput,
  CheckoutSession,
  PaymentDriver,
  SessionStatus,
  VerifiedWebhookEvent,
} from '../provider';

// Real CinetPay wiring: requires CINETPAY_API_KEY, CINETPAY_SITE_ID,
// CINETPAY_WEBHOOK_SECRET. Until configured, this driver throws so callers
// fall back to the mock driver via PAYMENTS_DRIVER=mock.

export const cinetpayDriver: PaymentDriver = {
  name: 'cinetpay',
  async createCheckout(_input: CheckoutInput): Promise<CheckoutSession> {
    throw new Error('CINETPAY_DRIVER_NOT_CONFIGURED');
  },
  async verifyAndParseWebhook(
    _rawBody: string,
    _signature: string | null,
  ): Promise<VerifiedWebhookEvent> {
    throw new Error('CINETPAY_DRIVER_NOT_CONFIGURED');
  },
  async retrieveSessionStatus(_providerSessionId: string): Promise<SessionStatus> {
    throw new Error('CINETPAY_DRIVER_NOT_CONFIGURED');
  },
};
