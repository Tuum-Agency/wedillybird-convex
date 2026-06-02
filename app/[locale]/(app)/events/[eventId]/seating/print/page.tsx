import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { redirect } from '@/i18n/navigation';
import { getSession } from '@/lib/auth/session';
import { convexApi, getConvexServerClient } from '@/lib/auth/convex-server';
import { PrintButton } from '@/components/seating/print-button';

/**
 * Vue imprimable du plan de table (traiteur + jour J). Document propre sans
 * AppShell : titre, une carte par table avec ses invités (places comptées),
 * liste des non-placés. `break-inside-avoid` évite de couper une table sur
 * deux pages.
 */
export default async function SeatingPrintPage({
  params,
}: {
  params: Promise<{ locale: string; eventId: string }>;
}) {
  const { locale, eventId } = await params;
  setRequestLocale(locale);

  const session = await getSession();
  if (!session) {
    redirect({ href: '/sign-in', locale });
  }

  const convex = getConvexServerClient();
  const event = await convex.query(convexApi.getEventById, {
    eventId,
    requesterId: session!.userId,
  });
  if (!event) notFound();

  // Même gate que la page seating : Premium/Pro uniquement.
  const canUseSeating = event.planTier === 'premium' || Boolean(event.organizationId);
  if (!canUseSeating) notFound();

  const plan = await convex.query(convexApi.getSeatingPlan, {
    eventId,
    requesterId: session!.userId,
  });
  const t = await getTranslations('Seating');

  const coupleNames = `${event.coupleNames.partnerA} & ${event.coupleNames.partnerB}`;
  const eventDate = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: event.timezone,
  }).format(new Date(event.eventDate));

  return (
    <main className="mx-auto max-w-3xl bg-white p-8 text-black print:max-w-none print:p-0">
      <div className="mb-6 flex items-center justify-between print:hidden">
        <h1 className="text-lg font-semibold">{t('title')}</h1>
        <PrintButton label={t('print')} />
      </div>

      <header className="mb-6 border-b border-black/15 pb-4">
        <h2 className="text-2xl font-semibold">{coupleNames}</h2>
        <p className="mt-1 text-sm text-black/60">
          {eventDate} ·{' '}
          {t('stats', {
            seated: plan.stats.seatedSeats,
            total: plan.stats.seatedSeats + plan.stats.unassignedSeats,
            tables: plan.stats.tableCount,
          })}
        </p>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {plan.tables.map((table) => (
          <div key={table._id} className="break-inside-avoid rounded-lg border border-black/20 p-4">
            <h3 className="flex items-center justify-between text-base font-semibold">
              <span>{table.name}</span>
              <span className="text-sm font-normal text-black/60">
                {table.occupancy}/{table.capacity}
              </span>
            </h3>
            {table.assigned.length === 0 ? (
              <p className="mt-2 text-sm text-black/40">—</p>
            ) : (
              <ol className="mt-2 list-decimal pl-5 text-sm leading-relaxed">
                {table.assigned.map((g) => (
                  <li key={g._id}>
                    {g.fullName}
                    {g.plusOnesNames.length > 0 ? ` (+${g.plusOnesNames.length})` : ''}
                  </li>
                ))}
              </ol>
            )}
          </div>
        ))}
      </section>

      {plan.unassigned.length > 0 ? (
        <section className="mt-6 break-inside-avoid border-t border-black/15 pt-4">
          <h3 className="text-base font-semibold">
            {t('unassignedTitle')} · {plan.unassigned.length}
          </h3>
          <ul className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
            {plan.unassigned.map((g) => (
              <li key={g._id}>
                {g.fullName}
                {g.plusOnesNames.length > 0 ? ` (+${g.plusOnesNames.length})` : ''}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
