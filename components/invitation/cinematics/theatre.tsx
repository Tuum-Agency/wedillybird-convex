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
import './theatre.css';

/**
 * « Le Lever de rideau » — l'acte des cygnes. AUCUNE carte : les prénoms
 * sont LE TITRE DU SPECTACLE.
 *
 * Théâtre à l'italienne — c'est la LUMIÈRE qui met en scène : rideau fermé,
 * le projecteur balaie le velours qui RESPIRE (nappe de lumière + poussière
 * dans le faisceau), puis le rideau SE LÈVE à l'autrichienne — vague de plis
 * qui se froncent, ourlet festonné passepoilé d'or. Derrière : lac au clair
 * de lune, brume qui dérive, deux cygnes qui tanguent l'un vers l'autre…
 * L'ENSEIGNE descend des cintres au bout de ses cordes (elle se balance avec
 * elles), ses AMPOULES s'allument une à une et son or se reflète sur l'eau.
 * Panneau « Acte I » côté cour, cœur des cygnes, puis chase d'ampoules
 * music-hall et compte à rebours entre deux rangées de loupiotes.
 *
 * Phases : 0 rideau fermé · 1 rise (lever) · 2 scene (lac + cygnes) ·
 *          3 title (enseigne + ampoules) · 4 act (Acte I + cœur) · 5 settled
 */
const WAITS = [950, 1100, 1200, 1050, 900];
const PHASES = ['', 'rise', 'scene', 'title', 'act', 'settled'] as const;

/** Plis du rideau à l'autrichienne : largeur relative + délai de respiration. */
const FOLDS: ReadonlyArray<{ g: number; b: number }> = [
  { g: 1.06, b: 0.4 },
  { g: 0.92, b: 2.1 },
  { g: 1.1, b: 1.2 },
  { g: 0.9, b: 3.4 },
  { g: 1.04, b: 0 },
  { g: 0.94, b: 2.8 },
  { g: 1.08, b: 1.7 },
  { g: 0.9, b: 3.9 },
  { g: 1.02, b: 0.8 },
];

/** Poussière en suspension dans le faisceau du projecteur. */
const MOTES: ReadonlyArray<{ x: number; d: number; t: number }> = [
  { x: 46, d: 0, t: 7.5 },
  { x: 52, d: 1.9, t: 9 },
  { x: 42, d: 3.4, t: 8 },
  { x: 58, d: 0.9, t: 10 },
  { x: 49, d: 5.2, t: 7 },
  { x: 55, d: 2.7, t: 8.6 },
  { x: 44, d: 6.1, t: 9.4 },
  { x: 61, d: 4.3, t: 7.8 },
];

/* y ≥ 12 % : au-dessus, le ciel est masqué par le lambrequin du rideau levé. */
const STARS: ReadonlyArray<{ x: number; y: number; s: number; d: number }> = [
  { x: 10, y: 21, s: 2.5, d: 0 },
  { x: 26, y: 16, s: 1.8, d: 1.3 },
  { x: 44, y: 12, s: 2.2, d: 2.4 },
  { x: 60, y: 14, s: 1.6, d: 0.7 },
  { x: 74, y: 13, s: 2.4, d: 1.9 },
  { x: 88, y: 18, s: 1.8, d: 3.1 },
  { x: 18, y: 26, s: 1.5, d: 2.7 },
  { x: 52, y: 22, s: 1.4, d: 3.6 },
  { x: 80, y: 28, s: 1.7, d: 0.4 },
  { x: 34, y: 30, s: 1.3, d: 1.6 },
];

/** Ampoules du pourtour de l'enseigne (292×132). */
const BULBS: ReadonlyArray<{ x: number; y: number }> = [
  { x: 24, y: 7 },
  { x: 65, y: 7 },
  { x: 106, y: 7 },
  { x: 146, y: 7 },
  { x: 186, y: 7 },
  { x: 227, y: 7 },
  { x: 268, y: 7 },
  { x: 268, y: 66 },
  { x: 268, y: 125 },
  { x: 227, y: 125 },
  { x: 186, y: 125 },
  { x: 146, y: 125 },
  { x: 106, y: 125 },
  { x: 65, y: 125 },
  { x: 24, y: 125 },
  { x: 24, y: 66 },
];

function Swan({ side }: { side: 'l' | 'r' }) {
  return (
    <div className={`swan s${side}`} aria-hidden>
      <span className="s-refl" />
      <span className="s-body" />
      <span className="s-wing" />
      <span className="s-neck" />
      <span className="s-head" />
      <span className="s-beak" />
    </div>
  );
}

