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
 * Cloche de notifications in-app — réactive (`useQuery`, mise à jour en direct).
 * Rendu **inline** (pas de portail) : hérite du `data-theme` du shell parent →
 * theme-portable (light couple / dark agence) via tokens sémantiques.
 */
export function NotificationBell({ userId }: { userId: string }) {
  const t = useTranslations('Notifications');
  const locale = useLocale();
  const data = useQuery(clientApi.notificationsForUser, { userId });
  const markAllRead = useMutation(clientApi.markAllNotificationsRead);
  const markRead = useMutation(clientApi.markNotificationRead);
  const [open, setOpen] = useState(false);
  // Base temporelle capturée à l'ouverture (impur en render → géré via event).
  const [now, setNow] = useState(0);

  const unread = data?.unread ?? 0;
  const items = data?.items ?? [];

  function toggle() {
    setNow(Date.now());
    setOpen((v) => !v);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label={t('title')}
        aria-expanded={open}
        className="focus-ring relative flex h-9 w-9 items-center justify-center rounded-full text-[color:var(--color-muted-foreground)] transition-colors hover:bg-[color:var(--color-surface-elevated)] hover:text-[color:var(--color-foreground)]"
      >
        <Bell className="h-4.5 w-4.5" strokeWidth={1.75} aria-hidden />
        {unread > 0 ? (
          <span
            aria-hidden
            className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[color:var(--color-primary)] px-1 text-[10px] font-semibold text-[color:var(--color-primary-foreground)]"
          >
            {unread > 9 ? '9+' : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <>
          {/* Capteur de clic extérieur (transparent). */}
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div
            role="dialog"
            aria-label={t('title')}
            className="absolute right-0 z-50 mt-2 flex w-80 max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] shadow-[var(--shadow-popover)]"
          >
            <div className="flex items-center justify-between gap-3 border-b border-[color:var(--color-border)] px-4 py-3">
              <span className="text-sm font-medium text-[color:var(--color-foreground)]">
                {t('title')}
              </span>
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

            <div className="max-h-96 overflow-y-auto">
              {items.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
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
                      <>
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
                      </>
                    );
                    const cls = cn(
                      'block px-4 py-3 text-left transition-colors hover:bg-[color:var(--color-surface-elevated)]',
                      isUnread ? 'bg-[color:var(--color-primary-soft)]/40' : '',
                    );
                    return (
                      <li
                        key={n._id}
                        className="border-b border-[color:var(--color-border)] last:border-0"
                      >
                        {n.link ? (
                          <Link
                            href={n.link as never}
                            className={cls}
                            onClick={() => {
                              setOpen(false);
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
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
