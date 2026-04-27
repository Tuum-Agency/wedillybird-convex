export interface WhatsAppOtpParams {
  to: string;
  code: string;
  locale?: 'fr' | 'en';
}

/**
 * Paramètres pour l'envoi d'une invitation de mariage via template Meta.
 * Les variables sont injectées en position {{1}}…{{5}} — voir
 * `lib/whatsapp/templates.ts` pour le mapping détaillé.
 */
export interface WhatsAppInvitationParams {
  to: string;
  /** Nom du template Meta validé (ex: "wedding_invitation_warm"). */
  templateName: string;
  guestFirstName: string;
  coupleNames: string;
  eventDate: string;
  invitationUrl: string;
  /** Mot perso du couple — fallback string non-vide à fournir si saisi par couple. */
  personalMessage: string;
  locale?: 'fr' | 'en';
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
  sendInvitation(params: WhatsAppInvitationParams): Promise<WhatsAppSendResult>;
}
