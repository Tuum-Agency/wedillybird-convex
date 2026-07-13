import { Sparkles, ArrowRight } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/cn';

/**
 * Bannière « choisir un forfait » du back-office agence.
 *
 * Affichée quand l'organisation n'a **pas encore choisi de forfait** (ni
 * abonnement actif/essai, ni crédit Pay-as-you-go). Les fonctionnalités — créer
 * un mariage, rétroplanning, prestataires… — sont verrouillées côté serveur
 * (mutations Convex → `SUBSCRIPTION_REQUIRED`) ; cette bannière explique le
 * blocage et renvoie vers la page Facturation.
 *
 * FR en dur, comme le reste du back-office (décision « 100 % FR back-office »,
 * cf. CLAUDE.md) — pas de clé next-intl à décliner sur 7 locales.
 */
export function PlanRequiredBanner({ feature }: { feature?: string }) {
  return (
    <section
      role="status"
      data-testid="plan-required-banner"
      className="flex flex-col gap-4 rounded-2xl border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface)] p-6 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-3.5">
        <span
          aria-hidden
          className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-xl bg-[color:var(--color-surface-elevated)] text-[color:var(--color-gold-500)]"
        >
          <Sparkles className="h-5 w-5" strokeWidth={1.85} />
        </span>
        <div className="flex flex-col gap-1">
          <h2
            className="font-display text-lg text-[color:var(--color-foreground)] italic"
            style={{ letterSpacing: '-0.018em' }}
          >
            Choisissez un forfait pour activer votre agence
          </h2>
          <p className="max-w-xl text-sm leading-relaxed text-[color:var(--color-muted-foreground)]">
            {feature
              ? `L’accès à ${feature} nécessite un abonnement actif ou un crédit Pay-as-you-go.`
              : 'Créer un mariage, le rétroplanning et les prestataires nécessitent un abonnement actif ou un crédit Pay-as-you-go.'}
          </p>
        </div>
      </div>
      <Link
        href="/pro/billing"
        data-testid="plan-required-cta"
        className={cn(
          buttonVariants({ variant: 'primary', size: 'md' }),
          'flex-shrink-0 self-start sm:self-auto',
        )}
      >
        Choisir un forfait
        <ArrowRight className="h-4 w-4" strokeWidth={2} aria-hidden />
      </Link>
    </section>
  );
}
