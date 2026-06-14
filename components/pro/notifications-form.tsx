'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Bell, Check, ShieldCheck, Laptop, ScrollText } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import {
  NOTIF_TYPES,
  mergeNotifPrefs,
  type NotifPrefs,
  type NotifKey,
} from '@/lib/pro/notifications';
import { updateNotificationPrefsAction } from '@/app/[locale]/(app)/pro/actions';

function MiniSwitch({
  on,
  onChange,
  label,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={cn(
        'relative h-5 w-9 flex-shrink-0 rounded-full transition-colors',
        on ? 'bg-[color:var(--color-blush-700)]' : 'bg-[color:var(--color-surface-elevated)]',
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 h-4 w-4 rounded-full shadow-sm transition-all duration-200 ease-out',
          on ? 'left-[18px] bg-[color:var(--color-blush-400)]' : 'left-0.5 bg-white',
        )}
        aria-hidden
      />
    </button>
  );
}

export function NotificationsForm({
  initialPrefs,
  canWrite,
}: {
  initialPrefs: Partial<NotifPrefs> | null;
  canWrite: boolean;
}) {
  const t = useTranslations('Pro.main');
  const router = useRouter();
  const [prefs, setPrefs] = useState<NotifPrefs>(() => mergeNotifPrefs(initialPrefs));
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function flip(key: NotifKey, channel: 'email' | 'app') {
    if (!canWrite) return;
    setSaved(false);
    setPrefs((p) => ({ ...p, [key]: { ...p[key], [channel]: !p[key][channel] } }));
  }

  function onSave() {
    setError(null);
    startTransition(async () => {
      const res = await updateNotificationPrefsAction(prefs);
      if (!res.ok) {
        setError(t('notifications.saveError'));
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6">
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[color:var(--color-surface-elevated)] text-[color:var(--color-blush-300)]">
          <Bell className="h-[18px] w-[18px]" strokeWidth={1.85} aria-hidden />
        </span>
        <div className="flex flex-col">
          <h2 className="font-display text-lg text-[color:var(--color-foreground)] italic">
            {t('notifications.title')}
          </h2>
          <span className="text-xs text-[color:var(--color-muted-foreground)]">
            {t('notifications.subtitle')}
          </span>
        </div>
      </div>

      <div className="overflow-x-auto border-t border-[color:var(--color-border)] pt-2">
        <table className="w-full min-w-[420px] border-collapse text-sm">
          <thead>
            <tr className="text-left font-mono text-[9px] tracking-[0.18em] text-[color:var(--color-muted-foreground)] uppercase">
              <th className="py-2 font-medium">{t('notifications.colType')}</th>
              <th className="w-20 py-2 text-center font-medium">{t('notifications.colEmail')}</th>
              <th className="w-20 py-2 text-center font-medium">{t('notifications.colInApp')}</th>
            </tr>
          </thead>
          <tbody>
            {NOTIF_TYPES.map((nt) => (
              <tr key={nt.key} className="border-t border-[color:var(--color-border)]">
                <td className="py-3 pr-4">
                  <div className="flex flex-col gap-0.5">
                    <b className="text-[color:var(--color-foreground)]">{nt.label}</b>
                    <span className="text-xs text-[color:var(--color-muted-foreground)]">
                      {nt.desc}
                    </span>
                  </div>
                </td>
                <td className="py-3 text-center">
                  <span className="inline-flex">
                    <MiniSwitch
                      on={prefs[nt.key].email}
                      onChange={() => flip(nt.key, 'email')}
                      label={t('notifications.toggleEmailAria', { type: nt.label })}
                    />
                  </span>
                </td>
                <td className="py-3 text-center">
                  <span className="inline-flex">
                    <MiniSwitch
                      on={prefs[nt.key].app}
                      onChange={() => flip(nt.key, 'app')}
                      label={t('notifications.toggleInAppAria', { type: nt.label })}
                    />
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-[color:var(--color-danger)]">
          {error}
        </p>
      ) : null}

      {canWrite ? (
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={onSave}
            disabled={pending}
            data-testid="save-notif-prefs"
          >
            {pending ? t('notifications.saving') : t('notifications.save')}
          </Button>
          {saved ? (
            <span className="inline-flex items-center gap-1.5 text-sm text-[color:var(--color-sage-500)]">
              <Check className="h-4 w-4" strokeWidth={2.4} aria-hidden /> {t('notifications.saved')}
            </span>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

export function SecurityPanel({ deviceLabel }: { deviceLabel: string }) {
  const t = useTranslations('Pro.main');
  return (
    <div className="flex flex-col gap-4">
      {/* 2FA */}
      <section className="flex flex-col gap-3 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[color:var(--color-surface-elevated)] text-[color:var(--color-blush-300)]">
            <ShieldCheck className="h-[18px] w-[18px]" strokeWidth={1.85} aria-hidden />
          </span>
          <div className="flex flex-col">
            <h2 className="font-display text-lg text-[color:var(--color-foreground)] italic">
              {t('security.twoFaTitle')}
            </h2>
            <span className="text-xs text-[color:var(--color-muted-foreground)]">
              {t('security.twoFaSub')}
            </span>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-[color:var(--color-border)] pt-3">
          <span className="inline-flex items-center gap-2 text-sm text-[color:var(--color-foreground)]">
            {t('security.twoFaLabel')}
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--color-surface-elevated)] px-2 py-0.5 font-mono text-[9px] tracking-[0.16em] text-[color:var(--color-muted-foreground)] uppercase">
              <span
                className="h-1.5 w-1.5 rounded-full bg-[color:var(--color-muted-foreground)]"
                aria-hidden
              />{' '}
              {t('security.inactive')}
            </span>
          </span>
          <span className="font-mono text-[10px] tracking-[0.12em] text-[color:var(--color-muted-foreground)] uppercase">
            {t('security.soon')}
          </span>
        </div>
      </section>

      {/* Sessions */}
      <section className="flex flex-col gap-3 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[color:var(--color-surface-elevated)] text-[color:var(--color-blush-300)]">
            <Laptop className="h-[18px] w-[18px]" strokeWidth={1.85} aria-hidden />
          </span>
          <div className="flex flex-col">
            <h2 className="font-display text-lg text-[color:var(--color-foreground)] italic">
              {t('security.sessionsTitle')}
            </h2>
            <span className="text-xs text-[color:var(--color-muted-foreground)]">
              {t('security.sessionsSub')}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-[color:var(--color-border)] px-3.5 py-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[color:var(--color-sage-500)]/12 text-[color:var(--color-sage-500)]">
            <Laptop className="h-4 w-4" strokeWidth={1.85} aria-hidden />
          </span>
          <div className="flex flex-1 flex-col">
            <b className="inline-flex items-center gap-2 text-sm text-[color:var(--color-foreground)]">
              {deviceLabel}
              <span className="rounded-full bg-[color:var(--color-sage-500)]/15 px-1.5 py-0.5 font-mono text-[9px] tracking-[0.12em] text-[color:var(--color-sage-500)] uppercase">
                {t('security.thisDevice')}
              </span>
            </b>
            <span className="text-xs text-[color:var(--color-muted-foreground)]">
              {t('security.sessionActive')}
            </span>
          </div>
        </div>
      </section>

      {/* Journal */}
      <section className="flex flex-col gap-2 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[color:var(--color-surface-elevated)] text-[color:var(--color-blush-300)]">
            <ScrollText className="h-[18px] w-[18px]" strokeWidth={1.85} aria-hidden />
          </span>
          <div className="flex flex-col">
            <h2 className="font-display text-lg text-[color:var(--color-foreground)] italic">
              {t('security.journalTitle')}
            </h2>
            <span className="text-xs text-[color:var(--color-muted-foreground)]">
              {t('security.journalSub')}
            </span>
          </div>
        </div>
        <p className="border-t border-[color:var(--color-border)] pt-3 text-sm text-[color:var(--color-muted-foreground)]">
          {t.rich('security.journalBody', {
            link: (chunks) => (
              <Link
                href="/pro/dashboard"
                className="text-[color:var(--color-blush-300)] hover:underline"
              >
                {chunks}
              </Link>
            ),
          })}
        </p>
      </section>
    </div>
  );
}
