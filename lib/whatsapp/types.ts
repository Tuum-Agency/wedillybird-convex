export interface WhatsAppOtpParams {
  to: string;
  code: string;
  locale?: 'fr' | 'en';
}

export interface WhatsAppTemplateParams {
  to: string;
  templateName: string;
  /** Body parameters in order ({{1}}, {{2}}, ...). */
  bodyParams: ReadonlyArray<string>;
  locale?: 'fr' | 'en';
  /** Optional URL parameter for a button (sub_type=url, index=0). */
  buttonUrlParam?: string;
}

export interface WhatsAppSendResult {
  success: boolean;
  messageId?: string;
  error?: {
    code: string;
    message: string;
  };
  provider: 'meta_cloud' | 'mock';
}

export interface WhatsAppClient {
  sendOtp(params: WhatsAppOtpParams): Promise<WhatsAppSendResult>;
  sendTemplate(params: WhatsAppTemplateParams): Promise<WhatsAppSendResult>;
}
