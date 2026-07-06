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
import './rivage.css';

/**
 * « Le Rivage » — la mer écrit dans le sable.
 *
 * Plage à l'aube, vue plongeante : une première langue d'écume lèche le
 * sable… puis la GRANDE vague monte, recouvre le rivage et SE RETIRE — les
 * prénoms restent ÉCRITS DANS LE SABLE derrière elle (creusés, ombre et
 * lumière rasante). Une esperluette se dessine en volute, deux bulles
 * d'écume éclatent, et la date arrive plantée sur une PANCARTE EN BOIS
 * FLOTTÉ. Compte à rebours gravé sur trois GALETS polis.
 *
 * Phases : 0 aube · 1 tide (première langue) · 2 wash (la grande vague) ·
 *          3 carve (volute &) · 4 plank (bois flotté) · 5 settled
 */
const WAITS = [900, 1000, 1250, 1000, 900];
const PHASES = ['', 'tide', 'wash', 'carve', 'plank', 'settled'] as const;

/** Bulles d'écume laissées par la vague. */
const BUBBLES: ReadonlyArray<{ x: number; y: number; d: number }> = [
  { x: 84, y: 218, d: 0 },
  { x: 262, y: 246, d: 0.5 },
  { x: 150, y: 200, d: 0.9 },
];

export function CinematicRivage({
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
    'cineR-scene',
    'cineR',
    isReduced && 'reduced',
    holdPhase != null && 'frozen',
    ...PHASES.slice(1, effectivePhase + 1),
  ]
    .filter(Boolean)
    .join(' ');

  const stageCls = ['cineR-stage', live && 'live'].filter(Boolean).join(' ');

  const pebble = (v: number | null, u: string, i: number) => (
    <span
      className="rv-peb"
      style={{ '--pd': `${i * 0.16}s`, '--pr': `${i - 1}deg` } as CSSProperties}
    >
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
        <div className="rx-camera">
          <div className="rx-par">
            {/* Sable + coquillages */}
            <span className="rv-sand" aria-hidden />
            <span className="rv-shell sa" aria-hidden />
            <span className="rv-shell sb" aria-hidden />
            <span className="rv-star" aria-hidden />

            {/* Prénoms écrits dans le sable (révélés par le retrait) */}
            <div className="rv-names">
              <span className="rv-eyebrow">{t('youreInvited')}</span>
              <b className="rv-name na">{partnerA}</b>
              <svg className="rv-swirl" viewBox="0 0 120 34" aria-hidden>
                <path d="M14 22 C 34 4, 52 30, 68 16 C 78 7, 92 10, 104 14" fill="none" />
                <text x="60" y="26">
                  &amp;
                </text>
              </svg>
              <b className="rv-name nb">{partnerB}</b>
            </div>

            {/* Bulles d'écume résiduelles */}
            <div className="rv-bubbles" aria-hidden>
              {BUBBLES.map((b, i) => (
                <span
                  key={i}
                  style={{ left: `${b.x}px`, top: `${b.y}px`, '--bd': `${b.d}s` } as CSSProperties}
                />
              ))}
            </div>

            {/* La mer + son écume (balayages en keyframes one-shot) */}
            <div className="rv-sea" aria-hidden>
              <span className="rv-deep" />
              <span className="rv-glint g1" />
              <span className="rv-glint g2" />
              <span className="rv-foam" />
            </div>

            {/* Pancarte en bois flotté */}
            <div className="rv-plank">
              <span className="rv-knot" aria-hidden />
              <b>{formattedDate}</b>
              {venueName ? <i>{venueName}</i> : null}
            </div>
          </div>
        </div>

        {/* Compte à rebours sur galets */}
        {target != null && (
          <div className="rv-cd">
            <span className="lbl">{t('countdownLabel')}</span>
            <div className="row">
              {pebble(cd?.d ?? null, t('countdownDays'), 0)}
              {pebble(cd?.h ?? null, t('countdownHours'), 1)}
              {pebble(cd?.m ?? null, t('countdownMinutes'), 2)}
            </div>
          </div>
        )}
      </div>

      <p className="cineR-cue" style={{ opacity: effectivePhase === 4 ? 1 : 0 }}>
        <span className="t">{t('scrollToDiscover')}</span>
      </p>
    </div>
  );
}
