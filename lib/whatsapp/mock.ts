import type {
  WhatsAppClient,
  WhatsAppOtpParams,
  WhatsAppSendResult,
  WhatsAppTemplateParams,
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

  async sendTemplate(params: WhatsAppTemplateParams): Promise<WhatsAppSendResult> {
    this.logger(
      `[whatsapp:mock] template=${params.templateName} -> ${params.to} body=${params.bodyParams.join('|')}`,
    );
    return {
      success: true,
      messageId: `mock_tpl_${Date.now()}`,
      provider: 'mock',
    };
  }
}
