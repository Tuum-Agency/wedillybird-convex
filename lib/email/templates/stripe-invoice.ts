import type { EmailRendered } from '../types';
import { button, htmlLayout, paragraph } from './_layout';

export type StripeInvoiceInput = {
  recipientName: string;
  organizationName: string;
  invoiceNumber: string;
  amountFormatted: string;
  periodLabel: string;
  /** Stripe-hosted invoice URL (live invoice, payment status, history). */
  invoiceUrl: string;
  /** Stripe-generated PDF URL (their CDN). */
  pdfUrl?: string;
  /** Wedillybird self-hosted PDF URL (our /api/payments/[paymentId]/invoice.pdf). */
  selfHostedPdfUrl?: string;
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
    selfHostedPdfUrl,
  } = input;

  const subject = `Facture ${invoiceNumber} — ${amountFormatted}`;

  const html = htmlLayout({
    preheader: `Votre facture pour ${periodLabel} est disponible`,
    body:
      paragraph(`Bonjour ${recipientName},`) +
      paragraph(`Votre facture ${invoiceNumber} pour ${organizationName} est disponible.`) +
      paragraph(`Montant : ${amountFormatted} — Période : ${periodLabel}`) +
      button('Consulter la facture', invoiceUrl) +
      (selfHostedPdfUrl ? paragraph(`Télécharger le PDF Wedillybird : ${selfHostedPdfUrl}`) : '') +
      (pdfUrl ? paragraph(`Reçu Stripe (PDF) : ${pdfUrl}`) : ''),
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
    ...(selfHostedPdfUrl ? ['', 'Télécharger le PDF Wedillybird :', selfHostedPdfUrl] : []),
    ...(pdfUrl ? ['', 'Reçu Stripe (PDF) :', pdfUrl] : []),
    '',
    '— Wedillybird',
  ].join('\n');

  return { subject, html, text };
}
