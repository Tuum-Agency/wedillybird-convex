'use client';

import { motion, useReducedMotion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

/**
 * Compte à rebours live jusqu'au mariage. Mise à jour toutes les minutes
 * (pas la seconde — pas besoin de stress visuel sur un site mariage).
 *
 * Affichage :
 *   J — H — M
 * en gros chiffres tabular (Geist 200) + libellés mono caps.
 *
 * Si l'événement est passé (eventDate < now), affiche un message paisible.
 */
export interface WeddingCountdownProps {
  /** Timestamp ms du mariage. */
  eventDate: number;
  /** Couleur d'accent — bordure + label. */
  accentColor?: string;
}

export function WeddingCountdown({ eventDate, accentColor }: WeddingCountdownProps) {
  const reduced = useReducedMotion();
  const t = useTranslations('Invitation');
  const [now, setNow] = useState<number | null>(null);
  const accent = accentColor ?? 'oklch(58% 0.075 80)';
  const daysLabel = t('countdownDays').toUpperCase();
  const hoursLabel = t('countdownHours').toUpperCase();
  const minutesLabel = t('countdownMinutes').toUpperCase();

  useEffect(() => {
    // Initial set différé en raf pour éviter le cascading render au mount
    // (le setState sync serait flagué par eslint-plugin-react-hooks).
    const raf = requestAnimationFrame(() => setNow(Date.now()));
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(id);
    };
  }, []);

  // SSR / first paint : on rend des placeholders pour éviter le hydration
  // mismatch et pour que l'écran ne saute pas quand le countdown apparaît.
  if (now === null) {
    return (
      <div
        className="inv-wcd grid grid-cols-3 gap-3 sm:gap-6"
        aria-label={t('countdownLoadingAria')}
      >
        <CountdownCell value="—" label={daysLabel} accent={accent} />
        <CountdownCell value="—" label={hoursLabel} accent={accent} />
        <CountdownCell value="—" label={minutesLabel} accent={accent} />
      </div>
    );
  }

  const diffMs = eventDate - now;

  if (diffMs <= 0) {
    return (
      <p
        className="font-display text-center text-balance italic"
        style={{
          fontSize: 'clamp(1.25rem, 2.4vw, 1.75rem)',
          color: 'var(--color-ink-700)',
          letterSpacing: '-0.018em',
        }}
      >
        {t('weddingDayArrived')}
      </p>
    );
  }

  const totalMinutes = Math.floor(diffMs / 60_000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  const initial = reduced ? false : { opacity: 0, y: 8 };
  const animate = reduced ? false : { opacity: 1, y: 0 };

  return (
    <motion.div
      initial={initial as never}
      animate={animate as never}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="inv-wcd grid grid-cols-3 gap-3 sm:gap-6"
      role="timer"
      aria-label={t('countdownAria', { days, hours, minutes })}
    >
      <CountdownCell value={String(days)} label={daysLabel} accent={accent} />
      <CountdownCell value={String(hours).padStart(2, '0')} label={hoursLabel} accent={accent} />
      <CountdownCell
        value={String(minutes).padStart(2, '0')}
        label={minutesLabel}
        accent={accent}
      />
    </motion.div>
  );
}

function CountdownCell({ value, label, accent }: { value: string; label: string; accent: string }) {
  return (
    <div
      className="inv-wcd-cell flex flex-col items-center gap-2 rounded-2xl border bg-white/60 px-4 py-5 backdrop-blur-sm sm:px-6 sm:py-7"
      style={{ borderColor: accent }}
    >
      <span
        className="inv-wcd-num tabular-nums"
        style={{
          fontFamily: 'var(--font-sans)',
          fontWeight: 200,
          fontSize: 'clamp(2.25rem, 5vw, 3.5rem)',
          lineHeight: 1,
          letterSpacing: '-0.04em',
          color: 'var(--color-ink-900)',
        }}
      >
        {value}
      </span>
      <span
        className="inv-wcd-lab font-mono text-[9px] tracking-[0.32em] uppercase sm:text-[10px]"
        style={{ color: accent }}
      >
        {label}
      </span>
    </div>
  );
}
