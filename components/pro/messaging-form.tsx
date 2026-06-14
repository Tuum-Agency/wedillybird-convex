'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { MessageSquare, Sparkles, Bell, Check, CircleCheck, Circle } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import {
  MSG_CHANNELS,
  MSG_TEMPLATE_OPTS,
  mergeMessaging,
  type MessagingDefaults,
  type MsgChannel,
  type MsgTemplate,
} from '@/lib/pro/messaging-defaults';
import { updateMessagingDefaultsAction } from '@/app/[locale]/(app)/pro/actions';

function Switch({
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
        'relative h-6 w-11 flex-shrink-0 rounded-full transition-colors',
        on ? 'bg-[color:var(--color-blush-700)]' : 'bg-[color:var(--color-surface-elevated)]',
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 h-5 w-5 rounded-full shadow-sm transition-all duration-200 ease-out',
          on ? 'left-[22px] bg-[color:var(--color-blush-400)]' : 'left-0.5 bg-white',
        )}
        aria-hidden
      />
    </button>
  );
}

function Card({
  Icon,
  title,
  sub,
  children,
}: {
  Icon: typeof Bell;
  title: string;
  sub: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6">
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[color:var(--color-surface-elevated)] text-[color:var(--color-blush-300)]">
          <Icon className="h-[18px] w-[18px]" strokeWidth={1.85} aria-hidden />
        </span>
        <div className="flex flex-col">
          <h2 className="font-display text-lg text-[color:var(--color-foreground)] italic">
            {title}
          </h2>
          <span className="text-xs text-[color:var(--color-muted-foreground)]">{sub}</span>
        </div>
      </div>
      <div className="flex flex-col gap-3 border-t border-[color:var(--color-border)] pt-3">
        {children}
      </div>
    </section>
  );
}

function Row({ title, desc, control }: { title: string; desc: string; control: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex flex-col gap-0.5">
        <b className="text-sm text-[color:var(--color-foreground)]">{title}</b>
        <span className="text-xs text-[color:var(--color-muted-foreground)]">{desc}</span>
      </div>
      <div className="flex-shrink-0">{control}</div>
    </div>
  );
}

export function MessagingForm({
  orgName,
  initialDefaults,
  canWrite,
}: {
  orgName: string;
  initialDefaults: Partial<MessagingDefaults> | null;
  canWrite: boolean;
}) {
  const t = useTranslations('Pro.main');
  const router = useRouter();
  const [d, setD] = useState<MessagingDefaults>(() => mergeMessaging(orgName, initialDefaults));
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function patch<K extends keyof MessagingDefaults>(key: K, value: MessagingDefaults[K]) {
    if (!canWrite) return;
    setSaved(false);
    setD((prev) => ({ ...prev, [key]: value }));
  }

  function onSave() {
    setError(null);
    startTransition(async () => {
      const res = await updateMessagingDefaultsAction(d);
      if (!res.ok) {
        setError(t('messaging.saveError'));
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Card
        Icon={MessageSquare}
        title={t('messaging.channelCardTitle')}
        sub={t('messaging.channelCardSub')}
      >
        <Row
          title={t('messaging.defaultChannel')}
          desc={t('messaging.defaultChannelDesc')}
          control={
            <div className="flex items-center gap-1 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface-elevated)] p-0.5">
              {MSG_CHANNELS.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => patch('channel', c.key as MsgChannel)}
                  aria-pressed={d.channel === c.key}
                  className={cn(
                    'rounded-md px-2.5 py-1.5 text-xs transition-colors',
                    d.channel === c.key
                      ? 'bg-[color:var(--color-surface)] font-medium text-[color:var(--color-foreground)]'
                      : 'text-[color:var(--color-muted-foreground)] hover:text-[color:var(--color-foreground)]',
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>
          }
        />
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-[color:var(--color-muted-foreground)]">
            {t('messaging.senderName')}
          </span>
          <input
            value={d.senderName}
            onChange={(e) => patch('senderName', e.target.value)}
            disabled={!canWrite}
            maxLength={120}
            className="focus-ring h-10 rounded-lg border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface-elevated)] px-3 text-sm text-[color:var(--color-foreground)] disabled:opacity-60"
          />
        </label>
      </Card>

      <Card
        Icon={Sparkles}
        title={t('messaging.templateCardTitle')}
        sub={t('messaging.templateCardSub')}
      >
        <div className="flex flex-wrap gap-2">
          {MSG_TEMPLATE_OPTS.map((t) => {
            const on = d.defaultTemplate === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => patch('defaultTemplate', t.key as MsgTemplate)}
                aria-pressed={on}
                className={cn(
                  'inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors',
                  on
                    ? 'border-[color:var(--color-blush-400)] bg-[color:var(--color-surface-elevated)] text-[color:var(--color-foreground)]'
                    : 'border-[color:var(--color-border)] text-[color:var(--color-muted-foreground)] hover:border-[color:var(--color-border-strong)] hover:text-[color:var(--color-foreground)]',
                )}
              >
                {on ? (
                  <CircleCheck
                    className="h-[15px] w-[15px] text-[color:var(--color-blush-300)]"
                    strokeWidth={1.9}
                    aria-hidden
                  />
                ) : (
                  <Circle className="h-[15px] w-[15px]" strokeWidth={1.9} aria-hidden />
                )}
                {t.label}
              </button>
            );
          })}
        </div>
      </Card>

      <Card
        Icon={Bell}
        title={t('messaging.remindersCardTitle')}
        sub={t('messaging.remindersCardSub')}
      >
        <Row
          title={t('messaging.reminderJ7')}
          desc={t('messaging.reminderJ7Desc')}
          control={
            <Switch
              on={d.reminderJ7}
              onChange={(v) => patch('reminderJ7', v)}
              label={t('messaging.reminderJ7Aria')}
            />
          }
        />
        <Row
          title={t('messaging.reminderJ1')}
          desc={t('messaging.reminderJ1Desc')}
          control={
            <Switch
              on={d.reminderJ1}
              onChange={(v) => patch('reminderJ1', v)}
              label={t('messaging.reminderJ1Aria')}
            />
          }
        />
      </Card>

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
            data-testid="save-messaging"
          >
            {pending ? t('messaging.saving') : t('messaging.save')}
          </Button>
          {saved ? (
            <span className="inline-flex items-center gap-1.5 text-sm text-[color:var(--color-sage-500)]">
              <Check className="h-4 w-4" strokeWidth={2.4} aria-hidden /> {t('messaging.saved')}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
