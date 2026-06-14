'use client';

/**
 * Formulaire de création d'un template WhatsApp personnalisé pour les
 * couples (option "Mon template personnalisé" sur la page /messaging).
 *
 * Workflow :
 *  1. Couple écrit son corps de message + libellé du bouton CTA + choisit
 *     son canal de notification (WhatsApp / email / les deux).
 *  2. Submit appelle `submitCustomTemplateAction` (cf. app actions) qui
 *     crée un draft Convex puis le soumet à Meta Cloud API.
 *  3. Côté UI, on `router.refresh()` pour que la page re-fetch et affiche
 *     `<TemplateStatusCard>` avec l'état pending.
 */

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/cn';
import { submitCustomTemplateAction } from '@/app/[locale]/(app)/events/actions';

const BODY_MAX = 1024;
const CTA_MAX = 25;

const NOTIFY_CHANNEL_VALUES = ['email', 'whatsapp', 'both'] as const;

interface Props {
  eventId: string;
  defaultNotifyChannel?: 'whatsapp' | 'email' | 'both';
}

export function CustomTemplateForm({ eventId, defaultNotifyChannel = 'email' }: Props) {
  const t = useTranslations('Events');
  const router = useRouter();
  const sampleBody = t('customSampleBody', { p1: '{{1}}', p2: '{{2}}', p3: '{{3}}', p4: '{{4}}' });
  const [bodyText, setBodyText] = useState(sampleBody);
  const [ctaLabel, setCtaLabel] = useState(t('customCtaDefault'));
  const [notifyChannel, setNotifyChannel] = useState<'whatsapp' | 'email' | 'both'>(
    defaultNotifyChannel,
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const trimmedLen = bodyText.trim().length;
  const hasGuestVar = /\{\{1\}\}/.test(bodyText);
  const ctaTooLong = ctaLabel.trim().length > CTA_MAX;
  const bodyTooShort = trimmedLen < 20;
  const bodyTooLong = trimmedLen > BODY_MAX;
  const canSubmit =
    !pending &&
    !bodyTooShort &&
    !bodyTooLong &&
    hasGuestVar &&
    !ctaTooLong &&
    ctaLabel.trim().length > 0;

  function submit() {
    setError(null);
    if (!canSubmit) {
      if (!hasGuestVar || bodyTooShort) {
        setError(t('customErrorBodyShort', { placeholder: '{{1}}' }));
      } else if (bodyTooLong) {
        setError(t('customErrorBodyLong', { max: BODY_MAX }));
      } else if (ctaTooLong) {
        setError(t('customErrorCtaLong', { max: CTA_MAX }));
      } else if (!ctaLabel.trim()) {
        setError(t('customErrorCtaRequired'));
      }
      return;
    }
    const fd = new FormData();
    fd.set('eventId', eventId);
    fd.set('bodyText', bodyText);
    fd.set('ctaLabel', ctaLabel);
    fd.set('templateNotifyChannel', notifyChannel);

    startTransition(async () => {
      const result = await submitCustomTemplateAction(fd);
      if (result.ok) {
        router.refresh();
        return;
      }
      const map: Record<string, string> = {
        BODY_TOO_SHORT: t('customErrorBodyShort', { placeholder: '{{1}}' }),
        BODY_TOO_LONG: t('customErrorBodyLong', { max: BODY_MAX }),
        BODY_MISSING_GUEST_PLACEHOLDER: t('customErrorBodyMissingPlaceholder', {
          placeholder: '{{1}}',
        }),
        CTA_LABEL_REQUIRED: t('customErrorCtaRequired'),
        CTA_LABEL_TOO_LONG: t('customErrorCtaLong', { max: CTA_MAX }),
        INVALID_CHANNEL: t('customErrorInvalidChannel'),
        INVALID_INPUT: t('customErrorInvalidInput'),
      };
      setError(map[result.error] ?? t('customErrorGeneric'));
    });
  }

  return (
    <form
      action={submit}
      className="flex flex-col gap-6 rounded-2xl border border-[color:var(--color-border)] bg-white p-5 shadow-[var(--shadow-soft)] sm:p-6"
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="customBody">{t('customBodyLabel')}</Label>
        <textarea
          id="customBody"
          name="bodyText"
          rows={8}
          value={bodyText}
          onChange={(e) => setBodyText(e.target.value)}
          maxLength={BODY_MAX + 200}
          className={cn(
            'focus-ring resize-vertical w-full rounded-xl border bg-white px-4 py-3 font-mono text-sm leading-relaxed text-[color:var(--color-ink-900)] placeholder:text-[color:var(--color-ink-300)]',
            bodyTooShort || bodyTooLong || !hasGuestVar
              ? 'border-[color:var(--color-blush-400)]'
              : 'border-[color:var(--color-border-strong)]',
          )}
        />
        <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[10px] tracking-[0.18em] uppercase">
          <span
            className={cn(
              'text-[color:var(--color-ink-500)]',
              !hasGuestVar ? 'text-[color:var(--color-blush-700)]' : null,
            )}
          >
            {t('customPlaceholderHint', { placeholder: '{{1}}' })}
          </span>
          <span
            className={cn(
              'text-[color:var(--color-ink-500)]',
              bodyTooLong ? 'text-[color:var(--color-blush-700)]' : null,
            )}
          >
            {trimmedLen}/{BODY_MAX}
          </span>
        </div>
        <p className="text-xs text-[color:var(--color-ink-500)]">
          {t.rich('customVariablesHint', {
            p1: '{{1}}',
            p2: '{{2}}',
            p3: '{{3}}',
            p4: '{{4}}',
            p5: '{{5}}',
            code: (chunks) => <span className="font-mono">{chunks}</span>,
          })}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="customCta">{t('customCtaLabel')}</Label>
        <Input
          id="customCta"
          name="ctaLabel"
          value={ctaLabel}
          maxLength={CTA_MAX}
          onChange={(e) => setCtaLabel(e.target.value)}
          placeholder={t('customCtaDefault')}
        />
        <p className="text-right font-mono text-[10px] tracking-[0.18em] text-[color:var(--color-ink-500)] uppercase">
          {ctaLabel.length}/{CTA_MAX}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <Label>{t('customNotifyLabel')}</Label>
        <div className="flex flex-col gap-2">
          {NOTIFY_CHANNEL_VALUES.map((value) => {
            const selected = notifyChannel === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setNotifyChannel(value)}
                className={cn(
                  'focus-ring flex flex-col gap-1 rounded-xl border p-4 text-left transition-all',
                  selected
                    ? 'border-[color:var(--color-blush-400)] bg-[color:var(--color-blush-50)]'
                    : 'border-[color:var(--color-border)] bg-white hover:border-[color:var(--color-blush-300)]',
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-[color:var(--color-ink-900)]">
                    {t(`customNotifyOptions.${value}.label`)}
                  </span>
                  <span
                    aria-hidden
                    className={cn(
                      'flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border',
                      selected
                        ? 'border-[color:var(--color-blush-700)] bg-[color:var(--color-blush-700)] text-white'
                        : 'border-[color:var(--color-border-strong)] bg-white',
                    )}
                  >
                    {selected ? '✦' : ''}
                  </span>
                </div>
                <span className="text-xs text-[color:var(--color-ink-500)]">
                  {t(`customNotifyOptions.${value}.hint`)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div
        className="rounded-xl border border-dashed border-[color:var(--color-blush-300)] px-4 py-3 text-xs leading-relaxed text-[color:var(--color-ink-500)]"
        style={{ background: 'oklch(98% 0.012 22)' }}
      >
        {t('customMetaNotice')}
      </div>

      {error ? (
        <p role="alert" className="text-sm text-[color:var(--color-destructive)]">
          {error}
        </p>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" variant="primary" size="md" disabled={!canSubmit}>
          <Send className="h-4 w-4" strokeWidth={2} aria-hidden />
          {pending ? t('customSubmitting') : t('customSubmit')}
        </Button>
      </div>
    </form>
  );
}
