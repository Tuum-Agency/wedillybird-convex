import type { Locale } from '../../../i18n/routing';
import { getServerTranslator } from '../../i18n/server-translator';
import type { EmailRendered } from '../types';
import { button, htmlLayout, paragraph } from './_layout';

export type StripeInvoiceInput = {
  recipientName: string;
  organizationName: string;
  invoiceNumber: string;
  amountFormatted: string;
  periodLabel: string;
  invoiceUrl: string;
  pdfUrl?: string;
  locale?: Locale | string;
};

export function renderStripeInvoice(input: StripeInvoiceInput): EmailRendered {
  const {
    recipientName,
    organizationName,
    invoiceNumber,
    amountFormatted,
    periodLabel,
    invoiceUrl,
    pdfUrl,
    locale,
  } = input;
  const t = getServerTranslator(locale);

  const subject = t('Emails.stripeInvoice.subject', { invoiceNumber, amountFormatted });

  const html = htmlLayout({
    preheader: t('Emails.stripeInvoice.preheader', { periodLabel }),
    body:
      paragraph(t('Emails.common.greeting', { name: recipientName })) +
      paragraph(t('Emails.stripeInvoice.intro', { invoiceNumber, organizationName })) +
      paragraph(t('Emails.stripeInvoice.amountAndPeriod', { amountFormatted, periodLabel })) +
      button(t('Emails.stripeInvoice.ctaLabel'), invoiceUrl) +
      (pdfUrl ? paragraph(`${t('Emails.stripeInvoice.textPdfLabel')} ${pdfUrl}`) : ''),
    footer: t('Emails.stripeInvoice.footer'),
    locale,
  });

  const text = [
    t('Emails.common.greeting', { name: recipientName }),
    '',
    t('Emails.stripeInvoice.textInvoiceFor', { invoiceNumber, organizationName }),
    `${t('Emails.stripeInvoice.amountLabel')}: ${amountFormatted}`,
    `${t('Emails.stripeInvoice.periodLabel')}: ${periodLabel}`,
    '',
    t('Emails.stripeInvoice.textConsultOnline'),
    invoiceUrl,
    ...(pdfUrl ? ['', t('Emails.stripeInvoice.textPdfLabel'), pdfUrl] : []),
    '',
    t('Emails.common.signature'),
  ].join('\n');

  return { subject, html, text };
}
