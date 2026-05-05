import type { Locale } from '../../../i18n/routing';
import { getServerTranslator } from '../../i18n/server-translator';
import type { EmailRendered } from '../types';
import { htmlLayout, paragraph } from './_layout';

export interface LinkCodeInput {
  /** Code à 6 chiffres à saisir dans le drawer de liaison. */
  code: string;
  /** Durée de validité (en minutes). 10 par défaut. */
  expiresInMinutes?: number;
  /** Adresse IP qui a déclenché la demande (optionnel, pour transparence). */
  requestIp?: string;
  /** Locale du destinataire. */
  locale?: Locale | string;
}

export function renderLinkCode({
  code,
  expiresInMinutes = 10,
  requestIp,
  locale,
}: LinkCodeInput): EmailRendered {
  const t = getServerTranslator(locale);

  const subject = t('Emails.linkCode.subject', { code });
  const preheader = t('Emails.linkCode.preheader', { minutes: expiresInMinutes });

  const body = [
    paragraph(t('Emails.common.greetingSimple')),
    paragraph(t('Emails.linkCode.intro')),
    `<div style="margin:24px 0;text-align:center;font-family:'Courier New',monospace;font-size:32px;letter-spacing:8px;color:#2E250F;background:#FBF6EE;padding:18px;border:1px solid #efe6d8;border-radius:8px;font-weight:bold;">${code}</div>`,
    paragraph(t('Emails.linkCode.expiry', { minutes: expiresInMinutes })),
    paragraph(t('Emails.linkCode.ignoreNotice')),
  ].join('');

  const footerLines = [
    requestIp
      ? t('Emails.common.requestFromIp', { ip: requestIp })
      : t('Emails.common.requestSentNoIp'),
    t('Emails.common.tagline'),
  ];
  const footer = footerLines.map((l) => `<p style="margin:0 0 4px 0;">${l}</p>`).join('');

  const html = htmlLayout({ preheader, body, footer, locale });

  const text = [
    t('Emails.linkCode.textTitle'),
    '',
    t('Emails.linkCode.textCode', { code }),
    t('Emails.linkCode.textValidity', { minutes: expiresInMinutes }),
    '',
    t('Emails.linkCode.textInstructions'),
    '',
    t('Emails.linkCode.ignoreNotice'),
    '',
    t('Emails.common.signature'),
  ].join('\n');

  return { subject, html, text };
}
