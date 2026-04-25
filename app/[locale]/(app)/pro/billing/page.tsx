import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { convexApi, getConvexServerClient } from '@/lib/auth/convex-server';
import { SUBSCRIPTION_TIER_PRICES, type SubscriptionTier } from '@/lib/payments/subscriptions';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { subscribeAction, openBillingPortalAction } from './actions';

const TIER_ORDER: readonly SubscriptionTier[] = ['starter', 'business', 'agency'];

const STATUS_LABEL: Record<string, string> = {
  trialing: "Période d'essai",
  active: 'Actif',
  past_due: 'Paiement en retard',
  canceled: 'Annulé',
  unpaid: 'Impayé',
};

const STATUS_VARIANT: Record<string, 'accent' | 'primary' | 'destructive'> = {
  trialing: 'primary',
  active: 'accent',
  past_due: 'destructive',
  canceled: 'destructive',
  unpaid: 'destructive',
};

function formatPrice(amountMinor: number): string {
  return `${(amountMinor / 100).toLocaleString('fr-FR', { minimumFractionDigits: 0 })} €`;
}

function formatPeriodEnd(timestamp: number | undefined): string | null {
  if (!timestamp) return null;
  return new Date(timestamp).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default async function ProBillingPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect('/login?next=/pro/billing');

  const convex = getConvexServerClient();
  const org = await convex.query(convexApi.myOrganization, { userId: session.userId });
  if (!org) redirect('/pro/onboarding');

  const params = await searchParams;
  const banner =
    params.status === 'success'
      ? { kind: 'success' as const, text: 'Abonnement activé. Bienvenue !' }
      : params.status === 'cancel'
        ? {
            kind: 'info' as const,
            text: 'Souscription annulée. Vous pouvez réessayer à tout moment.',
          }
        : null;

  const currentTier = org.subscriptionTier;
  const isCurrentTier = (tier: SubscriptionTier) => currentTier === tier;
  const periodEndLabel = formatPeriodEnd(org.subscriptionPeriodEnd);
  const hasActive =
    org.subscriptionStatus === 'active' ||
    org.subscriptionStatus === 'trialing' ||
    org.subscriptionStatus === 'past_due';

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">Abonnement</h1>
        <p className="text-[color:var(--color-muted)]">
          Choisissez le plan adapté à <strong>{org.name}</strong>. Vous pouvez changer ou annuler à
          tout moment depuis le portail client.
        </p>
      </header>

      {banner ? (
        <div
          role="status"
          className={`rounded-xl border px-4 py-3 text-sm ${
            banner.kind === 'success'
              ? 'border-[color:var(--color-accent)] bg-[color:var(--color-accent)]/10 text-[color:var(--color-accent-foreground)]'
              : 'border-[color:var(--color-border)] bg-[color:var(--color-surface)] text-[color:var(--color-foreground)]'
          }`}
        >
          {banner.text}
        </div>
      ) : null}

      <section className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-sm tracking-wide text-[color:var(--color-muted)] uppercase">
              Statut actuel
            </span>
            {currentTier && org.subscriptionStatus ? (
              <div className="flex items-center gap-3">
                <span className="text-xl font-semibold">
                  {SUBSCRIPTION_TIER_PRICES[currentTier].label}
                </span>
                <Badge variant={STATUS_VARIANT[org.subscriptionStatus] ?? 'primary'}>
                  {STATUS_LABEL[org.subscriptionStatus] ?? org.subscriptionStatus}
                </Badge>
              </div>
            ) : (
              <span className="text-xl font-semibold">Aucun abonnement</span>
            )}
            {periodEndLabel && hasActive ? (
              <span className="text-sm text-[color:var(--color-muted)]">
                Renouvellement le {periodEndLabel}
              </span>
            ) : null}
          </div>
          {org.stripeCustomerId ? (
            <form action={openBillingPortalAction}>
              <Button type="submit" variant="ghost" data-testid="open-portal">
                Gérer mon abonnement
              </Button>
            </form>
          ) : null}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3" data-testid="tier-grid">
        {TIER_ORDER.map((tier) => {
          const price = SUBSCRIPTION_TIER_PRICES[tier];
          const isCurrent = isCurrentTier(tier);
          return (
            <article
              key={tier}
              data-testid={`tier-card-${tier}`}
              data-current={isCurrent ? 'true' : undefined}
              className={`flex flex-col gap-4 rounded-2xl border p-6 ${
                isCurrent
                  ? 'border-[color:var(--color-accent)] bg-[color:var(--color-accent)]/5'
                  : 'border-[color:var(--color-border)] bg-[color:var(--color-surface)]'
              }`}
            >
              <header className="flex flex-col gap-1">
                <h2 className="text-xl font-semibold">{price.label}</h2>
                <p className="text-sm text-[color:var(--color-muted)]">{price.description}</p>
              </header>
              <p className="text-3xl font-semibold">
                {formatPrice(price.amountMinor)}
                <span className="text-sm font-normal text-[color:var(--color-muted)]"> / mois</span>
              </p>
              <ul className="flex flex-col gap-1.5 text-sm">
                {price.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <span aria-hidden>•</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <form action={subscribeAction} className="mt-auto">
                <input type="hidden" name="tier" value={tier} />
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isCurrent && hasActive}
                  data-testid={`subscribe-${tier}`}
                >
                  {isCurrent && hasActive
                    ? 'Plan actuel'
                    : currentTier
                      ? 'Changer pour ce plan'
                      : 'Souscrire'}
                </Button>
              </form>
            </article>
          );
        })}
      </section>

      <footer className="text-xs text-[color:var(--color-muted)]">
        Paiements sécurisés par Stripe en mode test (aucune transaction réelle). Vous pouvez annuler
        depuis le portail à tout moment.
      </footer>
    </div>
  );
}
