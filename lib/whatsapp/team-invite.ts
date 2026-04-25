import { createWhatsAppClient } from './index';
import type { WhatsAppClient } from './types';

export interface TeamInviteInput {
  phone: string;
  inviterName: string;
  organizationName: string;
  inviteUrl: string;
}

export interface TeamInviteResult {
  ok: boolean;
  reason?: string;
  messageId?: string;
}

/**
 * Pure function: sends the team invite WhatsApp template if configured, else
 * logs and returns ok:false with reason 'NO_TEMPLATE'. Extracted from the
 * Convex action so we can unit-test without standing up a Convex runtime.
 */
export async function sendTeamInviteWhatsApp(
  input: TeamInviteInput,
  options: {
    env?: Record<string, string | undefined>;
    client?: WhatsAppClient;
    logger?: (msg: string) => void;
  } = {},
): Promise<TeamInviteResult> {
  const env = options.env ?? process.env;
  const logger = options.logger ?? console.info;
  const templateName = env.WHATSAPP_TEAM_TEMPLATE;

  if (!templateName) {
    logger(`[whatsapp:no-template] skipping team invite to ${input.phone}`);
    return { ok: false, reason: 'NO_TEMPLATE' };
  }

  const client = options.client ?? createWhatsAppClient(env);
  const result = await client.sendTemplate({
    to: input.phone,
    templateName,
    bodyParams: [input.inviterName, input.organizationName, input.inviteUrl],
    buttonUrlParam: input.inviteUrl,
    locale: 'fr',
  });

  if (!result.success) {
    return { ok: false, reason: result.error?.code ?? 'SEND_FAILED' };
  }
  return { ok: true, messageId: result.messageId };
}
