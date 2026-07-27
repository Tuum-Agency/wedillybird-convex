'use client';

import { useMemo, useState, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Lock, ShieldAlert, Sparkles } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Button, buttonVariants } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectLabel as SelectGroupLabel,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/cn';
import {
  US_STATES,
  CA_PROVINCES,
  NOT_APPLICABLE_STATE_ID,
  BIOMETRIC_BANNED_STATE_CODES,
} from '@/lib/geo/regions';
import { setFaceSearchEnabledAction } from '@/app/[locale]/(app)/events/actions';

interface Props {
  eventId: string;
  /** Code déjà persisté (`events.weddingState`) — absent/inconnu → sentinelle "N/A". */
  initialWeddingState?: string;
  initialFaceSearchEnabled: boolean;
  /** Horodatage du dernier consentement enregistré (`events.faceSearchConsent.enabledAt`). */
  consentAt?: number;
  /** Feature déverrouillée (Premium / Pro) ? Sinon on montre l'upsell — miroir RsvpQuestionsEditor. */
  unlocked: boolean;
  upgradeHref: string;
}

/**
 * Section « Confidentialité & reco-faciale » de la page d'édition d'event
 * (Lane T3, F7). Autonome — propre bouton d'enregistrement, comme
 * `RsvpQuestionsEditor` — car elle pilote deux champs (`weddingState` +
 * `faceSearchEnabled`) distincts du formulaire général `EventEditForm`, avec
 * une mutation dédiée qui gère l'opt-in + le geofence IL/TX/WA.
 *
 * L'État/province et l'activation sont soumis **ensemble** en un seul appel
 * (`setFaceSearchEnabledAction`) pour que le geofence évalue la valeur qu'on
 * est en train de choisir, jamais une valeur potentiellement obsolète.
 */
