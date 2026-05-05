import type { Locale } from '../../../i18n/routing';
import { getServerTranslator } from '../../i18n/server-translator';
import type { EmailRendered } from '../types';
import { button, htmlLayout, paragraph } from './_layout';

export interface MagicLinkInput {
  /** URL absolue qui contient le token de vérification. */
  verifyUrl: string;
  /** Durée de validité (en minutes). 15 par défaut. */
  expiresInMinutes?: number;
  /** Adresse IP qui a déclenché la demande (optionnel, pour transparence). */
  requestIp?: string;
  /** Locale du destinataire. Par défaut `fr`. */
  locale?: Locale | string;
}

export function renderMagicLink({
  verifyUrl,
  expiresInMinutes = 15,
  requestIp,
  locale,
}: MagicLinkInput): EmailRendered {
  const t = getServerTranslator(locale);
  const tCommon = (key: Parameters<typeof t>[0]) => t(key);

  const subject = t('Emails.magicLink.subject');
  const preheader = t('Emails.magicLink.preheader', { minutes: expiresInMinutes });

  const body = [
    paragraph(tCommon('Emails.common.greetingSimple')),
    paragraph(t('Emails.magicLink.intro', { minutes: expiresInMinutes })),
    button(t('Emails.magicLink.ctaLabel'), verifyUrl),
    paragraph(tCommon('Emails.common.fallbackLink')),
    `<p style="margin:0 0 16px 0;word-break:break-all;font-size:13px;color:#666;">${escapeAttr(verifyUrl)}</p>`,
    paragraph(t('Emails.magicLink.ignoreNotice')),
  ].join('');

  const footerLines = [
    requestIp
      ? t('Emails.common.requestFromIp', { ip: escapeAttr(requestIp) })
      : t('Emails.common.requestSentNoIp'),
    tCommon('Emails.common.tagline'),
  ];
  const footer = footerLines.map((l) => `<p style="margin:0 0 4px 0;">${l}</p>`).join('');

  const html = htmlLayout({ preheader, body, footer, locale });

  const text = [
    subject,
    '',
    t('Emails.magicLink.textInstructions', { minutes: expiresInMinutes }),
    verifyUrl,
    '',
    t('Emails.magicLink.ignoreNotice'),
    '',
    tCommon('Emails.common.signature'),
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
