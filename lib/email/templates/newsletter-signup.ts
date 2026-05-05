import type { Locale } from '../../../i18n/routing';
import { getServerTranslator } from '../../i18n/server-translator';
import type { EmailRendered } from '../types';
import { escapeHtml, htmlLayout, paragraph } from './_layout';

export interface NewsletterSignupInput {
  email: string;
  requestIp?: string;
  source?: string;
  /** Locale destinataire (notre boîte admin, par défaut `fr`). */
  locale?: Locale | string;
}

export function renderNewsletterSignup({
  email,
  requestIp,
  source,
  locale,
}: NewsletterSignupInput): EmailRendered {
  const t = getServerTranslator(locale);

  const subject = t('Emails.newsletterSignup.subject', { email });
  const preheader = t('Emails.newsletterSignup.preheader', { email });

  const emailLabel = t('Emails.newsletterSignup.emailLabel');
  const sourceLabel = t('Emails.newsletterSignup.sourceLabel');
  const ipLabel = t('Emails.newsletterSignup.ipLabel');

  const body = [
    paragraph(t('Emails.newsletterSignup.intro')),
    `<table cellpadding="0" cellspacing="0" style="margin:0 0 20px 0;font-size:13px;color:#7a6b50;">
      <tr><td style="padding:4px 12px 4px 0;"><strong style="color:#2E250F;">${escapeHtml(emailLabel)}&nbsp;:</strong></td><td>${escapeHtml(email)}</td></tr>
      ${source ? `<tr><td style="padding:4px 12px 4px 0;"><strong style="color:#2E250F;">${escapeHtml(sourceLabel)}&nbsp;:</strong></td><td>${escapeHtml(source)}</td></tr>` : ''}
      ${requestIp ? `<tr><td style="padding:4px 12px 4px 0;"><strong style="color:#2E250F;">${escapeHtml(ipLabel)}&nbsp;:</strong></td><td>${escapeHtml(requestIp)}</td></tr>` : ''}
    </table>`,
    paragraph(t('Emails.newsletterSignup.addReminder')),
  ].join('');

  const footer = `<p style="margin:0;">${escapeHtml(t('Emails.newsletterSignup.footer'))}</p>`;

  const html = htmlLayout({ preheader, body, footer, locale });

  const text = [
    t('Emails.newsletterSignup.textTitle'),
    '',
    `${emailLabel} : ${email}`,
    source ? `${sourceLabel} : ${source}` : null,
    requestIp ? `${ipLabel} : ${requestIp}` : null,
    '',
    t('Emails.newsletterSignup.textAddReminder'),
  ]
    .filter(Boolean)
    .join('\n');

  return { subject, html, text };
}
