import { v } from 'convex/values';
import { query } from './_generated/server';

/**
 * Récupère un paiement avec ses méta pour générer la facture PDF.
 *
 * Vérifications :
 *  - paiement existe
 *  - statut === 'succeeded' (on n'émet pas de facture pour pending/failed/cancelled)
 *  - le requester est l'acheteur OU l'owner de l'event (les deux peuvent
 *    télécharger ; aujourd'hui c'est toujours la même personne pour les
 *    particuliers, mais on sépare la responsabilité par sécurité).
 *
 * Retourne aussi le user (nom, email, phone) et le titre de l'event pour
 * pouvoir composer la facture sans round-trip supplémentaire.
 */
export const getForInvoice = query({
  args: {
    paymentId: v.id('payments'),
    requesterId: v.id('users'),
  },
  handler: async (ctx, { paymentId, requesterId }) => {
    const payment = await ctx.db.get(paymentId);
    if (!payment) throw new Error('PAYMENT_NOT_FOUND');
    if (payment.status !== 'succeeded') throw new Error('PAYMENT_NOT_PAID');

    const event = await ctx.db.get(payment.eventId);
    const isBuyer = payment.userId === requesterId;
    const isOwner = event?.ownerId === requesterId;
    if (!isBuyer && !isOwner) throw new Error('FORBIDDEN');

    const customer = await ctx.db.get(payment.userId);

    return {
      payment: {
        _id: payment._id,
        userId: payment.userId,
        eventId: payment.eventId,
        plan: payment.plan,
        currency: payment.currency,
        amountMinor: payment.amountMinor,
        provider: payment.provider,
        status: payment.status,
        createdAt: payment.createdAt,
        updatedAt: payment.updatedAt,
      },
      event: event
        ? {
            _id: event._id,
            title: event.title,
          }
        : null,
      customer: customer
        ? {
            fullName: customer.fullName,
            email: customer.email,
            phone: customer.phone,
            locale: customer.locale,
          }
        : null,
    };
  },
});
