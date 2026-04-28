import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

const checkoutInput = {
  provider: 'cinetpay' as const,
  plan: 'essential' as const,
  currency: 'XOF' as const,
  amountMinor: 1250000, // 12 500 XOF stockés en centimes
  eventId: 'evt_1',
  userId: 'usr_1',
  successUrl: 'https://app.test/ok',
  cancelUrl: 'https://app.test/cancel',
  customerEmail: 'demo@example.com',
  customerPhone: '+221770000000',
};

beforeEach(() => {
  process.env.CINETPAY_API_KEY = 'cinetpay_test_key';
  process.env.CINETPAY_SITE_ID = 'site_test_123';
  process.env.NEXT_PUBLIC_APP_URL = 'https://app.test';
  vi.resetModules();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.restoreAllMocks();
});

describe('payments/drivers/cinetpay — createCheckout', () => {
  it('throws NOT_CONFIGURED when CINETPAY_API_KEY is missing', async () => {
    delete process.env.CINETPAY_API_KEY;
    const { cinetpayDriver } = await import('@/lib/payments/drivers/cinetpay');
    await expect(cinetpayDriver.createCheckout(checkoutInput)).rejects.toThrow(
      'CINETPAY_DRIVER_NOT_CONFIGURED',
    );
  });

  it('throws NOT_CONFIGURED when CINETPAY_SITE_ID is missing', async () => {
    delete process.env.CINETPAY_SITE_ID;
    const { cinetpayDriver } = await import('@/lib/payments/drivers/cinetpay');
    await expect(cinetpayDriver.createCheckout(checkoutInput)).rejects.toThrow(
      'CINETPAY_DRIVER_NOT_CONFIGURED',
    );
  });

  it('POSTs to the CinetPay payment endpoint with apikey, site_id and amount in major units', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        code: '201',
        data: { payment_token: 'tok_abc', payment_url: 'https://pay.cinetpay.com/checkout/abc' },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { cinetpayDriver } = await import('@/lib/payments/drivers/cinetpay');
    const result = await cinetpayDriver.createCheckout(checkoutInput);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api-checkout.cinetpay.com/v2/payment');
    expect((init as RequestInit).method).toBe('POST');
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.apikey).toBe('cinetpay_test_key');
    expect(body.site_id).toBe('site_test_123');
    // 1 250 000 centimes XOF → 12 500 unités majeures
    expect(body.amount).toBe(12500);
    expect(body.currency).toBe('XOF');
    expect(body.return_url).toBe('https://app.test/ok');
    expect(body.cancel_url).toBe('https://app.test/cancel');
    expect(body.notify_url).toBe('https://app.test/api/webhooks/cinetpay');
    expect(body.lang).toBe('fr');
    expect(typeof body.transaction_id).toBe('string');
    expect((body.transaction_id as string).length).toBeGreaterThan(0);
    expect(body.customer_email).toBe('demo@example.com');
    expect(body.customer_phone_number).toBe('+221770000000');
    const meta = JSON.parse(body.metadata);
    expect(meta).toEqual({ eventId: 'evt_1', userId: 'usr_1', plan: 'essential' });

    expect(result.providerSessionId).toBe(body.transaction_id);
    expect(result.redirectUrl).toBe('https://pay.cinetpay.com/checkout/abc');
  });

  it('throws when CinetPay responds with a non-201 code', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ code: '422', message: 'INVALID_AMOUNT' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { cinetpayDriver } = await import('@/lib/payments/drivers/cinetpay');
    await expect(cinetpayDriver.createCheckout(checkoutInput)).rejects.toThrow(
      /CINETPAY_INIT_FAILED/,
    );
  });

  it('throws when the HTTP response is not ok', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);

    const { cinetpayDriver } = await import('@/lib/payments/drivers/cinetpay');
    await expect(cinetpayDriver.createCheckout(checkoutInput)).rejects.toThrow('CINETPAY_HTTP_500');
  });
});

/* -------------------------------------------------------------------------- */

