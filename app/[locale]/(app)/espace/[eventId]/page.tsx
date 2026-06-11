import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { requireProContext } from '@/lib/pro/require-pro-context';
import { convexApi, getConvexServerClient } from '@/lib/auth/convex-server';
import { nowMs } from '@/lib/pro/format';
import { CouplePortal } from '@/components/portal/couple-portal';

export const metadata: Metadata = {
  title: 'Espace mariés',
  robots: { index: false, follow: false },
};

const DAY = 86_400_000;

/**
 * Espace mariés (portail couple white-label). Aperçu côté agence : un membre
 * de l'organisation visualise l'espace tel que les mariés le verront, sous la
 * marque de l'agence. L'authentification couple par OTP (`couplePortal`) est un
 * flux distinct (BACKLOG) ; ici on réutilise la session agence + on vérifie que
 * l'événement appartient à l'organisation.
 */
export default async function EspaceMariesPage({
  params,
}: {
  params: Promise<{ locale: string; eventId: string }>;
}) {
  const { locale, eventId } = await params;
  setRequestLocale(locale);
  const { session, org } = await requireProContext(locale);
  const convex = getConvexServerClient();

  const event = await convex.query(convexApi.getEventById, {
    eventId,
    requesterId: session.userId,
  });
  if (!event || event.organizationId !== org._id) {
    redirect({ href: '/pro/weddings', locale });
  }

  const [counts, budget, planning, organization, guests, quotesRes, contractsRes, user] =
    await Promise.all([
      convex.query(convexApi.countGuestsByEvent, { eventId, requesterId: session.userId }),
      convex.query(convexApi.budgetListByEvent, { eventId, requesterId: session.userId }),
      convex.query(convexApi.planningListByEvent, { eventId, requesterId: session.userId }),
      convex.query(convexApi.myOrganization, { userId: session.userId }),
      convex.query(convexApi.listGuestsByEvent, { eventId, requesterId: session.userId }),
      convex.query(convexApi.quotesListByOrg, {
        organizationId: org._id,
        requesterId: session.userId,
      }),
      convex.query(convexApi.contractsListByOrg, {
        organizationId: org._id,
        requesterId: session.userId,
      }),
      convex.query(convexApi.currentUser, { userId: session.userId }),
    ]);

  const now = nowMs();
  const lines = budget?.lines ?? [];
  const plannedMinor = lines.reduce((s, l) => s + l.plannedMinor, 0);
  const paidMinor = lines.reduce((s, l) => s + l.paidMinor, 0);
  const tasks = planning?.tasks ?? [];
  const doneTasks = tasks.filter((t) => t.done).length;
  const progressPct = tasks.length > 0 ? Math.round((doneTasks / tasks.length) * 100) : 0;

  // Tâches « à vous de jouer » : prochaines tâches non faites (vue couple).
  const coupleTasks = tasks
    .filter((t) => !t.done)
    .sort((a, b) => (a.dueDate ?? Infinity) - (b.dueDate ?? Infinity))
    .slice(0, 4)
    .map((t) => ({
      _id: t._id,
      label: t.title,
      dueDate: t.dueDate ?? null,
      daysUntil: t.dueDate != null ? Math.ceil((t.dueDate - now) / DAY) : null,
    }));

  // Documents visibles côté couple : devis/factures + contrats rattachés à
  // l'événement, hors brouillons.
  type DocStatus = 'to_sign' | 'sent' | 'signed';
  const documents: Array<{
    id: string;
    name: string;
    kind: string;
    status: DocStatus;
    signedAt: number | null;
  }> = [];
  for (const d of quotesRes?.docs ?? []) {
    if (d.eventId !== eventId) continue;
    const kind = d.type === 'invoice' ? 'Facture' : 'Devis';
    if (d.status === 'sent')
      documents.push({
        id: d._id,
        name: `${kind} ${d.number}`,
        kind,
        status: 'sent',
        signedAt: null,
      });
    else if (d.status === 'accepted' || d.status === 'paid')
      documents.push({
        id: d._id,
        name: `${kind} ${d.number}`,
        kind,
        status: 'signed',
        signedAt: null,
      });
  }
  for (const c of contractsRes?.contracts ?? []) {
    if (c.eventId !== eventId) continue;
    // Le type de ref omet 'sent' (désalignement lib/schema) → comparaison souple.
    const cs = c.status as string;
    if (cs === 'sent')
      documents.push({
        id: c._id,
        name: `Contrat ${c.number}`,
        kind: 'Contrat',
        status: 'to_sign',
        signedAt: null,
      });
    else if (cs === 'signed_client' || cs === 'countersigned' || cs === 'active') {
      documents.push({
        id: c._id,
        name: `Contrat ${c.number}`,
        kind: 'Contrat',
        status: 'signed',
        signedAt: c.signedAt ?? null,
      });
    }
  }

  const dateLabel = new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: event!.timezone || 'UTC',
  }).format(new Date(event!.eventDate));

  const brandColor = /^#[0-9a-fA-F]{6}$/.test(organization?.primaryColor ?? '')
    ? organization!.primaryColor!
    : null;

  return (
    <CouplePortal
      agency={{
        name: org.name,
        initial: (org.name.trim().charAt(0) || 'W').toUpperCase(),
        brandColor,
        logoUrl: organization?.logoUrl ?? null,
        fullWhiteLabel: organization?.whiteLabelFull ?? false,
      }}
      couple={{
        names: `${event!.coupleNames.partnerA} & ${event!.coupleNames.partnerB}`,
        partnerA: event!.coupleNames.partnerA,
        partnerB: event!.coupleNames.partnerB,
        dateLabel,
        jminus: Math.max(0, Math.ceil((event!.eventDate - now) / DAY)),
        venue: event!.venue?.name ?? null,
      }}
      rsvp={{
        confirmed: counts.attending,
        declined: counts.declined,
        pending: counts.pending,
        total: counts.total,
      }}
      budget={{
        plannedMinor,
        paidMinor,
        engagedPct: plannedMinor > 0 ? Math.round((paidMinor / plannedMinor) * 100) : 0,
        lines: lines.map((l) => ({
          category: l.category,
          label: l.label,
          plannedMinor: l.plannedMinor,
          paidMinor: l.paidMinor,
        })),
      }}
      planning={{
        progressPct,
        done: doneTasks,
        total: tasks.length,
        tasks: tasks.map((t) => ({ phase: t.phase, title: t.title, done: t.done })),
      }}
      guests={guests.map((g) => ({
        _id: g._id,
        fullName: g.fullName,
        category: g.category ?? null,
        plusOnesAllowed: g.plusOnesAllowed,
        rsvpStatus: g.rsvpStatus,
      }))}
      documents={documents}
      planner={{
        name: user?.fullName ?? org.name,
        initials: (user?.fullName ?? org.name).trim().slice(0, 2).toUpperCase(),
      }}
      coupleTasks={coupleTasks}
      backHref={`/pro/weddings/${eventId}`}
    />
  );
}
