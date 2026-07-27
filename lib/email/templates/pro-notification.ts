import type { Locale } from '../../../i18n/routing';
import { getServerTranslator } from '../../i18n/server-translator';
import type { EmailRendered } from '../types';
import { button, htmlLayout, paragraph } from './_layout';

export type ProNotificationKind =
  | 'team-member-added'
  | 'payment-received'
  | 'subscription-renewed'
  | 'subscription-failed'
  | 'payg-credit-activated'
  | 'photo-book-ordered';

export type ProNotificationInput = {
  recipientName: string;
  organizationName: string;
  kind: ProNotificationKind;
  detail: string;
  ctaLabel?: string;
  ctaUrl?: string;
  locale?: Locale | string;
};

const KIND_KEY: Record<ProNotificationKind, string> = {
  'team-member-added': 'teamMemberAdded',
  'payment-received': 'paymentReceived',
  'subscription-renewed': 'subscriptionRenewed',
  'subscription-failed': 'subscriptionFailed',
  'payg-credit-activated': 'paygCreditActivated',
  'photo-book-ordered': 'photoBookOrdered',
};

export function renderProNotification(input: ProNotificationInput): EmailRendered {
  const { recipientName, organizationName, kind, detail, ctaLabel, ctaUrl, locale } = input;
  const t = getServerTranslator(locale);

  const subject = t(
    `Emails.proNotification.${KIND_KEY[kind]}.subject` as 'Emails.proNotification.teamMemberAdded.subject',
    {
      organizationName,
    },
  );

  const html = htmlLayout({
    preheader: detail,
    body:
      paragraph(t('Emails.common.greeting', { name: recipientName })) +
      paragraph(detail) +
      (ctaLabel && ctaUrl ? button(ctaLabel, ctaUrl) : ''),
    footer: t('Emails.proNotification.footer', { organizationName }),
    locale,
  });

  const text = [
    t('Emails.common.greeting', { name: recipientName }),
    '',
    detail,
    ...(ctaLabel && ctaUrl ? ['', ctaLabel + ' :', ctaUrl] : []),
    '',
    t('Emails.proNotification.signatureWithOrg', { organizationName }),
  ].join('\n');

  return { subject, html, text };
}
