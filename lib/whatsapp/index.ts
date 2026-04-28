import { WhatsAppMetaCloudClient } from './meta-cloud';
import { WhatsAppMockClient } from './mock';
import type { WhatsAppClient } from './types';

export function createWhatsAppClient(
  env: Record<string, string | undefined> = process.env,
): WhatsAppClient {
  // Mode E2E : force le mock peu importe les credentials, pour que les tests
  // Playwright n'envoient jamais de message WhatsApp réel via Meta. Ce flag est
  // posé côté env Convex (`pnpx convex env set E2E_MODE 1`) avant les tests, et
  // côté webServer Playwright (cf. playwright.config.ts).
  if (env.E2E_MODE === '1') {
    return new WhatsAppMockClient();
  }

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
