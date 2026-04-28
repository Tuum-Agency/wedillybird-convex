import type { EmailRendered } from '../types';
import { button, htmlLayout, paragraph } from './_layout';

/**
 * Email envoyé au propriétaire d'une organisation pro après un achat
 * Pay-as-you-go confirmé. Il succède au webhook `payg.purchased` côté Stripe
 * et l'incrément de `paygCredits` côté Convex (cf. `convex/paygPurchases.ts`
 * action `markPurchase`).
 *
 * Ton chaleureux mais pro : on rappelle le solde de crédits restant et on
 * dirige vers `/pro/billing` pour visualiser l'historique. Optionnellement,
 * on inclut le lien vers la facture Stripe hosted (si transmise par le
 * webhook).
 */
export interface PaygCreditActivatedInput {
  recipientName: string;
  remainingCredits: number;
  invoiceUrl?: string;
}

export function renderPaygCreditActivated(input: PaygCreditActivatedInput): EmailRendered {
  const { recipientName, remainingCredits, invoiceUrl } = input;

  const creditsLabel = `${remainingCredits} crédit${remainingCredits > 1 ? 's' : ''}`;
  const availableLabel = `disponible${remainingCredits > 1 ? 's' : ''}`;

  const subject = 'Votre crédit Pay-as-you-go est activé';

  const html = htmlLayout({
    preheader: `Vous avez ${creditsLabel} ${availableLabel} pour activer un événement.`,
    body:
      paragraph(`Bonjour ${recipientName},`) +
      paragraph(
        `Merci pour votre achat. Votre crédit Pay-as-you-go vient d'être activé : vous avez désormais ${creditsLabel} ${availableLabel} pour publier un événement ponctuel sur Wedillybird.`,
      ) +
      paragraph(
        'Il vous suffit de créer (ou de finaliser) un événement depuis votre espace Pro et de cliquer sur Publier — un crédit sera consommé automatiquement.',
      ) +
      (invoiceUrl ? button('Voir ma facture Stripe', invoiceUrl) : '') +
      paragraph('Merci de faire confiance à Wedillybird pour vos événements.'),
    footer:
      "Cet email confirme votre achat à l'usage. Pour toute question, contactez le support Wedillybird.",
  });

  const text = [
    `Bonjour ${recipientName},`,
    '',
    `Merci pour votre achat. Votre crédit Pay-as-you-go vient d'être activé : vous avez désormais ${creditsLabel} ${availableLabel} pour publier un événement ponctuel sur Wedillybird.`,
    '',
    'Il vous suffit de créer (ou de finaliser) un événement depuis votre espace Pro et de cliquer sur Publier — un crédit sera consommé automatiquement.',
    ...(invoiceUrl ? ['', 'Facture Stripe :', invoiceUrl] : []),
    '',
    'Merci de faire confiance à Wedillybird pour vos événements.',
    '',
    '— Wedillybird',
  ].join('\n');

  return { subject, html, text };
}
