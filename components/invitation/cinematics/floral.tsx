'use client';

import { useTranslations } from 'next-intl';
import { useReducedMotion } from 'motion/react';
import { useRef, type CSSProperties } from 'react';
import {
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
 * « L'Éclosion » — le jardin écrit l'invitation. AUCUNE carte : la nature
 * fait tout.
 *
 * La caméra démarre au ras du pré ; les tiges s'élancent et elle monte avec
 * elles ; une arche de blossoms se compose dans le ciel ; les prénoms
 * S'ÉCRIVENT À L'ENCRE sous l'arche (révélation calligraphique + parafe doré
 * qui se trace) ; la date descend du sommet de l'arche sur une ÉTIQUETTE
 * SUSPENDUE qui se balance ; enfin le compte à rebours fleurit — trois
 * blossoms dont les cœurs portent les chiffres, pétales au vent.
 *
 * Phases : 0 pré à l'aube · 1 grow (tiges + caméra qui monte) · 2 bloom
 *          (fleurs + arche) · 3 write (encre + parafe) · 4 tag (étiquette)
 *          · 5 settled (compte à rebours fleuri + pétales)
 */
const WAITS = [950, 900, 1150, 950, 900];
const PHASES = ['', 'grow', 'bloom', 'write', 'tag', 'settled'] as const;

/** Tiges du pré : x (px scène), hauteur, taille de fleur, délai. */
const STEMS: ReadonlyArray<{ x: number; h: number; fs: number; d: number }> = [
  { x: 34, h: 200, fs: 40, d: 0.15 },
  { x: 78, h: 152, fs: 30, d: 0.35 },
  { x: 128, h: 122, fs: 24, d: 0.5 },
  { x: 232, h: 128, fs: 26, d: 0.42 },
  { x: 286, h: 168, fs: 34, d: 0.28 },
  { x: 326, h: 210, fs: 42, d: 0.08 },
];

/** Blossoms flottants de l'arche (arc au-dessus des prénoms). */
const ARCH: ReadonlyArray<{ x: number; y: number; fs: number; d: number }> = [
  { x: 34, y: 268, fs: 30, d: 0.55 },
  { x: 52, y: 196, fs: 38, d: 0.4 },
  { x: 96, y: 136, fs: 32, d: 0.25 },
  { x: 180, y: 108, fs: 44, d: 0 },
  { x: 264, y: 136, fs: 32, d: 0.3 },
  { x: 308, y: 196, fs: 38, d: 0.45 },
  { x: 326, y: 268, fs: 30, d: 0.6 },
];

const PETALS = [0, 1, 2, 3, 4, 5]; // 6 pétales × 60°

const DUST: ReadonlyArray<{ x: number; y: number; z: number; s: number; d: number }> = [
  { x: 18, y: 34, z: 55, s: 4, d: 0 },
  { x: 78, y: 24, z: 30, s: 3.5, d: 1.4 },
  { x: 30, y: 60, z: 70, s: 3.5, d: 2.2 },
  { x: 64, y: 52, z: 42, s: 4.5, d: 0.8 },
  { x: 46, y: 14, z: 18, s: 3, d: 2.9 },
  { x: 88, y: 44, z: 62, s: 3, d: 1.8 },
];

const FALLING = [
  { x: 22, d: 0, t: 9 },
  { x: 56, d: 3.2, t: 11 },
  { x: 80, d: 6.1, t: 10 },
] as const;

function Blossom({ fs, extra }: { fs: number; extra?: string }) {
  return (
    <span
      className={`f-blossom${extra ? ` ${extra}` : ''}`}
      style={{ '--fs': `${fs}px` } as CSSProperties}
    >
      {PETALS.map((p) => (
        <span
          key={p}
          className="f-petal"
          style={{ '--r': `${p * 60}deg`, '--pd': `${p * 0.05}s` } as CSSProperties}
        />
      ))}
      <span className="f-heart" />
    </span>
  );
}

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

  const tint: CSSProperties = accentColor
    ? ({
        '--c-petal': shiftL(accentColor, 0.14),
        '--c-petal-dk': shiftL(accentColor, -0.04),
        '--c-accent': shiftL(accentColor, -0.24),
      } as CSSProperties)
    : {};

  const stageCls = ['cineF-stage', 'paper-grain', live && 'live'].filter(Boolean).join(' ');

  const cdCell = (v: number | null, u: string, i: number) => (
    <span className="f-cdb-wrap" style={{ '--cdd': `${i * 0.12}s` } as CSSProperties}>
      <Blossom fs={58} extra="cdb" />
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
        <div className="fx-light" aria-hidden />

        <div className="fx-camera">
          <div className="fx-par">
            <div className="fx-dust" aria-hidden>
              {DUST.map((p, i) => (
                <span key={i} style={dustStyle(p)} />
              ))}
            </div>

            {/* Le pré : sol + tiges qui s'élancent */}
            <div className="f-meadow" aria-hidden>
              <span className="f-soil" />
              {STEMS.map((s, i) => (
                <div
                  key={i}
                  className="f-stemg"
                  style={
                    {
                      left: `${s.x}px`,
                      '--h': `${s.h}px`,
                      '--sd': `${s.d}s`,
                      '--sw': `${i % 2 === 0 ? 1 : -1}`,
                    } as CSSProperties
                  }
                >
                  <span className="f-stem" />
                  <span className="f-leaf fl" />
                  <span className="f-leaf fr" />
                  <Blossom fs={s.fs} />
                </div>
              ))}
            </div>

            {/* L'arche de blossoms flottants */}
            <div className="f-arch" aria-hidden>
              {ARCH.map((b, i) => (
                <span
                  key={i}
                  className="f-archspot"
                  style={{ left: `${b.x}px`, top: `${b.y}px`, '--ad': `${b.d}s` } as CSSProperties}
                >
                  <Blossom fs={b.fs} />
                </span>
              ))}
            </div>

            {/* Les prénoms s'écrivent à l'encre sous l'arche */}
            <div className="f-names">
              <span className="f-name na">
                <span className="txt">{partnerA}</span>
              </span>
              <svg className="f-swash" viewBox="0 0 170 26" aria-hidden>
                <path d="M6 15 C 38 4, 66 24, 96 11 C 118 2, 142 12, 164 8" fill="none" />
                <text x="85" y="20">
                  &amp;
                </text>
              </svg>
              <span className="f-name nb">
                <span className="txt">{partnerB}</span>
              </span>
            </div>

            {/* L'étiquette suspendue (date + lieu) */}
            <div className="f-tagwrap" aria-hidden={effectivePhase < 4}>
              <span className="f-string" />
              <div className="f-tag">
                <span className="f-taghole" />
                <b>{formattedDate}</b>
                {venueName ? <i>{venueName}</i> : null}
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

        {/* Compte à rebours fleuri */}
        {target != null && (
          <div className="f-cd">
            <span className="lbl">{t('countdownLabel')}</span>
            <div className="row">
              {cdCell(cd?.d ?? null, t('countdownDays'), 0)}
              {cdCell(cd?.h ?? null, t('countdownHours'), 1)}
              {cdCell(cd?.m ?? null, t('countdownMinutes'), 2)}
            </div>
          </div>
        )}
      </div>

      <p className="cineF-cue" style={{ opacity: effectivePhase === 4 ? 1 : 0 }}>
        <span className="t">{t('scrollToDiscover')}</span>
      </p>
    </div>
  );
}
