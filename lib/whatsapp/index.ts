import { WhatsAppMetaCloudClient } from './meta-cloud';
import { WhatsAppMockClient } from './mock';
import type { WhatsAppClient } from './types';

export function createWhatsAppClient(
  env: Record<string, string | undefined> = process.env,
): WhatsAppClient {
  const accessToken = env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = env.WHATSAPP_PHONE_NUMBER_ID;
  const templateName = env.WHATSAPP_OTP_TEMPLATE ?? 'otp_code';

  if (!accessToken || !phoneNumberId) {
    return new WhatsAppMockClient();
  }

  return new WhatsAppMetaCloudClient({
    accessToken,
    phoneNumberId,
    templateName,
    ...(env.WHATSAPP_GRAPH_VERSION ? { graphVersion: env.WHATSAPP_GRAPH_VERSION } : {}),
  });
}

export { WhatsAppMockClient } from './mock';
export { WhatsAppMetaCloudClient } from './meta-cloud';
export {
  INVITATION_STYLES,
  DEFAULT_INVITATION_STYLE,
  DEFAULT_PERSONAL_MESSAGE_FALLBACK,
  renderInvitationPreview,
  getMetaTemplateName,
  type InvitationStyle,
  type InvitationStyleId,
} from './templates';
export type {
  WhatsAppClient,
  WhatsAppOtpParams,
  WhatsAppInvitationParams,
  WhatsAppSendResult,
} from './types';
