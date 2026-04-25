import { v } from 'convex/values';
import { internal } from './_generated/api';
import { internalAction, internalQuery } from './_generated/server';
import { appOrigin, formatEventDate, reminderWindow } from '../lib/reminders/window';

/**
 * Daily cron entry-point. Scans events with eventDate within J-7 / J-1 windows
 * and schedules sendGuestReminder actions for opt-in guests with email + RSVP=attending
 * that haven't been reminded for that tier yet.
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
        status: string;
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
          qrCodeToken: string;
          alreadySent: boolean;
        }> = await ctx.runQuery(internal.reminders.listAttendingGuestsForReminder, {
          eventId: event._id as never,
          tier,
        });

        for (const guest of candidates) {
          if (!guest.email || guest.alreadySent) continue;
          await ctx.scheduler.runAfter(0, internal.emailActions.sendGuestReminder, {
            guestId: guest._id as never,
            to: guest.email,
            guestName: guest.fullName,
            eventTitle: event.title,
            eventDate: formatEventDate(event.eventDate),
            invitationUrl: `${appOrigin()}/i/${guest.qrCodeToken}`,
            daysUntilEvent: days,
            tier,
          });
          scheduled += 1;
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
      status: e.status,
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
      qrCodeToken: g.qrCodeToken,
      alreadySent: tier === 'd7' ? Boolean(g.reminderD7SentAt) : Boolean(g.reminderD1SentAt),
    }));
  },
});
