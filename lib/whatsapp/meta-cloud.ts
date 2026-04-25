import type {
  WhatsAppClient,
  WhatsAppOtpParams,
  WhatsAppSendResult,
  WhatsAppTemplateParams,
} from './types';

export interface MetaCloudConfig {
  accessToken: string;
  phoneNumberId: string;
  templateName: string;
  graphVersion?: string;
}

export class WhatsAppMetaCloudClient implements WhatsAppClient {
  private readonly config: Required<MetaCloudConfig>;

  constructor(config: MetaCloudConfig) {
    this.config = {
      graphVersion: 'v23.0',
      ...config,
    };
  }

  async sendOtp({ to, code, locale = 'fr' }: WhatsAppOtpParams): Promise<WhatsAppSendResult> {
    const url = `https://graph.facebook.com/${this.config.graphVersion}/${this.config.phoneNumberId}/messages`;

    const body = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: to.replace(/^\+/, ''),
      type: 'template',
      template: {
        name: this.config.templateName,
        language: { code: locale === 'fr' ? 'fr' : 'en_US' },
        components: [
          {
            type: 'body',
            parameters: [{ type: 'text', text: code }],
          },
          {
            type: 'button',
            sub_type: 'url',
            index: '0',
            parameters: [{ type: 'text', text: code }],
          },
        ],
      },
    };

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = (await res.json()) as {
        messages?: Array<{ id: string }>;
        error?: { code: number; message: string; type?: string };
      };

      if (!res.ok || data.error) {
        return {
          success: false,
          provider: 'meta_cloud',
          error: {
            code: String(data.error?.code ?? res.status),
            message: data.error?.message ?? 'WhatsApp send failed',
          },
        };
      }

      return {
        success: true,
        provider: 'meta_cloud',
        messageId: data.messages?.[0]?.id,
      };
    } catch (err) {
      return {
        success: false,
        provider: 'meta_cloud',
        error: {
          code: 'NETWORK',
          message: err instanceof Error ? err.message : 'Unknown error',
        },
      };
    }
  }

  async sendTemplate({
    to,
    templateName,
    bodyParams,
    locale = 'fr',
    buttonUrlParam,
  }: WhatsAppTemplateParams): Promise<WhatsAppSendResult> {
    const url = `https://graph.facebook.com/${this.config.graphVersion}/${this.config.phoneNumberId}/messages`;

    const components: Array<Record<string, unknown>> = [
      {
        type: 'body',
        parameters: bodyParams.map((text) => ({ type: 'text', text })),
      },
    ];
    if (buttonUrlParam !== undefined) {
      components.push({
        type: 'button',
        sub_type: 'url',
        index: '0',
        parameters: [{ type: 'text', text: buttonUrlParam }],
      });
    }

    const body = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: to.replace(/^\+/, ''),
      type: 'template',
      template: {
        name: templateName,
        language: { code: locale === 'fr' ? 'fr' : 'en_US' },
        components,
      },
    };

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = (await res.json()) as {
        messages?: Array<{ id: string }>;
        error?: { code: number; message: string; type?: string };
      };

      if (!res.ok || data.error) {
        return {
          success: false,
          provider: 'meta_cloud',
          error: {
            code: String(data.error?.code ?? res.status),
            message: data.error?.message ?? 'WhatsApp send failed',
          },
        };
      }

      return {
        success: true,
        provider: 'meta_cloud',
        messageId: data.messages?.[0]?.id,
      };
    } catch (err) {
      return {
        success: false,
        provider: 'meta_cloud',
        error: {
          code: 'NETWORK',
          message: err instanceof Error ? err.message : 'Unknown error',
        },
      };
    }
  }
}
