'use node';

import { v } from 'convex/values';
import { internal } from './_generated/api';
import { internalAction } from './_generated/server';

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
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const graphVersion = process.env.WHATSAPP_GRAPH_VERSION ?? 'v23.0';
    const isMock = !accessToken || !phoneNumberId;

    if (isMock) {
      console.info(
        `[whatsapp:mock] REMINDER ${args.tier} (${args.templateName}) -> ${args.to} | body=[${args.bodyParams.join(', ')}] urlBtn="${args.urlButtonParam}"`,
      );
      await ctx.runMutation(internal.guests.markReminderSent, {
        guestId: args.guestId,
        tier: args.tier,
      });
      return { ok: true as const, mock: true };
    }

    try {
      const res = await fetch(
        `https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: args.to.replace(/^\+/, ''),
            type: 'template',
            template: {
              name: args.templateName,
              language: { code: 'fr' },
              components: [
                {
                  type: 'body',
                  parameters: args.bodyParams.map((text) => ({ type: 'text', text })),
                },
                {
                  type: 'button',
                  sub_type: 'url',
                  index: '0',
                  parameters: [{ type: 'text', text: args.urlButtonParam }],
                },
              ],
            },
          }),
        },
      );

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: { message?: string };
        };
        console.error(
          `[reminder:whatsapp] failed for ${args.to} (${args.tier}): ${data.error?.message ?? res.status}`,
        );
        return { ok: false as const, error: data.error?.message ?? `HTTP_${res.status}` };
      }

      await ctx.runMutation(internal.guests.markReminderSent, {
        guestId: args.guestId,
        tier: args.tier,
      });
      return { ok: true as const, mock: false };
    } catch (err) {
      console.error(
        `[reminder:whatsapp] exception for ${args.to} (${args.tier}):`,
        err instanceof Error ? err.message : err,
      );
      return { ok: false as const, error: err instanceof Error ? err.message : 'UNKNOWN' };
    }
  },
});
