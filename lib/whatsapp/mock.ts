import type {
  WhatsAppClient,
  WhatsAppInvitationParams,
  WhatsAppOtpParams,
  WhatsAppReminderParams,
  WhatsAppSendResult,
} from './types';

export class WhatsAppMockClient implements WhatsAppClient {
  private readonly logger: (msg: string) => void;

  constructor(logger: (msg: string) => void = console.info) {
    this.logger = logger;
  }

  async sendOtp(params: WhatsAppOtpParams): Promise<WhatsAppSendResult> {
    this.logger(`[whatsapp:mock] OTP ${params.code} -> ${params.to}`);
    return {
      success: true,
      messageId: `mock_${Date.now()}`,
      provider: 'mock',
    };
  }

  async sendInvitation(params: WhatsAppInvitationParams): Promise<WhatsAppSendResult> {
    this.logger(
      `[whatsapp:mock] INVITATION (${params.templateName}) -> ${params.to} | guest="${params.guestFirstName}" couple="${params.coupleNames}" date="${params.eventDate}" url="${params.invitationUrl}"`,
    );
    return {
      success: true,
      messageId: `mock_invite_${Date.now()}`,
      provider: 'mock',
    };
  }

  async sendReminder(params: WhatsAppReminderParams): Promise<WhatsAppSendResult> {
    this.logger(
      `[whatsapp:mock] REMINDER (${params.templateName}) -> ${params.to} | body=[${params.bodyParams.join(', ')}] urlBtn="${params.urlButtonParam}"`,
    );
    return {
      success: true,
      messageId: `mock_reminder_${Date.now()}`,
      provider: 'mock',
    };
  }
}
