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
  } = input;

  const subject = `Facture ${invoiceNumber} — ${amountFormatted}`;

  const html = htmlLayout({
    preheader: `Votre facture pour ${periodLabel} est disponible`,
    body:
      paragraph(`Bonjour ${recipientName},`) +
      paragraph(`Votre facture ${invoiceNumber} pour ${organizationName} est disponible.`) +
      paragraph(`Montant : ${amountFormatted} — Période : ${periodLabel}`) +
      button('Consulter la facture', invoiceUrl) +
      (pdfUrl ? paragraph(`PDF : ${pdfUrl}`) : ''),
    footer: 'Pour toute question concernant cette facture, contactez le support Wedillybird.',
  });

  const text = [
    `Bonjour ${recipientName},`,
    '',
    `Facture ${invoiceNumber} pour ${organizationName}.`,
    `Montant : ${amountFormatted}`,
    `Période : ${periodLabel}`,
    '',
    'Consulter en ligne :',
    invoiceUrl,
    ...(pdfUrl ? ['', 'PDF :', pdfUrl] : []),
    '',
    '— Wedillybird',
  ].join('\n');

  return { subject, html, text };
}
