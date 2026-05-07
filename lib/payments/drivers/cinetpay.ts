import type {
  CheckoutInput,
  CheckoutSession,
  PaymentDriver,
  SessionStatus,
  VerifiedWebhookEvent,
} from '../provider';
import type { Currency } from '../plans';
import { isCurrency } from '../plans';

/**
 * CinetPay Pay-In driver — couvre les devises Afrique de l'Ouest (XOF) et
 * autres devises locales supportées (CDF, GNF, MAD, TND, etc.). Stripe ne
 * supportant pas XOF, c'est ce driver qui prend la main pour les paiements
 * one-shot des particuliers en Afrique francophone.
 *
 * Doc API : https://docs.cinetpay.com/api/1.0-en/checkout/initialisation
 *
 * Skip silencieux + `CINETPAY_DRIVER_NOT_CONFIGURED` quand `CINETPAY_API_KEY`
 * ou `CINETPAY_SITE_ID` est absent — autorise le rollout progressif (cf.
 * Lambda OpenAI Moderation pour le même pattern).
 */

const CINETPAY_PAYMENT_ENDPOINT = 'https://api-checkout.cinetpay.com/v2/payment';
const CINETPAY_CHECK_ENDPOINT = 'https://api-checkout.cinetpay.com/v2/payment/check';

/**
 * Devises supportées par CinetPay (zone Afrique de l'Ouest + Maghreb + EUR).
 * USD n'est PAS supporté — il passe par Stripe (zone americas).
 */
type CinetpayCurrency = Exclude<Currency, 'USD'>;

function isCinetpayCurrency(currency: Currency): currency is CinetpayCurrency {
  return currency !== 'USD';
}

/**
 * CinetPay attend les montants en unités majeures (XOF entiers, EUR cents
 * convertis en euros entiers — pas de décimales acceptées par l'API mobile).
 * Pour XOF on stocke en centimes en interne (divisor 100) → on divise.
 * Pour EUR on stocke aussi en centimes mais l'API CinetPay (mobile money)
 * exige des entiers — on convertit en unités majeures arrondies.
 */
const CINETPAY_DIVISOR: Record<CinetpayCurrency, number> = {
  EUR: 100,
  XOF: 100,
  MAD: 100,
  TND: 1000,
};

function toCinetpayAmount(minor: number, currency: CinetpayCurrency): number {
  return Math.round(minor / CINETPAY_DIVISOR[currency]);
}

function fromCinetpayAmount(major: number | string, currency: CinetpayCurrency): number {
  const value = typeof major === 'string' ? Number(major) : major;
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * CINETPAY_DIVISOR[currency]);
}

interface CinetpayCredentials {
  apiKey: string;
  siteId: string;
}

function readCredentials(): CinetpayCredentials {
  const apiKey = process.env.CINETPAY_API_KEY;
  const siteId = process.env.CINETPAY_SITE_ID;
  if (!apiKey || !siteId) {
    throw new Error('CINETPAY_DRIVER_NOT_CONFIGURED');
  }
  return { apiKey, siteId };
}

interface CinetpayInitResponse {
  code: string;
  message?: string;
  description?: string;
  data?: {
    payment_token?: string;
    payment_url?: string;
  };
  api_response_id?: string;
}

interface CinetpayCheckResponse {
  code: string;
  message?: string;
  data?: {
    amount?: string | number;
    currency?: string;
    status?: string;
    payment_method?: string;
    operator_id?: string;
    payment_date?: string;
    cpm_result?: string;
    cpm_trans_id?: string;
    cpm_trans_status?: string;
  };
}

/**
 * Webhook payload CinetPay (POST application/x-www-form-urlencoded).
 * Champs critiques pour la signature HMAC (ordre figé par la doc) :
 *   cpm_site_id + cpm_trans_id + cpm_trans_date + cpm_amount + cpm_currency
 *   + signature + payment_method + cel_phone_num + cpm_phone_prefixe
 *   + cpm_language + cpm_version + cpm_payment_config + cpm_page_action
 *   + cpm_custom + cpm_designation + cpm_error_message
 */
interface CinetpayWebhookPayload {
  cpm_site_id: string;
  cpm_trans_id: string;
  cpm_trans_date: string;
  cpm_amount: string;
  cpm_currency: string;
  signature: string;
  payment_method: string;
  cel_phone_num: string;
  cpm_phone_prefixe: string;
  cpm_language: string;
  cpm_version: string;
  cpm_payment_config: string;
  cpm_page_action: string;
  cpm_custom: string;
  cpm_designation: string;
  cpm_error_message: string;
  cpm_result: string;
}

function parseWebhookForm(rawBody: string): CinetpayWebhookPayload {
  const params = new URLSearchParams(rawBody);
  const get = (key: string): string => params.get(key) ?? '';
  return {
    cpm_site_id: get('cpm_site_id'),
    cpm_trans_id: get('cpm_trans_id'),
    cpm_trans_date: get('cpm_trans_date'),
    cpm_amount: get('cpm_amount'),
    cpm_currency: get('cpm_currency'),
    signature: get('signature'),
    payment_method: get('payment_method'),
    cel_phone_num: get('cel_phone_num'),
    cpm_phone_prefixe: get('cpm_phone_prefixe'),
    cpm_language: get('cpm_language'),
    cpm_version: get('cpm_version'),
    cpm_payment_config: get('cpm_payment_config'),
    cpm_page_action: get('cpm_page_action'),
    cpm_custom: get('cpm_custom'),
    cpm_designation: get('cpm_designation'),
    cpm_error_message: get('cpm_error_message'),
    cpm_result: get('cpm_result'),
  };
}

