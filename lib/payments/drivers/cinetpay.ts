import { createHmac, randomUUID } from 'node:crypto';
import type {
  CheckoutInput,
  CheckoutSession,
  PaymentDriver,
  SessionStatus,
  VerifiedWebhookEvent,
} from '../provider';
import type { Currency } from '../plans';
import { isCurrency } from '../plans';

// CinetPay docs: https://docs.cinetpay.com/api/1.0-en/checkout/initialisation
//
// Configuration via env:
//   CINETPAY_API_KEY        — API key from CinetPay dashboard
//   CINETPAY_SITE_ID        — site identifier
//   CINETPAY_WEBHOOK_SECRET — secret used to compute HMAC over the raw webhook
//                             body; the value is sent as the `x-token` header.
//   CINETPAY_NOTIFY_BASE_URL (optional) — overrides the origin used for the
//                             notify_url (default: NEXT_PUBLIC_APP_URL).
//
// When the first two are missing, the driver throws CINETPAY_DRIVER_NOT_CONFIGURED.

const CHECKOUT_URL = 'https://api-checkout.cinetpay.com/v2/payment';
const CHECK_URL = 'https://api-checkout.cinetpay.com/v2/payment/check';

const ALLOWED_CURRENCIES: ReadonlySet<Currency> = new Set(['EUR', 'XOF', 'MAD', 'TND']);

function requireConfig(): { apiKey: string; siteId: string } {
  const apiKey = process.env.CINETPAY_API_KEY;
  const siteId = process.env.CINETPAY_SITE_ID;
  if (!apiKey || !siteId) throw new Error('CINETPAY_DRIVER_NOT_CONFIGURED');
  return { apiKey, siteId };
}

function notifyUrl(): string {
  const origin = (
    process.env.CINETPAY_NOTIFY_BASE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    'https://wedillybird.com'
  ).replace(/\/$/, '');
  return `${origin}/api/webhooks/cinetpay`;
}

/** CinetPay accepts whole units. Internally we store XOF in centimes — divide. */
const DIVISOR_OVERRIDE: Partial<Record<Currency, number>> = {
  XOF: 100,
};

function toCinetpayAmount(minor: number, currency: Currency): number {
  const override = DIVISOR_OVERRIDE[currency];
  return override ? Math.round(minor / override) : minor;
}

function fromCinetpayAmount(amount: number, currency: Currency): number {
  const override = DIVISOR_OVERRIDE[currency];
  return override ? amount * override : amount;
}

interface InitResponse {
  code: string; // '201' on success
  message?: string;
  data?: { payment_url?: string; payment_token?: string };
}

interface CheckResponse {
  code: string; // '00' on success
  message?: string;
  data?: {
    amount?: number | string;
    currency?: string;
    status?: string; // ACCEPTED | REFUSED | PENDING | ...
    payment_method?: string;
    operator_id?: string;
  };
}

function mapStatus(raw: string | undefined): 'succeeded' | 'failed' | 'cancelled' {
  const value = (raw ?? '').toUpperCase();
  if (value === 'ACCEPTED' || value === 'SUCCESS') return 'succeeded';
  if (value === 'CANCELED' || value === 'CANCELLED') return 'cancelled';
  return 'failed';
}

export const cinetpayDriver: PaymentDriver = {
  name: 'cinetpay',

  async createCheckout(input: CheckoutInput): Promise<CheckoutSession> {
    const { apiKey, siteId } = requireConfig();
    if (!ALLOWED_CURRENCIES.has(input.currency)) {
      throw new Error('INVALID_CURRENCY');
    }

    const transactionId = `wd_${input.eventId}_${Date.now()}_${randomUUID().slice(0, 8)}`;
    const body = {
      apikey: apiKey,
      site_id: siteId,
      transaction_id: transactionId,
      amount: toCinetpayAmount(input.amountMinor, input.currency),
      currency: input.currency,
      description: `Wedillybird — plan ${input.plan}`,
      customer_id: input.userId,
      notify_url: notifyUrl(),
      return_url: input.successUrl,
      cancel_url: input.cancelUrl,
      channels: 'ALL',
      lang: 'fr',
      metadata: JSON.stringify({
        eventId: input.eventId,
        userId: input.userId,
        plan: input.plan,
      }),
    };

    const res = await fetch(CHECKOUT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as InitResponse;

    if (!res.ok || json.code !== '201' || !json.data?.payment_url) {
      throw new Error(`CINETPAY_INIT_FAILED:${json.code ?? res.status}`);
    }

    return {
      providerSessionId: transactionId,
      redirectUrl: json.data.payment_url,
    };
  },

  async verifyAndParseWebhook(
    rawBody: string,
    signature: string | null,
  ): Promise<VerifiedWebhookEvent> {
    if (!signature) throw new Error('INVALID_SIGNATURE');
    const secret = process.env.CINETPAY_WEBHOOK_SECRET;
    if (!secret) throw new Error('CINETPAY_DRIVER_NOT_CONFIGURED');

    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    if (expected !== signature.toLowerCase()) {
      throw new Error('INVALID_SIGNATURE');
    }

    // Webhook payload is application/x-www-form-urlencoded per CinetPay docs.
    const params = new URLSearchParams(rawBody);
    const transId = params.get('cpm_trans_id');
    const amountRaw = params.get('cpm_amount');
    const currencyRaw = (params.get('cpm_currency') ?? '').toUpperCase();
    const transStatus = params.get('cpm_trans_status');

    if (!transId) throw new Error('MISSING_TRANSACTION_ID');
    if (!isCurrency(currencyRaw)) throw new Error('INVALID_CURRENCY');

    const amount = Number.parseFloat(amountRaw ?? '0');
    if (!Number.isFinite(amount)) throw new Error('INVALID_AMOUNT');

    const status = mapStatus(transStatus ?? undefined);

    return {
      providerSessionId: transId,
      providerEventId: transId,
      status,
      amountMinor: fromCinetpayAmount(amount, currencyRaw),
      currency: currencyRaw,
      failureReason: status !== 'succeeded' ? (transStatus ?? undefined) : undefined,
    };
  },

  async retrieveSessionStatus(providerSessionId: string): Promise<SessionStatus> {
    const { apiKey, siteId } = requireConfig();

    const res = await fetch(CHECK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apikey: apiKey,
        site_id: siteId,
        transaction_id: providerSessionId,
      }),
    });
    const json = (await res.json()) as CheckResponse;
    if (!res.ok || !json.data) {
      throw new Error(`CINETPAY_CHECK_FAILED:${json.code ?? res.status}`);
    }

    const currencyRaw = (json.data.currency ?? '').toUpperCase();
    if (!isCurrency(currencyRaw)) throw new Error('INVALID_CURRENCY');

    const amount =
      typeof json.data.amount === 'string'
        ? Number.parseFloat(json.data.amount)
        : (json.data.amount ?? 0);

    const paid = mapStatus(json.data.status) === 'succeeded';

    return {
      paid,
      providerSessionId,
      providerEventId: providerSessionId,
      amountMinor: fromCinetpayAmount(amount, currencyRaw),
      currency: currencyRaw,
    };
  },
};
