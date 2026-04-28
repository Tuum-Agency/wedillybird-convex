import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildWhatsAppCloudUrl,
  isWhatsAppCloudConfigured,
  sendWhatsAppCloudTemplate,
  shouldUseWhatsAppMock,
} from '../../../convex/lib/whatsappCloud';

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  // Clean state for each test.
  delete process.env.WHATSAPP_ACCESS_TOKEN;
  delete process.env.WHATSAPP_PHONE_NUMBER_ID;
  delete process.env.WHATSAPP_GRAPH_VERSION;
  delete process.env.E2E_MODE;
  vi.restoreAllMocks();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('isWhatsAppCloudConfigured', () => {
  it('false when token missing', () => {
    process.env.WHATSAPP_PHONE_NUMBER_ID = '123';
    expect(isWhatsAppCloudConfigured()).toBe(false);
  });

  it('false when phone id missing', () => {
    process.env.WHATSAPP_ACCESS_TOKEN = 'tok';
    expect(isWhatsAppCloudConfigured()).toBe(false);
  });

  it('true when both set', () => {
    process.env.WHATSAPP_ACCESS_TOKEN = 'tok';
    process.env.WHATSAPP_PHONE_NUMBER_ID = '123';
    expect(isWhatsAppCloudConfigured()).toBe(true);
  });
});

describe('shouldUseWhatsAppMock', () => {
  it('always mock when E2E_MODE=1, even with creds', () => {
    process.env.WHATSAPP_ACCESS_TOKEN = 'tok';
    process.env.WHATSAPP_PHONE_NUMBER_ID = '123';
    process.env.E2E_MODE = '1';
    expect(shouldUseWhatsAppMock()).toBe(true);
  });

  it('mock when no creds', () => {
    expect(shouldUseWhatsAppMock()).toBe(true);
  });

  it('not mock when creds + no E2E', () => {
    process.env.WHATSAPP_ACCESS_TOKEN = 'tok';
    process.env.WHATSAPP_PHONE_NUMBER_ID = '123';
    expect(shouldUseWhatsAppMock()).toBe(false);
  });
});

describe('buildWhatsAppCloudUrl', () => {
  it('uses default v23.0 when no version provided', () => {
    expect(buildWhatsAppCloudUrl({ accessToken: 't', phoneNumberId: '999' })).toBe(
      'https://graph.facebook.com/v23.0/999/messages',
    );
  });

  it('honors graphVersion arg', () => {
    expect(buildWhatsAppCloudUrl({ accessToken: 't', phoneNumberId: '999' }, 'v22.0')).toBe(
      'https://graph.facebook.com/v22.0/999/messages',
    );
  });
});

describe('sendWhatsAppCloudTemplate (mock mode)', () => {
  it('returns error WHATSAPP_NOT_CONFIGURED when no credentials and not E2E mode (security F-04)', async () => {
    const res = await sendWhatsAppCloudTemplate({
      to: '+33612345678',
      templateName: 'otp_code',
      components: [{ type: 'body', parameters: [{ type: 'text', text: '123456' }] }],
    });
    expect(res.ok).toBe(false);
    expect(res.error).toBe('WHATSAPP_NOT_CONFIGURED');
  });

  it('returns ok+mock when E2E_MODE=1 even with creds', async () => {
    process.env.WHATSAPP_ACCESS_TOKEN = 'tok';
    process.env.WHATSAPP_PHONE_NUMBER_ID = '123';
    process.env.E2E_MODE = '1';
    const res = await sendWhatsAppCloudTemplate({
      to: '+33612345678',
      templateName: 'otp_code',
      components: [],
    });
    expect(res.ok).toBe(true);
    expect(res.mock).toBe(true);
  });
});

describe('sendWhatsAppCloudTemplate (live mode)', () => {
  beforeEach(() => {
    process.env.WHATSAPP_ACCESS_TOKEN = 'fake-tok';
    process.env.WHATSAPP_PHONE_NUMBER_ID = '999';
  });

  it('posts to graph.facebook.com with the correct body and returns messageId', async () => {
    const fetchSpy = vi.fn(
      async () =>
        new Response(JSON.stringify({ messages: [{ id: 'wamid.foo' }] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    );
    vi.stubGlobal('fetch', fetchSpy);

    const res = await sendWhatsAppCloudTemplate({
      to: '+33612345678',
      templateName: 'otp_code',
      components: [{ type: 'body', parameters: [{ type: 'text', text: 'hello' }] }],
    });

    expect(res.ok).toBe(true);
    expect(res.mock).toBe(false);
    expect(res.messageId).toBe('wamid.foo');
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const call = fetchSpy.mock.calls[0] as unknown as [string, { body: string }];
    expect(call[0]).toBe('https://graph.facebook.com/v23.0/999/messages');
    const body = JSON.parse(call[1].body);
    expect(body).toMatchObject({
      messaging_product: 'whatsapp',
      to: '33612345678', // leading + is stripped
      type: 'template',
      template: {
        name: 'otp_code',
        language: { code: 'fr' },
      },
    });
    vi.unstubAllGlobals();
  });

  it('returns ok=false with HTTP error code when the API rejects', async () => {
    const fetchSpy = vi.fn(
      async () =>
        new Response(JSON.stringify({ error: { message: 'invalid recipient', code: 132000 } }), {
          status: 400,
          headers: { 'content-type': 'application/json' },
        }),
    );
    vi.stubGlobal('fetch', fetchSpy);

    const res = await sendWhatsAppCloudTemplate({
      to: '+33612345678',
      templateName: 'otp_code',
      components: [],
    });
    expect(res.ok).toBe(false);
    expect(res.error).toBe('invalid recipient');
    expect(res.httpStatus).toBe(400);
    vi.unstubAllGlobals();
  });

  it('returns ok=false when fetch throws (network)', async () => {
    const fetchSpy = vi.fn(async () => {
      throw new Error('boom');
    });
    vi.stubGlobal('fetch', fetchSpy);

    const res = await sendWhatsAppCloudTemplate({
      to: '+33612345678',
      templateName: 'otp_code',
      components: [],
    });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/network: boom/);
    vi.unstubAllGlobals();
  });
});