async function buildSignedWebhook(opts: {
  apiKey: string;
  cpm_result: string;
  cpm_amount?: string;
  cpm_currency?: string;
  cpm_trans_id?: string;
  cpm_error_message?: string;
}): Promise<{ rawBody: string; signature: string }> {
  const fields = {
    cpm_site_id: 'site_test_123',
    cpm_trans_id: opts.cpm_trans_id ?? 'tx_abc123',
    cpm_trans_date: '2026-04-27 10:00:00',
    cpm_amount: opts.cpm_amount ?? '12500',
    cpm_currency: opts.cpm_currency ?? 'XOF',
    signature: 'cinetpay_inner_sig',
    payment_method: 'OM',
    cel_phone_num: '770000000',
    cpm_phone_prefixe: '221',
    cpm_language: 'fr',
    cpm_version: 'V4',
    cpm_payment_config: 'SINGLE',
    cpm_page_action: 'PAYMENT',
    cpm_custom: '',
    cpm_designation: 'Wedillybird — Essentiel',
    cpm_error_message: opts.cpm_error_message ?? '',
    cpm_result: opts.cpm_result,
  };
  const concat =
    fields.cpm_site_id +
    fields.cpm_trans_id +
    fields.cpm_trans_date +
    fields.cpm_amount +
    fields.cpm_currency +
    fields.signature +
    fields.payment_method +
    fields.cel_phone_num +
    fields.cpm_phone_prefixe +
    fields.cpm_language +
    fields.cpm_version +
    fields.cpm_payment_config +
    fields.cpm_page_action +
    fields.cpm_custom +
    fields.cpm_designation +
    fields.cpm_error_message;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(opts.apiKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sigBuffer = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(concat));
  const bytes = new Uint8Array(sigBuffer);
  let hex = '';
  for (const b of bytes) hex += b.toString(16).padStart(2, '0');

  const rawBody = new URLSearchParams(fields as Record<string, string>).toString();
  return { rawBody, signature: hex };
}

describe('payments/drivers/cinetpay — verifyAndParseWebhook', () => {
  it('rejects missing signature', async () => {
    const { cinetpayDriver } = await import('@/lib/payments/drivers/cinetpay');
    await expect(cinetpayDriver.verifyAndParseWebhook('cpm_trans_id=x', null)).rejects.toThrow(
      'INVALID_SIGNATURE',
    );
  });

  it('rejects invalid signature', async () => {
    const { rawBody } = await buildSignedWebhook({
      apiKey: 'cinetpay_test_key',
      cpm_result: '00',
    });
    const { cinetpayDriver } = await import('@/lib/payments/drivers/cinetpay');
    await expect(cinetpayDriver.verifyAndParseWebhook(rawBody, 'wrong_sig')).rejects.toThrow(
      'INVALID_SIGNATURE',
    );
  });

  it('parses succeeded for cpm_result === "00"', async () => {
    const { rawBody, signature } = await buildSignedWebhook({
      apiKey: 'cinetpay_test_key',
      cpm_result: '00',
    });
    const { cinetpayDriver } = await import('@/lib/payments/drivers/cinetpay');
    const event = await cinetpayDriver.verifyAndParseWebhook(rawBody, signature);
    expect(event.status).toBe('succeeded');
    expect(event.providerSessionId).toBe('tx_abc123');
    expect(event.providerEventId).toBe('tx_abc123');
    expect(event.currency).toBe('XOF');
    // 12500 XOF major → 1 250 000 centimes interne
    expect(event.amountMinor).toBe(1250000);
    expect(event.failureReason).toBeUndefined();
  });

  it('parses cancelled for cpm_result === "617"', async () => {
    const { rawBody, signature } = await buildSignedWebhook({
      apiKey: 'cinetpay_test_key',
      cpm_result: '617',
      cpm_error_message: 'Annulé par l’utilisateur',
    });
    const { cinetpayDriver } = await import('@/lib/payments/drivers/cinetpay');
    const event = await cinetpayDriver.verifyAndParseWebhook(rawBody, signature);
    expect(event.status).toBe('cancelled');
    expect(event.failureReason).toBe('Annulé par l’utilisateur');
  });

  it('parses failed for unknown error codes (e.g. "627")', async () => {
    const { rawBody, signature } = await buildSignedWebhook({
      apiKey: 'cinetpay_test_key',
      cpm_result: '627',
      cpm_error_message: 'INSUFFICIENT_FUNDS',
    });
    const { cinetpayDriver } = await import('@/lib/payments/drivers/cinetpay');
    const event = await cinetpayDriver.verifyAndParseWebhook(rawBody, signature);
    expect(event.status).toBe('failed');
    expect(event.failureReason).toBe('INSUFFICIENT_FUNDS');
  });

  it('rejects unsupported currencies', async () => {
    const { rawBody, signature } = await buildSignedWebhook({
      apiKey: 'cinetpay_test_key',
      cpm_result: '00',
      cpm_currency: 'USD',
    });
    const { cinetpayDriver } = await import('@/lib/payments/drivers/cinetpay');
    await expect(cinetpayDriver.verifyAndParseWebhook(rawBody, signature)).rejects.toThrow(
      'INVALID_CURRENCY',
    );
  });

  it('throws NOT_CONFIGURED when API key is missing', async () => {
    delete process.env.CINETPAY_API_KEY;
    const { cinetpayDriver } = await import('@/lib/payments/drivers/cinetpay');
    await expect(cinetpayDriver.verifyAndParseWebhook('cpm_trans_id=x', 'anysig')).rejects.toThrow(
      'CINETPAY_DRIVER_NOT_CONFIGURED',
    );
  });
});
