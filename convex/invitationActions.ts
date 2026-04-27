import { v } from 'convex/values';
import { action } from './_generated/server';
import { internal } from './_generated/api';
import {
  DEFAULT_INVITATION_STYLE,
  DEFAULT_PERSONAL_MESSAGE_FALLBACK,
  type InvitationStyleId,
  getMetaTemplateName,
} from '../lib/whatsapp/templates';

interface BroadcastResult {
  sent: number;
  failed: number;
  skipped: number;
  total: number;
  style: InvitationStyleId;
  mock: boolean;
}

/**
 * Broadcast les invitations WhatsApp à tous les guests d'un event qui :
 *  1. ont un phone E.164
 *  2. n'ont pas encore reçu leur invitation (invitationSentAt undefined)
 *
 * Utilise le template Meta correspondant au `messagingConfig.templateStyle`
 * du event (default: warm). Marker chaque guest avec invitationSentAt après
 * succès. Idempotent : un re-run skip les déjà-envoyés.
 *
 * Mode mock auto si WHATSAPP_ACCESS_TOKEN absent (logs en console — utile
 * en dev sans creds Meta).
 */
export const broadcast = action({
  args: {
    eventId: v.id('events'),
    requesterId: v.id('users'),
  },
  handler: async (ctx, { eventId, requesterId }): Promise<BroadcastResult> => {
    const event = await ctx.runQuery(internal.events._getForBroadcast, {
      eventId,
      requesterId,
    });
    if (!event) throw new Error('EVENT_NOT_FOUND_OR_FORBIDDEN');

    if (event.status !== 'active') {
      throw new Error('EVENT_NOT_PUBLISHED');
    }

    const guests = await ctx.runQuery(internal.guests.listToInvite, { eventId });
    const styleId: InvitationStyleId =
      event.messagingConfig?.templateStyle ?? DEFAULT_INVITATION_STYLE;

    if (guests.length === 0) {
      return { sent: 0, failed: 0, skipped: 0, total: 0, style: styleId, mock: false };
    }

    const personalMessage =
      event.messagingConfig?.personalMessage?.trim() || DEFAULT_PERSONAL_MESSAGE_FALLBACK;

    const coupleNames = `${event.coupleNames.partnerA} & ${event.coupleNames.partnerB}`;
    const eventDateFormatted = new Intl.DateTimeFormat('fr', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: event.timezone,
    }).format(new Date(event.eventDate));

    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const graphVersion = process.env.WHATSAPP_GRAPH_VERSION ?? 'v23.0';
    const baseUrl = (process.env.APP_BASE_URL ?? 'https://wedillybird.com').replace(/\/$/, '');
    const templateName = getMetaTemplateName(styleId, process.env);
    const isMock = !accessToken || !phoneNumberId;

    let sent = 0;
    let failed = 0;

    for (const guest of guests) {
      const guestFirstName = guest.fullName.split(' ')[0] ?? guest.fullName;
      const invitationUrl = `${baseUrl}/i/${guest.qrCodeToken}`;

      if (isMock) {
        console.info(
          `[whatsapp:mock] INVITATION (${templateName}) -> ${guest.phone} | ${guest.fullName}`,
        );
        await ctx.runMutation(internal.guests.markInvitationSent, {
          guestId: guest._id,
          channel: 'whatsapp' as const,
        });
        sent++;
        continue;
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
              to: guest.phone.replace(/^\+/, ''),
              type: 'template',
              template: {
                name: templateName,
                language: { code: 'fr' },
                components: [
                  {
                    type: 'body',
                    parameters: [
                      { type: 'text', text: guestFirstName },
                      { type: 'text', text: coupleNames },
                      { type: 'text', text: eventDateFormatted },
                      { type: 'text', text: invitationUrl },
                      { type: 'text', text: personalMessage },
                    ],
                  },
                  {
                    type: 'button',
                    sub_type: 'url',
                    index: '0',
                    parameters: [{ type: 'text', text: guest.qrCodeToken }],
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
            `[broadcast] failed for ${guest.phone}: ${data.error?.message ?? res.status}`,
          );
          failed++;
          continue;
        }

        await ctx.runMutation(internal.guests.markInvitationSent, {
          guestId: guest._id,
          channel: 'whatsapp' as const,
        });
        sent++;
      } catch (err) {
        console.error(
          `[broadcast] exception for ${guest.phone}:`,
          err instanceof Error ? err.message : err,
        );
        failed++;
      }
    }

    return {
      sent,
      failed,
      skipped: 0,
      total: guests.length,
      style: styleId,
      mock: isMock,
    };
  },
});
