'use client';

import { useTranslations } from 'next-intl';
import { useReducedMotion } from 'motion/react';
import { useRef, type CSSProperties, type ReactNode } from 'react';
import {
  CinematicSkip,
  useCinematicTimeline,
  useCountdown,
  useSceneParallax,
  type CinematicSceneProps,
} from './shared';
import './cake.css';

/**
 * « La Pièce montée » — le gâteau EST l'invitation. AUCUNE carte.
 *
 * VRAIE 3D : chaque étage est un TAMBOUR CYLINDRIQUE de 10 facettes
 * (rotateY + translateZ, éclairage statique par facette) — l'arc de caméra
 * autour de la pièce montée révèle sa rondeur réelle, et le glaçage se
 * poche facette après facette, en anneau. Les PRÉNOMS sont écrits au
 * cornet sur le fût ; à l'apaisement le gâteau TOURNE doucement sur son
 * plateau. Bougies étagées en profondeur, bannière de date, compte à
 * rebours aux bougies.
 *
 * Phases : 0 vitrine · 1 stack (étages) · 2 pipe (arc + glaçage) · 3 write
 *          (prénoms pochés) · 4 light (bougies + bannière) · 5 settled
 */
const WAITS = [900, 900, 1250, 1100, 900];
const PHASES = ['', 'stack', 'pipe', 'write', 'light', 'settled'] as const;

const FACES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

const CANDLES = [
  { x: -20, z: -14, d: 0 },
  { x: 0, z: 12, d: 0.16 },
  { x: 20, z: -6, d: 0.32 },
] as const;

/** Petit éclat doré quand les bougies prennent. */
const SPARKS: ReadonlyArray<{ x: number; y: number; r: number; d: number }> = [
  { x: -70, y: -60, r: 420, d: 0 },
  { x: -30, y: -84, r: -380, d: 0.06 },
  { x: 26, y: -88, r: 440, d: 0.03 },
  { x: 68, y: -64, r: -400, d: 0.09 },
  { x: -96, y: -28, r: 360, d: 0.12 },
  { x: 96, y: -24, r: -430, d: 0.15 },
] as const;

/** Tambour cylindrique : 10 facettes éclairées selon leur angle. */
function Drum({ cls, r, children }: { cls: string; r: number; children?: ReactNode }) {
  return (
    <div className={`k-tier ${cls}`} style={{ '--fr': `${r}px` } as CSSProperties}>
      <span className="k-top" aria-hidden />
      <div className="k-rot">
        {FACES.map((i) => {
          const rad = (i * 36 * Math.PI) / 180;
          // Éclairage statique par facette (arrondi : ULP SSR ≠ client).
          const fb = (0.84 + 0.17 * Math.max(0, Math.cos(rad))).toFixed(3);
          return (
            <i
              key={i}
              className="k-face"
              aria-hidden
              style={{ '--fy': `${i * 36}deg`, '--fb': fb, '--fi': `${i}` } as CSSProperties}
            />
          );
        })}
        {children}
      </div>
    </div>
  );
}

export function CinematicCake({
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
    'cineK-scene',
    'cineK',
    isReduced && 'reduced',
    holdPhase != null && 'frozen',
    ...PHASES.slice(1, effectivePhase + 1),
  ]
    .filter(Boolean)
    .join(' ');

  const stageCls = ['cineK-stage', live && 'live'].filter(Boolean).join(' ');

  const cdCell = (v: number | null, u: string, i: number) => (
    <span className="k-cdc" style={{ '--cdd': `${i * 0.13}s` } as CSSProperties}>
      <span className="k-cd-candle">
        <span className="k-flame" />
      </span>
      <b>{v == null ? '—' : String(v).padStart(2, '0')}</b>
      <i>{u}</i>
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
        <div className="kx-camera">
          <div className="kx-par">
            <span className="kx-backwall" aria-hidden />
            <span className="kx-spot" aria-hidden />

            <div className="k-cake">
              <span className="k-shadow" aria-hidden />
              <span className="k-glow" aria-hidden />

              <span className="k-stand" aria-hidden>
                <i className="pl" />
                <i className="ft" />
                <i className="bs" />
              </span>

              <Drum cls="kt1" r={100}>
                <span className="k-name">
                  <span className="txt">{partnerB}</span>
                </span>
              </Drum>
              <Drum cls="kt2" r={78}>
                <span className="k-name">
                  <span className="txt">{partnerA}</span>
                </span>
              </Drum>
              <Drum cls="kt3" r={52} />

              <span className="k-amp" aria-hidden>
                ♥
              </span>

              <div className="k-candles" aria-hidden>
                {CANDLES.map((c, i) => (
                  <span
                    key={i}
                    className="k-candle"
                    style={
                      {
                        '--cx': `${c.x}px`,
                        '--cz': `${c.z}px`,
                        '--kd': `${c.d}s`,
                      } as CSSProperties
                    }
                  >
                    <span className="k-flame" />
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Bannière de date + éclats — ancrés à la scène (hors contexte 3D :
            le tri en profondeur des tambours à facettes est peu fiable). */}
        <div className="k-banner" aria-hidden={effectivePhase < 4}>
          <span className="k-pole pa" />
          <span className="k-pole pb" />
          <span className="k-ribbon">
            {formattedDate}
            {venueName ? ` · ${venueName}` : ''}
          </span>
        </div>
        <span className="k-sparks" aria-hidden>
          {SPARKS.map((p, i) => (
            <i
              key={i}
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
        </span>

        {/* Compte à rebours aux bougies */}
        {target != null && (
          <div className="k-cd">
            <span className="lbl">{t('countdownLabel')}</span>
            <div className="row">
              {cdCell(cd?.d ?? null, t('countdownDays'), 0)}
              {cdCell(cd?.h ?? null, t('countdownHours'), 1)}
              {cdCell(cd?.m ?? null, t('countdownMinutes'), 2)}
            </div>
          </div>
        )}
      </div>

      <p className="cineK-cue" style={{ opacity: effectivePhase === 4 ? 1 : 0 }}>
        <span className="t">{t('scrollToDiscover')}</span>
      </p>
    </div>
  );
}
