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
