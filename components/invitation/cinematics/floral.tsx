'use client';

import { useTranslations } from 'next-intl';
import { useReducedMotion } from 'motion/react';
import { useRef, type CSSProperties } from 'react';
import {
  CinematicCountdown,
  CinematicSkip,
  dustStyle,
  shiftL,
  useCinematicTimeline,
  useCountdown,
  useSceneParallax,
  type CinematicSceneProps,
} from './shared';
import './floral.css';

/**
 * « L'Éclosion » — cinématique florale.
 *
 * Un bouquet naît à l'aube : les tiges s'élancent, les feuilles se déplient,
 * les pivoines éclosent pétale par pétale, puis le bouquet s'écarte pour
 * laisser monter la carte — il se resserre enfin en guirlande au pied du
 * compte à rebours pendant que des pétales se détachent et tombent.
 *
 * Phases : 0 aube · 1 grow (tiges) · 2 bud (boutons) · 3 bloom (éclosion)
 *          · 4 reveal (carte + prénoms) · 5 settled (guirlande + pétales)
 */
const WAITS = [850, 700, 950, 1050, 950];
const PHASES = ['', 'grow', 'bud', 'bloom', 'reveal', 'settled'] as const;

/** Tiges du bouquet : angle (deg), hauteur (px), taille de fleur (px), délais. */
const STEMS: ReadonlyArray<{ a: number; h: number; fs: number; d: number }> = [
  { a: -26, h: 196, fs: 44, d: 0.22 },
  { a: -13, h: 232, fs: 58, d: 0.1 },
  { a: 0, h: 258, fs: 68, d: 0 },
  { a: 13, h: 226, fs: 56, d: 0.16 },
  { a: 26, h: 188, fs: 42, d: 0.3 },
];

const OUTER_PETALS = [0, 1, 2, 3, 4, 5, 6]; // 7 pétales × 51,4°
const INNER_PETALS = [0, 1, 2, 3, 4]; // 5 pétales × 72°

const DUST: ReadonlyArray<{ x: number; y: number; z: number; s: number; d: number }> = [
  { x: 16, y: 30, z: 55, s: 4.5, d: 0 },
  { x: 80, y: 22, z: 30, s: 4, d: 1.4 },
  { x: 28, y: 64, z: 75, s: 3.5, d: 2.2 },
  { x: 68, y: 58, z: 42, s: 5, d: 0.8 },
  { x: 46, y: 16, z: 18, s: 3, d: 2.9 },
  { x: 88, y: 46, z: 66, s: 3.5, d: 1.8 },
  { x: 10, y: 50, z: 24, s: 3, d: 3.3 },
  { x: 56, y: 82, z: 50, s: 4, d: 1.1 },
];

/** Pétales qui se détachent et tombent à l'état apaisé. */
const FALLING = [
  { x: 26, d: 0, t: 9 },
  { x: 58, d: 3.2, t: 11 },
  { x: 78, d: 6.1, t: 10 },
] as const;

export function CinematicFloral({
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
    'cineF-scene',
    'cineF',
    isReduced && 'reduced',
    holdPhase != null && 'frozen',
    ...PHASES.slice(1, effectivePhase + 1),
  ]
    .filter(Boolean)
    .join(' ');

  // Marque blanche : l'accent du couple teinte pétales, cœur et accents.
  const tint: CSSProperties = accentColor
    ? ({
        '--c-petal': shiftL(accentColor, 0.14),
        '--c-petal-dk': shiftL(accentColor, -0.04),
        '--c-petal-deep': shiftL(accentColor, -0.18),
        '--c-accent': shiftL(accentColor, -0.24),
      } as CSSProperties)
    : {};

  const stageCls = ['cineF-stage', 'paper-grain', live && 'live'].filter(Boolean).join(' ');
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
        <div className="fx-light" aria-hidden />

        <div className="fx-camera">
          <div className="fx-par">
            <div className="fx-dust" aria-hidden>
              {DUST.map((p, i) => (
                <span key={i} style={dustStyle(p)} />
              ))}
            </div>

            <div className="bouquet" aria-hidden>
              <div className="b-shadow" />
              <div className="b-glow" />
              {STEMS.map((s, i) => (
                <div
                  key={i}
                  className={`stemg sg${i}`}
                  style={
                    {
                      '--a': `${s.a}deg`,
                      '--h': `${s.h}px`,
                      '--fs': `${s.fs}px`,
                      '--sd': `${s.d}s`,
                    } as CSSProperties
                  }
                >
                  <span className="stem" />
                  <span className="leaf ll" />
                  <span className="leaf lr" />
                  <div className="flower">
                    <span className="f-bud" />
                    {OUTER_PETALS.map((p) => (
                      <span
                        key={`o${p}`}
                        className="petal po"
                        style={{ '--r': `${p * 51.4}deg`, '--pd': `${p * 0.05}s` } as CSSProperties}
                      />
                    ))}
                    {INNER_PETALS.map((p) => (
                      <span
                        key={`i${p}`}
                        className="petal pi"
                        style={
                          {
                            '--r': `${36 + p * 72}deg`,
                            '--pd': `${0.18 + p * 0.05}s`,
                          } as CSSProperties
                        }
                      />
                    ))}
                    <span className="heart" />
                  </div>
                </div>
              ))}
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

            <div className="fall" aria-hidden>
              {FALLING.map((f, i) => (
                <span
                  key={i}
                  style={
                    { '--fx': `${f.x}%`, '--fd': `${f.d}s`, '--ft': `${f.t}s` } as CSSProperties
                  }
                />
              ))}
            </div>
          </div>
        </div>

        {target != null && <CinematicCountdown cd={cd} className="cineF-after" />}
      </div>

      <p className="cineF-cue" style={{ opacity: effectivePhase === 4 ? 1 : 0 }}>
        <span className="t">{t('scrollToDiscover')}</span>
      </p>
    </div>
  );
}
