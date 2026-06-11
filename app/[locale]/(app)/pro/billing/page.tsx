import { redirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import {
  Zap,
  RefreshCw,
  Calendar,
  CreditCard,
  ShieldCheck,
  ArrowRight,
  Download,
  Receipt,
  type LucideIcon,
} from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import { convexApi, getConvexServerClient } from '@/lib/auth/convex-server';
import {
  SUBSCRIPTION_TIER_PRICES,
  SUBSCRIPTION_TIER_ANNUAL_PRICES,
  PAYG_PRO_PRICE,
  type SubscriptionTier,
} from '@/lib/payments/subscriptions';
import { Button } from '@/components/ui/button';
import { ProSidebarShell } from '@/components/pro/pro-sidebar-shell';
import { QuotaGauges } from '@/components/pro/quota-gauges';
import { PlanCards, type PlanCardData, type TierMeta } from '@/components/pro/plan-cards';
import { BuyCreditButton, CancelSubscriptionButton } from '@/components/pro/billing-dialogs';
import { AccountingExport } from '@/components/pro/accounting-export';
import { PRO_TIER_LIMITS, BYTES_PER_GO } from '@/lib/payments/entitlements';
import { listSubscriptionInvoices, type SubscriptionInvoice } from '@/lib/payments/drivers/stripe';
import {
  recentMonths,
  BILLING_INVOICE_STATUS,
  type BillingInvoiceStatus,
} from '@/lib/pro/billing-export';
import { nowMs } from '@/lib/pro/format';
import { subscribeAction, openBillingPortalAction, payAsYouGoAction } from './actions';

const TIER_ORDER: readonly SubscriptionTier[] = ['starter', 'business', 'agency'];

const TIER_META: TierMeta = {
  starter: {
    events: PRO_TIER_LIMITS.starter.activeEvents,
    messages: PRO_TIER_LIMITS.starter.whatsappMessagesPerMonth,
    storageGo: Math.round(PRO_TIER_LIMITS.starter.storageBytes / BYTES_PER_GO),
  },
  business: {
    events: PRO_TIER_LIMITS.business.activeEvents,
    messages: PRO_TIER_LIMITS.business.whatsappMessagesPerMonth,
    storageGo: Math.round(PRO_TIER_LIMITS.business.storageBytes / BYTES_PER_GO),
  },
  agency: {
    events: PRO_TIER_LIMITS.agency.activeEvents,
    messages: PRO_TIER_LIMITS.agency.whatsappMessagesPerMonth,
    storageGo: Math.round(PRO_TIER_LIMITS.agency.storageBytes / BYTES_PER_GO),
  },
};

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

const INV_TONE: Record<'ok' | 'warn' | 'muted' | 'danger', string> = {
  ok: 'bg-[oklch(26%_0.04_145)] text-[oklch(82%_0.07_145)]',
  warn: 'bg-[oklch(28%_0.022_78)] text-[oklch(85%_0.04_78)]',
  muted: 'bg-[color:var(--color-surface-elevated)] text-[color:var(--color-muted-foreground)]',
  danger: 'bg-[oklch(28%_0.04_25)] text-[oklch(82%_0.07_22)]',
};

function formatInvDate(ts: number, locale: string): string {
  return new Date(ts).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatInvPeriod(
  start: number | undefined,
  end: number | undefined,
  locale: string,
): string {
  if (!start || !end) return '—';
  const s = new Date(start).toLocaleDateString(locale, { day: 'numeric', month: 'short' });
  const e = new Date(end).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  return `${s} → ${e}`;
}

/** Cellule clé/valeur de la carte « Abonnement actuel » (design Facturation). */
function BillingCell({ Icon, k, v }: { Icon: LucideIcon; k: string; v: string }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-elevated)] px-3.5 py-3">
      <span className="font-mono text-[9px] tracking-[0.14em] text-[color:var(--color-muted-foreground)] uppercase">
        {k}
      </span>
      <span className="inline-flex items-center gap-1.5 text-sm text-[color:var(--color-foreground)]">
        <Icon
          className="h-3.5 w-3.5 flex-shrink-0 text-[color:var(--color-blush-300)]"
          strokeWidth={1.9}
          aria-hidden
        />
        {v}
      </span>
    </div>
  );
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

  // Factures d'abonnement Stripe (vide si Stripe non configuré / pas de client).
  let subscriptionInvoices: SubscriptionInvoice[] = [];
  if (org.stripeCustomerId) {
    try {
      subscriptionInvoices = await listSubscriptionInvoices(org.stripeCustomerId);
    } catch {
      subscriptionInvoices = [];
    }
  }
  const exportMonths = recentMonths(nowMs(), 6);

  const currentTier = org.subscriptionTier;
  const isCurrentTier = (tier: SubscriptionTier) => currentTier === tier;

  const planCards: PlanCardData[] = TIER_ORDER.map((tier) => ({
    tier,
    label: SUBSCRIPTION_TIER_PRICES[tier].label,
    descriptionKey: SUBSCRIPTION_TIER_PRICES[tier].descriptionKey,
    featureKeys: SUBSCRIPTION_TIER_PRICES[tier].featureKeys,
    monthlyMinor: SUBSCRIPTION_TIER_PRICES[tier].amountMinor,
    annualMinor: SUBSCRIPTION_TIER_ANNUAL_PRICES[tier].amountMinor,
    isCurrent: isCurrentTier(tier),
    isMid: tier === 'business',
  }));

  // Consommation réelle (réutilise l'agrégat du cockpit) pour les jauges de quotas.
  const cockpit = currentTier
    ? await convex.query(convexApi.proCockpit, { userId: session.userId })
    : null;
  const usage = cockpit?.usage ?? null;
  const periodEndLabel = formatPeriodEnd(org.subscriptionPeriodEnd, locale);
  const hasActive =
    org.subscriptionStatus === 'active' ||
    org.subscriptionStatus === 'trialing' ||
    org.subscriptionStatus === 'past_due';
  const statusCfg = org.subscriptionStatus ? STATUS_COLOR[org.subscriptionStatus] : undefined;

  return (
    <ProSidebarShell
      current="billing"
      org={{
        name: org.name,
        primaryColor: org.primaryColor,
        tier: org.subscriptionTier ?? null,
        role: org.myRole,
      }}
      user={{ name: user?.fullName }}
      eventsUsed={undefined}
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

        {/* Abonnement actuel — carte détaillée (design Facturation) */}
        {currentTier && org.subscriptionStatus ? (
          <section
            className="flex flex-col gap-5 rounded-3xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6 sm:p-7"
            data-testid="current-subscription"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex flex-col gap-2.5">
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="font-display text-2xl text-[color:var(--color-foreground)] italic">
                    {SUBSCRIPTION_TIER_PRICES[currentTier].label}
                  </h3>
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
                <span className="flex items-baseline gap-1.5">
                  <span className="font-display text-3xl text-[color:var(--color-foreground)] italic tabular-nums">
                    {formatPrice(SUBSCRIPTION_TIER_PRICES[currentTier].amountMinor, locale)}
                  </span>
                  <span className="text-sm text-[color:var(--color-muted-foreground)]">/ mois</span>
                </span>
              </div>
              <span className="font-mono text-[10px] tracking-[0.18em] text-[color:var(--color-muted-foreground)] uppercase">
                Abonnement agence
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <BillingCell Icon={RefreshCw} k="Cycle de facturation" v="Mensuel" />
              <BillingCell
                Icon={Calendar}
                k="Prochaine échéance"
                v={hasActive && periodEndLabel ? periodEndLabel : '—'}
              />
              <BillingCell
                Icon={CreditCard}
                k="Moyen de paiement"
                v={org.stripeCustomerId ? 'Carte · via Stripe' : 'Aucun'}
              />
              <BillingCell
                Icon={ShieldCheck}
                k="Forfait"
                v={`${SUBSCRIPTION_TIER_PRICES[currentTier].label}`}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {org.stripeCustomerId ? (
                <form action={openBillingPortalAction}>
                  <Button type="submit" variant="primary" size="md" data-testid="open-portal">
                    {tBilling('manageSubscription')}
                  </Button>
                </form>
              ) : null}
              <a
                href="#plans"
                className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--color-border-strong)] px-4 py-2 text-sm text-[color:var(--color-foreground)] transition-colors hover:border-[color:var(--color-blush-400)]"
              >
                <RefreshCw className="h-4 w-4" strokeWidth={1.9} aria-hidden />
                Changer de formule
              </a>
              <span className="flex-1" />
              {org.stripeCustomerId && hasActive && org.myRole === 'owner' ? (
                <CancelSubscriptionButton
                  planLabel={SUBSCRIPTION_TIER_PRICES[currentTier].label}
                  renewalLabel={periodEndLabel ?? 'la fin de la période'}
                  action={openBillingPortalAction}
                />
              ) : null}
            </div>
          </section>
        ) : (
          <section className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-7">
            <span className="font-display text-xl text-[color:var(--color-foreground)] italic">
              {tBilling('noSubscription')}
            </span>
            <a
              href="#plans"
              className="inline-flex items-center gap-1.5 text-sm text-[color:var(--color-blush-300)] hover:underline"
            >
              Choisir un forfait <ArrowRight className="h-4 w-4" strokeWidth={2} aria-hidden />
            </a>
          </section>
        )}

        {/* Consommation / quotas */}
        {currentTier && usage ? <QuotaGauges tier={currentTier} usage={usage} /> : null}

        {/* Tier cards — bascule mensuel / annuel (−20 %) */}
        <div id="plans" className="scroll-mt-6">
          <PlanCards
            plans={planCards}
            hasActive={hasActive}
            hasCurrentTier={!!currentTier}
            locale={locale}
            subscribeAction={subscribeAction}
            currentTier={currentTier ?? null}
            tierMeta={TIER_META}
          />
        </div>

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
          <BuyCreditButton
            label={tBilling('buyCredit')}
            priceLabel={formatPrice(PAYG_PRO_PRICE.amountMinor, locale)}
            action={payAsYouGoAction}
          />
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

        {/* Factures d'abonnement (Stripe) */}
        <section
          className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6"
          data-testid="subscription-invoices"
        >
          <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-col gap-1">
              <span className="font-mono text-[10px] tracking-[0.32em] text-[color:var(--color-muted-foreground)] uppercase">
                Abonnement
              </span>
              <h3
                className="font-display italic"
                style={{
                  fontSize: 'clamp(1.125rem, 1.6vw, 1.375rem)',
                  letterSpacing: '-0.018em',
                  color: 'var(--color-foreground)',
                }}
              >
                Factures
              </h3>
            </div>
            {subscriptionInvoices.length > 0 ? (
              <span className="font-mono text-[11px] text-[color:var(--color-muted-foreground)]">
                Total payé{' '}
                <b className="text-[color:var(--color-foreground)]">
                  {formatPrice(
                    subscriptionInvoices
                      .filter((i) => i.status === 'paid')
                      .reduce((s, i) => s + i.amountMinor, 0),
                    locale,
                  )}
                </b>
              </span>
            ) : null}
          </header>

          {subscriptionInvoices.length === 0 ? (
            <div
              className="flex items-center gap-3 rounded-xl border border-dashed border-[color:var(--color-border-strong)] bg-[color:var(--color-surface)]/40 px-5 py-6 text-sm text-[color:var(--color-muted-foreground)]"
              data-testid="invoices-empty"
            >
              <Receipt className="h-5 w-5 flex-shrink-0" strokeWidth={1.6} aria-hidden />
              Vos factures d’abonnement apparaîtront ici dès le premier prélèvement. Elles restent
              téléchargeables depuis le portail Stripe.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[color:var(--color-border)] text-left font-mono text-[9px] tracking-[0.18em] text-[color:var(--color-muted-foreground)] uppercase">
                    <th className="px-3 py-2.5 font-medium">N° facture</th>
                    <th className="px-3 py-2.5 font-medium">Date</th>
                    <th className="px-3 py-2.5 font-medium">Période</th>
                    <th className="px-3 py-2.5 text-right font-medium">Montant</th>
                    <th className="px-3 py-2.5 font-medium">Statut</th>
                    <th className="px-3 py-2.5 text-right font-medium">Document</th>
                  </tr>
                </thead>
                <tbody>
                  {subscriptionInvoices.map((inv) => {
                    const meta = BILLING_INVOICE_STATUS[inv.status as BillingInvoiceStatus] ?? {
                      label: inv.status,
                      tone: 'muted' as const,
                    };
                    return (
                      <tr
                        key={inv.id}
                        className="border-b border-[color:var(--color-border)]/60 last:border-0"
                      >
                        <td className="px-3 py-3 font-mono text-xs font-medium text-[color:var(--color-foreground)]">
                          {inv.id}
                        </td>
                        <td className="px-3 py-3 font-mono text-xs text-[color:var(--color-muted-foreground)]">
                          {formatInvDate(inv.date, locale)}
                        </td>
                        <td className="px-3 py-3 text-xs text-[color:var(--color-ink-700)]">
                          {formatInvPeriod(inv.periodStart, inv.periodEnd, locale)}
                        </td>
                        <td className="px-3 py-3 text-right font-mono text-xs text-[color:var(--color-foreground)] tabular-nums">
                          {formatPrice(inv.amountMinor, locale)}
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${INV_TONE[meta.tone]}`}
                          >
                            <span
                              className="h-1.5 w-1.5 rounded-full bg-current opacity-80"
                              aria-hidden
                            />
                            {meta.label}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right">
                          {inv.pdfUrl || inv.hostedUrl ? (
                            <a
                              href={inv.pdfUrl ?? inv.hostedUrl ?? '#'}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--color-border)] px-2.5 py-1.5 text-xs text-[color:var(--color-muted-foreground)] hover:border-[color:var(--color-blush-400)] hover:text-[color:var(--color-foreground)]"
                            >
                              <Download className="h-3.5 w-3.5" strokeWidth={1.9} aria-hidden />
                              PDF
                            </a>
                          ) : (
                            <span className="text-xs text-[color:var(--color-muted-foreground)]">
                              —
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Export comptable mensuel */}
        <AccountingExport months={exportMonths} />

        <footer className="text-center font-mono text-[10px] tracking-[0.24em] text-[color:var(--color-muted-foreground)] uppercase">
          {tBilling('securePaymentFooter')}
        </footer>
      </div>
    </ProSidebarShell>
  );
}
