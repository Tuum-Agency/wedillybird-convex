'use client';

import { useTranslations } from 'next-intl';
import { useReducedMotion } from 'motion/react';
import { useRef, type CSSProperties } from 'react';
import {
  CinematicSkip,
  shiftL,
  useCinematicTimeline,
  useCountdown,
  useSceneParallax,
  type CinematicSceneProps,
} from './shared';
import './theatre.css';

/**
 * « Le Lever de rideau » — l'acte des cygnes. AUCUNE carte : les prénoms
 * sont LE TITRE DU SPECTACLE.
 *
 * Théâtre à l'italienne, caméra frontale quasi fixe — c'est la LUMIÈRE qui
 * met en scène : le projecteur balaie le velours, le rideau se lève sur un
 * lac au clair de lune, deux cygnes glissent l'un vers l'autre… puis une
 * ENSEIGNE descend des cintres au bout de ses cordes, portant les prénoms
 * en lettres d'or — ses AMPOULES s'allument une à une. Un panneau « Acte I »
 * entre côté cour avec la date pendant que les cygnes composent leur cœur.
 * Compte à rebours final en chiffres de music-hall entre deux rangées de
 * loupiotes.
 *
 * Phases : 0 rideau fermé · 1 rise (lever) · 2 scene (lac + cygnes) ·
 *          3 title (enseigne + ampoules) · 4 act (Acte I + cœur) · 5 settled
 */
const WAITS = [950, 950, 1200, 1050, 900];
const PHASES = ['', 'rise', 'scene', 'title', 'act', 'settled'] as const;

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

/** Ampoules du pourtour de l'enseigne (292×132). */
const BULBS: ReadonlyArray<{ x: number; y: number }> = [
  { x: 24, y: 7 },
  { x: 65, y: 7 },
  { x: 106, y: 7 },
  { x: 146, y: 7 },
  { x: 186, y: 7 },
  { x: 227, y: 7 },
  { x: 268, y: 7 },
  { x: 268, y: 66 },
  { x: 268, y: 125 },
  { x: 227, y: 125 },
  { x: 186, y: 125 },
  { x: 146, y: 125 },
  { x: 106, y: 125 },
  { x: 65, y: 125 },
  { x: 24, y: 125 },
  { x: 24, y: 66 },
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
  const par = useSceneParallax(sceneRef, { enabled: parallax && !isReduced, intensity: 1.6 });
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

  // Marque blanche : l'accent teinte le velours du rideau.
  const tint: CSSProperties = accentColor
    ? ({
        '--c-curt': shiftL(accentColor, -0.18),
        '--c-curt-dk': shiftL(accentColor, -0.34),
      } as CSSProperties)
    : {};

  const stageCls = ['cineT-stage', live && 'live'].filter(Boolean).join(' ');

  const cdCell = (v: number | null, u: string, i: number) => (
    <span className="t-cdc" style={{ '--cdd': `${i * 0.1}s` } as CSSProperties}>
      <b>{v == null ? '—' : String(v).padStart(2, '0')}</b>
      <i>{u}</i>
    </span>
  );

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

            {/* L'ENSEIGNE volée des cintres : les prénoms en titre */}
            <div className="t-flying">
              <span className="t-rope ra" aria-hidden />
              <span className="t-rope rb" aria-hidden />
              <div className="t-board">
                {BULBS.map((b, i) => (
                  <span
                    key={i}
                    className="t-bulb"
                    aria-hidden
                    style={
                      {
                        left: `${b.x}px`,
                        top: `${b.y}px`,
                        '--bd': `${i * 0.07}s`,
                        '--bi': i,
                      } as CSSProperties
                    }
                  />
                ))}
                <span className="t-eyebrow">{t('youreInvited')}</span>
                <b className="t-name">{partnerA}</b>
                <span className="t-star" aria-hidden>
                  ✦
                </span>
                <b className="t-name">{partnerB}</b>
              </div>
            </div>

            {/* Panneau « Acte I » — la date entre côté cour */}
            <div className="t-act">
              <b>{t('actOne')}</b>
              <span>{formattedDate}</span>
              {venueName ? <i>{venueName}</i> : null}
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

        {/* Compte à rebours music-hall */}
        {target != null && (
          <div className="t-cd">
            <span className="lbl">{t('countdownLabel')}</span>
            <span className="t-rule" aria-hidden />
            <div className="row">
              {cdCell(cd?.d ?? null, t('countdownDays'), 0)}
              {cdCell(cd?.h ?? null, t('countdownHours'), 1)}
              {cdCell(cd?.m ?? null, t('countdownMinutes'), 2)}
            </div>
            <span className="t-rule" aria-hidden />
          </div>
        )}
      </div>

      <p className="cineT-cue" style={{ opacity: effectivePhase === 4 ? 1 : 0 }}>
        <span className="t">{t('scrollToDiscover')}</span>
      </p>
    </div>
  );
}
