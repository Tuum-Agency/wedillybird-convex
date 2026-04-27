import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Calendar, Plus, Users, ArrowUpRight } from 'lucide-react';
import { Link, redirect } from '@/i18n/navigation';
import { getSession } from '@/lib/auth/session';
import { convexApi, getConvexServerClient } from '@/lib/auth/convex-server';
import { buttonVariants } from '@/components/ui/button';
import { ProShell, ProNav } from '@/components/pro/pro-shell';
import { cn } from '@/lib/cn';

type EventStatus = 'draft' | 'active' | 'archived' | 'cancelled';

const STATUS_CONFIG: Record<
  EventStatus,
  { labelKey: string; bg: string; fg: string; dot: string }
> = {
  draft: {
    labelKey: 'draftBadge',
    bg: 'oklch(28% 0.022 78)',
    fg: 'oklch(85% 0.04 78)',
    dot: 'oklch(78% 0.075 78)',
  },
  active: {
    labelKey: 'activeBadge',
    bg: 'oklch(26% 0.04 145)',
    fg: 'oklch(82% 0.07 145)',
    dot: 'oklch(72% 0.08 145)',
  },
  archived: {
    labelKey: 'archivedBadge',
    bg: 'oklch(28% 0.012 78)',
    fg: 'oklch(72% 0.018 65)',
    dot: 'oklch(72% 0.018 65)',
  },
  cancelled: {
    labelKey: 'cancelledBadge',
    bg: 'oklch(28% 0.04 25)',
    fg: 'oklch(82% 0.07 22)',
    dot: 'oklch(72% 0.09 20)',
  },
};

export default async function ProDashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await getSession();
  if (!session) redirect({ href: '/sign-in', locale });

  const convex = getConvexServerClient();
  const org = await convex.query(convexApi.myOrganization, { userId: session!.userId });
  if (!org) redirect({ href: '/pro/onboarding', locale });

  const events = await convex.query(convexApi.listOrgEvents, {
    organizationId: org!._id,
    requesterId: session!.userId,
  });

  const user = await convex.query(convexApi.currentUser, { userId: session!.userId });
  const t = await getTranslations('Pro');
  const tDash = await getTranslations('Dashboard');

  return (
    <ProShell
      orgName={org!.name}
      orgPrimaryColor={org!.primaryColor ?? undefined}
      userName={user?.fullName}
      nav={<ProNav current="dashboard" />}
    >
      <div className="container-page flex flex-col gap-12 py-12 sm:py-16">
        {/* Header éditorial */}
        <header className="flex flex-col gap-5">
          <span className="font-mono text-[10px] tracking-[0.32em] text-[color:var(--color-muted-foreground)] uppercase">
            {t('orgBadge')}
          </span>
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
            <div className="flex flex-col gap-2">
              <h1
                className="font-display text-balance italic"
                style={{
                  fontSize: 'clamp(2rem, 4.5vw, 3rem)',
                  lineHeight: 1.05,
                  letterSpacing: '-0.022em',
                  color: 'var(--color-foreground)',
                }}
              >
                {org!.name}
              </h1>
              <p className="font-mono text-[10px] tracking-[0.32em] text-[color:var(--color-muted-foreground)] uppercase">
                {t('memberRole')} · {t(`roles.${org!.myRole}` as const)}
              </p>
            </div>
            <Link
              href="/events/new"
              className={cn(buttonVariants({ variant: 'primary', size: 'md' }))}
            >
              <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
              {t('createEvent')}
            </Link>
          </div>
        </header>

        {/* Events list */}
        <section className="flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <h2
              className="font-display italic"
              style={{
                fontSize: 'clamp(1.25rem, 1.8vw, 1.5rem)',
                letterSpacing: '-0.018em',
                color: 'var(--color-foreground)',
              }}
            >
              {t('orgEventsTitle')}
            </h2>
            <span className="font-mono text-[10px] tracking-[0.24em] text-[color:var(--color-muted-foreground)] uppercase">
              {events.length} {events.length > 1 ? 'mariages' : 'mariage'}
            </span>
          </div>

          {events.length === 0 ? (
            <div className="flex flex-col items-center gap-6 rounded-3xl border border-dashed border-[color:var(--color-border-strong)] bg-[color:var(--color-surface)]/40 px-8 py-16 text-center">
              <span
                aria-hidden
                className="flex h-14 w-14 items-center justify-center rounded-full bg-[color:var(--color-surface-elevated)] text-[color:var(--color-blush-300)]"
              >
                <Calendar className="h-6 w-6" strokeWidth={1.5} aria-hidden />
              </span>
              <p className="text-sm leading-relaxed text-[color:var(--color-muted-foreground)] sm:text-base">
                {t('emptyEvents')}
              </p>
            </div>
          ) : (
            <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {events.map((ev) => {
                const cfg = STATUS_CONFIG[ev.status];
                const dateFormatted = new Intl.DateTimeFormat('fr', {
                  dateStyle: 'long',
                  timeZone: ev.timezone,
                }).format(new Date(ev.eventDate));
                return (
                  <li key={ev._id}>
                    <Link
                      href={`/events/${ev._id}`}
                      className="focus-ring group relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6 transition-[transform,box-shadow,border-color] duration-300 [@media(hover:hover)]:hover:-translate-y-0.5 [@media(hover:hover)]:hover:border-[color:var(--color-border-strong)] [@media(hover:hover)]:hover:shadow-[var(--shadow-lifted)]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <h3
                          className="font-display italic"
                          style={{
                            fontSize: 'clamp(1.125rem, 1.6vw, 1.375rem)',
                            lineHeight: 1.15,
                            letterSpacing: '-0.018em',
                            color: 'var(--color-foreground)',
                          }}
                        >
                          {ev.coupleNames.partnerA}{' '}
                          <span style={{ color: 'var(--color-gold-500)' }}>&amp;</span>{' '}
                          {ev.coupleNames.partnerB}
                        </h3>
                        <span
                          className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[9px] tracking-[0.18em] uppercase"
                          style={{ background: cfg.bg, color: cfg.fg }}
                        >
                          <span
                            aria-hidden
                            className="inline-block h-1.5 w-1.5 rounded-full"
                            style={{ background: cfg.dot }}
                          />
                          {tDash(cfg.labelKey)}
                        </span>
                      </div>

                      <p className="text-sm text-[color:var(--color-muted-foreground)]">
                        {ev.title}
                      </p>

                      <div className="flex flex-col gap-2 border-t border-[color:var(--color-border)] pt-4">
                        <p className="flex items-start gap-2.5 text-sm text-[color:var(--color-ink-700)]">
                          <Calendar
                            className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-[color:var(--color-blush-300)]"
                            strokeWidth={2}
                            aria-hidden
                          />
                          {dateFormatted}
                        </p>
                        <p className="flex items-start gap-2.5 text-sm text-[color:var(--color-muted-foreground)]">
                          <Users
                            className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-[color:var(--color-blush-300)]"
                            strokeWidth={2}
                            aria-hidden
                          />
                          {ev.maxGuests} invitations max
                        </p>
                      </div>

                      <span
                        aria-hidden
                        className="absolute top-5 right-5 flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--color-surface-elevated)] text-[color:var(--color-blush-300)] opacity-0 transition-opacity duration-300 [@media(hover:hover)]:group-hover:opacity-100"
                      >
                        <ArrowUpRight className="h-4 w-4" strokeWidth={2} />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </ProShell>
  );
}
