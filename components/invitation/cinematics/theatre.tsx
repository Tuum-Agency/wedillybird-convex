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
import './theatre.css';

/**
 * « Le Lever de rideau » — cinématique théâtrale (l'acte des cygnes).
 *
 * Un théâtre à l'italienne : le projecteur balaie le velours, le rideau se
 * lève sur un lac au clair de lune, deux cygnes glissent l'un vers l'autre
 * et leurs cous dessinent un cœur — la carte s'élève alors du lac dans le
 * cône de lumière. Les étoiles scintillent, l'eau miroite, le rideau reste
 * en cadre de scène autour du compte à rebours.
 *
 * Phases : 0 rideau fermé · 1 rise (lever) · 2 scene (lac + cygnes) ·
 *          3 heart (cœur + carte) · 4 named (prénoms) · 5 settled
 */
const WAITS = [950, 950, 1150, 1000, 950];
const PHASES = ['', 'rise', 'scene', 'heart', 'named', 'settled'] as const;

const STARS: ReadonlyArray<{ x: number; y: number; s: number; d: number }> = [
  { x: 12, y: 8, s: 2.5, d: 0 },
  { x: 26, y: 16, s: 1.8, d: 1.3 },
  { x: 44, y: 6, s: 2.2, d: 2.4 },
  { x: 60, y: 14, s: 1.6, d: 0.7 },
  { x: 74, y: 9, s: 2.4, d: 1.9 },
  { x: 88, y: 18, s: 1.8, d: 3.1 },
  { x: 18, y: 26, s: 1.5, d: 2.7 },
  { x: 52, y: 22, s: 1.4, d: 3.6 },
  { x: 80, y: 28, s: 1.7, d: 0.4 },
  { x: 34, y: 30, s: 1.3, d: 1.6 },
];

function Swan({ side }: { side: 'l' | 'r' }) {
  return (
    <div className={`swan s${side}`} aria-hidden>
      <span className="s-refl" />
      <span className="s-body" />
      <span className="s-wing" />
      <span className="s-neck" />
      <span className="s-head" />
      <span className="s-beak" />
    </div>
  );
}

export function CinematicTheatre({
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
    'cineT-scene',
    'cineT',
    isReduced && 'reduced',
    holdPhase != null && 'frozen',
    ...PHASES.slice(1, effectivePhase + 1),
  ]
    .filter(Boolean)
    .join(' ');

  // Marque blanche : l'accent teinte le velours du rideau + les accents.
  const tint: CSSProperties = accentColor
    ? ({
        '--c-curt': shiftL(accentColor, -0.18),
        '--c-curt-dk': shiftL(accentColor, -0.34),
        '--c-accent': accentColor,
      } as CSSProperties)
    : {};

  const stageCls = ['cineT-stage', live && 'live'].filter(Boolean).join(' ');

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
        <div className="tx-camera">
          <div className="tx-par">
            {/* Décor : lac au clair de lune */}
            <div className="bk" aria-hidden>
              <span className="moon" />
              {STARS.map((s, i) => (
                <span
                  key={i}
                  className="star"
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
              <span className="mtn m1" />
              <span className="mtn m2" />
              <span className="lake" />
              <span className="moonpath" />
              <span className="bk-dim" />
            </div>

            {/* Les cygnes + ondulations + cœur */}
            <div className="swans" aria-hidden>
              <Swan side="l" />
              <Swan side="r" />
              <span className="rip r1" />
              <span className="rip r2" />
              <span className="heart-glow" />
              <span className="spark">✦</span>
            </div>

            <div className="card3d">
              <div className="card-face">
                <span className="card-sheen" aria-hidden />
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

            {/* Cône du projecteur */}
            <span className="spot-cone" aria-hidden />

            {/* Rideau + cadre de scène (au premier plan) */}
            <div className="curt cl" aria-hidden />
            <div className="curt cr" aria-hidden />
            <div className="valance" aria-hidden />
            <span className="pro-arch" aria-hidden />
          </div>
        </div>

        {target != null && <CinematicCountdown cd={cd} className="cineT-after" />}
      </div>

      <p className="cineT-cue" style={{ opacity: effectivePhase === 4 ? 1 : 0 }}>
        <span className="t">{t('scrollToDiscover')}</span>
      </p>
    </div>
  );
}
