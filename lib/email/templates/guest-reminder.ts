import type { Locale } from '../../../i18n/routing';
import { getServerTranslator } from '../../i18n/server-translator';
import type { EmailRendered } from '../types';
import { button, htmlLayout, paragraph } from './_layout';

export type GuestReminderInput = {
  guestName: string;
  eventTitle: string;
  eventDate: string;
  invitationUrl: string;
  daysUntilEvent: number;
  locale?: Locale | string;
};

export function renderGuestReminder(input: GuestReminderInput): EmailRendered {
  const { guestName, eventTitle, eventDate, invitationUrl, daysUntilEvent, locale } = input;
  const t = getServerTranslator(locale);

  const subject =
    daysUntilEvent <= 1
      ? t('Emails.guestReminder.subjectDayBefore', { eventTitle })
      : t('Emails.guestReminder.subjectDaysBefore', { days: daysUntilEvent, eventTitle });

  const bodyLine =
    daysUntilEvent <= 1
      ? t('Emails.guestReminder.bodyDayBefore', { eventTitle, eventDate })
      : t('Emails.guestReminder.bodyDaysBefore', { days: daysUntilEvent, eventTitle, eventDate });

  const html = htmlLayout({
    preheader: t('Emails.guestReminder.preheader', { eventTitle }),
    body:
      paragraph(t('Emails.common.greeting', { name: guestName })) +
      paragraph(bodyLine) +
      paragraph(t('Emails.guestReminder.callToAction')) +
      button(t('Emails.guestReminder.ctaLabel'), invitationUrl) +
      paragraph(t('Emails.guestReminder.closing')),
    footer: t('Emails.guestReminder.footer'),
    locale,
  });

  const text = [
    t('Emails.common.greeting', { name: guestName }),
    '',
    bodyLine,
    '',
    t('Emails.guestReminder.textConfirmHere'),
    invitationUrl,
    '',
    t('Emails.guestReminder.closing'),
    '',
    t('Emails.common.signature'),
  ].join('\n');

  return { subject, html, text };
}
