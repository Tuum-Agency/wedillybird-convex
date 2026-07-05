'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Cinematic2 } from '@/components/invitation/cinematic2';

/**
 * Landing — Ouverture cinématique 2.5D (même composant que la page d'invitation :
 * {@link Cinematic2}). L'enveloppe de papeterie s'ouvre en profondeur réelle quand
 * la section entre dans le viewport (auto-play déclenché par IntersectionObserver),
 * avec parallaxe au pointeur sur desktop. Avant d'être vue, elle reste figée sur
 * l'enveloppe scellée. `prefers-reduced-motion` → état apaisé direct.
 */
export function LandingCinematicInvitation() {
  const t = useTranslations('Landing.cinematic');
  const stageRef = useRef<HTMLDivElement>(null);
  const [armed, setArmed] = useState(false);
  const [playKey, setPlayKey] = useState(0);

  // Joue la cinématique quand le cadre entre dans le viewport (une fois).
  useEffect(() => {
    const el = stageRef.current;
    if (!el || armed) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setArmed(true);
          setPlayKey((k) => k + 1);
          io.disconnect();
        }
      },
      { threshold: 0.45 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [armed]);

  return (
    <section className="relative" style={{ backgroundColor: 'var(--color-ivory-50)' }}>
      <div className="relative overflow-hidden py-24 sm:py-32">
        <div aria-hidden className="paper-grain pointer-events-none absolute inset-0" />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(50% 40% at 50% 18%, oklch(95% 0.025 22 / 50%) 0%, transparent 70%)',
          }}
        />

        <div className="container-page relative flex flex-col items-center gap-3 text-center">
          <span className="font-mono text-[11px] tracking-[0.32em] text-[color:var(--color-ink-500)] uppercase">
            {t('chapter')}
          </span>
          <h2
            className="font-display mt-4 max-w-3xl text-balance italic"
            style={{
              fontSize: 'clamp(2rem, 5vw, 3.5rem)',
              lineHeight: 1.05,
              letterSpacing: '-0.022em',
              color: 'var(--color-ink-900)',
            }}
          >
            {t('title')}
          </h2>
          <p className="mt-3 max-w-xl text-base text-[color:var(--color-ink-500)]">
            {t('subtitle')}
          </p>
        </div>

        {/* Lecteur encadré — l'ouverture cinématique 2.5D */}
        <div
          ref={stageRef}
          className="relative mx-auto mt-14 h-[560px] w-full max-w-[760px] overflow-hidden rounded-[var(--radius-3xl)] border border-[color:var(--color-border)] sm:h-[620px]"
          style={{ background: 'var(--color-surface)', boxShadow: 'var(--shadow-lifted)' }}
        >
          <Cinematic2
            holdPhase={armed ? null : 0}
            playKey={playKey}
            parallax
            partnerA="Camille"
            partnerB="Hugo"
            formattedDate={t('cardDate')}
            eventDate="2026-09-12T15:00:00"
          />
        </div>
      </div>
    </section>
  );
}
