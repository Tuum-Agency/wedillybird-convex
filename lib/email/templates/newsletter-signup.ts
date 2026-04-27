import type { EmailRendered } from '../types';
import { escapeHtml, htmlLayout, paragraph } from './_layout';

export interface NewsletterSignupInput {
  /** Email qui s'inscrit à la newsletter. */
  email: string;
  /** Adresse IP qui a soumis. */
  requestIp?: string;
  /** Source du signup (footer landing, page contact…). Optionnel. */
  source?: string;
}

/**
 * Email de notification admin reçu par hello@wedillybird.com quand quelqu'un
 * s'inscrit à la newsletter via le footer ou ailleurs.
 *
 * Pas de double opt-in pour le moment — on enregistre juste la demande côté
 * inbox admin. Quand on aura un service newsletter (Brevo, Mailchimp), on
 * remplacera par un appel API direct.
 */
export function renderNewsletterSignup({
  email,
  requestIp,
  source,
}: NewsletterSignupInput): EmailRendered {
  const subject = `[Newsletter] Nouvelle inscription — ${email}`;
  const preheader = `Nouvelle inscription newsletter : ${email}`;

  const body = [
    paragraph(`Nouvelle inscription à la newsletter Wedillybird.`),
    `<table cellpadding="0" cellspacing="0" style="margin:0 0 20px 0;font-size:13px;color:#7a6b50;">
      <tr><td style="padding:4px 12px 4px 0;"><strong style="color:#2E250F;">Email&nbsp;:</strong></td><td>${escapeHtml(email)}</td></tr>
      ${source ? `<tr><td style="padding:4px 12px 4px 0;"><strong style="color:#2E250F;">Source&nbsp;:</strong></td><td>${escapeHtml(source)}</td></tr>` : ''}
      ${requestIp ? `<tr><td style="padding:4px 12px 4px 0;"><strong style="color:#2E250F;">IP&nbsp;:</strong></td><td>${escapeHtml(requestIp)}</td></tr>` : ''}
    </table>`,
    paragraph(
      `Pensez à ajouter cet email à votre service de newsletter (Brevo, Mailchimp, etc.) si vous en avez un.`,
    ),
  ].join('');

  const footer = `<p style="margin:0;">Notification automatique — formulaire newsletter Wedillybird.</p>`;

  const html = htmlLayout({ preheader, body, footer });

  const text = [
    'Nouvelle inscription newsletter Wedillybird',
    '',
    `Email : ${email}`,
    source ? `Source : ${source}` : null,
    requestIp ? `IP : ${requestIp}` : null,
    '',
    'Pensez à ajouter cet email à votre service de newsletter.',
  ]
    .filter(Boolean)
    .join('\n');

  return { subject, html, text };
}
