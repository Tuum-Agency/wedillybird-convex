'use client';

import { useTranslations } from 'next-intl';
import { useReducedMotion } from 'motion/react';
import { useRef, type CSSProperties } from 'react';
import {
  CinematicSkip,
  useCinematicTimeline,
  useCountdown,
  useSceneParallax,
  type CinematicSceneProps,
} from './shared';
import './etoiles.css';

/**
 * « La Constellation » — le ciel écrit l'invitation.
 *
 * Nuit profonde au-dessus des collines : les étoiles s'avivent, une étoile
 * filante traverse (puis une seconde lui répond), et la constellation SE
 * TRACE — un fil de lumière relie dix étoiles qui composent un CŒUR, chaque
 * nœud s'embrase au passage. Les prénoms se révèlent en lumière stellaire
 * (netteté + halo), soulignés d'un trait de comète. Compte à rebours en
 * trois ORBES lumineux, chacun cerclé d'une orbite et de son satellite.
 *
 * Phases : 0 nuit · 1 night (le ciel s'avive) · 2 shoot (étoiles filantes)
 *          · 3 trace (le cœur se dessine) · 4 names · 5 settled
 */
const WAITS = [900, 850, 1150, 1050, 900];
const PHASES = ['', 'night', 'shoot', 'trace', 'names', 'settled'] as const;

/** Étoiles d'ambiance (position %, taille px, délai de scintillement). */
const SKY: ReadonlyArray<{ x: number; y: number; s: number; d: number }> = [
  { x: 8, y: 12, s: 2.5, d: 0 },
  { x: 20, y: 32, s: 1.8, d: 1.2 },
  { x: 31, y: 8, s: 2.2, d: 2.4 },
  { x: 44, y: 24, s: 1.5, d: 0.8 },
  { x: 55, y: 6, s: 2.6, d: 1.7 },
  { x: 66, y: 30, s: 1.6, d: 3 },
  { x: 78, y: 10, s: 2.3, d: 0.4 },
  { x: 90, y: 26, s: 1.8, d: 2 },
  { x: 12, y: 52, s: 1.6, d: 2.8 },
  { x: 88, y: 50, s: 1.5, d: 1 },
  { x: 40, y: 46, s: 1.4, d: 3.4 },
  { x: 70, y: 48, s: 1.7, d: 0.6 },
  { x: 26, y: 68, s: 1.4, d: 1.9 },
  { x: 82, y: 70, s: 1.6, d: 2.5 },
  { x: 52, y: 62, s: 1.3, d: 3.8 },
  { x: 6, y: 78, s: 1.5, d: 0.2 },
];

/** Nœuds du cœur (coordonnées scène 360×560, zone haute). */
const HEART: ReadonlyArray<{ x: number; y: number }> = [
  { x: 180, y: 168 },
  { x: 143, y: 132 },
  { x: 108, y: 146 },
  { x: 98, y: 190 },
  { x: 128, y: 236 },
  { x: 180, y: 276 },
  { x: 232, y: 236 },
  { x: 262, y: 190 },
  { x: 252, y: 146 },
  { x: 217, y: 132 },
];

export function CinematicEtoiles({
  partnerA,
  partnerB,
  formattedDate,
  venueName,
  eventDate,
  reduced,
  parallax = true,
  holdPhase = null,
  playKey,
  onDone,
  live = false,
}: CinematicSceneProps) {
  const t = useTranslations('Invitation');
  const prefersReduced = useReducedMotion();
  const isReduced = reduced || !!prefersReduced;
  const sceneRef = useRef<HTMLDivElement>(null);

  const { effectivePhase, skipToEnd } = useCinematicTimeline({
    waits: WAITS,
    playKey,
    holdPhase,
    isReduced,
    onDone,
  });
  const par = useSceneParallax(sceneRef, { enabled: parallax && !isReduced });
  const cd = useCountdown(eventDate);
  const target = eventDate != null ? new Date(eventDate).getTime() : null;

  const sceneCls = [
    'cineS-scene',
    'cineS',
    isReduced && 'reduced',
    holdPhase != null && 'frozen',
    ...PHASES.slice(1, effectivePhase + 1),
  ]
    .filter(Boolean)
    .join(' ');

  const stageCls = ['cineS-stage', live && 'live'].filter(Boolean).join(' ');
  const points = HEART.map((p) => `${p.x},${p.y}`).join(' ') + ` ${HEART[0]!.x},${HEART[0]!.y}`;

  const orb = (v: number | null, u: string, i: number) => (
    <span className="st-orb" style={{ '--od': `${i * 0.16}s` } as CSSProperties}>
      <i className="ring" />
      <b>{v == null ? '—' : String(v).padStart(2, '0')}</b>
      <em>{u}</em>
    </span>
  );

  return (
    <div className={stageCls} role="presentation">
      {live && holdPhase == null && !isReduced && effectivePhase < 5 && (
        <CinematicSkip
          onSkip={() => {
            skipToEnd();
            onDone?.();
          }}
        />
      )}

      <div
        className={sceneCls}
        ref={sceneRef}
        onPointerMove={par.onPointerMove}
        onPointerLeave={par.onPointerLeave}
      >
        <div className="sx-camera">
          <div className="sx-par">
            {/* Ciel : voie lactée + étoiles + collines */}
            <span className="st-milky" aria-hidden />
            <div className="st-sky" aria-hidden>
              {SKY.map((s, i) => (
                <span
                  key={i}
                  style={
                    {
                      left: `${s.x}%`,
                      top: `${s.y}%`,
                      width: s.s,
                      height: s.s,
                      '--sd': `${s.d}s`,
                    } as CSSProperties
                  }
                />
              ))}
            </div>
            <span className="st-hill h1" aria-hidden />
            <span className="st-hill h2" aria-hidden />

            {/* Étoiles filantes */}
            <span className="st-shoot s1" aria-hidden />
            <span className="st-shoot s2" aria-hidden />

            {/* La constellation en cœur */}
            <svg className="st-heart" viewBox="0 0 360 560" aria-hidden>
              <polyline points={points} />
            </svg>
            <div className="st-nodes" aria-hidden>
              {HEART.map((p, i) => (
                <span
                  key={i}
                  style={
                    { left: `${p.x}px`, top: `${p.y}px`, '--nd': `${i * 0.12}s` } as CSSProperties
                  }
                />
              ))}
            </div>

            {/* Les prénoms en lumière stellaire */}
            <div className="st-names">
              <span className="st-eyebrow">{t('youreInvited')}</span>
              <b className="st-name na">{partnerA}</b>
              <span className="st-amp">&amp;</span>
              <b className="st-name nb">{partnerB}</b>
              <span className="st-comet" aria-hidden />
              <span className="st-date">
                {formattedDate}
                {venueName ? ` · ${venueName}` : ''}
              </span>
            </div>
          </div>
        </div>

        {/* Compte à rebours en orbes */}
        {target != null && (
          <div className="st-cd">
            <span className="lbl">{t('countdownLabel')}</span>
            <div className="row">
              {orb(cd?.d ?? null, t('countdownDays'), 0)}
              {orb(cd?.h ?? null, t('countdownHours'), 1)}
              {orb(cd?.m ?? null, t('countdownMinutes'), 2)}
            </div>
          </div>
        )}
      </div>

      <p className="cineS-cue" style={{ opacity: effectivePhase === 4 ? 1 : 0 }}>
        <span className="t">{t('scrollToDiscover')}</span>
      </p>
    </div>
  );
}
