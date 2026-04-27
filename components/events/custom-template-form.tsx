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
import { useRouter } from 'next/navigation';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/cn';
import { submitCustomTemplateAction } from '@/app/[locale]/(app)/events/actions';

const BODY_MAX = 1024;
const CTA_MAX = 25;

const NOTIFY_CHANNELS: ReadonlyArray<{
  value: 'whatsapp' | 'email' | 'both';
  label: string;
  hint: string;
}> = [
  { value: 'email', label: 'Par email', hint: 'Notification dans votre boîte de réception.' },
  {
    value: 'whatsapp',
    label: 'Sur WhatsApp',
    hint: 'Message direct sur votre numéro WhatsApp.',
  },
  { value: 'both', label: 'Les deux', hint: "Vous ne raterez pas l'info." },
];

const PLACEHOLDER_HINT = '{{1}} obligatoire';

const SAMPLE_BODY =
  "Bonjour {{1}},\n\n{{2}} ont l'honneur de vous convier à leur mariage le {{3}}. {{4}}\n\nMerci de confirmer votre présence en cliquant sur le bouton ci-dessous.";

interface Props {
  eventId: string;
  defaultNotifyChannel?: 'whatsapp' | 'email' | 'both';
}

export function CustomTemplateForm({ eventId, defaultNotifyChannel = 'email' }: Props) {
  const router = useRouter();
  const [bodyText, setBodyText] = useState(SAMPLE_BODY);
  const [ctaLabel, setCtaLabel] = useState('Confirmer ma présence');
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
        setError('Le message doit contenir au moins 20 caractères et inclure {{1}}.');
      } else if (bodyTooLong) {
        setError(`Le message dépasse ${BODY_MAX} caractères.`);
      } else if (ctaTooLong) {
        setError(`Le libellé du bouton dépasse ${CTA_MAX} caractères.`);
      } else if (!ctaLabel.trim()) {
        setError('Le libellé du bouton est requis.');
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
        BODY_TOO_SHORT: 'Le message doit contenir au moins 20 caractères et inclure {{1}}.',
        BODY_TOO_LONG: `Le message dépasse ${BODY_MAX} caractères.`,
        BODY_MISSING_GUEST_PLACEHOLDER: 'Le message doit inclure {{1}} (prénom invité).',
        CTA_LABEL_REQUIRED: 'Le libellé du bouton est requis.',
        CTA_LABEL_TOO_LONG: `Le libellé du bouton dépasse ${CTA_MAX} caractères.`,
        INVALID_CHANNEL: 'Choisissez un canal de notification valide.',
        INVALID_INPUT: 'Champ manquant ou invalide.',
      };
      setError(
        map[result.error] ??
          'Soumission impossible. Vérifiez vos infos ou réessayez dans un instant.',
      );
    });
  }

  return (
    <form
      action={submit}
      className="flex flex-col gap-6 rounded-2xl border border-[color:var(--color-border)] bg-white p-5 shadow-[var(--shadow-soft)] sm:p-6"
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="customBody">Corps du message</Label>
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
            {PLACEHOLDER_HINT}
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
          Variables disponibles : <span className="font-mono">{'{{1}}'}</span> prénom invité ·{' '}
          <span className="font-mono">{'{{2}}'}</span> noms du couple ·{' '}
          <span className="font-mono">{'{{3}}'}</span> date · <span className="font-mono">{'{{4}}'}</span>{' '}
          mot perso · <span className="font-mono">{'{{5}}'}</span> libre.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="customCta">Libellé du bouton</Label>
        <Input
          id="customCta"
          name="ctaLabel"
          value={ctaLabel}
          maxLength={CTA_MAX}
          onChange={(e) => setCtaLabel(e.target.value)}
          placeholder="Confirmer ma présence"
        />
        <p className="text-right font-mono text-[10px] tracking-[0.18em] text-[color:var(--color-ink-500)] uppercase">
          {ctaLabel.length}/{CTA_MAX}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <Label>Comment être prévenu·e du résultat ?</Label>
        <div className="flex flex-col gap-2">
          {NOTIFY_CHANNELS.map((opt) => {
            const selected = notifyChannel === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setNotifyChannel(opt.value)}
                className={cn(
                  'focus-ring flex flex-col gap-1 rounded-xl border p-4 text-left transition-all',
                  selected
                    ? 'border-[color:var(--color-blush-400)] bg-[color:var(--color-blush-50)]'
                    : 'border-[color:var(--color-border)] bg-white hover:border-[color:var(--color-blush-300)]',
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-[color:var(--color-ink-900)]">
                    {opt.label}
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
                <span className="text-xs text-[color:var(--color-ink-500)]">{opt.hint}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div
        className="rounded-xl border border-dashed border-[color:var(--color-blush-300)] px-4 py-3 text-xs leading-relaxed text-[color:var(--color-ink-500)]"
        style={{ background: 'oklch(98% 0.012 22)' }}
      >
        Validation Meta sous 24-48h. Vous serez prévenu·e dès la décision via le canal choisi
        ci-dessus. Tant que le template n&apos;est pas validé, les invitations utiliseront le style
        préfabriqué sélectionné en haut de page.
      </div>

      {error ? (
        <p role="alert" className="text-sm text-[color:var(--color-destructive)]">
          {error}
        </p>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" variant="primary" size="md" disabled={!canSubmit}>
          <Send className="h-4 w-4" strokeWidth={2} aria-hidden />
          {pending ? 'Soumission…' : 'Soumettre à WhatsApp'}
        </Button>
      </div>
    </form>
  );
}
