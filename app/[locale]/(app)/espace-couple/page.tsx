import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import { Calendar, MapPin, ArrowRight, Heart } from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import { Link, redirect } from '@/i18n/navigation';
import { convexApi, getConvexServerClient } from '@/lib/auth/convex-server';
import { AppShell } from '@/components/app/app-shell';

/**
 * Espace couple — liste des mariages où l'utilisateur est rattaché comme `couple`
 * (par son agence). Une seule entrée → on l'ouvre directement.
 */
export default async function CoupleSpacePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await getSession();
  if (!session) redirect({ href: '/sign-in', locale });

  const convex = getConvexServerClient();
  const [weddings, user] = await Promise.all([
    convex.query(convexApi.listMineAsCouple, { userId: session!.userId }),
    convex.query(convexApi.currentUser, { userId: session!.userId }),
  ]);

  if (weddings.length === 1) {
    redirect({ href: `/espace-couple/${weddings[0]!._id}`, locale });
  }

  const t = await getTranslations('CoupleSpace');
  const format = await getFormatter();

  return (
    <AppShell userName={user?.fullName}>
      <div className="container-page flex flex-col gap-10 py-12 sm:py-16">
        <header className="flex flex-col gap-2">
          <span className="font-mono text-[10px] tracking-[0.32em] text-[color:var(--color-ink-500)] uppercase">
            {t('eyebrow')}
          </span>
          <h1
            className="font-display italic"
            style={{
              fontSize: 'clamp(1.9rem, 4vw, 2.75rem)',
              lineHeight: 1.05,
              letterSpacing: '-0.022em',
              color: 'var(--color-ink-900)',
            }}
          >
            {t('weddingsTitle')}
          </h1>
        </header>

        {weddings.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-[color:var(--color-border-strong)] px-6 py-16 text-center">
            <Heart
              className="h-7 w-7 text-[color:var(--color-blush-300)]"
              strokeWidth={1.6}
              aria-hidden
            />
            <p className="max-w-sm text-sm text-[color:var(--color-ink-500)]">{t('empty')}</p>
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {weddings.map((w) => (
              <li key={w._id}>
                <Link
                  href={`/espace-couple/${w._id}`}
                  className="focus-ring group flex flex-col gap-3 rounded-3xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6 transition-colors hover:border-[color:var(--color-blush-400)]"
                >
                  <span className="font-display text-2xl text-[color:var(--color-ink-900)] italic">
                    {w.coupleNames.partnerA} &amp; {w.coupleNames.partnerB}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-sm text-[color:var(--color-ink-500)]">
                    <Calendar className="h-3.5 w-3.5" strokeWidth={1.9} aria-hidden />
                    {format.dateTime(new Date(w.eventDate), {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </span>
                  {w.venue ? (
                    <span className="inline-flex items-center gap-1.5 text-sm text-[color:var(--color-ink-500)]">
                      <MapPin className="h-3.5 w-3.5" strokeWidth={1.9} aria-hidden />
                      {w.venue.name}
                    </span>
                  ) : null}
                  <span className="mt-1 inline-flex items-center gap-1.5 font-mono text-[10px] tracking-[0.16em] text-[color:var(--color-ink-700)] uppercase">
                    {t('openMySpace')}
                    <ArrowRight
                      className="h-3 w-3 transition-transform group-hover:translate-x-0.5"
                      strokeWidth={2}
                      aria-hidden
                    />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
