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
import './neige.css';

/**
 * « Premier flocon » — l'hiver à la fenêtre.
 *
 * La neige tombe sur les sapins ; le GIVRE gagne la vitre — quatre fougères
 * de glace SE DESSINENT depuis les bords et le verre se voile… puis un
 * CERCLE DE CHALEUR essuie la buée (clip-path qui s'ouvre) : derrière la
 * vitre, une pièce à la lueur d'une bougie, où les prénoms apparaissent
 * dans un halo doré. La neige continue de tomber dehors. Compte à rebours
 * en trois BOULES DE NOËL givrées suspendues à leurs rubans.
 *
 * Phases : 0 chute · 1 snow (la neige s'installe) · 2 frost (fougères +
 *          buée) · 3 wipe (le cercle chaud) · 4 names · 5 settled
 */
const WAITS = [900, 950, 1100, 1050, 900];
const PHASES = ['', 'snow', 'frost', 'wipe', 'names', 'settled'] as const;

/** Flocons : x %, taille, durée, délai, dérive. */
const FLAKES: ReadonlyArray<{ x: number; s: number; t: number; d: number; w: number; z: number }> =
  [
    { x: 6, s: 7, t: 9, d: 0, w: 18, z: 60 },
    { x: 16, s: 5, t: 11, d: 2.2, w: -14, z: -150 },
    { x: 28, s: 8.5, t: 8, d: 4.1, w: 12, z: 130 },
    { x: 40, s: 6, t: 10, d: 1.3, w: -18, z: -80 },
    { x: 52, s: 7.5, t: 9.5, d: 5.6, w: 16, z: 30 },
    { x: 64, s: 5, t: 11.5, d: 0.7, w: -12, z: -190 },
    { x: 76, s: 8.5, t: 8.5, d: 3.4, w: 14, z: 90 },
    { x: 88, s: 6, t: 10.5, d: 6.2, w: -16, z: -50 },
    { x: 95, s: 7, t: 9, d: 1.9, w: 10, z: -120 },
    { x: 34, s: 4.5, t: 12, d: 7.1, w: -10, z: -20 },
    { x: 12, s: 5.5, t: 10.5, d: 3.8, w: 14, z: 100 },
    { x: 46, s: 4.5, t: 11.5, d: 6.7, w: -12, z: -170 },
    { x: 70, s: 6.5, t: 9.8, d: 1.1, w: 16, z: 40 },
    { x: 84, s: 5, t: 12.5, d: 4.9, w: -14, z: -100 },
  ];

export function CinematicNeige({
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
  const par = useSceneParallax(sceneRef, { enabled: parallax && !isReduced, intensity: 1.6 });
  const cd = useCountdown(eventDate);
  const target = eventDate != null ? new Date(eventDate).getTime() : null;

  const sceneCls = [
    'cineN-scene',
    'cineN',
    isReduced && 'reduced',
    holdPhase != null && 'frozen',
    ...PHASES.slice(1, effectivePhase + 1),
  ]
    .filter(Boolean)
    .join(' ');

  const stageCls = ['cineN-stage', live && 'live'].filter(Boolean).join(' ');

  const fern = (cls: string, d: string) => (
    <svg className={`ng-fern ${cls}`} viewBox="0 0 100 100" aria-hidden>
      <path d={d} fill="none" />
    </svg>
  );

  const bauble = (v: number | null, u: string, i: number) => (
    <span
      className="ng-bb"
      style={{ '--bd': `${i * 0.16}s`, '--br': `${(i - 1) * 2}deg` } as CSSProperties}
    >
      <i className="ribbon" aria-hidden />
      <b>
        <em className="cap" aria-hidden />
        {v == null ? '—' : String(v).padStart(2, '0')}
      </b>
      <em className="unit">{u}</em>
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
        <div className="nx-camera">
          <div className="nx-par">
            {/* Dehors : sapins sous la neige */}
            <span className="ng-pines pa" aria-hidden />
            <span className="ng-pines pb" aria-hidden />

            {/* Le givre : voile + fougères de glace */}
            <div className="ng-frost" aria-hidden>
              {fern(
                'fa',
                'M8 96 C 26 80, 38 60, 44 34 M13 87 C 7 83, 4 78, 3 71 M20 77 C 13 73, 9 67, 8 60 M28 65 C 21 61, 17 55, 16 48 M35 51 C 29 48, 25 43, 24 36',
              )}
              {fern(
                'fb',
                'M92 96 C 74 80, 62 60, 56 34 M87 87 C 93 83, 96 78, 97 71 M80 77 C 87 73, 91 67, 92 60 M72 65 C 79 61, 83 55, 84 48 M65 51 C 71 48, 75 43, 76 36',
              )}
              {fern(
                'fc',
                'M6 6 C 24 20, 36 38, 42 62 M13 16 C 7 20, 4 25, 3 32 M21 27 C 14 31, 10 37, 9 44 M29 41 C 22 45, 18 51, 17 58',
              )}
              {fern(
                'fd',
                'M94 6 C 76 20, 64 38, 58 62 M87 16 C 93 20, 96 25, 97 32 M79 27 C 86 31, 90 37, 91 44 M71 41 C 78 45, 82 51, 83 58',
              )}
            </div>

            {/* Le cercle de chaleur (essuie la buée) */}
            <div className="ng-warm">
              <span className="ng-candle" aria-hidden>
                <i className="flame" />
              </span>
              <div className="ng-names">
                <span className="ng-eyebrow">{t('youreInvited')}</span>
                <b className="ng-name na">{partnerA}</b>
                <span className="ng-amp" aria-hidden>
                  &amp;
                </span>
                <b className="ng-name nb">{partnerB}</b>
                <span className="ng-date">
                  {formattedDate}
                  {venueName ? ` · ${venueName}` : ''}
                </span>
              </div>
            </div>

            {/* La neige (au premier plan, toujours) */}
            <div className="ng-snow" aria-hidden>
              {FLAKES.map((f, i) => (
                <span
                  key={i}
                  style={
                    {
                      left: `${f.x}%`,
                      width: f.s,
                      height: f.s,
                      '--ft': `${f.t}s`,
                      '--fd': `${f.d}s`,
                      '--fw': `${f.w}px`,
                      '--fz': `${f.z}px`,
                    } as CSSProperties
                  }
                />
              ))}
            </div>
          </div>
        </div>

        {/* Compte à rebours en boules givrées */}
        {target != null && (
          <div className="ng-cd">
            <span className="lbl">{t('countdownLabel')}</span>
            <div className="row">
              {bauble(cd?.d ?? null, t('countdownDays'), 0)}
              {bauble(cd?.h ?? null, t('countdownHours'), 1)}
              {bauble(cd?.m ?? null, t('countdownMinutes'), 2)}
            </div>
          </div>
        )}
      </div>

      <p className="cineN-cue" style={{ opacity: effectivePhase === 4 ? 1 : 0 }}>
        <span className="t">{t('scrollToDiscover')}</span>
      </p>
    </div>
  );
}
