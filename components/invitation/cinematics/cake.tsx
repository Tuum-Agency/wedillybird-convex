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
import './cake.css';

/**
 * « La Pièce montée » — le gâteau EST l'invitation. AUCUNE carte.
 *
 * Vitrine de pâtissier à la nuit tombée : les étages tombent et rebondissent
 * sous le projecteur, la caméra fait un ARC autour de la pièce montée
 * (parallaxe réelle entre étages) pendant que le glaçage se poche — festons,
 * perles… puis LES PRÉNOMS EUX-MÊMES, écrits au cornet sur les étages, un
 * cœur de glaçage entre les deux. Les bougies s'allument, une bannière
 * portant la date se déroule entre deux piques. Le compte à rebours final :
 * trois bougies dont les flammes veillent sur les chiffres.
 *
 * Phases : 0 vitrine · 1 stack (étages) · 2 pipe (arc + glaçage) · 3 write
 *          (prénoms pochés) · 4 light (bougies + bannière) · 5 settled
 */
const WAITS = [900, 900, 1250, 1100, 900];
const PHASES = ['', 'stack', 'pipe', 'write', 'light', 'settled'] as const;

const CANDLES = [
  { x: -20, d: 0 },
  { x: 0, d: 0.16 },
  { x: 20, d: 0.32 },
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
      } as CSSProperties)
    : {};

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

              <div className="k-tier kt1" aria-hidden={false}>
                <span className="k-ice" />
                <span className="k-pearls" />
                <span className="k-name">
                  <span className="txt">{partnerB}</span>
                </span>
              </div>
              <div className="k-tier kt2">
                <span className="k-ice" />
                <span className="k-pearls" />
                <span className="k-name">
                  <span className="txt">{partnerA}</span>
                </span>
              </div>
              <div className="k-tier kt3" aria-hidden>
                <span className="k-ice" />
                <span className="k-pearls" />
              </div>

              <span className="k-amp" aria-hidden>
                ♥
              </span>

              <div className="k-candles" aria-hidden>
                {CANDLES.map((c, i) => (
                  <span
                    key={i}
                    className="k-candle"
                    style={{ '--cx': `${c.x}px`, '--kd': `${c.d}s` } as CSSProperties}
                  >
                    <span className="k-flame" />
                  </span>
                ))}
              </div>

              {/* Bannière de date entre deux piques */}
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
            </div>
          </div>
        </div>

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
