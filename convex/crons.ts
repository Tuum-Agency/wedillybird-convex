import { cronJobs } from 'convex/server';
import { internal } from './_generated/api';

const crons = cronJobs();

// Daily at 09:00 UTC: scan events and queue J-7 / J-1 guest reminder emails.
// Sandbox-safe: dispatch obeys EMAIL_DRIVER=mock until SES production access lands.
crons.cron(
  'dispatch daily guest reminders',
  '0 9 * * *',
  internal.reminders.dispatchDailyGuestReminders,
  {},
);

export default crons;
