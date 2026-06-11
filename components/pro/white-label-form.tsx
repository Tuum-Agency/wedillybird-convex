'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Globe, Mail, BadgeCheck, Lock, Check } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { cleanDomain, isLikelyEmail, defaultSubdomain } from '@/lib/pro/white-label';
import { updateWhiteLabelAction } from '@/app/[locale]/(app)/pro/actions';

export function WhiteLabelForm({
  slug,
  initialCustomDomain,
  initialSenderEmail,
  initialWhiteLabelFull,
  isAgency,
}: {
  slug: string;
  initialCustomDomain: string;
  initialSenderEmail: string;
  initialWhiteLabelFull: boolean;
  isAgency: boolean;
}) {
  const router = useRouter();
  const [domain, setDomain] = useState(initialCustomDomain);
  const [email, setEmail] = useState(initialSenderEmail);
  const [full, setFull] = useState(initialWhiteLabelFull);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function onSave() {
    setError(null);
    setSaved(false);
    const cleanedDomain = domain.trim() ? cleanDomain(domain) : '';
    if (domain.trim() && !cleanedDomain) {
      setError('Domaine invalide (ex. mariages.monagence.fr).');
      return;
    }
    if (email.trim() && !isLikelyEmail(email)) {
      setError('Adresse e-mail expéditeur invalide.');
      return;
    }
    startTransition(async () => {
      const res = await updateWhiteLabelAction({
        customDomain: cleanedDomain,
        senderEmail: email.trim().toLowerCase(),
        whiteLabelFull: full,
      });
      if (!res.ok) {
        setError(
          res.error === 'FEATURE_NOT_IN_PLAN'
            ? 'La marque blanche totale nécessite le forfait Agency.'
            : 'Une erreur est survenue. Réessayez.',
        );
        return;
      }
      if (cleanedDomain && cleanedDomain !== domain) setDomain(cleanedDomain);
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <h2 className="font-display text-xl text-[color:var(--color-foreground)] italic">
            Domaine &amp; marque blanche
          </h2>
          {!isAgency ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--color-surface-elevated)] px-2 py-0.5 font-mono text-[9px] tracking-[0.16em] text-[color:var(--color-muted-foreground)] uppercase">
              <Lock className="h-2.5 w-2.5" strokeWidth={2.2} aria-hidden /> Agency
            </span>
          ) : null}
        </div>
        <p className="text-sm text-[color:var(--color-muted-foreground)]">
          Diffusez vos invitations sous votre propre domaine et e-mail, sans mention Wedillybird.
        </p>
      </div>

      <div className="flex flex-col gap-4 border-t border-[color:var(--color-border)] pt-4">
        {/* Sous-domaine (lecture seule) */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-[color:var(--color-muted-foreground)]">
            Adresse Wedillybird (incluse)
          </label>
          <div className="flex items-center gap-2 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface-elevated)] px-3 py-2.5">
            <Globe
              className="h-4 w-4 flex-shrink-0 text-[color:var(--color-muted-foreground)]"
              strokeWidth={1.85}
              aria-hidden
            />
            <span className="font-mono text-sm text-[color:var(--color-foreground)]">
              {defaultSubdomain(slug)}
            </span>
          </div>
        </div>

        <fieldset
          disabled={!isAgency}
          className={cn('flex flex-col gap-4', !isAgency && 'opacity-60')}
        >
          {/* Domaine sur mesure */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="wl-domain"
              className="text-xs font-medium text-[color:var(--color-muted-foreground)]"
            >
              Domaine sur mesure
            </label>
            <div className="flex items-center gap-2 rounded-lg border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface)] px-3 py-2.5 focus-within:border-[color:var(--color-blush-400)]">
              <Globe
                className="h-4 w-4 flex-shrink-0 text-[color:var(--color-muted-foreground)]"
                strokeWidth={1.85}
                aria-hidden
              />
              <input
                id="wl-domain"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="mariages.monagence.fr"
                className="w-full bg-transparent font-mono text-sm text-[color:var(--color-foreground)] outline-none placeholder:text-[color:var(--color-muted-foreground)]"
              />
            </div>
            <p className="text-[11px] text-[color:var(--color-muted-foreground)]">
              Ajoutez un enregistrement CNAME vers{' '}
              <span className="font-mono">cname.wedillybird.fr</span>.
            </p>
          </div>

          {/* E-mail expéditeur */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="wl-email"
              className="text-xs font-medium text-[color:var(--color-muted-foreground)]"
            >
              E-mail expéditeur
            </label>
            <div className="flex items-center gap-2 rounded-lg border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface)] px-3 py-2.5 focus-within:border-[color:var(--color-blush-400)]">
              <Mail
                className="h-4 w-4 flex-shrink-0 text-[color:var(--color-muted-foreground)]"
                strokeWidth={1.85}
                aria-hidden
              />
              <input
                id="wl-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="contact@monagence.fr"
                className="w-full bg-transparent text-sm text-[color:var(--color-foreground)] outline-none placeholder:text-[color:var(--color-muted-foreground)]"
              />
            </div>
          </div>

          {/* Retrait du badge */}
          <div className="flex items-center justify-between gap-3 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-elevated)] px-4 py-3">
            <span className="flex items-center gap-2.5">
              <BadgeCheck
                className="h-[18px] w-[18px] flex-shrink-0 text-[color:var(--color-blush-300)]"
                strokeWidth={1.85}
                aria-hidden
              />
              <span className="flex flex-col">
                <b className="text-sm text-[color:var(--color-foreground)]">
                  Retirer la mention « Propulsé par Wedillybird »
                </b>
                <span className="text-xs text-[color:var(--color-muted-foreground)]">
                  Sur les pages d’invitation et e-mails.
                </span>
              </span>
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={full}
              aria-label="Retirer le badge Wedillybird"
              onClick={() => setFull((f) => !f)}
              className={cn(
                'relative h-6 w-11 flex-shrink-0 rounded-full transition-colors',
                full ? 'bg-[color:var(--color-blush-700)]' : 'bg-[color:var(--color-surface)]',
              )}
            >
              <span
                className={cn(
                  'absolute top-0.5 h-5 w-5 rounded-full shadow-sm transition-all duration-200 ease-out',
                  full ? 'left-[22px] bg-[color:var(--color-blush-400)]' : 'left-0.5 bg-white',
                )}
                aria-hidden
              />
            </button>
          </div>
        </fieldset>

        {!isAgency ? (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-elevated)] px-4 py-3">
            <span className="text-sm text-[color:var(--color-muted-foreground)]">
              Marque blanche totale incluse dans le forfait Agency.
            </span>
            <Link
              href="/pro/billing"
              className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--color-border-strong)] px-3 py-1.5 text-xs text-[color:var(--color-foreground)] transition-colors hover:border-[color:var(--color-blush-400)]"
            >
              Passer à Agency
            </Link>
          </div>
        ) : null}

        {error ? (
          <p role="alert" className="text-sm text-[color:var(--color-danger)]">
            {error}
          </p>
        ) : null}

        {isAgency ? (
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={onSave}
              disabled={pending}
              data-testid="save-white-label"
            >
              {pending ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
            {saved ? (
              <span className="inline-flex items-center gap-1.5 text-sm text-[color:var(--color-sage-500)]">
                <Check className="h-4 w-4" strokeWidth={2.4} aria-hidden /> Enregistré
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
