import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildTwilioMessagesUrl,
  isTwilioConfigured,
  sendTwilioSms,
  shouldUseTwilioMock,
} from '../../../convex/lib/twilioSms';

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  delete process.env.TWILIO_ACCOUNT_SID;
  delete process.env.TWILIO_AUTH_TOKEN;
  delete process.env.TWILIO_MESSAGING_SERVICE_SID;
  delete process.env.TWILIO_FROM_NUMBER;
  delete process.env.E2E_MODE;
  vi.restoreAllMocks();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('isTwilioConfigured', () => {
  it('false when account sid missing', () => {
    process.env.TWILIO_AUTH_TOKEN = 'tok';
    process.env.TWILIO_FROM_NUMBER = '+18335550123';
    expect(isTwilioConfigured()).toBe(false);
  });

  it('false when auth token missing', () => {
    process.env.TWILIO_ACCOUNT_SID = 'AC123';
    process.env.TWILIO_FROM_NUMBER = '+18335550123';
    expect(isTwilioConfigured()).toBe(false);
  });

  it('false when no sender (neither messaging service nor from number)', () => {
    process.env.TWILIO_ACCOUNT_SID = 'AC123';
    process.env.TWILIO_AUTH_TOKEN = 'tok';
    expect(isTwilioConfigured()).toBe(false);
  });

  it('true with sid + token + messaging service', () => {
    process.env.TWILIO_ACCOUNT_SID = 'AC123';
    process.env.TWILIO_AUTH_TOKEN = 'tok';
    process.env.TWILIO_MESSAGING_SERVICE_SID = 'MG123';
    expect(isTwilioConfigured()).toBe(true);
  });

  it('true with sid + token + from number', () => {
    process.env.TWILIO_ACCOUNT_SID = 'AC123';
    process.env.TWILIO_AUTH_TOKEN = 'tok';
    process.env.TWILIO_FROM_NUMBER = '+18335550123';
    expect(isTwilioConfigured()).toBe(true);
  });
});

describe('shouldUseTwilioMock', () => {
  it('always mock when E2E_MODE=1, even with creds', () => {
    process.env.TWILIO_ACCOUNT_SID = 'AC123';
    process.env.TWILIO_AUTH_TOKEN = 'tok';
    process.env.TWILIO_FROM_NUMBER = '+18335550123';
    process.env.E2E_MODE = '1';
    expect(shouldUseTwilioMock()).toBe(true);
  });

  it('mock when no creds', () => {
    expect(shouldUseTwilioMock()).toBe(true);
  });

  it('not mock when creds + no E2E', () => {
    process.env.TWILIO_ACCOUNT_SID = 'AC123';
    process.env.TWILIO_AUTH_TOKEN = 'tok';
    process.env.TWILIO_FROM_NUMBER = '+18335550123';
    expect(shouldUseTwilioMock()).toBe(false);
  });
});

describe('buildTwilioMessagesUrl', () => {
  it('targets the Messages.json endpoint for the account', () => {
    expect(buildTwilioMessagesUrl('AC999')).toBe(
      'https://api.twilio.com/2010-04-01/Accounts/AC999/Messages.json',
    );
  });
});

describe('sendTwilioSms (mock mode)', () => {
  it('returns error TWILIO_NOT_CONFIGURED when no credentials and not E2E mode (F-04)', async () => {
    const res = await sendTwilioSms({ to: '+14155550123', body: 'code 123456' });
    expect(res.ok).toBe(false);
    expect(res.error).toBe('TWILIO_NOT_CONFIGURED');
  });

  it('returns ok+mock when E2E_MODE=1 even with creds', async () => {
    process.env.TWILIO_ACCOUNT_SID = 'AC123';
    process.env.TWILIO_AUTH_TOKEN = 'tok';
    process.env.TWILIO_FROM_NUMBER = '+18335550123';
    process.env.E2E_MODE = '1';
    const res = await sendTwilioSms({ to: '+14155550123', body: 'code 123456' });
    expect(res.ok).toBe(true);
    expect(res.mock).toBe(true);
  });
});

describe('sendTwilioSms (live mode)', () => {
  beforeEach(() => {
    process.env.TWILIO_ACCOUNT_SID = 'AC_fake';
    process.env.TWILIO_AUTH_TOKEN = 'fake-tok';
  });

  it('posts form-encoded body with Basic auth and returns the message sid', async () => {
    process.env.TWILIO_MESSAGING_SERVICE_SID = 'MG_pool';
    const fetchSpy = vi.fn(
      async () =>
        new Response(JSON.stringify({ sid: 'SM_abc', status: 'queued' }), {
          status: 201,
          headers: { 'content-type': 'application/json' },
        }),
    );
    vi.stubGlobal('fetch', fetchSpy);

    const res = await sendTwilioSms({ to: '+14155550123', body: 'your code is 123456' });

    expect(res.ok).toBe(true);
    expect(res.mock).toBe(false);
    expect(res.messageId).toBe('SM_abc');
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const call = fetchSpy.mock.calls[0] as unknown as [
      string,
      { headers: Record<string, string>; body: string },
    ];
    expect(call[0]).toBe('https://api.twilio.com/2010-04-01/Accounts/AC_fake/Messages.json');
    expect(call[1].headers.Authorization).toBe(`Basic ${btoa('AC_fake:fake-tok')}`);
    expect(call[1].headers['Content-Type']).toBe('application/x-www-form-urlencoded');

    const body = new URLSearchParams(call[1].body);
    expect(body.get('To')).toBe('+14155550123');
    expect(body.get('Body')).toBe('your code is 123456');
    expect(body.get('MessagingServiceSid')).toBe('MG_pool');
    // When a Messaging Service is set, no fixed From is sent.
    expect(body.get('From')).toBeNull();
    vi.unstubAllGlobals();
  });

  it('uses From when only a fixed number is configured', async () => {
    process.env.TWILIO_FROM_NUMBER = '+18335550123';
    const fetchSpy = vi.fn(
      async () =>
        new Response(JSON.stringify({ sid: 'SM_def' }), {
          status: 201,
          headers: { 'content-type': 'application/json' },
        }),
    );
    vi.stubGlobal('fetch', fetchSpy);

    await sendTwilioSms({ to: '+14155550123', body: 'hi' });

    const call = fetchSpy.mock.calls[0] as unknown as [string, { body: string }];
    const body = new URLSearchParams(call[1].body);
    expect(body.get('From')).toBe('+18335550123');
    expect(body.get('MessagingServiceSid')).toBeNull();
    vi.unstubAllGlobals();
  });

  it('returns ok=false with HTTP status when Twilio rejects', async () => {
    process.env.TWILIO_FROM_NUMBER = '+18335550123';
    const fetchSpy = vi.fn(
      async () =>
        new Response(JSON.stringify({ message: 'The To number is not valid', code: 21211 }), {
          status: 400,
          headers: { 'content-type': 'application/json' },
        }),
    );
    vi.stubGlobal('fetch', fetchSpy);

    const res = await sendTwilioSms({ to: '+1', body: 'x' });
    expect(res.ok).toBe(false);
    expect(res.error).toBe('The To number is not valid');
    expect(res.httpStatus).toBe(400);
    vi.unstubAllGlobals();
  });

  it('returns ok=false when fetch throws (network)', async () => {
    process.env.TWILIO_FROM_NUMBER = '+18335550123';
    const fetchSpy = vi.fn(async () => {
      throw new Error('boom');
    });
    vi.stubGlobal('fetch', fetchSpy);

    const res = await sendTwilioSms({ to: '+14155550123', body: 'x' });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/network: boom/);
    vi.unstubAllGlobals();
  });
});
