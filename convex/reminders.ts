import { v } from 'convex/values';
import { internal } from './_generated/api';
import { internalAction, internalQuery } from './_generated/server';
import {
  appOrigin,
  formatEventDate,
  reminderWindow,
  shouldSendEmail,
  shouldSendWhatsapp,
  type ReminderChannel,
} from '../lib/reminders/window';
import { getReminderTemplateName, type ReminderTier } from '../lib/whatsapp/templates';

/**
 * Daily cron entry-point. Scans events with eventDate within J-7 / J-1 windows
 * and schedules sendGuestReminder actions for opt-in guests with email + RSVP=attending
 * that haven't been reminded for that tier yet.
 *
 * Routage selon `event.messagingConfig.preferredChannel` :
 *   - `'email'` (ou champ absent)  → email seul (existant)
 *   - `'whatsapp'`                 → WhatsApp si template Meta dispo, sinon
 *                                     fallback email-only avec warning
 *   - `'both'`                     → email + WhatsApp (si dispo)
 *
 * Le marker idempotent (`reminderD{7|1}SentAt`) est patch dès qu'un canal
 * réussit. Les invités sans email **et** sans phone sont skip.
 */
export const dispatchDailyGuestReminders = internalAction({
  args: { now: v.optional(v.number()) },
  handler: async (ctx, { now: nowArg }): Promise<{ scheduled: number }> => {
    const now = nowArg ?? Date.now();
    let scheduled = 0;

    for (const tier of ['d7', 'd1'] as const) {
      const days = tier === 'd7' ? 7 : 1;
      const window = reminderWindow(now, days);

      const events: Array<{
        _id: string;
        title: string;
        eventDate: number;
        timezone: string;
        status: string;
        coupleNames: { partnerA: string; partnerB: string };
        venue?: { name: string; address: string };
        preferredChannel?: ReminderChannel;
      }> = await ctx.runQuery(internal.reminders.listEventsInWindow, {
        start: window.start,
        end: window.end,
      });

      for (const event of events) {
        if (event.status !== 'active') continue;

        const candidates: Array<{
          _id: string;
          fullName: string;
          email?: string;
          phone?: string;
          qrCodeToken: string;
          alreadySent: boolean;
        }> = await ctx.runQuery(internal.reminders.listAttendingGuestsForReminder, {
          eventId: event._id as never,
          tier,
        });

        const channel = event.preferredChannel;
        const wantsEmail = shouldSendEmail(channel);
        const wantsWhatsapp = shouldSendWhatsapp(channel);
        const whatsappTemplateName = wantsWhatsapp
          ? getReminderTemplateName(tier as ReminderTier)
          : null;

        // Si le couple veut WhatsApp mais le template Meta n'est pas encore
        // configuré côté env, on log un warning et on retombe sur l'email
        // (si le canal est 'whatsapp' seul, on bascule vers email pour ne pas
        // skipper le rappel). Cf. BACKLOG : templates utility J-7/J-1 à créer.
        const whatsappAvailable = wantsWhatsapp && whatsappTemplateName !== null;
        if (wantsWhatsapp && !whatsappTemplateName) {
          console.warn(
            `[reminder] WhatsApp ${tier} requested for event ${event._id} but ${tier === 'd7' ? 'WHATSAPP_REMINDER_D7_TEMPLATE' : 'WHATSAPP_REMINDER_D1_TEMPLATE'} env var is missing — falling back to email only.`,
          );
        }

        const emailFallbackForced = wantsWhatsapp && !whatsappAvailable;
        const sendEmail = wantsEmail || emailFallbackForced;

        const coupleNames = `${event.coupleNames.partnerA} & ${event.coupleNames.partnerB}`;
        const eventDateLabel = formatEventDate(event.eventDate);

        for (const guest of candidates) {
          if (guest.alreadySent) continue;

          const invitationUrl = `${appOrigin()}/i/${guest.qrCodeToken}`;
          const guestFirstName = guest.fullName.split(' ')[0] ?? guest.fullName;
          let dispatched = false;

          if (sendEmail && guest.email) {
            await ctx.scheduler.runAfter(0, internal.emailActions.sendGuestReminder, {
              guestId: guest._id as never,
              to: guest.email,
              guestName: guest.fullName,
              eventTitle: event.title,
              eventDate: eventDateLabel,
              invitationUrl,
              daysUntilEvent: days,
              tier,
            });
            dispatched = true;
          }

          if (whatsappAvailable && guest.phone) {
            // D7 body : prénom, couple, date, lien
            // D1 body : prénom, couple, lieu (fallback si absent), lien
            const venueLabel = event.venue?.name ?? event.venue?.address ?? 'le lieu prévu';
            const bodyParams =
              tier === 'd7'
                ? [guestFirstName, coupleNames, eventDateLabel, invitationUrl]
                : [guestFirstName, coupleNames, venueLabel, invitationUrl];

            await ctx.scheduler.runAfter(0, internal.reminderActions.sendGuestWhatsappReminder, {
              guestId: guest._id as never,
              to: guest.phone,
              templateName: whatsappTemplateName!,
              bodyParams,
              urlButtonParam: guest.qrCodeToken,
              tier,
            });
            dispatched = true;
          }

          if (dispatched) scheduled += 1;
        }
      }
    }

    return { scheduled };
  },
});

/* -------------------------------------------------------------------------- */
/*  Internal queries used by dispatchDailyGuestReminders (called from action) */
/* -------------------------------------------------------------------------- */

export const listEventsInWindow = internalQuery({
  args: { start: v.number(), end: v.number() },
  handler: async (ctx, { start, end }) => {
    const events = await ctx.db
      .query('events')
      .filter((q) => q.and(q.gte(q.field('eventDate'), start), q.lte(q.field('eventDate'), end)))
      .collect();
    return events.map((e) => ({
      _id: e._id,
      title: e.title,
      eventDate: e.eventDate,
      timezone: e.timezone,
      status: e.status,
      coupleNames: e.coupleNames,
      venue: e.venue,
      preferredChannel: e.messagingConfig?.preferredChannel,
    }));
  },
});

export const listAttendingGuestsForReminder = internalQuery({
  args: {
    eventId: v.id('events'),
    tier: v.union(v.literal('d7'), v.literal('d1')),
  },
  handler: async (ctx, { eventId, tier }) => {
    const guests = await ctx.db
      .query('guests')
      .withIndex('by_event_rsvp', (q) => q.eq('eventId', eventId).eq('rsvpStatus', 'attending'))
      .collect();
    return guests.map((g) => ({
      _id: g._id,
      fullName: g.fullName,
      email: g.email,
      phone: g.phone,
      qrCodeToken: g.qrCodeToken,
      alreadySent: tier === 'd7' ? Boolean(g.reminderD7SentAt) : Boolean(g.reminderD1SentAt),
    }));
  },
});
