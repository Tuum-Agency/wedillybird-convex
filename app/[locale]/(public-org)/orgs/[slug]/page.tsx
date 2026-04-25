import { Link } from '@/i18n/navigation';
import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { convexApi, getConvexServerClient } from '@/lib/auth/convex-server';

export const dynamic = 'force-dynamic';

export default async function OrgLandingPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const convex = getConvexServerClient();
  const org = await convex.query(convexApi.getOrgBySlug, { slug });
  if (!org) notFound();

  const eventsHref = `/orgs/${slug}/events` as never;

  return (
    <section className="container-page flex flex-col items-center gap-8 py-20 text-center">
      <h1
        className="font-display text-5xl font-semibold tracking-tight"
        style={{ color: 'var(--color-primary)' }}
      >
        {org.name}
      </h1>
      <p className="max-w-xl text-lg text-[color:var(--color-muted)]">
        Bienvenue sur la page de {org.name}. Découvrez les événements et invitations que nous
        orchestrons pour nos clients.
      </p>
      <Link
        href={eventsHref}
        className="inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold text-white shadow"
        style={{ backgroundColor: 'var(--color-accent)' }}
      >
        Voir nos événements
      </Link>
    </section>
  );
}
