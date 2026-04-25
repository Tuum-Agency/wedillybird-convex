import type { EmailRendered } from '../types';
import { button, htmlLayout, paragraph } from './_layout';

export type ProNotificationKind =
  | 'team-member-added'
  | 'payment-received'
  | 'subscription-renewed'
  | 'subscription-failed';

export type ProNotificationInput = {
  recipientName: string;
  organizationName: string;
  kind: ProNotificationKind;
  detail: string;
  ctaLabel?: string;
  ctaUrl?: string;
};

const SUBJECTS: Record<ProNotificationKind, (org: string) => string> = {
  'team-member-added': (org) => `Nouveau membre dans ${org}`,
  'payment-received': (org) => `Paiement reçu — ${org}`,
  'subscription-renewed': (org) => `Abonnement renouvelé — ${org}`,
  'subscription-failed': (org) => `Échec de paiement — ${org}`,
};

export function renderProNotification(input: ProNotificationInput): EmailRendered {
  const { recipientName, organizationName, kind, detail, ctaLabel, ctaUrl } = input;
  const subject = SUBJECTS[kind](organizationName);

  const html = htmlLayout({
    preheader: detail,
    body:
      paragraph(`Bonjour ${recipientName},`) +
      paragraph(detail) +
      (ctaLabel && ctaUrl ? button(ctaLabel, ctaUrl) : ''),
    footer: `Notification envoyée pour l'organisation ${organizationName}.`,
  });

  const text = [
    `Bonjour ${recipientName},`,
    '',
    detail,
    ...(ctaLabel && ctaUrl ? ['', ctaLabel + ' :', ctaUrl] : []),
    '',
    `— Wedillybird (${organizationName})`,
  ].join('\n');

  return { subject, html, text };
}
