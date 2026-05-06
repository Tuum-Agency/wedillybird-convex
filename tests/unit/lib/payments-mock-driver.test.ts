import { describe, expect, it } from 'vitest';
import { mockDriver } from '@/lib/payments/drivers/mock';

const checkoutInput = {
  provider: 'mock' as const,
  plan: 'essential' as const,
  currency: 'EUR' as const,
  amountMinor: 4900,
  eventId: 'evt_1',
  userId: 'usr_1',
  successUrl: 'https://app.test/ok',
  cancelUrl: 'https://app.test/cancel',
};

describe('payments/drivers/mock — createCheckout', () => {
  it('returns a deterministic redirect URL containing all checkout params', async () => {
    const session = await mockDriver.createCheckout(checkoutInput);
    expect(session.providerSessionId).toMatch(/^mock_sess_/);
    expect(session.redirectUrl).toContain('/api/checkout/mock');
    expect(session.redirectUrl).toContain(`session=${session.providerSessionId}`);
    expect(session.redirectUrl).toContain('plan=essential');
    expect(session.redirectUrl).toContain('currency=EUR');
    expect(session.redirectUrl).toContain('amount=4900');
  });

  it('embeds session_id and provider in the success URL for finalization', async () => {
    const session = await mockDriver.createCheckout(checkoutInput);
    expect(session.redirectUrl).toContain(
      encodeURIComponent(`session_id=${session.providerSessionId}`),
    );
    expect(session.redirectUrl).toContain(encodeURIComponent('provider=mock'));
  });
});

describe('payments/drivers/mock — retrieveSessionStatus', () => {
  it('returns paid:true echoing back the session id', async () => {
    const result = await mockDriver.retrieveSessionStatus('mock_sess_xyz');
    expect(result.paid).toBe(true);
    expect(result.providerSessionId).toBe('mock_sess_xyz');
    expect(result.providerEventId).toBe('mock_evt_mock_sess_xyz');
  });
});

describe('payments/drivers/mock — verifyAndParseWebhook', () => {
  function makePayload(overrides: Partial<Record<string, unknown>> = {}): string {
    return JSON.stringify({
      providerSessionId: 'mock_sess_abc',
      providerEventId: 'mock_evt_xyz',
      status: 'succeeded',
      amountMinor: 4900,
      currency: 'EUR',
      ...overrides,
    });
  }

  it('rejects requests with no signature', async () => {
    await expect(mockDriver.verifyAndParseWebhook(makePayload(), null)).rejects.toThrow(
      'INVALID_SIGNATURE',
    );
  });

  it('rejects requests with a wrong signature', async () => {
    await expect(mockDriver.verifyAndParseWebhook(makePayload(), 'nope')).rejects.toThrow(
      'INVALID_SIGNATURE',
    );
  });

  it('parses a succeeded event', async () => {
    const result = await mockDriver.verifyAndParseWebhook(makePayload(), 'mock-signature');
    expect(result).toEqual({
      providerSessionId: 'mock_sess_abc',
      providerEventId: 'mock_evt_xyz',
      status: 'succeeded',
      amountMinor: 4900,
      currency: 'EUR',
      failureReason: undefined,
    });
  });

  it('parses a failed event with reason', async () => {
    const result = await mockDriver.verifyAndParseWebhook(
      makePayload({ status: 'failed', failureReason: 'card_declined' }),
      'mock-signature',
    );
    expect(result.status).toBe('failed');
    expect(result.failureReason).toBe('card_declined');
  });

  it('rejects unknown status', async () => {
    await expect(
      mockDriver.verifyAndParseWebhook(makePayload({ status: 'unknown' }), 'mock-signature'),
    ).rejects.toThrow('INVALID_STATUS');
  });

  it('rejects unsupported currencies', async () => {
    // GBP n'est jamais une devise supportée par Wedillybird (USD est désormais
    // valide pour la région americas).
    await expect(
      mockDriver.verifyAndParseWebhook(makePayload({ currency: 'GBP' }), 'mock-signature'),
    ).rejects.toThrow('INVALID_CURRENCY');
  });

  it('rejects negative or non-finite amounts', async () => {
    await expect(
      mockDriver.verifyAndParseWebhook(makePayload({ amountMinor: -1 }), 'mock-signature'),
    ).rejects.toThrow('INVALID_AMOUNT');
  });

  it('rejects payload missing identifiers', async () => {
    await expect(
      mockDriver.verifyAndParseWebhook(
        makePayload({ providerSessionId: '', providerEventId: '' }),
        'mock-signature',
      ),
    ).rejects.toThrow('INVALID_PAYLOAD');
  });
});
