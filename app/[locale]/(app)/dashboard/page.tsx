import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import { Plus } from 'lucide-react';
import { Link, redirect } from '@/i18n/navigation';
import { getSession } from '@/lib/auth/session';
import { convexApi, getConvexServerClient } from '@/lib/auth/convex-server';
import { buttonVariants } from '@/components/ui/button';
import { AppShell } from '@/components/app/app-shell';
import { DashboardEventsList } from '@/components/dashboard/events-list';
import { cn } from '@/lib/cn';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Dashboard' });
  return { title: t('greeting', { name: '' }).trim() };
}

/**
 * Dashboard couple V4 — header éditorial + grid événements animée.
 *
 * Server component qui :
 *  1. Vérifie la session, redirige vers /sign-in si absent
 *  2. Vérifie l'onboarding, redirige vers /onboarding si pas terminé
 *  3. Redirige les pros vers /pro/dashboard
 *  4. Liste les events de l'utilisateur (couple)
 *
 * Le rendu délègue les animations à DashboardEventsList (client component).
 */
export default async function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await getSession();
  if (!session) {
    redirect({ href: '/sign-in', locale });
  }

  const convex = getConvexServerClient();
  const user = await convex.query(convexApi.currentUser, { userId: session!.userId });

  if (!user?.fullName) {
    redirect({ href: '/onboarding', locale });
  }

  if (user!.role === 'pro' || user!.role === 'admin') {
    const myOrg = await convex.query(convexApi.myOrganization, { userId: session!.userId });
    if (myOrg) {
      redirect({ href: '/pro/dashboard', locale });
    }
  }

  const events = await convex.query(convexApi.listEventsByOwner, { ownerId: session!.userId });
  const t = await getTranslations('Dashboard');

  return (
    <AppShell userName={user!.fullName}>
      <div className="container-page py-12 sm:py-16">
        {/* Eyebrow + greeting éditorial */}
        <header className="mb-12 flex flex-col gap-4">
          <span className="font-mono text-[10px] tracking-[0.32em] text-[color:var(--color-ink-500)] uppercase">
            Tableau de bord
          </span>
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
            <h1
              className="font-display text-balance italic"
              style={{
                fontSize: 'clamp(2rem, 4.5vw, 3rem)',
                lineHeight: 1.05,
                letterSpacing: '-0.022em',
                color: 'var(--color-ink-900)',
              }}
            >
              {t('greeting', { name: user!.fullName ?? '' })}
            </h1>
            {events.length > 0 ? (
              <Link
                href="/events/new"
                className={cn(buttonVariants({ variant: 'primary', size: 'md' }), 'group')}
              >
                <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
                {t('createEvent')}
              </Link>
            ) : null}
          </div>
        </header>

        {events.length === 0 ? <EmptyState /> : <DashboardEventsList events={events} />}
      </div>
    </AppShell>
  );
}

/**
 * Empty state V4 — pas d'événements encore. CTA grand format pour engager
 * la première création.
 */
async function EmptyState() {
  const t = await getTranslations('Dashboard');
  return (
    <section className="flex flex-col items-center gap-7 rounded-3xl border border-dashed border-[color:var(--color-border-strong)] bg-white/60 px-8 py-16 text-center">
      <span
        aria-hidden
        className="flex h-16 w-16 items-center justify-center rounded-full"
        style={{
          background: 'linear-gradient(135deg, oklch(95% 0.025 22) 0%, oklch(91% 0.045 22) 100%)',
          color: 'var(--color-blush-700)',
        }}
      >
        <Plus className="h-7 w-7" strokeWidth={1.5} aria-hidden />
      </span>
      <div className="flex flex-col gap-3">
        <h2
          className="font-display text-balance italic"
          style={{
            fontSize: 'clamp(1.5rem, 2.5vw, 2rem)',
            lineHeight: 1.15,
            letterSpacing: '-0.018em',
            color: 'var(--color-ink-900)',
          }}
        >
          {t('noEvents')}
        </h2>
        <p className="max-w-md text-sm leading-relaxed text-[color:var(--color-ink-500)] sm:text-base">
          Créez votre premier mariage en quelques minutes. Date, lieu, identité visuelle — vous
          pourrez tout modifier à tout moment.
        </p>
      </div>
      <Link
        href="/events/new"
        className={cn(buttonVariants({ variant: 'primary', size: 'lg' }), 'mt-2')}
      >
        <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
        {t('createEvent')}
      </Link>
    </section>
  );
}
