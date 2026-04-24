'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { submitRsvpAction, type RsvpActionResult } from '@/app/[locale]/i/[token]/actions';

type RsvpStatus = 'attending' | 'declined' | 'maybe';

interface Props {
  token: string;
  plusOnesAllowed: number;
  initial: {
    rsvpStatus: 'pending' | RsvpStatus;
    plusOnesNames?: string[];
    dietaryRestrictions?: string;
    notes?: string;
  };
}

export function RsvpForm({ token, plusOnesAllowed, initial }: Props) {
  const t = useTranslations('Invitation');
  const tCommon = useTranslations('Common');
  const [status, setStatus] = useState<RsvpStatus | null>(
    initial.rsvpStatus === 'pending' ? null : initial.rsvpStatus,
  );
  const [names, setNames] = useState<string[]>(
    initial.plusOnesNames && initial.plusOnesNames.length > 0
      ? initial.plusOnesNames
      : Array(plusOnesAllowed).fill(''),
  );
  const [dietary, setDietary] = useState(initial.dietaryRestrictions ?? '');
  const [notes, setNotes] = useState(initial.notes ?? '');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | undefined>>({});
  const [success, setSuccess] = useState(initial.rsvpStatus !== 'pending');
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    setFieldErrors({});
    if (!status) {
      setError(t('errors.pickStatus'));
      return;
    }
    formData.set('rsvpStatus', status);
    formData.delete('plusOnesNames');
    if (status === 'attending') {
      for (const n of names) {
        if (n.trim().length > 0) formData.append('plusOnesNames', n.trim());
      }
    }

    startTransition(async () => {
      const result: RsvpActionResult = await submitRsvpAction(token, formData);
      if (result.ok) {
        setSuccess(true);
        return;
      }
      if (result.fieldErrors) {
        const flat: Record<string, string | undefined> = {};
        for (const [k, v] of Object.entries(result.fieldErrors)) {
          if (v && v.length > 0) flat[k] = v[0];
        }
        setFieldErrors(flat);
        return;
      }
      if (result.error === 'INVITATION_NOT_FOUND') setError(t('errors.notFound'));
      else if (result.error === 'EVENT_CLOSED') setError(t('errors.eventClosed'));
      else if (result.error === 'PLUS_ONES_EXCEEDED') setError(t('errors.plusOnesExceeded'));
      else setError(t('errors.unknown'));
    });
  }

  if (success) {
    return (
      <div
        data-testid="rsvp-success"
        className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6 text-center"
      >
        <p className="font-display text-xl font-semibold">{t('thanks')}</p>
        <p className="mt-2 text-sm text-[color:var(--color-muted)]">
          {status === 'attending'
            ? t('thanksAttending')
            : status === 'declined'
              ? t('thanksDeclined')
              : t('thanksMaybe')}
        </p>
        <button
          type="button"
          onClick={() => setSuccess(false)}
          className="mt-4 text-xs underline"
          data-testid="rsvp-change"
        >
          {t('changeAnswer')}
        </button>
      </div>
    );
  }

  return (
    <form
      action={handleSubmit}
      className="flex flex-col gap-6 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6"
      data-testid="rsvp-form"
    >
      <fieldset className="flex flex-col gap-3">
        <legend className="font-display text-lg font-semibold">{t('willYouAttend')}</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {(['attending', 'declined', 'maybe'] as const).map((s) => (
            <label
              key={s}
              className={`focus-ring flex cursor-pointer items-center justify-center rounded-lg border p-3 text-sm transition-colors ${
                status === s
                  ? 'border-[color:var(--color-accent)] bg-[color:var(--color-accent-muted,transparent)] font-medium'
                  : 'border-[color:var(--color-border)]'
              }`}
            >
              <input
                type="radio"
                name="rsvpStatus"
                value={s}
                checked={status === s}
                onChange={() => setStatus(s)}
                className="sr-only"
                data-testid={`rsvp-option-${s}`}
              />
              {t(`status.${s}`)}
            </label>
          ))}
        </div>
      </fieldset>

      {status === 'attending' && plusOnesAllowed > 0 ? (
        <fieldset className="flex flex-col gap-3">
          <legend className="font-medium">{t('plusOnesLegend', { count: plusOnesAllowed })}</legend>
          <div className="flex flex-col gap-2">
            {Array.from({ length: plusOnesAllowed }).map((_, i) => (
              <Input
                key={i}
                name="plusOnesNames"
                placeholder={t('plusOnePlaceholder', { index: i + 1 })}
                value={names[i] ?? ''}
                onChange={(e) => {
                  const next = [...names];
                  next[i] = e.target.value;
                  setNames(next);
                }}
                data-testid={`plus-one-${i}`}
              />
            ))}
          </div>
          {fieldErrors.plusOnesNames ? (
            <p className="text-xs text-[color:var(--color-destructive)]">
              {fieldErrors.plusOnesNames}
            </p>
          ) : null}
        </fieldset>
      ) : null}

      {status === 'attending' ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="dietaryRestrictions">{t('dietaryLabel')}</Label>
          <Input
            id="dietaryRestrictions"
            name="dietaryRestrictions"
            placeholder={t('dietaryPlaceholder')}
            value={dietary}
            onChange={(e) => setDietary(e.target.value)}
          />
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor="notes">{t('notesLabel')}</Label>
        <Input
          id="notes"
          name="notes"
          placeholder={t('notesPlaceholder')}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      {error ? (
        <p id="rsvp-error" role="alert" className="text-sm text-[color:var(--color-destructive)]">
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={pending} data-testid="submit-rsvp">
        {pending ? tCommon('loading') : t('submit')}
      </Button>
    </form>
  );
}
