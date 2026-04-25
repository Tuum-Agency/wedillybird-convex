import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WhatsAppMockClient } from '@/lib/whatsapp/mock';
import { WhatsAppMetaCloudClient } from '@/lib/whatsapp/meta-cloud';
import { createWhatsAppClient } from '@/lib/whatsapp';

describe('WhatsAppMockClient.sendTemplate', () => {
  it('logs and returns success', async () => {
    const lines: string[] = [];
    const client = new WhatsAppMockClient((m) => lines.push(m));
    const result = await client.sendTemplate({
      to: '+33611111111',
      templateName: 'team_invitation',
      bodyParams: ['Alice', 'Tuum', 'https://wedillybird.com/pro/invite/AAA'],
    });

    expect(result.success).toBe(true);
    expect(result.provider).toBe('mock');
    expect(lines[0]).toContain('template=team_invitation');
    expect(lines[0]).toContain('+33611111111');
  });
});

describe('WhatsAppMetaCloudClient.sendTemplate', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('POSTs to Graph with body+button parameters and returns the messageId', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ messages: [{ id: 'wamid_XYZ' }] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = new WhatsAppMetaCloudClient({
      accessToken: 'EAAB',
      phoneNumberId: '12345',
      templateName: 'unused',
      graphVersion: 'v23.0',
    });
    const result = await client.sendTemplate({
      to: '+33611111111',
      templateName: 'team_invitation',
      bodyParams: ['Alice', 'Tuum', 'https://wedillybird.com/pro/invite/AAA'],
      buttonUrlParam: 'https://wedillybird.com/pro/invite/AAA',
    });

    expect(result.success).toBe(true);
    expect(result.messageId).toBe('wamid_XYZ');

    const [, init] = fetchMock.mock.calls[0]!;
    const payload = JSON.parse(init.body);
    expect(payload.template.name).toBe('team_invitation');
    expect(payload.template.components[0].parameters).toHaveLength(3);
    expect(payload.template.components[0].parameters[0]).toEqual({ type: 'text', text: 'Alice' });
    expect(payload.template.components[1].sub_type).toBe('url');
    expect(payload.to).toBe('33611111111'); // strips leading +
  });

  it('returns failure when Graph reports an error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error: { code: 100, message: 'Param missing' } }),
      }),
    );
    const client = new WhatsAppMetaCloudClient({
      accessToken: 'EAAB',
      phoneNumberId: '12345',
      templateName: 'unused',
    });
    const result = await client.sendTemplate({
      to: '+33611111111',
      templateName: 'team_invitation',
      bodyParams: ['Alice'],
    });
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('100');
  });
});

describe('createWhatsAppClient factory', () => {
  it('returns a mock client when no access token is configured', () => {
    const client = createWhatsAppClient({});
    expect(client).toBeInstanceOf(WhatsAppMockClient);
  });

  it('returns the meta-cloud client when env is fully configured', () => {
    const client = createWhatsAppClient({
      WHATSAPP_ACCESS_TOKEN: 'EAAB',
      WHATSAPP_PHONE_NUMBER_ID: '12345',
    });
    expect(client).toBeInstanceOf(WhatsAppMetaCloudClient);
  });
});
