import type { Locale } from '../../../i18n/routing';
import { getServerTranslator } from '../../i18n/server-translator';
import type { EmailRendered } from '../types';
import { escapeHtml, htmlLayout, paragraph } from './_layout';

export interface ContactMessageInput {
  fromName: string;
  fromEmail: string;
  subject: string;
  message: string;
  requestIp?: string;
  /**
   * Locale du destinataire (= notre boîte support, donc en pratique `fr`).
   * Exposée pour cohérence avec les autres templates et tests futurs.
   */
  locale?: Locale | string;
}

export function renderContactMessage({
  fromName,
  fromEmail,
  subject,
  message,
  requestIp,
  locale,
}: ContactMessageInput): EmailRendered {
  const t = getServerTranslator(locale);
  const emailSubject = t('Emails.contactMessage.subjectPrefix', { subject });
  const preheader = `${fromName} <${fromEmail}> — ${truncate(subject, 80)}`;

  const messageHtml = message
    .split(/\n{2,}/)
    .map((para) => paragraph(para.replace(/\n/g, ' ')))
    .join('');

  const fromLabel = t('Emails.contactMessage.fromLabel');
  const subjectLabel = t('Emails.contactMessage.subjectLabel');

  const body = [
    `<table cellpadding="0" cellspacing="0" style="margin:0 0 20px 0;font-size:13px;color:#7a6b50;">
      <tr><td style="padding:4px 12px 4px 0;"><strong style="color:#2E250F;">${escapeHtml(fromLabel)}&nbsp;:</strong></td><td>${escapeHtml(fromName)} &lt;${escapeHtml(fromEmail)}&gt;</td></tr>
      <tr><td style="padding:4px 12px 4px 0;"><strong style="color:#2E250F;">${escapeHtml(subjectLabel)}&nbsp;:</strong></td><td>${escapeHtml(subject)}</td></tr>
    </table>`,
    `<hr style="border:0;border-top:1px solid #efe6d8;margin:0 0 20px 0;"/>`,
    messageHtml,
  ].join('');

  const ipPart = requestIp ? t('Emails.contactMessage.footerIpPart', { ip: requestIp }) : '';
  const footerLines = [
    t('Emails.contactMessage.footerSent', { ipPart }),
    t('Emails.contactMessage.footerReply', { name: fromName }),
  ];
  const footer = footerLines
    .map((l) => `<p style="margin:0 0 4px 0;">${escapeHtml(l)}</p>`)
    .join('');

  const html = htmlLayout({ preheader, body, footer, locale });

  const text = [
    emailSubject,
    '',
    `${fromLabel} : ${fromName} <${fromEmail}>`,
    `${subjectLabel} : ${subject}`,
    '',
    '---',
    '',
    message,
    '',
    '---',
    t('Emails.contactMessage.footerSent', { ipPart }),
    t('Emails.contactMessage.footerReply', { name: fromName }),
  ].join('\n');

  return { subject: emailSubject, html, text };
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1).trim()}…`;
}
