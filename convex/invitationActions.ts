import { v } from 'convex/values';
import { action } from './_generated/server';
import { internal } from './_generated/api';
import {
  DEFAULT_INVITATION_STYLE,
  DEFAULT_PERSONAL_MESSAGE_FALLBACK,
  type InvitationStyleId,
  getMetaTemplateName,
} from '../lib/whatsapp/templates';
import { sendWhatsAppCloudTemplate, isWhatsAppCloudConfigured } from './lib/whatsappCloud';
import { resolveChannel } from './lib/channelRouting';
import { isTwilioConfigured, sendTwilioSms } from './lib/twilioSms';

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
    // Version EN de la date + base URL pour les invitations SMS (invités
    // US/Canada). La copie SMS est en anglais car le routage SMS cible le +1.
    const eventDateEn = new Intl.DateTimeFormat('en-US', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: event.timezone,
    }).format(new Date(event.eventDate));
    const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://wedillybird.com';

    const templateName = getMetaTemplateName(styleId, process.env);
    const isMock = !isWhatsAppCloudConfigured();

    let sent = 0;
    let failed = 0;

    for (const guest of guests) {
      const guestFirstName = guest.fullName.split(' ')[0] ?? guest.fullName;

      // Routage canal : invités +1 (US/Canada) → SMS Twilio si configuré,
      // sinon WhatsApp (comportement historique). Gated sur isTwilioConfigured
      // → inerte tant que Twilio n'est pas live (tout part en WhatsApp).
      if (resolveChannel(guest.phone) === 'sms' && isTwilioConfigured()) {
        const rsvpUrl = `${appBaseUrl}/en/i/${guest.qrCodeToken}`;
        const smsResult = await sendTwilioSms({
          to: guest.phone,
          body: `${guestFirstName}, ${coupleNames} invite you to their wedding on ${eventDateEn}. ${personalMessage} RSVP: ${rsvpUrl} Reply STOP to opt out.`,
        });
        if (!smsResult.ok) {
          console.error(`[broadcast] SMS failed for ${guest.phone}: ${smsResult.error}`);
          failed++;
          continue;
        }
        if (smsResult.mock) {
          console.info(`[twilio:mock] INVITATION SMS -> ${guest.phone} | ${guest.fullName}`);
        }
        await ctx.runMutation(internal.guests.markInvitationSent, {
          guestId: guest._id,
          channel: 'sms' as const,
        });
        sent++;
        continue;
      }

      const result = await sendWhatsAppCloudTemplate({
        to: guest.phone,
        templateName,
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: guestFirstName },
              { type: 'text', text: coupleNames },
              { type: 'text', text: eventDateFormatted },
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
      });

      if (!result.ok) {
        console.error(`[broadcast] failed for ${guest.phone}: ${result.error}`);
        failed++;
        continue;
      }

      if (result.mock) {
        console.info(
          `[whatsapp:mock] INVITATION (${templateName}) -> ${guest.phone} | ${guest.fullName}`,
        );
      }
      await ctx.runMutation(internal.guests.markInvitationSent, {
        guestId: guest._id,
        channel: 'whatsapp' as const,
      });
      sent++;
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
