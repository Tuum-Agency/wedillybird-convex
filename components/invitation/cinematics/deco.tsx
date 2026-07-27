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
import './deco.css';

/**
 * « L'Art déco » — le gala Gatsby.
 *
 * Noir profond et or : des filets verticaux glissent en place, des ÉVENTAILS
 * EN SOLEIL déploient leurs lamelles une à une (grand au sommet, deux
 * quarts aux angles), puis le DOUBLE CADRE SE DESSINE — traits qui se
 * tirent, motifs en gradins aux coins. Les prénoms arrivent en CAPITALES
 * DORÉES ESPACÉES (l'interlettrage se resserre, un éclat traverse), diamant
 * ◆ en séparateur. Bulles de champagne le long du cadre à l'apaisement.
 * Compte à rebours en cartouches à gradins.
 *
 * En VRAIE PROFONDEUR : caméra qui descend de la mezzanine en arc lent
 * (rotateX/rotateY/dolly), sol de marbre balayé par un reflet, deux
 * PILASTRES cannelés surgis du fond, SOLEIL ART DÉCO déployé derrière la
 * composition. Vie continue : poussière de champagne étagée en Z,
 * impulsions lumineuses le long des filets, onde de lueur sur les rayons,
 * reflet qui traverse le cadre, bulles dès l'arrivée des prénoms.
 *
 * Phases : 0 noir · 1 lines (sol + pilastres + filets) · 2 fans (soleil +
 *          éventails) · 3 frame (le cadre se tire) · 4 names · 5 settled
 */
const WAITS = [900, 1050, 1150, 1100, 950];
const PHASES = ['', 'lines', 'fans', 'frame', 'names', 'settled'] as const;

const CORNER_BLADES = [0, 22, 44, 66, 88];

/** Rayons du soleil art déco (éventail complet au-dessus des prénoms). */
const SUN_RAYS = [-84, -70, -56, -42, -28, -14, 0, 14, 28, 42, 56, 70, 84];

/** Poussière de champagne étagée en profondeur (z = translateZ px). */
const DUST: ReadonlyArray<{ x: number; y: number; z: number; s: number; d: number; t: number }> = [
  { x: 14, y: 78, z: -60, s: 2, d: 0, t: 11 },
  { x: 30, y: 88, z: 30, s: 3, d: 2.2, t: 9 },
  { x: 46, y: 82, z: -30, s: 2.5, d: 4.6, t: 12 },
  { x: 60, y: 90, z: 44, s: 3.5, d: 1.1, t: 8.5 },
  { x: 74, y: 80, z: -70, s: 2, d: 3.4, t: 10.5 },
  { x: 86, y: 86, z: 20, s: 2.5, d: 5.8, t: 9.5 },
  { x: 22, y: 92, z: 50, s: 3, d: 7.2, t: 8 },
  { x: 40, y: 76, z: -50, s: 2, d: 6.1, t: 11.5 },
  { x: 56, y: 94, z: 0, s: 2.5, d: 8.4, t: 10 },
  { x: 70, y: 74, z: 36, s: 3, d: 2.9, t: 9 },
  { x: 90, y: 92, z: -40, s: 2, d: 9.3, t: 12 },
  { x: 8, y: 84, z: 10, s: 2.5, d: 4.1, t: 10 },
];

const BUBBLES: ReadonlyArray<{ x: number; d: number; t: number; s: number }> = [
  { x: 12, d: 0, t: 7, s: 5 },
  { x: 15, d: 2.8, t: 8.5, s: 4 },
  { x: 85, d: 1.4, t: 7.5, s: 5 },
  { x: 88, d: 4.2, t: 9, s: 6 },
  { x: 13, d: 5.5, t: 8, s: 6 },
  { x: 86, d: 6.8, t: 7.8, s: 4 },
  { x: 10, d: 1.9, t: 9.5, s: 4 },
  { x: 90, d: 3.1, t: 8.2, s: 4.5 },
  { x: 17, d: 7.7, t: 7.2, s: 5 },
  { x: 83, d: 8.9, t: 8.8, s: 5 },
];

