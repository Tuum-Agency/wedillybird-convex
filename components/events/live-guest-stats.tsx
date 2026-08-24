'use client';

import { useQuery } from 'convex/react';
import { useTranslations } from 'next-intl';
import { clientApi } from '@/lib/convex/client-api';
import { useConvexSessionToken } from '@/stores/convex-session-store';

interface Props {
  eventId: string;
  initialCounts: {
    total: number;
    attending: number;
    declined: number;
    pending: number;
    maybe: number;
  };
  maxGuests: number;
}

export function LiveGuestStats({ eventId, initialCounts, maxGuests }: Props) {
  const t = useTranslations('EventStats');
  // L'identité vient du `sessionToken` vérifié par Convex : tant qu'il n'est pas
  // chargé on reste sur les compteurs rendus côté serveur.
  const sessionToken = useConvexSessionToken();
  const live = useQuery(
    clientApi.countGuestsByEvent,
    sessionToken ? { eventId, sessionToken } : 'skip',
  );
  const counts = live ?? initialCounts;

  return (
    <section
      className="flex flex-col gap-4 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5"
      data-testid="live-guest-stats"
    >
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold">{t('liveTitle')}</h2>
        <span className="text-xs text-[color:var(--color-muted)]">
          {counts.total} / {maxGuests}
        </span>
      </div>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label={t('attending')} value={counts.attending} tone="accent" />
        <Stat label={t('pending')} value={counts.pending} tone="primary" />
        <Stat label={t('maybe')} value={counts.maybe} tone="neutral" />
        <Stat label={t('declined')} value={counts.declined} tone="destructive" />
      </dl>
    </section>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'accent' | 'primary' | 'neutral' | 'destructive';
}) {
  const toneClass = {
    accent: 'text-[color:var(--color-accent)]',
    primary: 'text-[color:var(--color-primary)]',
    neutral: 'text-[color:var(--color-muted)]',
    destructive: 'text-[color:var(--color-destructive)]',
  }[tone];

  return (
    <div className="flex flex-col gap-1 rounded-lg border border-[color:var(--color-border)] p-3">
      <dt className="text-xs text-[color:var(--color-muted)]">{label}</dt>
      <dd className={`font-display text-2xl font-semibold ${toneClass}`}>{value}</dd>
    </div>
  );
}
