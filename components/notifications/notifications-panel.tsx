'use client';

import { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { useTranslations, useLocale } from 'next-intl';
import { Bell, CheckCheck, Inbox } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/cn';
import { clientApi } from '@/lib/convex/client-api';
import { renderNotificationText, relativeTime } from '@/lib/notifications/render';

/**
 * Carte « Notifications » réactive pour les dashboards (agence + couple).
 * Même source que la cloche (`useQuery`, temps réel) mais toujours dépliée.
 * Theme-portable via tokens sémantiques (hérite du `data-theme` du parent).
 */
export function NotificationsPanel({ userId, limit = 6 }: { userId: string; limit?: number }) {
  const t = useTranslations('Notifications');
  const locale = useLocale();
  const data = useQuery(clientApi.notificationsForUser, { userId });
  const markAllRead = useMutation(clientApi.markAllNotificationsRead);
  const markRead = useMutation(clientApi.markNotificationRead);
  // Base temporelle capturée une fois au montant (initialiseur lazy = position
  // autorisée pour un appel impur, hors corps de render).
  const [now] = useState(() => Date.now());

  const unread = data?.unread ?? 0;
  const all = data?.items ?? [];
  const items = all.slice(0, limit);

  return (
    <section className="flex flex-col overflow-hidden rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] shadow-[var(--shadow-soft)]">
      <div className="flex items-center justify-between gap-3 border-b border-[color:var(--color-border)] px-5 py-4">
        <div className="flex items-center gap-2.5">
          <Bell
            className="h-4 w-4 text-[color:var(--color-primary)]"
            strokeWidth={1.9}
            aria-hidden
          />
          <h2 className="text-sm font-medium text-[color:var(--color-foreground)]">{t('title')}</h2>
          {unread > 0 ? (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[color:var(--color-primary)] px-1.5 text-[10px] font-semibold text-[color:var(--color-primary-foreground)]">
              {unread > 9 ? '9+' : unread}
            </span>
          ) : null}
        </div>
        {unread > 0 ? (
          <button
            type="button"
            onClick={() => void markAllRead({ userId })}
            className="focus-ring inline-flex items-center gap-1 text-xs text-[color:var(--color-primary)] transition-opacity hover:opacity-80"
          >
            <CheckCheck className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
            {t('markAllRead')}
          </button>
        ) : null}
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-5 py-10 text-center">
          <Inbox
            className="h-6 w-6 text-[color:var(--color-muted-foreground)]"
            strokeWidth={1.5}
            aria-hidden
          />
          <p className="text-sm text-[color:var(--color-muted-foreground)]">{t('empty')}</p>
        </div>
      ) : (
        <ul className="flex flex-col">
          {items.map((n) => {
            const isUnread = n.readAt === undefined;
            const body = (
              <span className="flex items-start gap-2.5">
                <span
                  aria-hidden
                  className={cn(
                    'mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full',
                    isUnread ? 'bg-[color:var(--color-primary)]' : 'bg-transparent',
                  )}
                />
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm leading-snug text-[color:var(--color-foreground)]">
                    {renderNotificationText(t, n)}
                  </span>
                  <span className="text-[11px] text-[color:var(--color-muted-foreground)]">
                    {relativeTime(locale, n.createdAt, now)}
                  </span>
                </span>
              </span>
            );
            const cls = cn(
              'block px-5 py-3.5 text-left transition-colors hover:bg-[color:var(--color-surface-elevated)]',
              isUnread ? 'bg-[color:var(--color-primary-soft)]/40' : '',
            );
            return (
              <li key={n._id} className="border-b border-[color:var(--color-border)] last:border-0">
                {n.link ? (
                  <Link
                    href={n.link as never}
                    className={cls}
                    onClick={() => {
                      if (isUnread) void markRead({ notificationId: n._id, userId });
                    }}
                  >
                    {body}
                  </Link>
                ) : (
                  <div className={cls}>{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {all.length > items.length ? (
        <div className="border-t border-[color:var(--color-border)] px-5 py-2.5 text-center text-[11px] text-[color:var(--color-muted-foreground)]">
          {t('andMore', { count: all.length - items.length })}
        </div>
      ) : null}
    </section>
  );
}
