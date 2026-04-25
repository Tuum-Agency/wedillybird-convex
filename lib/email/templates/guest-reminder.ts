import type { EmailRendered } from '../types';
import { button, htmlLayout, paragraph } from './_layout';

export type GuestReminderInput = {
  guestName: string;
  eventTitle: string;
  eventDate: string;
  invitationUrl: string;
  daysUntilEvent: number;
};

export function renderGuestReminder(input: GuestReminderInput): EmailRendered {
  const { guestName, eventTitle, eventDate, invitationUrl, daysUntilEvent } = input;
  const subject =
    daysUntilEvent <= 1
      ? `C'est demain : ${eventTitle}`
      : `J-${daysUntilEvent} avant ${eventTitle}`;

  const html = htmlLayout({
    preheader: `${eventTitle} approche — confirmez votre présence`,
    body:
      paragraph(`Bonjour ${guestName},`) +
      paragraph(
        `Plus que ${daysUntilEvent} jour${daysUntilEvent > 1 ? 's' : ''} avant ${eventTitle} le ${eventDate}.`,
      ) +
      paragraph('Confirmez votre présence et accédez à votre invitation :') +
      button('Voir mon invitation', invitationUrl) +
      paragraph('À très vite !'),
    footer: 'Cet email vous est envoyé par les hôtes de votre événement via Wedillybird.',
  });

  const text = [
    `Bonjour ${guestName},`,
    '',
    `Plus que ${daysUntilEvent} jour${daysUntilEvent > 1 ? 's' : ''} avant ${eventTitle} le ${eventDate}.`,
    '',
    'Confirmez votre présence ici :',
    invitationUrl,
    '',
    'À très vite !',
    '',
    '— Wedillybird',
  ].join('\n');

  return { subject, html, text };
}