export function CinematicTheatre({
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
  const par = useSceneParallax(sceneRef, { enabled: parallax && !isReduced, intensity: 1.6 });
  const cd = useCountdown(eventDate);
  const target = eventDate != null ? new Date(eventDate).getTime() : null;

  const sceneCls = [
    'cineT-scene',
    'cineT',
    isReduced && 'reduced',
    holdPhase != null && 'frozen',
    ...PHASES.slice(1, effectivePhase + 1),
  ]
    .filter(Boolean)
    .join(' ');

  // Marque blanche : l'accent teinte le velours du rideau.
  const tint: CSSProperties = accentColor
    ? ({
        '--c-curt': shiftL(accentColor, -0.18),
        '--c-curt-dk': shiftL(accentColor, -0.34),
        '--c-curt-lt': shiftL(accentColor, -0.08),
      } as CSSProperties)
    : {};

  const stageCls = ['cineT-stage', live && 'live'].filter(Boolean).join(' ');

  const cdCell = (v: number | null, u: string, i: number) => (
    <span className="t-cdc" style={{ '--cdd': `${i * 0.1}s` } as CSSProperties}>
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
        <div className="tx-camera">
          <div className="tx-par">
            {/* Décor : lac au clair de lune */}
            <div className="bk" aria-hidden>
              <span className="moon" />
              {STARS.map((s, i) => (
                <span
                  key={i}
                  className="star"
                  style={
                    {
                      left: `${s.x}%`,
                      top: `${s.y}%`,
                      width: s.s,
                      height: s.s,
                      '--sd': `${s.d}s`,
                    } as CSSProperties
                  }
                />
              ))}
              <span className="mtn m1" />
              <span className="mtn m2" />
              <span className="lake" />
              <span className="moonpath" />
              <span className="mist mi1" />
              <span className="mist mi2" />
              <span className="bk-dim" />
            </div>

            {/* Les cygnes + ondulations + reflet de l'enseigne + cœur */}
            <div className="swans" aria-hidden>
              <span className="t-lakeglow" />
              <Swan side="l" />
              <Swan side="r" />
              <span className="rip r1" />
              <span className="rip r2" />
              <span className="rip r3" />
              <span className="heart-glow" />
              <span className="spark">✦</span>
            </div>

            {/* L'ENSEIGNE volée des cintres : les prénoms en titre.
                `t-swing` = cordes + panneau, qui se balancent D'UN BLOC
                autour du point d'accroche aux cintres. */}
            <div className="t-flying">
              <div className="t-swing">
                <span className="t-rope ra" aria-hidden />
                <span className="t-rope rb" aria-hidden />
                <div className="t-board">
                  {BULBS.map((b, i) => (
                    <span
                      key={i}
                      className="t-bulb"
                      aria-hidden
                      style={
                        {
                          left: `${b.x}px`,
                          top: `${b.y}px`,
                          '--bd': `${i * 0.07}s`,
                          '--bi': i,
                        } as CSSProperties
                      }
                    />
                  ))}
                  <span className="t-eyebrow">{t('youreInvited')}</span>
                  <b className="t-name">{partnerA}</b>
                  <span className="t-star" aria-hidden>
                    ✦
                  </span>
                  <b className="t-name">{partnerB}</b>
                </div>
              </div>
            </div>

            {/* Panneau « Acte I » — la date entre côté cour */}
            <div className="t-act">
              <b>{t('actOne')}</b>
              <span>{formattedDate}</span>
              {venueName ? <i>{venueName}</i> : null}
            </div>

            {/* Cône du projecteur + poussière en suspension dans le faisceau
                (les motes sont ROGNÉS par le clip-path du cône) */}
            <span className="spot-cone" aria-hidden>
              {MOTES.map((m, i) => (
                <i
                  key={i}
                  style={
                    { '--mx': `${m.x}%`, '--md': `${m.d}s`, '--mt': `${m.t}s` } as CSSProperties
                  }
                />
              ))}
            </span>

            {/* Rideau à l'autrichienne : vague de plis qui SE LÈVENT */}
            <div className="curt" aria-hidden>
              {FOLDS.map((f, i) => (
                <span
                  key={i}
                  className="fold"
                  style={
                    {
                      '--fg': f.g,
                      '--fi': Math.abs(i - 4),
                      '--fb': `${f.b}s`,
                    } as CSSProperties
                  }
                />
              ))}
            </div>
            <div className="valance" aria-hidden />
            <span className="pro-arch" aria-hidden />
          </div>
        </div>

        {/* Nappe du projecteur SUR le velours — voile PLAT hors du contexte 3D
            (sinon z-fighting avec les plis du rideau). Balaie le tissu tant
            qu'il est fermé, s'efface au lever. */}
        <span className="spot-wash" aria-hidden />

        {/* Compte à rebours music-hall */}
        {target != null && (
          <div className="t-cd">
            <span className="lbl">{t('countdownLabel')}</span>
            <span className="t-rule" aria-hidden />
            <div className="row">
              {cdCell(cd?.d ?? null, t('countdownDays'), 0)}
              {cdCell(cd?.h ?? null, t('countdownHours'), 1)}
              {cdCell(cd?.m ?? null, t('countdownMinutes'), 2)}
            </div>
            <span className="t-rule" aria-hidden />
          </div>
        )}
      </div>

      <p className="cineT-cue" style={{ opacity: effectivePhase === 4 ? 1 : 0 }}>
        <span className="t">{t('scrollToDiscover')}</span>
      </p>
    </div>
  );
}
