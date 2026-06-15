'use client';

import { useTranslations } from 'next-intl';
import { type Tier } from './content';

/**
 * Badge de disponibilité d'une fonctionnalité. Rien pour `all` (l'appelant
 * affiche alors une coche « inclus partout »). Couleurs : Business = blush,
 * Agency = gold, Option = neutre.
 */
export function TierBadge({ tier, className }: { tier: Tier; className?: string }) {
  const t = useTranslations('Pros');

  if (tier === 'all') return null;

  const style: Record<Exclude<Tier, 'all'>, string> = {
    business:
      'bg-[color:var(--color-blush-100)] text-[color:var(--color-blush-700)] ring-[color:var(--color-blush-200)]',
    agency:
      'bg-[color:var(--color-champagne-100)] text-[color:var(--color-gold-700)] ring-[color:var(--color-champagne-200)]',
    addon:
      'bg-[color:var(--color-ivory-200)] text-[color:var(--color-ink-500)] ring-[color:var(--color-border)]',
  };

  return (
    <span
      className={[
        'inline-flex flex-shrink-0 items-center rounded-full px-2 py-0.5 font-mono text-[9px] font-medium tracking-[0.08em] uppercase ring-1 ring-inset',
        style[tier],
        className ?? '',
      ].join(' ')}
    >
      {t(`tierBadge.${tier}` as Parameters<typeof t>[0])}
    </span>
  );
}
