import type { WhatsAppClient, WhatsAppOtpParams, WhatsAppSendResult } from './types';

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
}
