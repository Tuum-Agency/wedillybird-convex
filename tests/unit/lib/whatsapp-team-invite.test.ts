import { describe, expect, it, vi } from 'vitest';
import { sendTeamInviteWhatsApp } from '@/lib/whatsapp/team-invite';
import type { WhatsAppClient } from '@/lib/whatsapp/types';

const baseInput = {
  phone: '+33611111111',
  inviterName: 'Alice',
  organizationName: 'Tuum',
  inviteUrl: 'https://wedillybird.com/pro/invite/AAA',
};

function makeClient(success: boolean, errorCode?: string): WhatsAppClient {
  return {
    sendOtp: vi.fn(),
    sendTemplate: vi
      .fn()
      .mockResolvedValue(
        success
          ? { success: true, provider: 'mock', messageId: 'mid_123' }
          : {
              success: false,
              provider: 'mock',
              error: { code: errorCode ?? 'OOPS', message: 'x' },
            },
      ),
  };
}

describe('sendTeamInviteWhatsApp', () => {
  it('skips and logs when WHATSAPP_TEAM_TEMPLATE is not configured', async () => {
    const logs: string[] = [];
    const result = await sendTeamInviteWhatsApp(baseInput, {
      env: {},
      logger: (m) => logs.push(m),
    });
    expect(result).toEqual({ ok: false, reason: 'NO_TEMPLATE' });
    expect(logs[0]).toContain('[whatsapp:no-template]');
    expect(logs[0]).toContain('+33611111111');
  });

  it('forwards body parameters in order and returns the messageId on success', async () => {
    const client = makeClient(true);
    const result = await sendTeamInviteWhatsApp(baseInput, {
      env: { WHATSAPP_TEAM_TEMPLATE: 'team_invitation' },
      client,
    });
    expect(result.ok).toBe(true);
    expect(result.messageId).toBe('mid_123');
    expect(client.sendTemplate).toHaveBeenCalledWith({
      to: '+33611111111',
      templateName: 'team_invitation',
      bodyParams: ['Alice', 'Tuum', 'https://wedillybird.com/pro/invite/AAA'],
      buttonUrlParam: 'https://wedillybird.com/pro/invite/AAA',
      locale: 'fr',
    });
  });

  it('returns failure with the underlying error code when send fails', async () => {
    const client = makeClient(false, '131047');
    const result = await sendTeamInviteWhatsApp(baseInput, {
      env: { WHATSAPP_TEAM_TEMPLATE: 'team_invitation' },
      client,
    });
    expect(result).toEqual({ ok: false, reason: '131047' });
  });
});