/**
 * Compute HMAC-SHA256 of the concatenated webhook fields using the API key
 * as the secret. CinetPay sends the expected hash via the `x-token` header.
 */
async function computeWebhookHmac(
  payload: CinetpayWebhookPayload,
  apiKey: string,
): Promise<string> {
  const concat =
    payload.cpm_site_id +
    payload.cpm_trans_id +
    payload.cpm_trans_date +
    payload.cpm_amount +
    payload.cpm_currency +
    payload.signature +
    payload.payment_method +
    payload.cel_phone_num +
    payload.cpm_phone_prefixe +
    payload.cpm_language +
    payload.cpm_version +
    payload.cpm_payment_config +
    payload.cpm_page_action +
    payload.cpm_custom +
    payload.cpm_designation +
    payload.cpm_error_message;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(apiKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sigBuffer = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(concat));
  const bytes = new Uint8Array(sigBuffer);
  let hex = '';
  for (const b of bytes) hex += b.toString(16).padStart(2, '0');
  return hex;
}

function timingSafeStringEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Mapping `cpm_result` → status interne.
 *  - `00`            → succeeded
 *  - `617`           → cancelled (utilisateur a fermé la page)
 *  - tout le reste   → failed (codes 600/601/602/603/627/628/...)
 */
function mapResultToStatus(cpmResult: string): 'succeeded' | 'failed' | 'cancelled' {
  if (cpmResult === '00') return 'succeeded';
  if (cpmResult === '617') return 'cancelled';
  return 'failed';
}

export const cinetpayDriver: PaymentDriver = {
  name: 'cinetpay',
  async createCheckout(input: CheckoutInput): Promise<CheckoutSession> {
    const creds = readCredentials();

    if (!isCinetpayCurrency(input.currency)) {
      throw new Error('UNSUPPORTED_CINETPAY_CURRENCY');
    }
    const currency: CinetpayCurrency = input.currency;

    const transactionId = (
      typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `tx-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    ).replace(/-/g, '');

    const payload = {
      apikey: creds.apiKey,
      site_id: creds.siteId,
      transaction_id: transactionId,
      amount: toCinetpayAmount(input.amountMinor, currency),
      currency,
      description: planDescription(input.plan),
      notify_url: notifyUrl(),
      return_url: input.successUrl,
      cancel_url: input.cancelUrl,
      // CinetPay channels: ALL = mobile money + carte bancaire + wave + orange money etc.
      channels: 'ALL',
      lang: 'fr',
      metadata: JSON.stringify({
        eventId: input.eventId,
        userId: input.userId,
        plan: input.plan,
      }),
      ...(input.customerEmail ? { customer_email: input.customerEmail } : {}),
      ...(input.customerPhone ? { customer_phone_number: input.customerPhone } : {}),
    };

    const res = await fetch(CINETPAY_PAYMENT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(`CINETPAY_HTTP_${res.status}`);
    }

    const json = (await res.json()) as CinetpayInitResponse;
    if (json.code !== '201' || !json.data?.payment_url) {
      const reason = json.description ?? json.message ?? 'INIT_FAILED';
      throw new Error(`CINETPAY_INIT_FAILED:${reason}`);
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
    const creds = readCredentials();

    const payload = parseWebhookForm(rawBody);
    if (!payload.cpm_trans_id) throw new Error('INVALID_PAYLOAD');

    const expected = await computeWebhookHmac(payload, creds.apiKey);
    if (!timingSafeStringEqual(signature.toLowerCase(), expected.toLowerCase())) {
      throw new Error('INVALID_SIGNATURE');
    }

    const currency = payload.cpm_currency.toUpperCase();
    if (!isCurrency(currency) || !isCinetpayCurrency(currency)) throw new Error('INVALID_CURRENCY');

    const amountMinor = fromCinetpayAmount(payload.cpm_amount, currency);
    const status = mapResultToStatus(payload.cpm_result);

    return {
      providerSessionId: payload.cpm_trans_id,
      providerEventId: payload.cpm_trans_id,
      status,
      amountMinor,
      currency,
      failureReason:
        status !== 'succeeded'
          ? payload.cpm_error_message || payload.cpm_result || undefined
          : undefined,
    };
  },

  async retrieveSessionStatus(providerSessionId: string): Promise<SessionStatus> {
    const creds = readCredentials();

    const res = await fetch(CINETPAY_CHECK_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apikey: creds.apiKey,
        site_id: creds.siteId,
        transaction_id: providerSessionId,
      }),
    });

    if (!res.ok) throw new Error(`CINETPAY_HTTP_${res.status}`);
    const json = (await res.json()) as CinetpayCheckResponse;

    const cpmResult = json.data?.cpm_result ?? '';
    const paid = cpmResult === '00' || json.code === '00';
    const currencyRaw = (json.data?.currency ?? 'XOF').toUpperCase();
    if (!isCurrency(currencyRaw) || !isCinetpayCurrency(currencyRaw))
      throw new Error('INVALID_CURRENCY');
    const amountMinor = fromCinetpayAmount(json.data?.amount ?? 0, currencyRaw);

    return {
      paid,
      providerSessionId,
      providerEventId: providerSessionId,
      amountMinor,
      currency: currencyRaw,
    };
  },
};

function planDescription(plan: string): string {
  if (plan === 'essential') return 'Wedillybird — Essentiel';
  if (plan === 'premium') return 'Wedillybird — Premium';
  return `Wedillybird — ${plan}`;
}

function notifyUrl(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? 'https://wedillybird.com';
  return `${base.replace(/\/$/, '')}/api/webhooks/cinetpay`;
}
