import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { Wallet } from 'lucide-react';
import { requireProContext } from '@/lib/pro/require-pro-context';
import { convexApi, getConvexServerClient } from '@/lib/auth/convex-server';
import { ProSidebarShell } from '@/components/pro/pro-sidebar-shell';
import { BudgetBoard } from '@/components/pro/budget/budget-board';
import { tierHasFeature } from '@/lib/payments/entitlements';

export const metadata: Metadata = { title: 'Budget — Wedillybird Pro' };

export default async function ProBudgetPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ event?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const { session, org, user } = await requireProContext(locale);
  const tier = org.subscriptionTier ?? null;
  const canEdit = tierHasFeature(tier, 'budgetEditing');

  const shellOrg = { name: org.name, primaryColor: org.primaryColor, tier, role: org.myRole };

  const convex = getConvexServerClient();
  const events = await convex.query(convexApi.listOrgEvents, {
    organizationId: org._id,
    requesterId: session.userId,
  });

  if (events.length === 0) {
    return (
      <ProSidebarShell current="budget" org={shellOrg} user={{ name: user?.fullName }}>
        <div className="container-page flex flex-col gap-6 py-8 sm:py-10">
          <header className="flex items-center gap-3">
            <span
              aria-hidden
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-[color:var(--color-surface-elevated)] text-[color:var(--color-blush-300)]"
            >
              <Wallet className="h-5 w-5" strokeWidth={1.7} />
            </span>
            <h1
              className="font-display italic"
              style={{
                fontSize: 'clamp(1.9rem, 4vw, 2.75rem)',
                letterSpacing: '-0.022em',
                color: 'var(--color-foreground)',
              }}
            >
              Budget
            </h1>
          </header>
          <div className="rounded-3xl border border-dashed border-[color:var(--color-border-strong)] bg-[color:var(--color-surface)]/40 px-8 py-16 text-center text-sm text-[color:var(--color-muted-foreground)]">
            Aucun mariage pour l’instant. Créez un mariage pour suivre son budget.
          </div>
        </div>
      </ProSidebarShell>
    );
  }

  const selectedId = sp.event && events.some((e) => e._id === sp.event) ? sp.event : events[0]!._id;
  const [budget, vendors] = await Promise.all([
    convex.query(convexApi.budgetListByEvent, {
      eventId: selectedId,
      requesterId: session.userId,
    }),
    convex.query(convexApi.vendorsListByOrg, {
      organizationId: org._id,
      requesterId: session.userId,
    }),
  ]);

  const eventOptions = events.map((e) => ({
    _id: e._id,
    partnerA: e.coupleNames.partnerA,
    partnerB: e.coupleNames.partnerB,
    eventDate: e.eventDate,
    timezone: e.timezone,
    venue: e.venue,
    status: e.status,
  }));

  return (
    <ProSidebarShell current="budget" org={shellOrg} user={{ name: user?.fullName }}>
      <BudgetBoard
        events={eventOptions}
        selectedEventId={selectedId}
        orgName={org.name}
        lines={budget?.lines ?? []}
        envelopeMinor={budget?.envelopeMinor ?? 0}
        canEdit={canEdit}
        vendors={vendors.map((v) => ({ name: v.name, category: v.category }))}
      />
    </ProSidebarShell>
  );
}
