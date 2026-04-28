'use node';

import { v } from 'convex/values';
import { internal } from './_generated/api';
import { internalAction } from './_generated/server';
import { sendWhatsAppCloudTemplate } from './lib/whatsappCloud';

/**
 * Action interne d'envoi d'un rappel WhatsApp J-7 / J-1 via Meta Cloud API.
 *
 * Mode mock auto si `WHATSAPP_ACCESS_TOKEN` ou `WHATSAPP_PHONE_NUMBER_ID`
 * absents (logs en console — utile en dev sans creds Meta).
 *
 * Le caller (`reminders.dispatchDailyGuestReminders`) a déjà résolu le nom
 * de template Meta + construit la liste des `bodyParams`. On marque le
 * guest avec `reminderD7SentAt` / `reminderD1SentAt` au succès, idempotent.
 */
export const sendGuestWhatsappReminder = internalAction({
  args: {
    guestId: v.id('guests'),
    to: v.string(),
    templateName: v.string(),
    bodyParams: v.array(v.string()),
    urlButtonParam: v.string(),
    tier: v.union(v.literal('d7'), v.literal('d1')),
  },
  handler: async (ctx, args) => {
    const result = await sendWhatsAppCloudTemplate({
      to: args.to,
      templateName: args.templateName,
      components: [
        {
          type: 'body',
          parameters: args.bodyParams.map((text) => ({ type: 'text' as const, text })),
        },
        {
          type: 'button',
          sub_type: 'url',
          index: '0',
          parameters: [{ type: 'text', text: args.urlButtonParam }],
        },
      ],
    });

    if (!result.ok) {
      console.error(`[reminder:whatsapp] failed for ${args.to} (${args.tier}): ${result.error}`);
      return { ok: false as const, error: result.error ?? 'UNKNOWN' };
    }

    if (result.mock) {
      console.info(
        `[whatsapp:mock] REMINDER ${args.tier} (${args.templateName}) -> ${args.to} | body=[${args.bodyParams.join(', ')}] urlBtn="${args.urlButtonParam}"`,
      );
    }
    await ctx.runMutation(internal.guests.markReminderSent, {
      guestId: args.guestId,
      tier: args.tier,
    });
    return { ok: true as const, mock: result.mock ?? false };
  },
});
