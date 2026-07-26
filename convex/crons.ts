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

// Daily at 03:00 UTC: purge biometric face data (Rekognition Face Collection +
// `photoFaces` rows) for any event whose gallery retention window has expired,
// even if it was never explicitly archived. Privacy/BIPA requirement (Lane T3,
// F7) — indexed faces must not outlive the gallery. Idempotent.
crons.cron(
  'purge expired biometric face data',
  '0 3 * * *',
  internal.events.purgeExpiredBiometricData,
  {},
);

export default crons;
