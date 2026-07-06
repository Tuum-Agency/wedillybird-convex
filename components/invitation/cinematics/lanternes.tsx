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
import './lanternes.css';

/**
 * « Les Lanternes » — la lumière porte les prénoms.
 *
 * Crépuscule sur l'eau : des lucioles clignotent, cinq petites lanternes
 * s'allument une à une le long de l'horizon… puis la GRANDE lanterne
 * s'embrase (flamme vivante) et toutes S'ÉLÈVENT dans la nuit — les prénoms
 * apparaissent EN TRANSPARENCE à travers le papier de la grande, éclairés
 * de l'intérieur, la date se déroule sur un ruban de papier suspendu.
 * Compte à rebours en trois lanternes miniatures, chiffres lumineux.
 *
 * Phases : 0 crépuscule · 1 gather (petites lanternes) · 2 ignite (la
 *          grande s'embrase) · 3 rise (envol) · 4 names · 5 settled
 */
const WAITS = [900, 900, 1150, 1050, 900];
const PHASES = ['', 'gather', 'ignite', 'rise', 'names', 'settled'] as const;

/** Petites lanternes : x (px scène), délai, profondeur, dérive d'envol. */
const SMALL: ReadonlyArray<{ x: number; d: number; z: number; ry: number; dx: number }> = [
  { x: 52, d: 0, z: -30, ry: -168, dx: -14 },
  { x: 112, d: 0.22, z: 18, ry: -120, dx: 10 },
  { x: 236, d: 0.12, z: 24, ry: -132, dx: -8 },
  { x: 296, d: 0.3, z: -22, ry: -180, dx: 14 },
  { x: 178, d: 0.4, z: -46, ry: -210, dx: 4 },
];

const FIREFLIES: ReadonlyArray<{ x: number; y: number; d: number }> = [
  { x: 14, y: 46, d: 0 },
  { x: 84, y: 38, d: 1.6 },
  { x: 30, y: 66, d: 2.8 },
  { x: 68, y: 60, d: 0.9 },
];

export function CinematicLanternes({
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
    'cineL-scene',
    'cineL',
    isReduced && 'reduced',
    holdPhase != null && 'frozen',
    ...PHASES.slice(1, effectivePhase + 1),
  ]
    .filter(Boolean)
    .join(' ');

  const stageCls = ['cineL-stage', live && 'live'].filter(Boolean).join(' ');

  const cdCell = (v: number | null, u: string, i: number) => (
    <span className="ln-cdc" style={{ '--cdd': `${i * 0.16}s` } as CSSProperties}>
      <span className="ln-mini">
        <i className="cap" />
        <b>{v == null ? '—' : String(v).padStart(2, '0')}</b>
        <i className="rim" />
      </span>
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
        <div className="lx-camera">
          <div className="lx-par">
            <span className="ln-horizon" aria-hidden />
            <span className="ln-water" aria-hidden />

            <div className="ln-flies" aria-hidden>
              {FIREFLIES.map((f, i) => (
                <span
                  key={i}
                  style={{ left: `${f.x}%`, top: `${f.y}%`, '--fd': `${f.d}s` } as CSSProperties}
                />
              ))}
            </div>

            {/* Petites lanternes le long de l'horizon */}
            <div className="ln-smalls" aria-hidden>
              {SMALL.map((s, i) => (
                <span
                  key={i}
                  className="ln-small"
                  style={
                    {
                      left: `${s.x}px`,
                      '--ld': `${s.d}s`,
                      '--lz': `${s.z}px`,
                      '--lry': `${s.ry}px`,
                      '--ldx': `${s.dx}px`,
                    } as CSSProperties
                  }
                >
                  <i className="glow" />
                </span>
              ))}
            </div>

            {/* La grande lanterne */}
            <div className="ln-big">
              <span className="ln-glowhalo" aria-hidden />
              <span className="ln-cap" aria-hidden />
              <div className="ln-paper">
                <span className="ln-flame" aria-hidden />
                <span className="ln-eyebrow">{t('youreInvited')}</span>
                <b className="ln-name">{partnerA}</b>
                <span className="ln-amp" aria-hidden>
                  &amp;
                </span>
                <b className="ln-name nb">{partnerB}</b>
              </div>
              <span className="ln-rim" aria-hidden />
              <span className="ln-tassel" aria-hidden />
              {/* Ruban de date suspendu */}
              <span className="ln-ribbon">
                {formattedDate}
                {venueName ? ` · ${venueName}` : ''}
              </span>
            </div>
          </div>
        </div>

        {/* Compte à rebours en lanternes miniatures */}
        {target != null && (
          <div className="ln-cd">
            <span className="lbl">{t('countdownLabel')}</span>
            <div className="row">
              {cdCell(cd?.d ?? null, t('countdownDays'), 0)}
              {cdCell(cd?.h ?? null, t('countdownHours'), 1)}
              {cdCell(cd?.m ?? null, t('countdownMinutes'), 2)}
            </div>
          </div>
        )}
      </div>

      <p className="cineL-cue" style={{ opacity: effectivePhase === 4 ? 1 : 0 }}>
        <span className="t">{t('scrollToDiscover')}</span>
      </p>
    </div>
  );
}
