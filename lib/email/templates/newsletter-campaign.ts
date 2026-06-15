import type { Locale } from '../../../i18n/routing';
import type { EmailRendered } from '../types';
import { escapeHtml, htmlLayout, paragraphRaw } from './_layout';

export interface NewsletterCampaignInput {
  subject: string;
  /** Corps en texte simple (saisi par l'admin). Lignes vides = nouveaux paragraphes. */
  bodyText: string;
  /** Lien de désinscription one-click (signé). */
  unsubscribeUrl: string;
  locale?: Locale | string;
}

/**
 * Rend une campagne newsletter à partir d'un corps en **texte simple** saisi par
 * l'admin. Le texte est échappé (anti-XSS) puis converti en paragraphes ; les
 * liens `https://…` sont auto-cliquables. Pied de page avec désinscription
 * obligatoire (conformité + délivrabilité SES).
 */
export function renderNewsletterCampaign({
  subject,
  bodyText,
  unsubscribeUrl,
  locale,
}: NewsletterCampaignInput): EmailRendered {
  const paragraphs = bodyText
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0);

  const bodyHtml = paragraphs
    .map((block) => paragraphRaw(linkify(escapeHtml(block)).replace(/\n/g, '<br/>')))
    .join('');

  const footer = `<p style="margin:0;">Vous recevez cet email car vous êtes inscrit·e à la newsletter Wedillybird.<br/><a href="${escapeHtml(
    unsubscribeUrl,
  )}" style="color:#7a6b50;text-decoration:underline;">Se désinscrire</a></p>`;

  const html = htmlLayout({ preheader: subject, body: bodyHtml, footer, locale });

  const text = [...paragraphs, '', '—', 'Se désinscrire : ' + unsubscribeUrl].join('\n\n');

  return { subject, html, text };
}

/** Transforme les URLs http(s) en liens cliquables (sur du texte DÉJÀ échappé). */
function linkify(escaped: string): string {
  return escaped.replace(
    /(https?:\/\/[^\s<]+)/g,
    (url) => `<a href="${url}" style="color:#C68567;">${url}</a>`,
  );
}
