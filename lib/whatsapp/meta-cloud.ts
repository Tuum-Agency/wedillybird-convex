import type {
  WhatsAppClient,
  WhatsAppInvitationParams,
  WhatsAppOtpParams,
  WhatsAppSendResult,
} from './types';

export interface MetaCloudConfig {
  accessToken: string;
  phoneNumberId: string;
  /** Nom du template OTP Meta (login + linking). */
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
    return this.dispatch(body);
  }

  /**
   * Envoie une invitation de mariage via template Meta. Les 5 variables sont
   * passées en composants `body` ({{1}}…{{5}}) + URL dynamique du bouton CTA
   * en `button` (le lien personnalisé /i/[token]).
   */
  async sendInvitation({
    to,
    templateName,
    guestFirstName,
    coupleNames,
    eventDate,
    invitationUrl,
    personalMessage,
    locale = 'fr',
  }: WhatsAppInvitationParams): Promise<WhatsAppSendResult> {
    // Pour le bouton CTA URL dynamique, Meta attend que le param soit la
    // **dernière partie** de l'URL (le segment dynamique). On extrait le
    // token en fin de path.
    const urlSegment = invitationUrl.split('/').filter(Boolean).pop() ?? invitationUrl;

    const body = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: to.replace(/^\+/, ''),
      type: 'template',
      template: {
        name: templateName,
        language: { code: locale === 'fr' ? 'fr' : 'en_US' },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: guestFirstName },
              { type: 'text', text: coupleNames },
              { type: 'text', text: eventDate },
              { type: 'text', text: invitationUrl },
              { type: 'text', text: personalMessage },
            ],
          },
          {
            type: 'button',
            sub_type: 'url',
            index: '0',
            parameters: [{ type: 'text', text: urlSegment }],
          },
        ],
      },
    };
    return this.dispatch(body);
  }

  /**
   * Helper interne : POST le body au endpoint Cloud API + parse la réponse
   * en `WhatsAppSendResult` standardisé.
   */
  private async dispatch(body: object): Promise<WhatsAppSendResult> {
    const url = `https://graph.facebook.com/${this.config.graphVersion}/${this.config.phoneNumberId}/messages`;
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
