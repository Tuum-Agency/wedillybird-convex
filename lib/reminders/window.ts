const MS_PER_DAY = 86_400_000;

/**
 * Returns the [start, end] timestamp window (in ms) for events occurring
 * approximately `daysFromNow` away from `now`, with a ±12h tolerance to
 * tolerate cron drift and tz shifts.
 */
export function reminderWindow(now: number, daysFromNow: number): { start: number; end: number } {
  const center = now + daysFromNow * MS_PER_DAY;
  return { start: center - MS_PER_DAY / 2, end: center + MS_PER_DAY / 2 };
}

export function formatEventDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function appOrigin(): string {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ?? 'https://wedillybird.com';
}

/* -------------------------------------------------------------------------- */
/*  Routage email / WhatsApp selon `event.messagingConfig.preferredChannel`    */
/* -------------------------------------------------------------------------- */

export type ReminderChannel = 'whatsapp' | 'email' | 'both';

/**
 * Email envoyé quand le canal préféré est `'email'` ou `'both'`. Si la
 * config est absente (events legacy), on default sur email — c'est le
 * comportement historique avant l'introduction du routage.
 */
export function shouldSendEmail(channel: ReminderChannel | undefined): boolean {
  if (!channel) return true;
  return channel === 'email' || channel === 'both';
}

/**
 * WhatsApp envoyé quand le canal préféré est `'whatsapp'` ou `'both'`. Pas
 * de fallback : si la config est absente, on n'envoie pas de WhatsApp.
 */
export function shouldSendWhatsapp(channel: ReminderChannel | undefined): boolean {
  if (!channel) return false;
  return channel === 'whatsapp' || channel === 'both';
}

/* -------------------------------------------------------------------------- */
/*  Anti-doublon court-terme (cron ré-exécutée manuellement, retry transient)  */
/* -------------------------------------------------------------------------- */

/**
 * Fenêtre min entre deux rappels successifs pour le même invité, tous tiers
 * confondus. 12 h offre une marge confortable : la cron tourne une fois par
 * jour, donc à fréquence normale `lastReminderSentAt` sera toujours > 12 h
 * quand on revisite. Si la cron est ré-exécutée à la main dans la même
 * journée, on skip pour éviter de spammer l'invité.
 */
export const REMINDER_DEDUP_WINDOW_MS = 12 * 60 * 60 * 1000;

/**
 * Retourne `true` si on doit skip l'invité parce qu'il a déjà été notifié
 * récemment (anti-doublon). `lastReminderSentAt` est un marker générique posé
 * à chaque envoi réussi (cf. `convex/guests.ts:markReminderSent`) ; les
 * markers par tier (`reminderD{7|1}SentAt`) restent la source de vérité pour
 * l'idempotence par tier.
 */
export function isWithinDedupWindow(
  lastReminderSentAt: number | undefined,
  now: number,
  windowMs: number = REMINDER_DEDUP_WINDOW_MS,
): boolean {
  if (!lastReminderSentAt) return false;
  return now - lastReminderSentAt < windowMs;
}
