'use client';

/**
 * Bouton + dialog « Nouveau mariage » du back-office agence. Crée un event
 * **rattaché à l'organisation** (server action `createOrgWeddingAction`) puis
 * ouvre son hub. Remplace l'ancien lien vers `/events/new` (parcours couple).
 * S'ouvre automatiquement via le deep-link `?new=1` (depuis le cockpit).
 */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X, Calendar, MapPin, Heart } from 'lucide-react';
import { cn } from '@/lib/cn';
import { buttonVariants } from '@/components/ui/button';
import { createOrgWeddingAction } from '@/app/[locale]/(app)/pro/actions';

export function NewWeddingLauncher({ autoOpen = false }: { autoOpen?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(autoOpen);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const partnerA = String(fd.get('partnerA') ?? '').trim();
    const partnerB = String(fd.get('partnerB') ?? '').trim();
    const dateStr = String(fd.get('eventDate') ?? '');
    const venueName = String(fd.get('venueName') ?? '').trim();
    const venueAddress = String(fd.get('venueAddress') ?? '').trim();
    if (!partnerA || !partnerB) {
      setError('Indiquez les deux prénoms du couple.');
      return;
    }
    const eventDate = dateStr ? new Date(`${dateStr}T12:00:00`).getTime() : NaN;
    if (!Number.isFinite(eventDate)) {
      setError('Choisissez une date de mariage.');
      return;
    }
    startTransition(async () => {
      const res = await createOrgWeddingAction({
        partnerA,
        partnerB,
        eventDate,
        ...(venueName ? { venueName } : {}),
        ...(venueAddress ? { venueAddress } : {}),
      });
      if (res.ok) {
        setOpen(false);
        router.push(`/pro/weddings/${res.id}` as never);
        router.refresh();
      } else {
        setError(
          res.error === 'INVALID_NAMES' ? 'Prénoms invalides.' : 'La création a échoué. Réessayez.',
        );
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(buttonVariants({ variant: 'primary', size: 'md' }))}
      >
        <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
        Nouveau mariage
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Nouveau mariage"
        >
          <button
            type="button"
            aria-label="Fermer"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          />
          <form
            onSubmit={submit}
            className="relative flex w-full max-w-md flex-col gap-5 rounded-2xl border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface)] p-6 shadow-[var(--shadow-popover)]"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl bg-[color:var(--color-surface-elevated)] text-[color:var(--color-blush-300)]">
                  <Heart className="h-5 w-5" strokeWidth={1.85} aria-hidden />
                </span>
                <div className="flex flex-col gap-0.5">
                  <span className="font-mono text-[10px] tracking-[0.18em] text-[color:var(--color-muted-foreground)] uppercase">
                    Back-office agence
                  </span>
                  <h2 className="font-display text-xl text-[color:var(--color-foreground)] italic">
                    Nouveau mariage
                  </h2>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fermer"
                className="text-[color:var(--color-muted-foreground)] hover:text-[color:var(--color-foreground)]"
              >
                <X className="h-5 w-5" strokeWidth={2} aria-hidden />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Partenaire A">
                <input name="partnerA" autoFocus required placeholder="Awa" className={INPUT} />
              </Field>
              <Field label="Partenaire B">
                <input name="partnerB" required placeholder="Karim" className={INPUT} />
              </Field>
            </div>

            <Field label="Date du mariage" icon={Calendar}>
              <input name="eventDate" type="date" required className={INPUT} />
            </Field>

            <Field label="Lieu de réception (optionnel)" icon={MapPin}>
              <input name="venueName" placeholder="Domaine de la Roseraie" className={INPUT} />
            </Field>
            <Field label="Ville / adresse (optionnel)">
              <input name="venueAddress" placeholder="Aix-en-Provence" className={INPUT} />
            </Field>

            {error ? <p className="text-sm text-[color:var(--color-danger)]">{error}</p> : null}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg px-4 py-2 text-sm text-[color:var(--color-muted-foreground)] hover:text-[color:var(--color-foreground)]"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={pending}
                className={cn(
                  buttonVariants({ variant: 'primary', size: 'md' }),
                  'disabled:opacity-50',
                )}
              >
                {pending ? 'Création…' : 'Créer le mariage'}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}

const INPUT =
  'h-10 w-full rounded-lg border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface-elevated)] px-3 text-sm text-[color:var(--color-foreground)] outline-none placeholder:text-[color:var(--color-muted-foreground)] focus:border-[color:var(--color-blush-400)]';

function Field({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon?: typeof Calendar;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="inline-flex items-center gap-1.5 font-mono text-[10px] tracking-[0.14em] text-[color:var(--color-muted-foreground)] uppercase">
        {Icon ? <Icon className="h-3 w-3" strokeWidth={1.9} aria-hidden /> : null}
        {label}
      </span>
      {children}
    </label>
  );
}
