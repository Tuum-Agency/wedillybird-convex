import type { Locale } from '../../../i18n/routing';
import { getServerTranslator } from '../../i18n/server-translator';
import type { EmailRendered } from '../types';
import { button, htmlLayout, paragraph } from './_layout';

export interface PaygCreditActivatedInput {
  recipientName: string;
  remainingCredits: number;
  invoiceUrl?: string;
  locale?: Locale | string;
}

export function renderPaygCreditActivated(input: PaygCreditActivatedInput): EmailRendered {
  const { recipientName, remainingCredits, invoiceUrl, locale } = input;
  const t = getServerTranslator(locale);

  const isOne = remainingCredits === 1;
  const subject = t('Emails.paygCreditActivated.subject');
  const preheader = isOne
    ? t('Emails.paygCreditActivated.preheaderOne', { credits: remainingCredits })
    : t('Emails.paygCreditActivated.preheaderMany', { credits: remainingCredits });
  const thanks = isOne
    ? t('Emails.paygCreditActivated.thanksOne', { credits: remainingCredits })
    : t('Emails.paygCreditActivated.thanksMany', { credits: remainingCredits });

  const html = htmlLayout({
    preheader,
    body:
      paragraph(t('Emails.common.greeting', { name: recipientName })) +
      paragraph(thanks) +
      paragraph(t('Emails.paygCreditActivated.instructions')) +
      (invoiceUrl ? button(t('Emails.paygCreditActivated.ctaLabel'), invoiceUrl) : '') +
      paragraph(t('Emails.paygCreditActivated.thankYou')),
    footer: t('Emails.paygCreditActivated.footer'),
    locale,
  });

  const text = [
    t('Emails.common.greeting', { name: recipientName }),
    '',
    thanks,
    '',
    t('Emails.paygCreditActivated.instructions'),
    ...(invoiceUrl ? ['', t('Emails.paygCreditActivated.textInvoiceLabel'), invoiceUrl] : []),
    '',
    t('Emails.paygCreditActivated.thankYou'),
    '',
    t('Emails.common.signature'),
  ].join('\n');

  return { subject, html, text };
}
