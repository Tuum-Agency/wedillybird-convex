import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHmac } from 'node:crypto';

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env.CINETPAY_API_KEY = 'cp_api_TEST';
  process.env.CINETPAY_SITE_ID = '12345';
  process.env.CINETPAY_WEBHOOK_SECRET = 'whsec_TEST';
  process.env.NEXT_PUBLIC_APP_URL = 'https://wedillybird.test';
  vi.resetModules();
  vi.restoreAllMocks();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

const checkoutInput = {
  provider: 'cinetpay' as const,
  plan: 'essential' as const,
  currency: 'XOF' as const,
  amountMinor: 3200000, // 32 000 XOF stored as centimes
  eventId: 'evt_1',
  userId: 'usr_1',
  successUrl: 'https://app.test/ok',
  cancelUrl: 'https://app.test/cancel',
};

describe('payments/drivers/cinetpay — createCheckout', () => {
  it('initialises a CinetPay payment and returns transaction id + redirect URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        code: '201',
        data: { payment_url: 'https://checkout.cinetpay.com/abc', payment_token: 'tok_xyz' },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { cinetpayDriver } = await import('@/lib/payments/drivers/cinetpay');
    const result = await cinetpayDriver.createCheckout(checkoutInput);

    expect(result.redirectUrl).toBe('https://checkout.cinetpay.com/abc');
    expect(result.providerSessionId).toMatch(/^wd_evt_1_/);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api-checkout.cinetpay.com/v2/payment');
    const sent = JSON.parse(opts.body);
    expect(sent.apikey).toBe('cp_api_TEST');
    expect(sent.site_id).toBe('12345');
    // XOF stored as centimes -> CinetPay expects whole units
    expect(sent.amount).toBe(32000);
    expect(sent.currency).toBe('XOF');
    expect(sent.channels).toBe('ALL');
    expect(sent.notify_url).toBe('https://wedillybird.test/api/webhooks/cinetpay');
    expect(sent.return_url).toBe('https://app.test/ok');
  });

  it('throws CINETPAY_DRIVER_NOT_CONFIGURED when api key is missing', async () => {
    delete process.env.CINETPAY_API_KEY;
    const { cinetpayDriver } = await import('@/lib/payments/drivers/cinetpay');
    await expect(cinetpayDriver.createCheckout(checkoutInput)).rejects.toThrow(
      'CINETPAY_DRIVER_NOT_CONFIGURED',
    );
  });

  it('throws CINETPAY_DRIVER_NOT_CONFIGURED when site id is missing', async () => {
    delete process.env.CINETPAY_SITE_ID;
    const { cinetpayDriver } = await import('@/lib/payments/drivers/cinetpay');
    await expect(cinetpayDriver.createCheckout(checkoutInput)).rejects.toThrow(
      'CINETPAY_DRIVER_NOT_CONFIGURED',
    );
  });

  it('throws CINETPAY_INIT_FAILED when CinetPay returns a non-201 code', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ code: '608', message: 'MINIMUM_REQUIRED_FIELDS' }),
      }),
    );
    const { cinetpayDriver } = await import('@/lib/payments/drivers/cinetpay');
    await expect(cinetpayDriver.createCheckout(checkoutInput)).rejects.toThrow(
      /CINETPAY_INIT_FAILED:608/,
    );
  });
});

describe('payments/drivers/cinetpay — verifyAndParseWebhook', () => {
  function signedBody(body: string, secret = 'whsec_TEST'): string {
    return createHmac('sha256', secret).update(body).digest('hex');
  }

  it('returns succeeded when signature is valid and trans_status === ACCEPTED', async () => {
    const body = new URLSearchParams({
      cpm_trans_id: 'wd_evt_1_1234',
      cpm_amount: '32000',
      cpm_currency: 'XOF',
      cpm_trans_status: 'ACCEPTED',
    }).toString();
    const sig = signedBody(body);

    const { cinetpayDriver } = await import('@/lib/payments/drivers/cinetpay');
    const result = await cinetpayDriver.verifyAndParseWebhook(body, sig);

    expect(result.status).toBe('succeeded');
    expect(result.providerSessionId).toBe('wd_evt_1_1234');
    expect(result.currency).toBe('XOF');
    // CinetPay returned 32000 whole units; we re-multiply XOF back to centimes
    expect(result.amountMinor).toBe(3200000);
  });

  it('rejects when the HMAC signature does not match', async () => {
    const body = 'cpm_trans_id=t&cpm_amount=10&cpm_currency=EUR&cpm_trans_status=ACCEPTED';
    const { cinetpayDriver } = await import('@/lib/payments/drivers/cinetpay');
    await expect(cinetpayDriver.verifyAndParseWebhook(body, 'deadbeef')).rejects.toThrow(
      'INVALID_SIGNATURE',
    );
  });

  it('rejects when no signature header is provided', async () => {
    const { cinetpayDriver } = await import('@/lib/payments/drivers/cinetpay');
    await expect(cinetpayDriver.verifyAndParseWebhook('a=1', null)).rejects.toThrow(
      'INVALID_SIGNATURE',
    );
  });

  it('maps CANCELED to cancelled and REFUSED to failed', async () => {
    const { cinetpayDriver } = await import('@/lib/payments/drivers/cinetpay');

    const cancelledBody = new URLSearchParams({
      cpm_trans_id: 't1',
      cpm_amount: '10',
      cpm_currency: 'EUR',
      cpm_trans_status: 'CANCELED',
    }).toString();
    const refusedBody = new URLSearchParams({
      cpm_trans_id: 't2',
      cpm_amount: '10',
      cpm_currency: 'EUR',
      cpm_trans_status: 'REFUSED',
    }).toString();

    const cancelled = await cinetpayDriver.verifyAndParseWebhook(
      cancelledBody,
      signedBody(cancelledBody),
    );
    const refused = await cinetpayDriver.verifyAndParseWebhook(
      refusedBody,
      signedBody(refusedBody),
    );

    expect(cancelled.status).toBe('cancelled');
    expect(refused.status).toBe('failed');
    expect(refused.failureReason).toBe('REFUSED');
  });
});

describe('payments/drivers/cinetpay — retrieveSessionStatus', () => {
  it('returns paid:true when CinetPay reports ACCEPTED', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          code: '00',
          data: { amount: 32000, currency: 'XOF', status: 'ACCEPTED' },
        }),
      }),
    );
    const { cinetpayDriver } = await import('@/lib/payments/drivers/cinetpay');
    const result = await cinetpayDriver.retrieveSessionStatus('wd_evt_1_1');

    expect(result.paid).toBe(true);
    expect(result.currency).toBe('XOF');
    expect(result.amountMinor).toBe(3200000);
  });

  it('throws when CinetPay returns no data block', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ code: '623' }),
      }),
    );
    const { cinetpayDriver } = await import('@/lib/payments/drivers/cinetpay');
    await expect(cinetpayDriver.retrieveSessionStatus('missing')).rejects.toThrow(
      /CINETPAY_CHECK_FAILED/,
    );
  });
});
