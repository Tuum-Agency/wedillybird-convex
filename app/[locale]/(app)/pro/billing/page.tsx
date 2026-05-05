import { redirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { Check, Sparkles, Zap } from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import { convexApi, getConvexServerClient } from '@/lib/auth/convex-server';
import {
  SUBSCRIPTION_TIER_PRICES,
  PAYG_PRO_PRICE,
  type SubscriptionTier,
} from '@/lib/payments/subscriptions';
import { Button } from '@/components/ui/button';
import { ProShell, ProNav } from '@/components/pro/pro-shell';
import { subscribeAction, openBillingPortalAction, payAsYouGoAction } from './actions';

const TIER_ORDER: readonly SubscriptionTier[] = ['starter', 'business', 'agency'];

const STATUS_COLOR: Record<string, { bg: string; fg: string; dot: string }> = {
  trialing: {
    bg: 'oklch(28% 0.022 78)',
    fg: 'oklch(85% 0.04 78)',
    dot: 'oklch(78% 0.075 78)',
  },
  active: {
    bg: 'oklch(26% 0.04 145)',
    fg: 'oklch(82% 0.07 145)',
    dot: 'oklch(72% 0.08 145)',
  },
  past_due: {
    bg: 'oklch(28% 0.04 25)',
    fg: 'oklch(82% 0.07 22)',
    dot: 'oklch(72% 0.09 20)',
  },
  canceled: {
    bg: 'oklch(28% 0.012 78)',
    fg: 'oklch(72% 0.018 65)',
    dot: 'oklch(72% 0.018 65)',
  },
  unpaid: {
    bg: 'oklch(28% 0.04 25)',
    fg: 'oklch(82% 0.07 22)',
    dot: 'oklch(72% 0.09 20)',
  },
};

function formatPrice(amountMinor: number, locale: string): string {
  return `${(amountMinor / 100).toLocaleString(locale, { minimumFractionDigits: 0 })} €`;
}

function formatPaygAmount(amountMinor: number, currency: string, locale: string): string {
  const amount = amountMinor / 100;
  if (currency === 'EUR') return `${amount.toLocaleString(locale, { minimumFractionDigits: 2 })} €`;
  if (currency === 'XOF') return `${amount.toLocaleString(locale)} FCFA`;
  return `${amount.toLocaleString(locale)} ${currency}`;
}

function formatPaygDate(timestamp: number, locale: string): string {
  return new Date(timestamp).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function truncateSessionId(value: string): string {
  if (value.length <= 18) return value;
  return `${value.slice(0, 8)}…${value.slice(-6)}`;
}

function formatPeriodEnd(timestamp: number | undefined, locale: string): string | null {
  if (!timestamp) return null;
  return new Date(timestamp).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default async function ProBillingPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; kind?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect('/login?next=/pro/billing');

  const locale = await getLocale();
  const tBilling = await getTranslations('Billing');
  const tPlans = await getTranslations('Plans');

  const convex = getConvexServerClient();
  const org = await convex.query(convexApi.myOrganization, { userId: session.userId });
  if (!org) redirect('/pro/onboarding');

  const user = await convex.query(convexApi.currentUser, { userId: session.userId });
  const params = await searchParams;
  const banner =
    params.status === 'success' && params.kind === 'payg'
      ? { kind: 'success' as const, text: tBilling('paygSuccessBanner') }
      : params.status === 'success'
        ? { kind: 'success' as const, text: tBilling('subscribeSuccessBanner') }
        : params.status === 'cancel'
          ? { kind: 'info' as const, text: tBilling('cancelledBanner') }
          : null;

  const paygCredits = (await convex.query(convexApi.getPaygCreditsByOrganization, {
    organizationId: org._id,
    requesterId: session.userId,
  })) ?? { credits: 0 };

  const paygHistory = await convex.query(convexApi.listPaygPurchasesByOrganization, {
    organizationId: org._id,
    requesterId: session.userId,
  });

  const currentTier = org.subscriptionTier;
  const isCurrentTier = (tier: SubscriptionTier) => currentTier === tier;
  const periodEndLabel = formatPeriodEnd(org.subscriptionPeriodEnd, locale);
  const hasActive =
    org.subscriptionStatus === 'active' ||
    org.subscriptionStatus === 'trialing' ||
    org.subscriptionStatus === 'past_due';
  const statusCfg = org.subscriptionStatus ? STATUS_COLOR[org.subscriptionStatus] : undefined;

  return (
    <ProShell
      orgName={org.name}
      orgPrimaryColor={org.primaryColor ?? undefined}
      userName={user?.fullName}
      nav={<ProNav current="billing" />}
    >
      <div className="container-page mx-auto flex max-w-5xl flex-col gap-10 py-12 sm:py-16">
        <header className="flex flex-col gap-3">
          <span className="font-mono text-[10px] tracking-[0.32em] text-[color:var(--color-muted-foreground)] uppercase">
            {tBilling('eyebrow')}
          </span>
          <h1
            className="font-display text-balance italic"
            style={{
              fontSize: 'clamp(2rem, 4.5vw, 3rem)',
              lineHeight: 1.05,
              letterSpacing: '-0.022em',
              color: 'var(--color-foreground)',
            }}
          >
            {tBilling('title')}
          </h1>
          <p className="text-base leading-relaxed text-[color:var(--color-muted-foreground)] sm:text-lg">
            {tBilling.rich('subtitle', {
              name: org.name,
              strong: (chunks) => <strong>{chunks}</strong>,
            })}
          </p>
        </header>

        {banner ? (
          <div
            role="status"
            className={`rounded-2xl border px-5 py-4 text-sm ${
              banner.kind === 'success'
                ? 'border-[color:var(--color-sage-700)] bg-[oklch(26%_0.04_145)] text-[oklch(82%_0.07_145)]'
                : 'border-[color:var(--color-border)] bg-[color:var(--color-surface)] text-[color:var(--color-foreground)]'
            }`}
          >
            {banner.text}
          </div>
        ) : null}

        {/* Statut actuel */}
        <section className="rounded-3xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-7">
          <div className="flex flex-wrap items-center justify-between gap-5">
            <div className="flex flex-col gap-2">
              <span className="font-mono text-[10px] tracking-[0.32em] text-[color:var(--color-muted-foreground)] uppercase">
                {tBilling('currentStatusLabel')}
              </span>
              {currentTier && org.subscriptionStatus ? (
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className="font-display italic"
                    style={{
                      fontSize: 'clamp(1.5rem, 2.4vw, 1.875rem)',
                      letterSpacing: '-0.018em',
                      color: 'var(--color-foreground)',
                    }}
                  >
                    {SUBSCRIPTION_TIER_PRICES[currentTier].label}
                  </span>
                  {statusCfg ? (
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[9px] tracking-[0.18em] uppercase"
                      style={{ background: statusCfg.bg, color: statusCfg.fg }}
                    >
                      <span
                        aria-hidden
                        className="inline-block h-1.5 w-1.5 rounded-full"
                        style={{ background: statusCfg.dot }}
                      />
                      {tBilling(
                        `status.${org.subscriptionStatus}` as Parameters<typeof tBilling>[0],
                      ) ?? org.subscriptionStatus}
                    </span>
                  ) : null}
                </div>
              ) : (
                <span
                  className="font-display italic"
                  style={{
                    fontSize: 'clamp(1.25rem, 2vw, 1.5rem)',
                    color: 'var(--color-foreground)',
                  }}
                >
                  {tBilling('noSubscription')}
                </span>
              )}
              {periodEndLabel && hasActive ? (
                <span className="text-sm text-[color:var(--color-muted-foreground)]">
                  {tBilling('renewalDate', { date: periodEndLabel })}
                </span>
              ) : null}
            </div>
            {org.stripeCustomerId ? (
              <form action={openBillingPortalAction}>
                <Button type="submit" variant="outline" size="md" data-testid="open-portal">
                  {tBilling('manageSubscription')}
                </Button>
              </form>
            ) : null}
          </div>
        </section>

        {/* Tier cards */}
        <section className="grid gap-4 md:grid-cols-3" data-testid="tier-grid">
          {TIER_ORDER.map((tier) => {
            const price = SUBSCRIPTION_TIER_PRICES[tier];
            const isCurrent = isCurrentTier(tier);
            const isMid = tier === 'business';
            return (
              <article
                key={tier}
                data-testid={`tier-card-${tier}`}
                data-current={isCurrent ? 'true' : undefined}
                className={`relative flex flex-col gap-5 overflow-hidden rounded-3xl border p-7 transition-[transform,border-color] duration-300 ${
                  isCurrent
                    ? 'border-[color:var(--color-blush-400)] bg-[color:var(--color-surface)] shadow-[var(--shadow-blush)]'
                    : isMid
                      ? 'border-[color:var(--color-border-strong)] bg-[color:var(--color-surface)] [@media(hover:hover)]:hover:-translate-y-1'
                      : 'border-[color:var(--color-border)] bg-[color:var(--color-surface)] [@media(hover:hover)]:hover:-translate-y-0.5'
                }`}
              >
                {isCurrent ? (
                  <span className="absolute top-5 right-5 inline-flex items-center gap-1.5 rounded-full bg-[color:var(--color-blush-400)] px-2.5 py-1 font-mono text-[9px] tracking-[0.18em] text-[oklch(15%_0.012_28)] uppercase">
                    <Sparkles className="h-3 w-3" strokeWidth={2.5} aria-hidden />
                    {tBilling('currentPlanBadge')}
                  </span>
                ) : isMid ? (
                  <span className="absolute top-5 right-5 inline-flex items-center gap-1.5 rounded-full bg-[oklch(28%_0.05_80)] px-2.5 py-1 font-mono text-[9px] tracking-[0.18em] text-[oklch(85%_0.05_80)] uppercase">
                    <Sparkles className="h-3 w-3" strokeWidth={2.5} aria-hidden />
                    {tBilling('recommendedBadge')}
                  </span>
                ) : null}

                <header className="flex flex-col gap-1.5">
                  <h2
                    className="font-display italic"
                    style={{
                      fontSize: 'clamp(1.25rem, 1.8vw, 1.5rem)',
                      letterSpacing: '-0.018em',
                      color: 'var(--color-foreground)',
                    }}
                  >
                    {price.label}
                  </h2>
                  <p className="text-sm text-[color:var(--color-muted-foreground)]">
                    {tPlans(
                      `pro.descriptions.${price.descriptionKey}` as Parameters<typeof tPlans>[0],
                    )}
                  </p>
                </header>

                <p className="flex items-baseline gap-2">
                  <span
                    className="font-display tabular-nums"
                    style={{
                      fontSize: 'clamp(2.25rem, 4vw, 2.75rem)',
                      fontStyle: 'italic',
                      fontWeight: 300,
                      letterSpacing: '-0.025em',
                      lineHeight: 1,
                      color: 'var(--color-foreground)',
                    }}
                  >
                    {formatPrice(price.amountMinor, locale)}
                  </span>
                  <span className="text-sm text-[color:var(--color-muted-foreground)]">
                    {tBilling('perMonth')}
                  </span>
                </p>

                <ul className="flex flex-col gap-2 text-sm">
                  {price.featureKeys.map((key) => (
                    <li
                      key={key}
                      className="flex items-start gap-2.5 text-[color:var(--color-ink-700)]"
                    >
                      <span
                        aria-hidden
                        className="mt-0.5 inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-[color:var(--color-blush-400)]/15 text-[color:var(--color-blush-400)]"
                      >
                        <Check className="h-2.5 w-2.5" strokeWidth={3} />
                      </span>
                      <span className="leading-relaxed">
                        {tPlans(`pro.features.${key}` as Parameters<typeof tPlans>[0])}
                      </span>
                    </li>
                  ))}
                </ul>

                <form action={subscribeAction} className="mt-auto">
                  <input type="hidden" name="tier" value={tier} />
                  <Button
                    type="submit"
                    variant={isCurrent ? 'outline' : isMid ? 'primary' : 'outline'}
                    size="md"
                    className="w-full"
                    disabled={isCurrent && hasActive}
                    data-testid={`subscribe-${tier}`}
                  >
                    {isCurrent && hasActive
                      ? tBilling('currentPlanButton')
                      : currentTier
                        ? tBilling('changePlan')
                        : tBilling('subscribe')}
                  </Button>
                </form>
              </article>
            );
          })}
        </section>

        {/* Pay-as-you-go — alternative à l'abonnement, paiement à l'événement. */}
        <section
          className="flex flex-col gap-4 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6 sm:flex-row sm:items-center sm:justify-between"
          data-testid="payg-card"
        >
          <div className="flex flex-1 flex-col gap-2">
            <div className="flex items-center gap-2">
              <Zap
                className="h-4 w-4 text-[color:var(--color-gold-500)]"
                strokeWidth={2}
                aria-hidden
              />
              <h3 className="font-display text-lg italic" style={{ letterSpacing: '-0.018em' }}>
                Pay-as-you-go
              </h3>
              {paygCredits.credits > 0 ? (
                <span
                  className="rounded-full bg-[color:var(--color-gold-100)] px-2 py-0.5 font-mono text-[10px] tracking-[0.18em] text-[color:var(--color-gold-700)] uppercase"
                  data-testid="payg-credits-badge"
                >
                  {tBilling('paygCreditsAvailable', { count: paygCredits.credits })}
                </span>
              ) : null}
            </div>
            <p className="text-sm leading-relaxed text-[color:var(--color-muted-foreground)]">
              {tBilling('paygDescription', {
                price: formatPrice(PAYG_PRO_PRICE.amountMinor, locale),
              })}
            </p>
          </div>
          <form action={payAsYouGoAction}>
            <Button type="submit" variant="outline" size="md" data-testid="buy-payg">
              {tBilling('buyCredit')}
            </Button>
          </form>
        </section>

        {/* Historique des achats Pay-as-you-go (50 derniers, MVP sans pagination) */}
        <section
          className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6"
          data-testid="payg-history"
        >
          <header className="mb-4 flex flex-col gap-1">
            <span className="font-mono text-[10px] tracking-[0.32em] text-[color:var(--color-muted-foreground)] uppercase">
              Pay-as-you-go
            </span>
            <h3
              className="font-display italic"
              style={{
                fontSize: 'clamp(1.125rem, 1.6vw, 1.375rem)',
                letterSpacing: '-0.018em',
                color: 'var(--color-foreground)',
              }}
            >
              {tBilling('paygHistoryTitle')}
            </h3>
          </header>

          {paygHistory.length === 0 ? (
            <p
              className="text-sm text-[color:var(--color-muted-foreground)]"
              data-testid="payg-history-empty"
            >
              {tBilling('paygHistoryEmpty')}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm" data-testid="payg-history-table">
                <thead>
                  <tr className="border-b border-[color:var(--color-border)] text-left">
                    <th className="py-2 pr-4 font-mono text-[10px] tracking-[0.18em] text-[color:var(--color-muted-foreground)] uppercase">
                      {tBilling('paygHistoryDate')}
                    </th>
                    <th className="py-2 pr-4 font-mono text-[10px] tracking-[0.18em] text-[color:var(--color-muted-foreground)] uppercase">
                      {tBilling('paygHistoryAmount')}
                    </th>
                    <th className="py-2 font-mono text-[10px] tracking-[0.18em] text-[color:var(--color-muted-foreground)] uppercase">
                      {tBilling('paygHistoryReference')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paygHistory.map((purchase) => (
                    <tr
                      key={purchase._id}
                      className="border-b border-[color:var(--color-border)]/60 last:border-b-0"
                      data-testid="payg-history-row"
                    >
                      <td className="py-3 pr-4 text-[color:var(--color-foreground)]">
                        {formatPaygDate(purchase.createdAt, locale)}
                      </td>
                      <td className="py-3 pr-4 text-[color:var(--color-foreground)] tabular-nums">
                        {formatPaygAmount(purchase.amountMinor, purchase.currency, locale)}
                      </td>
                      <td className="py-3 pr-4 font-mono text-xs text-[color:var(--color-muted-foreground)]">
                        <a
                          href={`https://dashboard.stripe.com/payments/${purchase.stripeSessionId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline-offset-2 hover:underline"
                          title={purchase.stripeSessionId}
                        >
                          {truncateSessionId(purchase.stripeSessionId)}
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <footer className="text-center font-mono text-[10px] tracking-[0.24em] text-[color:var(--color-muted-foreground)] uppercase">
          {tBilling('securePaymentFooter')}
        </footer>
      </div>
    </ProShell>
  );
}
