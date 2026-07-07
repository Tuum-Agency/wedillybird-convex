import { cronJobs } from 'convex/server';
import { api, internal } from './_generated/api';

const crons = cronJobs();

// Daily at 10:00 UTC (= 10:00 Africa/Dakar, UTC+0): scan events and queue
// J-7 / J-1 guest reminder emails. Sandbox-safe: dispatch obeys
// EMAIL_DRIVER=mock until SES production access lands.
crons.cron(
  'dispatch daily guest reminders',
  '0 10 * * *',
  internal.reminders.dispatchDailyGuestReminders,
  {},
);

// Every 30 min: poll Meta for the status of pending custom WhatsApp templates.
// Acts as a fallback if the webhook (`/api/webhooks/whatsapp`) misses an event.
// No-op when WHATSAPP_ACCESS_TOKEN / WHATSAPP_WABA_ID are not configured.
crons.cron(
  'poll whatsapp template statuses',
  '*/30 * * * *',
  internal.whatsappTemplates.pollPendingStatuses,
  {},
);

// Every 5 min: notify owners about template status changes (approved/rejected/...).
// Idempotent — uses `whatsappTemplates.notifiedAt` to avoid duplicates. Triggered
// immediately by the webhook; this cron is the safety net.
crons.cron(
  'dispatch whatsapp template notifications',
  '*/5 * * * *',
  api.whatsappTemplateNotifications.dispatchPendingNotifications,
  {},
);

// Daily at 03:00 UTC: vest affiliate/referral rewards whose hold has elapsed
// (pending → vested once the event date / J+7 floor is passed). Idempotent;
// no-op when there's nothing due.
crons.cron('vest affiliate rewards', '0 3 * * *', internal.affiliate.vestDueReferrals, {});

export default crons;
