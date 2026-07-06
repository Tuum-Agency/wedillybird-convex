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
import './cake.css';

/**
 * « La Pièce montée » — cinématique gourmande & festive.
 *
 * Une pièce montée se dresse sous le projecteur : les étages tombent et
 * s'empilent en rebond, le glaçage coule, les bougies s'allument — puis le
 * sommet se soulève comme un couvercle et la carte s'élève de l'intérieur
 * dans une pluie de confettis. Le gâteau s'apaise en veilleuse derrière le
 * compte à rebours, flammes toujours vivantes.
 *
 * Phases : 0 scène · 1 stack (étages) · 2 light (bougies) · 3 reveal
 *          (couvercle + carte) · 4 named (prénoms + confettis) · 5 settled
 */
const WAITS = [850, 820, 950, 1000, 950];
const PHASES = ['', 'stack', 'light', 'reveal', 'named', 'settled'] as const;

const CANDLES = [
  { x: -22, d: 0 },
  { x: 0, d: 0.14 },
  { x: 22, d: 0.28 },
] as const;

/** Burst de confettis (one-shot au moment des prénoms). */
const CONFETTI: ReadonlyArray<{ x: number; y: number; r: number; d: number; c: number }> = [
  { x: -128, y: -104, r: 640, d: 0, c: 0 },
  { x: -96, y: -150, r: -520, d: 0.05, c: 1 },
  { x: -58, y: -180, r: 700, d: 0.02, c: 2 },
  { x: -20, y: -196, r: -560, d: 0.08, c: 0 },
  { x: 24, y: -190, r: 610, d: 0.04, c: 1 },
  { x: 66, y: -172, r: -680, d: 0.1, c: 2 },
  { x: 104, y: -138, r: 540, d: 0.06, c: 0 },
  { x: 136, y: -92, r: -600, d: 0.12, c: 1 },
  { x: -142, y: -48, r: 580, d: 0.09, c: 2 },
  { x: 148, y: -34, r: -640, d: 0.14, c: 0 },
  { x: -70, y: -206, r: 520, d: 0.16, c: 1 },
  { x: 82, y: -200, r: -580, d: 0.18, c: 2 },
] as const;

/** Confettis paresseux en boucle à l'état apaisé. */
const DRIFT = [
  { x: 22, d: 0, t: 8.5 },
  { x: 52, d: 2.8, t: 10 },
  { x: 80, d: 5.4, t: 9 },
] as const;

export function CinematicCake({
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
    'cineK-scene',
    'cineK',
    isReduced && 'reduced',
    holdPhase != null && 'frozen',
    ...PHASES.slice(1, effectivePhase + 1),
  ]
    .filter(Boolean)
    .join(' ');

  const tint: CSSProperties = accentColor
    ? ({
        '--c-ice': shiftL(accentColor, 0.16),
        '--c-ice-dk': shiftL(accentColor, 0.02),
        '--c-accent': shiftL(accentColor, -0.24),
      } as CSSProperties)
    : {};

  const initials = `${(partnerA.trim()[0] ?? '').toUpperCase()}&${(partnerB.trim()[0] ?? '').toUpperCase()}`;

  const stageCls = ['cineK-stage', 'paper-grain', live && 'live'].filter(Boolean).join(' ');
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
        <div className="fx-light kx-light" aria-hidden />

        <div className="kx-camera">
          <div className="kx-par">
            <div className="kx-spot" aria-hidden />

            <div className="cake" aria-hidden>
              <div className="k-shadow" />
              <div className="k-glow" />
              <div className="k-burst" />

              <div className="k-stand">
                <span className="plate" />
                <span className="foot" />
                <span className="pbase" />
              </div>

              <div className="tier t1">
                <span className="ice" />
              </div>
              <div className="tier t2">
                <span className="ice" />
                <span className="mono">{initials}</span>
              </div>

              <div className="k-lid">
                <div className="tier t3">
                  <span className="ice" />
                </div>
                <div className="candles">
                  {CANDLES.map((c, i) => (
                    <span
                      key={i}
                      className="candle"
                      style={{ '--cx': `${c.x}px`, '--kd': `${c.d}s` } as CSSProperties}
                    >
                      <span className="flame" />
                    </span>
                  ))}
                </div>
              </div>
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

            <div className="kx-confetti" aria-hidden>
              {CONFETTI.map((p, i) => (
                <span
                  key={i}
                  className={`cf c${p.c}`}
                  style={
                    {
                      '--kx': `${p.x}px`,
                      '--ky': `${p.y}px`,
                      '--kr': `${p.r}deg`,
                      '--kd': `${p.d}s`,
                    } as CSSProperties
                  }
                />
              ))}
            </div>
            <div className="kx-drift" aria-hidden>
              {DRIFT.map((f, i) => (
                <span
                  key={i}
                  className={`cf c${i % 3}`}
                  style={
                    { '--fx': `${f.x}%`, '--fd': `${f.d}s`, '--ft': `${f.t}s` } as CSSProperties
                  }
                />
              ))}
            </div>
          </div>
        </div>

        {target != null && <CinematicCountdown cd={cd} className="cineK-after" />}
      </div>

      <p className="cineK-cue" style={{ opacity: effectivePhase === 4 ? 1 : 0 }}>
        <span className="t">{t('scrollToDiscover')}</span>
      </p>
    </div>
  );
}
