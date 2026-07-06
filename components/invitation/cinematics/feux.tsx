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
import './feux.css';

/**
 * « Le Feu d'artifice » — la nuit de fête.
 *
 * Nuit d'été au-dessus des arbres : deux fusées montent en sifflant, deux
 * GERBES éclatent (étincelles balistiques, anneau d'onde), puis le BOUQUET
 * FINAL : un grand éclat central dont le FLASH révèle les prénoms en or —
 * ils restent suspendus, escortés d'étincelles. Des braises flottent, de
 * petites gerbes lointaines ponctuent l'apaisement. Compte à rebours sur
 * trois cartouches noirs à mèche d'étincelles.
 *
 * Phases : 0 nuit · 1 hush (attente) · 2 launch (fusées) · 3 burst
 *          (gerbes) · 4 names (bouquet + flash) · 5 settled
 */
const WAITS = [850, 800, 1000, 1150, 950];
const PHASES = ['', 'hush', 'launch', 'burst', 'names', 'settled'] as const;

const SPARK_COUNT = 16;
/** Directions d'une gerbe (angle régulier + rayon légèrement varié). */
function sparks(radius: number): Array<{ tx: number; ty: number; ra: number; d: number }> {
  const out: Array<{ tx: number; ty: number; ra: number; d: number }> = [];
  for (let i = 0; i < SPARK_COUNT; i++) {
    const a = (i / SPARK_COUNT) * Math.PI * 2;
    const r = radius * (0.66 + 0.34 * (((i * 7) % 5) / 4));
    // Arrondi à 2 décimales : le dernier ULP de Math.sin/cos diffère entre
    // le rendu serveur et le client → mismatch d'hydratation sinon.
    out.push({
      tx: Number((Math.cos(a) * r).toFixed(2)),
      ty: Number((Math.sin(a) * r).toFixed(2)),
      // Orientation RADIALE du trait (0° = vertical, le long de la trajectoire).
      ra: Number((((a * 180) / Math.PI + 90) % 360).toFixed(1)),
      d: (i % 4) * 0.03,
    });
  }
  return out;
}
const BURST_A = sparks(78);
const BURST_B = sparks(64);
const BURST_C = sparks(105);

const EMBERS: ReadonlyArray<{ x: number; d: number }> = [
  { x: 20, d: 0 },
  { x: 52, d: 2.1 },
  { x: 78, d: 4.2 },
];

function Burst({
  cls,
  parts,
  color,
}: {
  cls: string;
  parts: ReadonlyArray<{ tx: number; ty: number; ra: number; d: number }>;
  color: 0 | 1;
}) {
  return (
    <div className={`fw-burst ${cls}`} aria-hidden>
      <span className="fw-ring" />
      {parts.map((p, i) => (
        <i
          key={i}
          className={`fw-spark c${(i + color) % 2}`}
          style={
            {
              '--tx': `${p.tx}px`,
              '--ty': `${p.ty}px`,
              '--ra': `${p.ra.toFixed(1)}deg`,
              '--sd': `${p.d}s`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

export function CinematicFeux({
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
    'cineW-scene',
    'cineW',
    isReduced && 'reduced',
    holdPhase != null && 'frozen',
    ...PHASES.slice(1, effectivePhase + 1),
  ]
    .filter(Boolean)
    .join(' ');

  const stageCls = ['cineW-stage', live && 'live'].filter(Boolean).join(' ');

  const cdCell = (v: number | null, u: string, i: number) => (
    <span className="fw-cdc" style={{ '--cdd': `${i * 0.15}s` } as CSSProperties}>
      <b>
        <i className="fuse" aria-hidden />
        {v == null ? '—' : String(v).padStart(2, '0')}
      </b>
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
        <div className="wx-camera">
          <div className="wx-par">
            {/* Nuit + silhouettes d'arbres + guirlande lointaine */}
            <span className="fw-trees ta" aria-hidden />
            <span className="fw-trees tb" aria-hidden />
            <span className="fw-garland" aria-hidden />

            {/* Braises flottantes */}
            <div className="fw-embers" aria-hidden>
              {EMBERS.map((e, i) => (
                <span key={i} style={{ left: `${e.x}%`, '--ed': `${e.d}s` } as CSSProperties} />
              ))}
            </div>

            {/* Fusées */}
            <span className="fw-rocket r1" aria-hidden />
            <span className="fw-rocket r2" aria-hidden />

            {/* Gerbes */}
            <Burst cls="ba" parts={BURST_A} color={0} />
            <Burst cls="bb" parts={BURST_B} color={1} />
            <Burst cls="bc" parts={BURST_C} color={0} />
            <span className="fw-flash" aria-hidden />

            {/* Les prénoms révélés par le bouquet final */}
            <div className="fw-names">
              <span className="fw-eyebrow">{t('youreInvited')}</span>
              <b className="fw-name na">{partnerA}</b>
              <span className="fw-amp" aria-hidden>
                ✦
              </span>
              <b className="fw-name nb">{partnerB}</b>
              <span className="fw-date">
                {formattedDate}
                {venueName ? ` · ${venueName}` : ''}
              </span>
            </div>

            {/* Petites gerbes lointaines à l'apaisement */}
            <span className="fw-far fa" aria-hidden />
            <span className="fw-far fb" aria-hidden />
          </div>
        </div>

        {/* Compte à rebours en cartouches à mèche */}
        {target != null && (
          <div className="fw-cd">
            <span className="lbl">{t('countdownLabel')}</span>
            <div className="row">
              {cdCell(cd?.d ?? null, t('countdownDays'), 0)}
              {cdCell(cd?.h ?? null, t('countdownHours'), 1)}
              {cdCell(cd?.m ?? null, t('countdownMinutes'), 2)}
            </div>
          </div>
        )}
      </div>

      <p className="cineW-cue" style={{ opacity: effectivePhase === 4 ? 1 : 0 }}>
        <span className="t">{t('scrollToDiscover')}</span>
      </p>
    </div>
  );
}
