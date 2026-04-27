import type { EmailRendered } from '../types';
import { htmlLayout, paragraph } from './_layout';

export interface LinkCodeInput {
  /** Code à 6 chiffres à saisir dans le drawer de liaison. */
  code: string;
  /** Durée de validité (en minutes). 10 par défaut. */
  expiresInMinutes?: number;
  /** Adresse IP qui a déclenché la demande (optionnel, pour transparence). */
  requestIp?: string;
}

/**
 * Email "code de liaison" — envoyé quand un user déjà connecté souhaite
 * ajouter cet email à son compte (flux Account.link.email).
 *
 * Pattern OTP-style : un code 6 chiffres à recopier dans l'app, pas un lien
 * cliquable. Plus simple à implémenter dans un drawer + plus sûr (pas de
 * lien à cliquer depuis un autre device non connecté).
 */
export function renderLinkCode({
  code,
  expiresInMinutes = 10,
  requestIp,
}: LinkCodeInput): EmailRendered {
  const subject = `Votre code de vérification Wedillybird : ${code}`;
  const preheader = `Code à recopier dans l'app pour confirmer cette adresse — valable ${expiresInMinutes} minutes.`;

  const body = [
    paragraph('Bonjour,'),
    paragraph(
      `Vous avez demandé à associer cette adresse email à votre compte Wedillybird. Recopiez le code ci-dessous dans la fenêtre de vérification :`,
    ),
    `<div style="margin:24px 0;text-align:center;font-family:'Courier New',monospace;font-size:32px;letter-spacing:8px;color:#2E250F;background:#FBF6EE;padding:18px;border:1px solid #efe6d8;border-radius:8px;font-weight:bold;">${code}</div>`,
    paragraph(
      `Le code expire dans ${expiresInMinutes} minutes et n'est utilisable qu'une seule fois.`,
    ),
    paragraph(
      `Si vous n'êtes pas à l'origine de cette demande, ignorez ce message — aucune adresse ne sera ajoutée à votre compte.`,
    ),
  ].join('');

  const footerLines = [
    `Demande envoyée${requestIp ? ` depuis l'adresse ${requestIp}` : ''}.`,
    `Wedillybird — l'organisation de mariage simplifiée.`,
  ];
  const footer = footerLines.map((l) => `<p style="margin:0 0 4px 0;">${l}</p>`).join('');

  const html = htmlLayout({ preheader, body, footer });

  const text = [
    'Votre code de vérification Wedillybird',
    '',
    `Code : ${code}`,
    `Valable ${expiresInMinutes} minutes, usage unique.`,
    '',
    `Recopiez ce code dans la fenêtre de vérification de l'app.`,
    '',
    "Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.",
    '',
    '— Wedillybird',
  ].join('\n');

  return { subject, html, text };
}