export function CinematicDeco({
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
    'cineD-scene',
    'cineD',
    isReduced && 'reduced',
    holdPhase != null && 'frozen',
    ...PHASES.slice(1, effectivePhase + 1),
  ]
    .filter(Boolean)
    .join(' ');

  const stageCls = ['cineD-stage', live && 'live'].filter(Boolean).join(' ');

  const cdCell = (v: number | null, u: string, i: number) => (
    <span className="dc-cdc" style={{ '--cdd': `${i * 0.15}s` } as CSSProperties}>
      <b>
        <i className="steps" aria-hidden />
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
        <div className="dx-camera">
          <div className="dx-par">
            {/* Fond de salle (lueur lointaine) */}
            <span className="dx-back" aria-hidden />

            {/* Sol de marbre en perspective, balayé par un reflet */}
            <span className="dc-floor" aria-hidden />

            {/* Architecture de la salle : deux pilastres cannelés flanquent la
                composition, reliés par une corniche à gradins (entablement) en
                haut et une plinthe en bas — la pièce est fermée, plus de
                lampadaires flottants. */}
            <span className="dc-col colL" aria-hidden />
            <span className="dc-col colR" aria-hidden />
            <span className="dc-cornice" aria-hidden />
            <span className="dc-plinth" aria-hidden />

            {/* Soleil art déco derrière la composition */}
            <div className="dc-sun" aria-hidden>
              {SUN_RAYS.map((a, i) => (
                <span
                  key={i}
                  style={
                    {
                      '--ra': `${a}deg`,
                      '--rd': `${i * 0.05}s`,
                      '--ri': i,
                    } as CSSProperties
                  }
                />
              ))}
              <i className="medal" />
            </div>

            {/* Filets verticaux (impulsion lumineuse une fois le cadre posé) */}
            <div className="dc-lines" aria-hidden>
              {[54, 100, 146, 214, 260, 306].map((x, i) => (
                <span
                  key={i}
                  style={
                    {
                      left: `${x}px`,
                      '--ld': `${i * 0.09}s`,
                      '--lp': `${i * 0.85}s`,
                    } as CSSProperties
                  }
                  className={i % 2 ? 'fromTop' : 'fromBottom'}
                />
              ))}
            </div>

            {/* Poussière de champagne étagée en profondeur */}
            <div className="dc-dust" aria-hidden>
              {DUST.map((p, i) => (
                <i
                  key={i}
                  style={
                    {
                      left: `${p.x}%`,
                      top: `${p.y}%`,
                      width: p.s,
                      height: p.s,
                      '--dz': `${p.z}px`,
                      '--dd': `${p.d}s`,
                      '--dt': `${p.t}s`,
                    } as CSSProperties
                  }
                />
              ))}
            </div>

            {/* Éventails d'angles (le soleil art déco tient le sommet) */}
            <div className="dc-fan bl" aria-hidden>
              {CORNER_BLADES.map((a, i) => (
                <span
                  key={i}
                  style={{ '--fa': `${-a}deg`, '--fd': `${i * 0.07}s` } as CSSProperties}
                />
              ))}
              <i className="hub" />
            </div>
            <div className="dc-fan br" aria-hidden>
              {CORNER_BLADES.map((a, i) => (
                <span
                  key={i}
                  style={{ '--fa': `${a}deg`, '--fd': `${i * 0.07}s` } as CSSProperties}
                />
              ))}
              <i className="hub" />
            </div>

            {/* Le double cadre qui se dessine + gradins d'angles */}
            <div className="dc-frame outer" aria-hidden>
              <span className="e et" />
              <span className="e eb" />
              <span className="e el" />
              <span className="e er" />
            </div>
            <div className="dc-frame inner" aria-hidden>
              <span className="e et" />
              <span className="e eb" />
              <span className="e el" />
              <span className="e er" />
            </div>
            <span className="dc-zig za" aria-hidden />
            <span className="dc-zig zb" aria-hidden />
            <span className="dc-zig zc" aria-hidden />
            <span className="dc-zig zd" aria-hidden />

            {/* Les prénoms en capitales dorées */}
            <div className="dc-names">
              <span className="dc-eyebrow">{t('youreInvited')}</span>
              <b className="dc-name na">
                {partnerA}
                <i className="shine" aria-hidden />
              </b>
              <span className="dc-diamond" aria-hidden>
                ◆
              </span>
              <b className="dc-name nb">
                {partnerB}
                <i className="shine" aria-hidden />
              </b>
              <span className="dc-date">
                {formattedDate}
                {venueName ? ` · ${venueName}` : ''}
              </span>
              <span className="dc-flourish" aria-hidden />
            </div>

            {/* Bulles de champagne le long du cadre */}
            <div className="dc-bubbles" aria-hidden>
              {BUBBLES.map((b, i) => (
                <span
                  key={i}
                  style={
                    {
                      left: `${b.x}%`,
                      width: b.s,
                      height: b.s,
                      '--bd': `${b.d}s`,
                      '--bt': `${b.t}s`,
                    } as CSSProperties
                  }
                />
              ))}
            </div>
          </div>
        </div>

        {/* Reflet qui traverse le cadre — voile PLAT hors du contexte 3D
            (un plan screen-blend coplanaire au cadre z-fighte pendant la
            caméra/parallaxe). Fixé au rectangle-cadre en espace écran. */}
        <span className="dc-glare" aria-hidden />

        {/* Compte à rebours en cartouches à gradins */}
        {target != null && (
          <div className="dc-cd">
            <span className="lbl">{t('countdownLabel')}</span>
            <div className="row">
              {cdCell(cd?.d ?? null, t('countdownDays'), 0)}
              {cdCell(cd?.h ?? null, t('countdownHours'), 1)}
              {cdCell(cd?.m ?? null, t('countdownMinutes'), 2)}
            </div>
          </div>
        )}
      </div>

      <p className="cineD-cue" style={{ opacity: effectivePhase === 4 ? 1 : 0 }}>
        <span className="t">{t('scrollToDiscover')}</span>
      </p>
    </div>
  );
}
