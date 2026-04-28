import type { EmailRendered } from '../types';
import { button, escapeHtml, htmlLayout, paragraph } from './_layout';

export type TemplateStatusKind = 'approved' | 'rejected' | 'disabled' | 'paused';

export interface WhatsappTemplateStatusInput {
  recipientName: string;
  templateName: string;
  eventTitle: string;
  status: TemplateStatusKind;
  rejectionReason?: string;
  /** URL de retour vers la page messaging de l'événement (CTA bouton). */
  ctaUrl?: string;
}

const SUBJECT: Record<TemplateStatusKind, string> = {
  approved: 'Votre template WhatsApp est validé',
  rejected: 'Votre template WhatsApp a été refusé',
  disabled: 'Votre template WhatsApp a été désactivé',
  paused: 'Votre template WhatsApp est suspendu',
};

const STATUS_VERB: Record<TemplateStatusKind, string> = {
  approved: 'validé',
  rejected: 'refusé',
  disabled: 'désactivé',
  paused: 'suspendu',
};

const STATUS_BODY_LEAD: Record<TemplateStatusKind, (eventTitle: string) => string> = {
  approved: (eventTitle) =>
    `Bonne nouvelle — WhatsApp vient de valider votre template d'invitation pour ${eventTitle}. Il est maintenant prêt à être utilisé pour envoyer vos invitations.`,
  rejected: (eventTitle) =>
    `WhatsApp n'a pas validé votre template d'invitation pour ${eventTitle}. Vous pouvez ajuster le texte et le soumettre à nouveau, ou choisir un style préfabriqué en attendant.`,
  disabled: (eventTitle) =>
    `WhatsApp a définitivement désactivé votre template d'invitation pour ${eventTitle}. Il faudra créer un nouveau template ou utiliser un style préfabriqué.`,
  paused: (eventTitle) =>
    `WhatsApp a temporairement suspendu votre template d'invitation pour ${eventTitle} suite à des signaux qualité. Vous pourrez le réutiliser après vérification par WhatsApp.`,
};

export function renderWhatsappTemplateStatusEmail(
  input: WhatsappTemplateStatusInput,
): EmailRendered {
  const { recipientName, templateName, eventTitle, status, rejectionReason, ctaUrl } = input;
  const subject = SUBJECT[status];
  const verb = STATUS_VERB[status];
  const lead = STATUS_BODY_LEAD[status](eventTitle);

  const reasonBlock =
    (status === 'rejected' || status === 'disabled' || status === 'paused') && rejectionReason
      ? `<div style="margin:16px 0;padding:14px 16px;background:#fdf3ee;border-left:3px solid #c68567;border-radius:6px;font-size:14px;line-height:1.5;color:#533a26;"><strong>Raison communiquée par WhatsApp :</strong><br/>${escapeHtml(
          rejectionReason,
        )}</div>`
      : '';

  const html = htmlLayout({
    preheader: `${templateName} — ${verb} par WhatsApp`,
    body:
      paragraph(`Bonjour ${recipientName},`) +
      paragraph(lead) +
      `<p style="margin:0 0 16px 0;">Template concerné : <em style="font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:14px;">${escapeHtml(
        templateName,
      )}</em></p>` +
      reasonBlock +
      (ctaUrl
        ? button(status === 'approved' ? 'Envoyer mes invitations' : 'Ajuster mon message', ctaUrl)
        : ''),
    footer: 'Notification automatique liée à la validation Meta WhatsApp Business.',
  });

  const text = [
    `Bonjour ${recipientName},`,
    '',
    lead,
    '',
    `Template : ${templateName}`,
    ...(reasonBlock && rejectionReason ? ['', `Raison : ${rejectionReason}`] : []),
    ...(ctaUrl ? ['', ctaUrl] : []),
    '',
    '— Wedillybird',
  ].join('\n');

  return { subject, html, text };
}
