'use client';

import { useTranslations } from 'next-intl';
import { useReducedMotion } from 'motion/react';
import { useRef, type CSSProperties } from 'react';
import {
  CinematicCountdown,
  CinematicSkip,
  shiftL,
  useCinematicTimeline,
  useCountdown,
  useSceneParallax,
  type CinematicSceneProps,
} from './shared';
import './voyage.css';

/**
 * « L'Embarquement » — cinématique voyage.
 *
 * Cabine au crépuscule : le cache du hublot se lève sur une aube au-dessus
 * des nuages, la caméra traverse le hublot et bascule en plein ciel, un
 * avion en papier trace sa route, puis la carte arrive de l'horizon comme
 * une carte d'embarquement (bord perforé) et les prénoms se tamponnent.
 *
 * Phases : 0 cabine · 1 shade (cache) · 2 through (traversée) · 3 plane
 *          (avion + carte) · 4 named (prénoms) · 5 settled (dérive)
 */
const WAITS = [900, 780, 1150, 1000, 950];
const PHASES = ['', 'shade', 'through', 'plane', 'named', 'settled'] as const;

/** Nuages plein ciel : position (%), échelle, profondeur, délai de dérive. */
/* translateZ ≤ 22 px : les nuages restent DERRIÈRE la carte (z 30). */
const CLOUDS: ReadonlyArray<{ x: number; y: number; s: number; z: number; d: number }> = [
  { x: 8, y: 66, s: 1.25, z: 18, d: 0 },
  { x: 55, y: 74, s: 1.6, z: 10, d: 1.6 },
  { x: 30, y: 84, s: 2, z: 22, d: 0.8 },
  { x: 72, y: 60, s: 1, z: 6, d: 2.4 },
  { x: -6, y: 80, s: 1.7, z: 14, d: 3.1 },
  { x: 62, y: 88, s: 2.2, z: 4, d: 1.2 },
];

/** Nuages du mini-ciel (dans le hublot). */
const MINI_CLOUDS: ReadonlyArray<{ x: number; y: number; s: number; d: number }> = [
  { x: 6, y: 58, s: 0.8, d: 0 },
  { x: 48, y: 70, s: 1.05, d: 1.4 },
  { x: 26, y: 82, s: 1.3, d: 0.7 },
];

export function CinematicVoyage({
  partnerA,
  partnerB,
  formattedDate,
  venueName,
  accentColor,
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
    'cineV-scene',
    'cineV',
    isReduced && 'reduced',
    holdPhase != null && 'frozen',
    ...PHASES.slice(1, effectivePhase + 1),
  ]
    .filter(Boolean)
    .join(' ');

  const tint: CSSProperties = accentColor
    ? ({
        '--c-accent': shiftL(accentColor, -0.24),
        '--c-shade': shiftL(accentColor, 0.2),
      } as CSSProperties)
    : {};

  const initials = `${(partnerA.trim()[0] ?? '').toUpperCase()} & ${(partnerB.trim()[0] ?? '').toUpperCase()}`;

  const cloud = (c: { x: number; y: number; s: number; d: number; z?: number }, i: number) => (
    <span
      key={i}
      className="cl"
      style={
        {
          left: `${c.x}%`,
          top: `${c.y}%`,
          '--cs': c.s,
          '--cz': `${c.z ?? 0}px`,
          '--cd': `${c.d}s`,
        } as CSSProperties
      }
    />
  );

  const stageCls = ['cineV-stage', live && 'live'].filter(Boolean).join(' ');
  return (
    <div className={stageCls} style={tint} role="presentation">
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
        <div className="vx-camera">
          <div className="vx-par">
            {/* Plein ciel (révélé à la traversée du hublot) */}
            <div className="vx-sky" aria-hidden>
              <span className="sun" />
              <span className="horizon" />
              {CLOUDS.map(cloud)}
              <span className="streak s1" />
              <span className="streak s2" />
            </div>

            {/* Avion en papier + traînée pointillée */}
            <div className="pp-path" aria-hidden>
              <span className="pp-trail" />
              <div className="pplane">
                <span className="w1" />
                <span className="w2" />
              </div>
            </div>

            {/* Cabine + hublot — cache et reflet DANS h-sky (overflow hidden) */}
            <div className="vx-cabin" aria-hidden />
            <div className="hublot" aria-hidden>
              <div className="h-sky">
                <span className="sun" />
                {MINI_CLOUDS.map(cloud)}
                <div className="h-shade">
                  <span className="h-handle" />
                </div>
                <span className="h-glass" />
              </div>
              <span className="h-frame" />
            </div>
            <div className="h-plaque" aria-hidden>
              {initials}
            </div>

            <div className="card3d">
              <div className="card-face">
                <span className="card-sheen" aria-hidden />
                <span className="card-perfo" aria-hidden />
                <span className="cf-eyebrow">{t('youreInvited')}</span>
                <span className="cf-rule" />
                <div className="cf-names">
                  <span className="cf-clip">
                    <span className="cf-line l1">{partnerA}</span>
                  </span>
                  <span className="cf-amp">&amp;</span>
                  <span className="cf-clip">
                    <span className="cf-line l2">{partnerB}</span>
                  </span>
                </div>
                <span className="cf-rule" />
                <span className="cf-date">
                  {formattedDate}
                  {venueName ? ` · ${venueName}` : ''}
                </span>
              </div>
            </div>
          </div>
        </div>

        {target != null && <CinematicCountdown cd={cd} className="cineV-after" />}
      </div>

      <p className="cineV-cue" style={{ opacity: effectivePhase === 4 ? 1 : 0 }}>
        <span className="t">{t('scrollToDiscover')}</span>
      </p>
    </div>
  );
}
