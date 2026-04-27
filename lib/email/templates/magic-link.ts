import type { EmailRendered } from '../types';
import { button, htmlLayout, paragraph } from './_layout';

export interface MagicLinkInput {
  /** URL absolue qui contient le token de vérification. */
  verifyUrl: string;
  /** Durée de validité (en minutes). 15 par défaut. */
  expiresInMinutes?: number;
  /** Adresse IP qui a déclenché la demande (optionnel, pour transparence). */
  requestIp?: string;
}

/**
 * Email Magic Link — fallback auth pour les utilisateurs sans WhatsApp.
 *
 * Sobre et rassurant. Le bouton est l'action principale ; le lien texte en
 * dessous sert pour les clients mail qui n'autorisent pas le HTML.
 */
export function renderMagicLink({
  verifyUrl,
  expiresInMinutes = 15,
  requestIp,
}: MagicLinkInput): EmailRendered {
  const subject = 'Votre lien de connexion Wedillybird';
  const preheader = `Cliquez pour vous connecter — valable ${expiresInMinutes} minutes.`;

  const body = [
    paragraph('Bonjour,'),
    paragraph(
      `Vous avez demandé à vous connecter à Wedillybird par email. Cliquez sur le bouton ci-dessous pour valider votre identité. Le lien expire dans ${expiresInMinutes} minutes et n'est utilisable qu'une seule fois.`,
    ),
    button('Vérifier mon email', verifyUrl),
    paragraph(`Si le bouton ne fonctionne pas, copiez-collez ce lien dans votre navigateur :`),
    `<p style="margin:0 0 16px 0;word-break:break-all;font-size:13px;color:#666;">${escapeAttr(verifyUrl)}</p>`,
    paragraph(
      `Si vous n'êtes pas à l'origine de cette demande, ignorez ce message — aucun compte ne sera créé ni modifié.`,
    ),
  ].join('');

  const footerLines = [
    `Demande envoyée${requestIp ? ` depuis l'adresse ${escapeAttr(requestIp)}` : ''}.`,
    `Wedillybird — l'organisation de mariage simplifiée.`,
  ];
  const footer = footerLines.map((l) => `<p style="margin:0 0 4px 0;">${l}</p>`).join('');

  const html = htmlLayout({ preheader, body, footer });

  const text = [
    'Votre lien de connexion Wedillybird',
    '',
    `Cliquez sur ce lien pour vous connecter (valable ${expiresInMinutes} minutes, usage unique) :`,
    verifyUrl,
    '',
    "Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.",
    '',
    '— Wedillybird',
  ].join('\n');

  return { subject, html, text };
}

function escapeAttr(value: string): string {
  return value.replace(/[<>"']/g, (c) => {
    switch (c) {
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case "'":
        return '&#39;';
      default:
        return c;
    }
  });
}