export function FaceSearchPrivacySection({
  eventId,
  initialWeddingState,
  initialFaceSearchEnabled,
  consentAt,
  unlocked,
  upgradeHref,
}: Props) {
  const t = useTranslations('FaceSearchPrivacy');
  const locale = useLocale();
  // Défaut = aucune sélection (placeholder), PAS la sentinelle permissive : le
  // couple doit déclarer sa juridiction avant de pouvoir activer (fail-closed
  // côté serveur, cf. decideFaceSearchOptIn).
  const [weddingState, setWeddingState] = useState(initialWeddingState ?? '');
  const [enabled, setEnabled] = useState(initialFaceSearchEnabled);
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [errorCode, setErrorCode] = useState<string>('errorSave');
  const [pending, startTransition] = useTransition();

  const isBanned = BIOMETRIC_BANNED_STATE_CODES.has(weddingState);
  const consentDateLabel = useMemo(
    () =>
      consentAt ? new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(consentAt) : null,
    [consentAt, locale],
  );

  function save() {
    setStatus('idle');
    const nextEnabled = isBanned ? false : enabled;
    // Envoyé tel quel : '' (rien choisi) → refus STATE_REQUIRED côté serveur ;
    // 'NONE' (hors US/CA) → juridiction déclarée, persistée, autorisée.
    const nextWeddingState = weddingState;
    startTransition(async () => {
      const res = await setFaceSearchEnabledAction(eventId, nextEnabled, nextWeddingState);
      if (res.ok) {
        setEnabled(res.enabled);
        setStatus('saved');
        return;
      }
      setStatus('error');
      setErrorCode(
        res.error === 'FACE_SEARCH_STATE_REQUIRED'
          ? 'errorStateRequired'
          : res.error === 'FACE_SEARCH_STATE_BANNED'
            ? 'errorStateBanned'
            : res.error === 'FEATURE_NOT_IN_PLAN'
              ? 'errorFeatureNotInPlan'
              : res.error === 'FORBIDDEN'
                ? 'errorForbidden'
                : 'errorSave',
      );
      // Le toggle repart de son dernier état confirmé côté serveur — on
      // n'affiche jamais "activé" sans confirmation réelle.
      setEnabled(initialFaceSearchEnabled);
    });
  }

  if (!unlocked) {
    return (
      <section className="flex flex-col gap-5 rounded-3xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-7 shadow-[var(--shadow-soft)] sm:p-9">
        <SectionHeader title={t('title')} subtitle={t('subtitle')} />
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-[color:var(--color-border-strong)] bg-[color:var(--color-primary-soft)] px-6 py-10 text-center">
          <span
            aria-hidden
            className="flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--color-surface)] text-[color:var(--color-primary)] shadow-[var(--shadow-soft)]"
          >
            <Lock className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <p className="max-w-sm text-sm leading-relaxed text-[color:var(--color-foreground)] sm:text-base">
            {t('lockedBody')}
          </p>
          <Link
            href={upgradeHref as never}
            className={cn(buttonVariants({ variant: 'primary', size: 'lg' }))}
          >
            <Sparkles className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            {t('lockedCta')}
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-8 rounded-3xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-7 shadow-[var(--shadow-soft)] sm:p-9">
      <SectionHeader title={t('title')} subtitle={t('subtitle')} />

      <div className="flex flex-col gap-2">
        <Label htmlFor="privacyWeddingState">{t('stateLabel')}</Label>
        <Select
          name="weddingState"
          value={weddingState}
          onValueChange={(v) => {
            setStatus('idle');
            setWeddingState(v);
          }}
        >
          <SelectTrigger
            id="privacyWeddingState"
            className="focus-ring h-11 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface-elevated)] px-3 text-sm"
          >
            <SelectValue placeholder={t('statePlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NOT_APPLICABLE_STATE_ID}>{t('stateNotApplicable')}</SelectItem>
            <SelectGroup>
              <SelectGroupLabel>{t('stateGroupUs')}</SelectGroupLabel>
              {US_STATES.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectGroup>
            <SelectGroup>
              <SelectGroupLabel>{t('stateGroupCa')}</SelectGroupLabel>
              {CA_PROVINCES.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <p className="text-xs text-[color:var(--color-muted-foreground)]">{t('stateHint')}</p>
      </div>

      <ToggleRow
        label={t('toggleLabel')}
        hint={t('toggleHint')}
        on={enabled && !isBanned}
        disabled={isBanned}
        onChange={(v) => {
          setStatus('idle');
          setEnabled(v);
        }}
      />

      {isBanned ? (
        <div className="flex items-start gap-3 rounded-2xl border border-[color:var(--color-destructive)]/30 bg-[color:var(--color-destructive)]/5 px-4 py-3">
          <ShieldAlert
            className="mt-0.5 h-4 w-4 flex-shrink-0 text-[color:var(--color-destructive)]"
            strokeWidth={1.75}
            aria-hidden
          />
          <p className="text-sm leading-relaxed text-[color:var(--color-foreground)]">
            {t('bannedNotice')}
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-elevated)] px-4 py-3">
          <p className="text-sm leading-relaxed text-[color:var(--color-foreground)]">
            {t('consentNoticeBody')}
          </p>
          {consentDateLabel ? (
            <p className="mt-2 text-xs text-[color:var(--color-muted-foreground)]">
              {t('consentRecordedAt', { date: consentDateLabel })}
            </p>
          ) : null}
        </div>
      )}

      <div className="flex flex-col gap-3 border-t border-[color:var(--color-border)] pt-6 sm:flex-row sm:items-center sm:justify-end">
        {status === 'saved' ? (
          <p className="text-sm text-[color:var(--color-success)] sm:mr-auto" role="status">
            {t('saved')}
          </p>
        ) : null}
        {status === 'error' ? (
          <p className="text-sm text-[color:var(--color-destructive)] sm:mr-auto" role="alert">
            {t(errorCode)}
          </p>
        ) : null}
        <Button
          type="button"
          variant="primary"
          size="lg"
          onClick={save}
          disabled={pending}
          data-testid="face-search-privacy-save"
        >
          {t('save')}
        </Button>
      </div>
    </section>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <h2
        className="font-display italic"
        style={{
          fontSize: 'clamp(1.25rem, 1.8vw, 1.5rem)',
          lineHeight: 1.2,
          letterSpacing: '-0.018em',
          color: 'var(--color-foreground)',
        }}
      >
        {title}
      </h2>
      <p className="text-sm text-[color:var(--color-muted-foreground)]">{subtitle}</p>
    </div>
  );
}

/** Toggle light (pouce positionné par `left` — piège Tailwind v4, cf. rsvp-questions-editor.tsx). */
function ToggleRow({
  label,
  hint,
  on,
  disabled,
  onChange,
}: {
  label: string;
  hint?: string;
  on: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-[color:var(--color-border)] p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium text-[color:var(--color-foreground)]">{label}</span>
          {hint ? (
            <span className="text-xs text-[color:var(--color-muted-foreground)]">{hint}</span>
          ) : null}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label={label}
          disabled={disabled}
          onClick={() => onChange(!on)}
          data-testid="face-search-enabled-toggle"
          className={cn(
            'focus-ring relative h-6 w-11 flex-shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50',
            on ? 'bg-[color:var(--color-primary)]' : 'bg-[color:var(--color-border-strong)]',
          )}
        >
          <span
            className={cn(
              'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all duration-200 ease-out',
              on ? 'left-[22px]' : 'left-0.5',
            )}
          />
        </button>
      </div>
    </div>
  );
}
