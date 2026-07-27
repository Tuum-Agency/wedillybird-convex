import type { NotificationItem } from '@/lib/convex/client-api';

/**
 * Rendu localisé des notifications — partagé entre la cloche et les cartes de
 * dashboard. `t` est le traducteur next-intl du namespace `Notifications`
 * (typé souplement : le projet n'augmente pas les clés de messages).
 */
type Translate = (key: string, values?: Record<string, string | number>) => string;

export function renderNotificationText(t: Translate, n: NotificationItem): string {
  const d = n.data ?? {};
  switch (n.type) {
    case 'rsvp_response':
      return t('rsvpResponse', {
        name: d.guestName ?? t('someone'),
        status: d.rsvpStatus ? t(`status.${d.rsvpStatus}`) : '',
      });
    case 'rsvp_config_changed':
      return t('configChanged', { name: d.actorName ?? t('theCouple') });
    case 'planning_task':
      return t('planningTask', { title: d.taskTitle ?? '' });
    default:
      return d.text ?? '';
  }
}

/** Temps relatif localisé (« il y a 5 minutes »). `nowMs` capturé hors render. */
export function relativeTime(locale: string, tsMs: number, nowMs: number): string {
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const mins = Math.round((tsMs - nowMs) / 60000);
  if (Math.abs(mins) < 60) return rtf.format(mins, 'minute');
  const hours = Math.round(mins / 60);
  if (Math.abs(hours) < 24) return rtf.format(hours, 'hour');
  return rtf.format(Math.round(hours / 24), 'day');
}
