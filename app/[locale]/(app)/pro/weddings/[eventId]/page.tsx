import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { requireProContext } from '@/lib/pro/require-pro-context';
import { convexApi, getConvexServerClient } from '@/lib/auth/convex-server';
import { ProSidebarShell } from '@/components/pro/pro-sidebar-shell';
import { WeddingHubClient } from '@/components/pro/weddings/wedding-hub';
import { CoupleLinkCard } from '@/components/pro/couple-link-card';
import { PRO_TIER_LIMITS } from '@/lib/payments/entitlements';
import { nowMs } from '@/lib/pro/format';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('ProPages');
  return { title: t('weddingHubMetaTitle') };
}

const DAY = 86_400_000;
const TIER_LABEL: Record<'starter' | 'business' | 'agency', string> = {
  starter: 'Starter',
  business: 'Business',
  agency: 'Agency',
};

export default async function ProWeddingHubPage({
  params,
}: {
  params: Promise<{ locale: string; eventId: string }>;
}) {
  const { locale, eventId } = await params;
  setRequestLocale(locale);
  const { session, org, user } = await requireProContext(locale);
  const convex = getConvexServerClient();

  const event = await convex.query(convexApi.getEventById, {
    eventId,
    requesterId: session.userId,
  });
  if (!event || event.organizationId !== org._id) {
    redirect({ href: '/pro/weddings', locale });
  }

  const [counts, budget, planning, orgEvents, guests, cockpit, seatingPlan, coupleLinks] =
    await Promise.all([
      convex.query(convexApi.countGuestsByEvent, { eventId, requesterId: session.userId }),
      convex.query(convexApi.budgetListByEvent, { eventId, requesterId: session.userId }),
      convex.query(convexApi.planningListByEvent, { eventId, requesterId: session.userId }),
      convex.query(convexApi.listOrgEvents, {
        organizationId: org._id,
        requesterId: session.userId,
      }),
      convex.query(convexApi.listGuestsByEvent, { eventId, requesterId: session.userId }),
      convex.query(convexApi.proCockpit, { userId: session.userId }),
      // Le plan de table requiert l'entitlement seatingPlan ; on dégrade en null sinon.
      convex
        .query(convexApi.getSeatingPlan, { eventId, requesterId: session.userId })
        .catch(() => null),
      convex.query(convexApi.coupleLinks, { eventId, requesterId: session.userId }).catch(() => []),
    ]);

  const tier = org.subscriptionTier ?? null;
  const now = nowMs();
  const messageQuota: [number, number] | undefined = tier
    ? [
        cockpit?.usage.whatsappMessagesThisMonth ?? 0,
        PRO_TIER_LIMITS[tier].whatsappMessagesPerMonth,
      ]
    : undefined;
  const plannedMinor = (budget?.lines ?? []).reduce((s, l) => s + l.plannedMinor, 0);
  const paidMinor = (budget?.lines ?? []).reduce((s, l) => s + l.paidMinor, 0);
  const tasksDue = (planning?.tasks ?? []).filter(
    (t) => !t.done && t.dueDate != null && t.dueDate <= now + 7 * DAY,
  ).length;
  const activeCount = orgEvents.filter((e) => e.status === 'active').length;

  const dateLabel = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: event!.timezone || 'UTC',
  }).format(new Date(event!.eventDate));

  return (
    <ProSidebarShell
      current="weddings"
      org={{ name: org.name, primaryColor: org.primaryColor, tier, role: org.myRole }}
      user={{ name: user?.fullName }}
      eventsUsed={activeCount}
    >
      <WeddingHubClient
        initialStatus={event!.status}
        data={{
          eventId: event!._id,
          coupleA: event!.coupleNames.partnerA,
          coupleB: event!.coupleNames.partnerB,
          dateLabel,
          jminus: Math.max(0, Math.ceil((event!.eventDate - now) / DAY)),
          venue: event!.venue?.name,
          plan: tier ? TIER_LABEL[tier] : '—',
          eventNo: activeCount,
          eventCap: tier ? PRO_TIER_LIMITS[tier].activeEvents : null,
          guestCap: tier ? PRO_TIER_LIMITS[tier].guestsPerEvent : 150,
          guestTotal: counts.total,
          rsvp: { confirmed: counts.attending, declined: counts.declined, pending: counts.pending },
          budgetTotalMinor: plannedMinor,
          budgetEngagedPct: plannedMinor > 0 ? Math.round((paidMinor / plannedMinor) * 100) : 0,
          tasksDue,
          guests: guests.map((g) => ({
            _id: g._id,
            fullName: g.fullName,
            phone: g.phone,
            category: g.category,
            plusOnesAllowed: g.plusOnesAllowed,
            rsvpStatus: g.rsvpStatus,
          })),
          messageQuota,
          seatingPlan,
        }}
      />
      <div className="mx-auto w-full max-w-6xl px-4 pb-12 sm:px-6">
        <CoupleLinkCard eventId={event!._id} initialLinks={coupleLinks} />
      </div>
    </ProSidebarShell>
  );
}
