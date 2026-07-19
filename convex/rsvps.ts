import { v } from 'convex/values';
import { mutation } from './_generated/server';
import { sanitizeCustomAnswers } from '../lib/rsvp/questions';

const MAX_NOTES_LENGTH = 500;
const MAX_DIETARY_LENGTH = 200;
const MAX_NAME_LENGTH = 120;

export const submit = mutation({
  args: {
    token: v.string(),
    rsvpStatus: v.union(v.literal('attending'), v.literal('declined'), v.literal('maybe')),
    plusOnesNames: v.optional(v.array(v.string())),
    dietaryRestrictions: v.optional(v.string()),
    notes: v.optional(v.string()),
    /** Réponses aux questions custom (`events.rsvpConfig.customQuestions`). */
    customAnswers: v.optional(
      v.array(
        v.object({
          questionId: v.string(),
          values: v.array(v.string()),
        }),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const guest = await ctx.db
      .query('guests')
      .withIndex('by_qr_token', (q) => q.eq('qrCodeToken', args.token))
      .first();
    if (!guest) throw new Error('INVITATION_NOT_FOUND');

    const event = await ctx.db.get(guest.eventId);
    if (!event) throw new Error('EVENT_NOT_FOUND');
    if (event.status === 'cancelled' || event.status === 'archived') {
      throw new Error('EVENT_CLOSED');
    }

    const names = (args.plusOnesNames ?? [])
      .map((n) => n.trim())
      .filter((n) => n.length > 0 && n.length <= MAX_NAME_LENGTH);

    if (names.length > guest.plusOnesAllowed) {
      throw new Error('PLUS_ONES_EXCEEDED');
    }

    const dietary = args.dietaryRestrictions?.trim().slice(0, MAX_DIETARY_LENGTH) || undefined;
    const notes = args.notes?.trim().slice(0, MAX_NOTES_LENGTH) || undefined;

    // Réponses custom : validées/nettoyées contre la config de l'event (autorité
    // serveur — écarte les inconnues, force les options, saute les questions
    // conditionnelles quand l'invité n'est pas présent).
    const attending = args.rsvpStatus === 'attending';
    const { answers, errors } = sanitizeCustomAnswers(
      event.rsvpConfig,
      args.customAnswers ?? [],
      attending,
    );
    if (Object.keys(errors).length > 0) throw new Error('CUSTOM_ANSWER_REQUIRED');

    await ctx.db.patch(guest._id, {
      rsvpStatus: args.rsvpStatus,
      rsvpRespondedAt: Date.now(),
      plusOnesNames: attending ? names : undefined,
      dietaryRestrictions: attending ? dietary : undefined,
      notes,
      customAnswers: answers.length > 0 ? answers : undefined,
      updatedAt: Date.now(),
    });

    return { ok: true as const };
  },
});
