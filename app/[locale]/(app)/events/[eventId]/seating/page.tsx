import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { ArmchairIcon, ArrowLeft, Lock } from 'lucide-react';
import { Link, redirect } from '@/i18n/navigation';
import { getSession } from '@/lib/auth/session';
import { convexApi, getConvexServerClient } from '@/lib/auth/convex-server';
import { AppShell } from '@/components/app/app-shell';
import { SeatingBoard } from '@/components/seating/seating-board';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/cn';

export default async function SeatingPage({
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

  const user = await convex.query(convexApi.currentUser, { userId: session!.userId });
  const t = await getTranslations('Seating');

  // Entitlement par formule : le plan de table est réservé à Premium + Pro.
  // Essentiel voit un upsell (la query/mutations Convex enforce aussi côté
  // serveur — ceci évite juste l'erreur + propose l'upgrade).
  const canUseSeating = event.planTier === 'premium' || Boolean(event.organizationId);

  return (
    <AppShell userName={user?.fullName}>
      <div className="container-page flex flex-col gap-8 py-12 sm:py-16">
        <header className="flex flex-col gap-3">
          <Link
            href={`/events/${eventId}`}
            className="inline-flex items-center gap-1.5 font-mono text-[10px] tracking-[0.32em] text-[color:var(--color-ink-500)] uppercase transition-colors hover:text-[color:var(--color-ink-900)]"
          >
            <ArrowLeft className="h-3 w-3" strokeWidth={2} aria-hidden />
            {t('backToEvent')}
          </Link>
          <h1
            className="font-display text-balance italic"
            style={{
              fontSize: 'clamp(2rem, 4.5vw, 3rem)',
              lineHeight: 1.05,
              letterSpacing: '-0.022em',
              color: 'var(--color-ink-900)',
            }}
          >
            {t('title')}
          </h1>
          <p className="text-base leading-relaxed text-[color:var(--color-ink-500)] sm:text-lg">
            {t('subtitle')}
          </p>
        </header>

        {canUseSeating ? (
          <SeatingBoardSection eventId={eventId} requesterId={session!.userId} />
        ) : (
          <div className="flex flex-col items-center gap-4 rounded-3xl border border-[color:var(--color-border)] bg-[color:var(--color-ivory-100)] px-6 py-16 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[color:var(--color-surface)] text-[color:var(--color-accent)]">
              <Lock className="h-6 w-6" strokeWidth={1.75} aria-hidden />
            </span>
            <h2 className="font-display text-2xl text-[color:var(--color-ink-900)] italic">
              {t('upsellTitle')}
            </h2>
            <p className="max-w-md text-sm leading-relaxed text-[color:var(--color-ink-500)]">
              {t('upsellHint')}
            </p>
            <Link
              href={`/events/${eventId}#upgrade` as never}
              className={cn(buttonVariants({ variant: 'primary', size: 'lg' }), 'mt-2')}
            >
              <ArmchairIcon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
              {t('upsellCta')}
            </Link>
          </div>
        )}
      </div>
    </AppShell>
  );
}

async function SeatingBoardSection({
  eventId,
  requesterId,
}: {
  eventId: string;
  requesterId: string;
}) {
  const convex = getConvexServerClient();
  const plan = await convex.query(convexApi.getSeatingPlan, { eventId, requesterId });
  return <SeatingBoard eventId={eventId} initial={plan} />;
}
