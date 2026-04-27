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

/**
 * Paramètres pour l'envoi d'un rappel WhatsApp (J-7 / J-1) via template Meta.
 * Variables body séquentielles {{1}}…{{N}}, plus une variable bouton URL
 * dynamique (segment dynamique de l'URL d'invitation).
 */
export interface WhatsAppReminderParams {
  to: string;
  /** Nom du template Meta validé (ex: "wedding_reminder_d7"). */
  templateName: string;
  /** Variables body, ordonnées {{1}}, {{2}}, … */
  bodyParams: string[];
  /** Segment dynamique du bouton URL (en général qrCodeToken). */
  urlButtonParam: string;
  locale?: 'fr' | 'en';
}

export interface WhatsAppClient {
  sendOtp(params: WhatsAppOtpParams): Promise<WhatsAppSendResult>;
  sendInvitation(params: WhatsAppInvitationParams): Promise<WhatsAppSendResult>;
  sendReminder(params: WhatsAppReminderParams): Promise<WhatsAppSendResult>;
}
