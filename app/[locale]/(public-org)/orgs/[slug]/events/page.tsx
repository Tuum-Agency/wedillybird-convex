import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { convexApi, getConvexServerClient } from '@/lib/auth/convex-server';

export const dynamic = 'force-dynamic';

export default async function OrgEventsPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const convex = getConvexServerClient();
  const events = await convex.query(convexApi.listPublicOrgEvents, { slug });
  if (events === null) notFound();

  return (
    <section className="container-page flex flex-col gap-6 py-12">
      <header>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Nos événements</h1>
      </header>
      {events.length === 0 ? (
        <p className="text-[color:var(--color-muted)]">Aucun événement public pour le moment.</p>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {events.map((evt) => (
            <li
              key={evt._id}
              className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6"
              data-testid="public-event-card"
            >
              <h2 className="font-display text-xl font-semibold">{evt.title}</h2>
              <p className="text-sm text-[color:var(--color-muted)]">
                {evt.coupleNames.partnerA} & {evt.coupleNames.partnerB}
              </p>
              <p className="mt-2 text-sm">
                {new Intl.DateTimeFormat('fr', {
                  dateStyle: 'long',
                  timeZone: evt.timezone,
                }).format(new Date(evt.eventDate))}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
