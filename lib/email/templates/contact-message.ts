import type { EmailRendered } from '../types';
import { escapeHtml, htmlLayout, paragraph } from './_layout';

export interface ContactMessageInput {
  /** Nom de la personne qui contacte. */
  fromName: string;
  /** Email de la personne (servira de Reply-To côté SES). */
  fromEmail: string;
  /** Sujet saisi dans le formulaire. */
  subject: string;
  /** Corps du message (texte brut). */
  message: string;
  /** Adresse IP qui a soumis (pour transparence/anti-abuse). */
  requestIp?: string;
}

/**
 * Email reçu par hello@wedillybird.com depuis le formulaire de contact public.
 *
 * Le sujet préfixe `[Contact]` pour le tri inbox. Le Reply-To est l'email
 * du contacter pour pouvoir répondre directement.
 */
export function renderContactMessage({
  fromName,
  fromEmail,
  subject,
  message,
  requestIp,
}: ContactMessageInput): EmailRendered {
  const emailSubject = `[Contact] ${subject}`;
  const preheader = `${fromName} <${fromEmail}> — ${truncate(subject, 80)}`;

  const messageHtml = message
    .split(/\n{2,}/)
    .map((para) => paragraph(para.replace(/\n/g, ' ')))
    .join('');

  const body = [
    `<table cellpadding="0" cellspacing="0" style="margin:0 0 20px 0;font-size:13px;color:#7a6b50;">
      <tr><td style="padding:4px 12px 4px 0;"><strong style="color:#2E250F;">De&nbsp;:</strong></td><td>${escapeHtml(fromName)} &lt;${escapeHtml(fromEmail)}&gt;</td></tr>
      <tr><td style="padding:4px 12px 4px 0;"><strong style="color:#2E250F;">Sujet&nbsp;:</strong></td><td>${escapeHtml(subject)}</td></tr>
    </table>`,
    `<hr style="border:0;border-top:1px solid #efe6d8;margin:0 0 20px 0;"/>`,
    messageHtml,
  ].join('');

  const footerLines = [
    `Message envoyé via le formulaire /contact${requestIp ? ` depuis l'IP ${escapeHtml(requestIp)}` : ''}.`,
    `Répondez à cet email pour contacter ${escapeHtml(fromName)} directement.`,
  ];
  const footer = footerLines.map((l) => `<p style="margin:0 0 4px 0;">${l}</p>`).join('');

  const html = htmlLayout({ preheader, body, footer });

  const text = [
    `[Contact] ${subject}`,
    '',
    `De : ${fromName} <${fromEmail}>`,
    `Sujet : ${subject}`,
    '',
    '---',
    '',
    message,
    '',
    '---',
    `Message envoyé via le formulaire /contact${requestIp ? ` depuis l'IP ${requestIp}` : ''}.`,
    `Répondez à cet email pour contacter ${fromName} directement.`,
  ].join('\n');

  return { subject: emailSubject, html, text };
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1).trim()}…`;
}
