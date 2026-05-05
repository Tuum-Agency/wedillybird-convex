'use client';

import { motion, useReducedMotion } from 'motion/react';
import { useTranslations, useLocale } from 'next-intl';
import { Calendar, MapPin, Users, ArrowUpRight } from 'lucide-react';
import { Link } from '@/i18n/navigation';

type EventStatus = 'draft' | 'active' | 'archived' | 'cancelled';

interface Event {
  _id: string;
  slug: string;
  title: string;
  coupleNames: { partnerA: string; partnerB: string };
  eventDate: number;
  timezone: string;
  status: EventStatus;
  planTier: 'essential' | 'premium' | undefined;
  maxGuests: number;
  venue?: { name: string; address: string };
  updatedAt: number;
}

/**
 * Dashboard events list V4 — animated list avec cards éditoriales premium.
 *
 * Chaque card :
 *  - Header avec status badge + plan tier badge gold si payé
 *  - Titre couple en Bodoni italic + date long form
 *  - Footer : lieu (si défini) + chevron ArrowUpRight au hover
 *  - Hover lift -2px + shadow blush
 *
 * Stagger reveal Motion sur l'apparition (60ms entre chaque card).
 */
export function DashboardEventsList({ events }: { events: ReadonlyArray<Event> }) {
  const t = useTranslations('Dashboard');
  const locale = useLocale();
  const reduced = useReducedMotion();

  const containerVariants = {
    hidden: {},
    visible: { transition: { staggerChildren: reduced ? 0 : 0.06, delayChildren: 0.05 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: reduced ? 0 : 12 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: 'easeOut' as const } },
  };

  return (
    <motion.ul
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="grid grid-cols-1 gap-4 md:grid-cols-2"
    >
      {events.map((ev) => {
        const dateFormatted = new Intl.DateTimeFormat(locale, {
          dateStyle: 'long',
          timeStyle: 'short',
          timeZone: ev.timezone,
        }).format(new Date(ev.eventDate));

        return (
          <motion.li key={ev._id} variants={itemVariants}>
            <Link
              href={`/events/${ev._id}`}
              className="focus-ring group relative flex flex-col gap-4 overflow-hidden rounded-3xl border border-[color:var(--color-border)] bg-white p-6 transition-[transform,box-shadow,border-color] duration-300 [@media(hover:hover)]:hover:-translate-y-0.5 [@media(hover:hover)]:hover:border-[color:var(--color-blush-300)] [@media(hover:hover)]:hover:shadow-[var(--shadow-blush)]"
            >
              {/* Header : badges */}
              <div className="flex items-center justify-between gap-3">
                <StatusBadge status={ev.status} t={t} />
                {ev.planTier ? <PlanBadge tier={ev.planTier} /> : null}
              </div>

              {/* Couple name */}
              <h3
                className="font-display text-balance italic"
                style={{
                  fontSize: 'clamp(1.5rem, 2.4vw, 1.875rem)',
                  lineHeight: 1.1,
                  letterSpacing: '-0.02em',
                  color: 'var(--color-ink-900)',
                }}
              >
                {ev.coupleNames.partnerA}{' '}
                <span style={{ color: 'var(--color-gold-500)' }}>&amp;</span>{' '}
                {ev.coupleNames.partnerB}
              </h3>

              {/* Meta : date + lieu */}
              <div className="flex flex-col gap-2 border-t border-[color:var(--color-border)] pt-4">
                <p className="flex items-start gap-2.5 text-sm text-[color:var(--color-ink-700)]">
                  <Calendar
                    className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-[color:var(--color-blush-700)]"
                    strokeWidth={2}
                    aria-hidden
                  />
                  {dateFormatted}
                </p>
                {ev.venue ? (
                  <p className="flex items-start gap-2.5 text-sm text-[color:var(--color-ink-500)]">
                    <MapPin
                      className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-[color:var(--color-blush-700)]"
                      strokeWidth={2}
                      aria-hidden
                    />
                    {ev.venue.name}
                  </p>
                ) : null}
                <p className="flex items-start gap-2.5 text-sm text-[color:var(--color-ink-500)]">
                  <Users
                    className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-[color:var(--color-blush-700)]"
                    strokeWidth={2}
                    aria-hidden
                  />
                  {t('singleEventNotice').replace(
                    /Votre formule inclut un seul mariage\./,
                    `${ev.maxGuests} invitations max`,
                  )}
                </p>
              </div>

              {/* Chevron coin haut-droit, apparait au hover */}
              <span
                aria-hidden
                className="absolute top-5 right-5 flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--color-blush-50)] text-[color:var(--color-blush-700)] opacity-0 transition-opacity duration-300 [@media(hover:hover)]:group-hover:opacity-100"
              >
                <ArrowUpRight className="h-4 w-4" strokeWidth={2} />
              </span>
            </Link>
          </motion.li>
        );
      })}
    </motion.ul>
  );
}

function StatusBadge({ status, t }: { status: EventStatus; t: (k: string) => string }) {
  const config: Record<EventStatus, { label: string; bg: string; fg: string; dot: string }> = {
    draft: {
      label: t('draftBadge'),
      bg: 'oklch(94% 0.022 78)',
      fg: 'var(--color-ink-700)',
      dot: 'oklch(78% 0.075 78)',
    },
    active: {
      label: t('activeBadge'),
      bg: 'oklch(96% 0.018 145)',
      fg: 'oklch(50% 0.08 145)',
      dot: 'oklch(50% 0.08 145)',
    },
    archived: {
      label: t('archivedBadge'),
      bg: 'oklch(94% 0.012 78)',
      fg: 'var(--color-ink-500)',
      dot: 'var(--color-ink-500)',
    },
    cancelled: {
      label: t('cancelledBadge'),
      bg: 'oklch(96% 0.025 25)',
      fg: 'var(--color-blush-700)',
      dot: 'var(--color-blush-700)',
    },
  };
  const c = config[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[9px] tracking-[0.18em] uppercase"
      style={{ background: c.bg, color: c.fg }}
    >
      <span
        aria-hidden
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ background: c.dot }}
      />
      {c.label}
    </span>
  );
}

function PlanBadge({ tier }: { tier: 'essential' | 'premium' }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-mono text-[9px] tracking-[0.18em] uppercase"
      style={{
        background: tier === 'premium' ? 'oklch(92% 0.035 80)' : 'oklch(95% 0.025 22)',
        color: tier === 'premium' ? 'oklch(58% 0.075 80)' : 'var(--color-blush-700)',
      }}
    >
      <span aria-hidden>✦</span>
      {tier === 'premium' ? 'Premium' : 'Essentiel'}
    </span>
  );
}
