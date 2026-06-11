import { Check, Lock, ArrowUpRight, Hammer, type LucideIcon } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/cn';
import { buttonVariants } from '@/components/ui/button';
import type { SubscriptionTier } from '@/lib/payments/subscriptions';

/**
 * ModulePlaceholder — page de module back-office dont l'implémentation est en
 * cours. Présente honnêtement le **périmètre prévu** (d'après la grille v3) avec
 * un statut « bientôt », et gère le **gating par forfait** : si le tier de
 * l'agence n'inclut pas le module, on affiche un encart d'upgrade plutôt que la
 * préversion.
 *
 * Pas de fausses données : on décrit ce qui arrive, on ne simule pas un produit
 * fini.
 */

const TIER_LABEL: Record<SubscriptionTier, string> = {
  starter: 'Starter',
  business: 'Business',
  agency: 'Agency',
};

export interface ModulePlaceholderProps {
  eyebrow: string;
  title: string;
  Icon: LucideIcon;
  description: string;
  /** Capacités prévues (aperçu du périmètre, issu de la grille v3). */
  capabilities: ReadonlyArray<string>;
  /** Si défini, le module est verrouillé tant que le tier n'atteint pas ce palier. */
  lockedUntil?: SubscriptionTier | null;
}

export function ModulePlaceholder({
  eyebrow,
  title,
  Icon,
  description,
  capabilities,
  lockedUntil = null,
}: ModulePlaceholderProps) {
  const locked = lockedUntil != null;

  return (
    <div className="container-page flex flex-col gap-8 py-8 sm:py-10">
      <header className="flex flex-col gap-2">
        <span className="font-mono text-[10px] tracking-[0.32em] text-[color:var(--color-muted-foreground)] uppercase">
          {eyebrow}
        </span>
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="flex h-11 w-11 items-center justify-center rounded-xl bg-[color:var(--color-surface-elevated)] text-[color:var(--color-blush-300)]"
          >
            <Icon className="h-5 w-5" strokeWidth={1.7} />
          </span>
          <h1
            className="font-display italic"
            style={{
              fontSize: 'clamp(1.9rem, 4vw, 2.75rem)',
              lineHeight: 1.05,
              letterSpacing: '-0.022em',
              color: 'var(--color-foreground)',
            }}
          >
            {title}
          </h1>
        </div>
        <p className="max-w-2xl text-sm leading-relaxed text-[color:var(--color-muted-foreground)] sm:text-base">
          {description}
        </p>
      </header>

      {locked ? (
        <div
          className="flex flex-col items-start gap-4 rounded-3xl border p-7 sm:flex-row sm:items-center sm:justify-between"
          style={{ borderColor: 'var(--color-border-strong)', background: 'var(--color-surface)' }}
        >
          <div className="flex items-start gap-3">
            <span
              aria-hidden
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[color:var(--color-surface-elevated)] text-[color:var(--color-gold-500)]"
            >
              <Lock className="h-[18px] w-[18px]" strokeWidth={1.85} />
            </span>
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium text-[color:var(--color-foreground)]">
                Inclus à partir du forfait {TIER_LABEL[lockedUntil!]}
              </p>
              <p className="max-w-md text-sm text-[color:var(--color-muted-foreground)]">
                Ce module n’est pas compris dans votre forfait actuel. Passez à un palier supérieur
                pour le débloquer.
              </p>
            </div>
          </div>
          <Link
            href="/pro/billing"
            className={cn(buttonVariants({ variant: 'primary', size: 'md' }), 'flex-shrink-0')}
          >
            Voir les forfaits
            <ArrowUpRight className="h-4 w-4" strokeWidth={2} aria-hidden />
          </Link>
        </div>
      ) : (
        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface)] px-3.5 py-1.5 font-mono text-[10px] tracking-[0.16em] text-[color:var(--color-gold-500)] uppercase">
          <Hammer className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
          Bientôt disponible
        </div>
      )}

      <section className="flex flex-col gap-4 rounded-3xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6 sm:p-7">
        <h2 className="font-mono text-[10px] tracking-[0.24em] text-[color:var(--color-muted-foreground)] uppercase">
          Ce que ce module apportera
        </h2>
        <ul className="grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
          {capabilities.map((cap) => (
            <li
              key={cap}
              className="flex items-start gap-2.5 text-sm text-[color:var(--color-foreground)]"
            >
              <Check
                className="mt-0.5 h-4 w-4 flex-shrink-0 text-[color:var(--color-sage-500)]"
                strokeWidth={2}
                aria-hidden
              />
              {cap}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
