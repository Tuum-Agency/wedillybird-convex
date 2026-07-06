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
 * Phases : 0 noir · 1 lines (filets) · 2 fans (éventails) · 3 frame
 *          (le cadre se tire) · 4 names · 5 settled
 */
const WAITS = [850, 900, 1100, 1050, 950];
const PHASES = ['', 'lines', 'fans', 'frame', 'names', 'settled'] as const;

const FAN_BLADES = [-60, -45, -30, -15, 0, 15, 30, 45, 60];
const CORNER_BLADES = [0, 22, 44, 66, 88];

const BUBBLES: ReadonlyArray<{ x: number; d: number; t: number }> = [
  { x: 12, d: 0, t: 7 },
  { x: 15, d: 2.8, t: 8.5 },
  { x: 85, d: 1.4, t: 7.5 },
  { x: 88, d: 4.2, t: 9 },
  { x: 13, d: 5.5, t: 8 },
  { x: 86, d: 6.8, t: 7.8 },
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
            {/* Sol de marbre en perspective */}
            <span className="dc-floor" aria-hidden />

            {/* Filets verticaux */}
            <div className="dc-lines" aria-hidden>
              {[54, 100, 146, 214, 260, 306].map((x, i) => (
                <span
                  key={i}
                  style={{ left: `${x}px`, '--ld': `${i * 0.09}s` } as CSSProperties}
                  className={i % 2 ? 'fromTop' : 'fromBottom'}
                />
              ))}
            </div>

            {/* Éventails en soleil */}
            <div className="dc-fan top" aria-hidden>
              {FAN_BLADES.map((a, i) => (
                <span
                  key={i}
                  style={{ '--fa': `${a}deg`, '--fd': `${i * 0.06}s` } as CSSProperties}
                />
              ))}
              <i className="hub" />
            </div>
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
            </div>

            {/* Bulles de champagne le long du cadre */}
            <div className="dc-bubbles" aria-hidden>
              {BUBBLES.map((b, i) => (
                <span
                  key={i}
                  style={{ left: `${b.x}%`, '--bd': `${b.d}s`, '--bt': `${b.t}s` } as CSSProperties}
                />
              ))}
            </div>
          </div>
        </div>

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
