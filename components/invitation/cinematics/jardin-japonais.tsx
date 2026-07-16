'use client';

import { useTranslations } from 'next-intl';
import { useReducedMotion } from 'motion/react';
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  type CinematicSceneProps,
  useCountdown,
  useSceneParallax,
  CinematicSkip,
  CinematicCountdown,
} from './shared';
import './jardin-japonais.css';

/**
 * Cinématique « Jardin japonais » — enveloppe washi (Japon, ère Edo) qui
 * S'OUVRE au tap du sceau, puis transition vers un jardin en profondeur 3D.
 *
 * Séquence : (0) enveloppe scellée · (1) le sceau de cire SAUTE au tap · (2) les
 * deux panneaux de washi s'écartent comme des shoji + flash → on ENTRE dans le
 * jardin · (3) le monde s'éveille (dolly, rais) · (4) les prénoms surgissent en
 * Z (climax + nuée de pétales) · (5) date · (6) apaisé (compte à rebours vivant).
 *
 * 3D en CSS pur (pas de WebGL — LCP mobile). Prénoms = texte DOM éditable
 * (`partnerA`/`partnerB`). Garde-fous : autoplay (ouverture auto après un temps
 * si pas de tap) ; `prefers-reduced-motion` → pas d'enveloppe, image fixe +
 * état final ; voiles lumineux HORS `preserve-3d` (sinon z-fighting).
 */

const PLATE_SRC = '/cinematics/jardin-japonais/plate.mp4';
const POSTER_SRC = '/cinematics/jardin-japonais/poster.jpg';

// ms par transition : sceau(tap/auto) · saut du sceau · ouverture/transition ·
// éveil · prénoms (climax) · date → apaisé
const WAITS = [1900, 560, 940, 1000, 1100, 1100] as const;
const FINAL = WAITS.length; // phase 6 = apaisée
const PHASE_CLASSES = ['break', 'open', 'awaken', 'named', 'dated', 'settled'] as const;
// Invitation (live) : on attend le tap sur le sceau. Filet de sécurité = ouvre
// tout seul après ce délai si l'invité ne tape pas (jamais de cul-de-sac).
const SAFETY_OPEN_MS = 9000;

const PETALS_BACK: ReadonlyArray<{ x: number; d: number; s: number }> = [
  { x: 10, d: 0, s: 0.9 },
  { x: 26, d: 3.1, s: 0.7 },
  { x: 44, d: 1.4, s: 1 },
  { x: 61, d: 4.2, s: 0.8 },
  { x: 78, d: 2.2, s: 0.95 },
  { x: 90, d: 0.7, s: 0.65 },
  { x: 35, d: 5.3, s: 0.75 },
];
const PETALS_FRONT: ReadonlyArray<{ x: number; d: number; s: number }> = [
  { x: 16, d: 1.1, s: 1.5 },
  { x: 52, d: 3.6, s: 1.7 },
  { x: 84, d: 0.4, s: 1.4 },
  { x: 70, d: 5.0, s: 1.9 },
];
const BURST: ReadonlyArray<{ x: number; dx: number; d: number; s: number }> = [
  { x: 22, dx: -30, d: 0, s: 1 },
  { x: 33, dx: 20, d: 0.08, s: 0.8 },
  { x: 44, dx: -14, d: 0.16, s: 1.1 },
  { x: 50, dx: 26, d: 0.05, s: 0.9 },
  { x: 57, dx: -22, d: 0.2, s: 0.85 },
  { x: 66, dx: 16, d: 0.12, s: 1 },
  { x: 76, dx: 32, d: 0.24, s: 0.75 },
  { x: 40, dx: 40, d: 0.3, s: 0.7 },
  { x: 60, dx: -36, d: 0.28, s: 0.8 },
];
// colonne de brosse abstraite (évoque le sumi vertical sans caractère lisible)
const CALLI = [0.7, 1, 0.55, 0.85, 0.4, 0.95];

export function CinematicJardinJaponais({
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
  const worldRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const safetyRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const openedRef = useRef(false);
  const phaseRef = useRef(0);

  const [phase, setPhase] = useState(0);
  const effectivePhase = holdPhase ?? (isReduced ? FINAL : phase);

  // Miroir de la phase courante pour openSeal (évite de recréer le callback à
  // chaque phase). Sync hors render — react-hooks/refs interdit d'écrire un ref
  // pendant le rendu.
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  // Réinitialise au changement de run (rejeu playKey, sortie de hold/reduced).
  // Le garde `openedRef` est remis à false par l'effet de contrôle plus bas
  // (seul chemin où il compte), donc pas de mutation de ref pendant le rendu.
  const runKey = `${playKey ?? 0}|${holdPhase == null ? 'auto' : 'hold'}|${isReduced ? 'still' : 'anim'}`;
  const [prevRunKey, setPrevRunKey] = useState(runKey);
  if (runKey !== prevRunKey) {
    setPrevRunKey(runKey);
    setPhase(0);
  }

  const cd = useCountdown(eventDate);
  const { onPointerMove, onPointerLeave } = useSceneParallax(worldRef, {
    enabled: parallax && !isReduced,
    intensity: 0.5,
  });

  // Enchaîne les phases depuis un index (réutilisé par l'autoplay et le tap).
  const runFrom = useCallback(
    (index: number) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      const step = (i: number) => {
        if (i >= WAITS.length) {
          timerRef.current = setTimeout(() => onDone?.(), 1100);
          return;
        }
        timerRef.current = setTimeout(() => {
          setPhase(i + 1);
          step(i + 1);
        }, WAITS[i]);
      };
      step(index);
    },
    [onDone],
  );

  // Brise le sceau et lance l'ouverture — depuis l'état scellé uniquement
  // (idempotent : tap + filet de sécurité ne peuvent pas déclencher deux fois).
  const openSeal = useCallback(() => {
    if (openedRef.current || phaseRef.current !== 0 || holdPhase != null || isReduced) return;
    openedRef.current = true;
    if (safetyRef.current) clearTimeout(safetyRef.current);
    setPhase(1);
    runFrom(1);
  }, [holdPhase, isReduced, runFrom]);

  useEffect(() => {
    if (holdPhase != null) return;
    if (isReduced) {
      const id = setTimeout(() => onDone?.(), 600);
      return () => clearTimeout(id);
    }
    openedRef.current = false;
    if (live) {
      // INVITATION : on attend le TAP sur le sceau (le geste = le wow). Pas
      // d'auto-ouverture rapide ; seulement un filet de sécurité long.
      safetyRef.current = setTimeout(() => openSeal(), SAFETY_OPEN_MS);
    } else {
      // Aperçu (landing/bento) : ouverture automatique (WAITS[0] = durée scellé).
      runFrom(0);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (safetyRef.current) clearTimeout(safetyRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rejoue sur playKey/holdPhase/reduced/live
  }, [playKey, holdPhase, isReduced, live]);

  const stageCls = [
    'cineJp-stage',
    ...PHASE_CLASSES.slice(0, effectivePhase).map((c) => `cineJp-${c}`),
  ].join(' ');
  const stageStyle = accentColor ? ({ '--jp-accent': accentColor } as CSSProperties) : undefined;
  const initials = `${(partnerA.trim()[0] ?? '').toUpperCase()} · ${(partnerB.trim()[0] ?? '').toUpperCase()}`;

  return (
    <div
      className={stageCls}
      data-phase={effectivePhase}
      style={stageStyle}
      role="presentation"
      onPointerMove={isReduced ? undefined : onPointerMove}
      onPointerLeave={isReduced ? undefined : onPointerLeave}
    >
      {live && holdPhase == null && !isReduced && effectivePhase < FINAL && (
        <CinematicSkip onSkip={() => setPhase(FINAL)} />
      )}

      {/* ---- LE MONDE (dolly par phase → parallaxe → plans en Z) ---- */}
      <div className="cineJp-dolly">
        <div ref={worldRef} className="cineJp-parallax">
          {isReduced ? (
            <div
              className="cineJp-plate cineJp-plate-still"
              style={{ backgroundImage: `url("${POSTER_SRC}")` }}
              aria-hidden
            />
          ) : (
            <video
              className="cineJp-plate"
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              poster={POSTER_SRC}
              aria-hidden
            >
              <source src={PLATE_SRC} type="video/mp4" />
            </video>
          )}
          <div className="cineJp-haze" aria-hidden />
          {!isReduced && (
            <div className="cineJp-petals cineJp-petals-back" aria-hidden>
              {PETALS_BACK.map((p, i) => (
                <span
                  key={i}
                  style={{ left: `${p.x}%`, '--dd': `${p.d}s`, '--ps': p.s } as CSSProperties}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ---- LUMIÈRE (plat, HORS preserve-3d → pas de z-fighting) ---- */}
      <div className="cineJp-light" aria-hidden>
        <div className="cineJp-rays" />
        <div className="cineJp-bloom" />
        <div className="cineJp-sweep" />
      </div>

      {!isReduced && (
        <div className="cineJp-petals cineJp-petals-front" aria-hidden>
          {PETALS_FRONT.map((p, i) => (
            <span
              key={i}
              style={{ left: `${p.x}%`, '--dd': `${p.d}s`, '--ps': p.s } as CSSProperties}
            />
          ))}
        </div>
      )}

      {!isReduced && (
        <div className="cineJp-burst" aria-hidden>
          {BURST.map((p, i) => (
            <span
              key={i}
              style={
                {
                  left: `${p.x}%`,
                  '--bx': `${p.dx}px`,
                  '--bd': `${p.d}s`,
                  '--ps': p.s,
                } as CSSProperties
              }
            />
          ))}
        </div>
      )}

      {/* ---- voile de lecture (contraste du texte) ---- */}
      <div className="cineJp-textveil" aria-hidden />

      {/* ---- LES PRÉNOMS — nets, en surgissement Z (texte éditable) ---- */}
      <div className="cineJp-scene">
        <span className="cineJp-eyebrow">{t('youreInvited')}</span>
        <span className="cineJp-fleuron" aria-hidden>
          ✦
        </span>
        <h1 className="cineJp-names">
          <span className="cineJp-name">{partnerA}</span>
          <span className="cineJp-amp" aria-hidden>
            &amp;
          </span>
          <span className="cineJp-name">{partnerB}</span>
        </h1>
        <span className="cineJp-rule" aria-hidden />
        <span className="cineJp-date">{formattedDate}</span>
        {venueName && <span className="cineJp-venue">{venueName}</span>}
      </div>

      {eventDate != null && <CinematicCountdown cd={cd} className="cineJp-after" />}

      {/* ---- L'ENVELOPPE WASHI (ère Edo) — panneaux shoji + sceau (tap) ---- */}
      {!isReduced && (
        <div className="cineJp-env">
          <div className="cineJp-env-panel cineJp-env-l paper-grain">
            <span className="cineJp-calli" aria-hidden>
              {CALLI.map((h, i) => (
                <i key={i} style={{ '--ch': h } as CSSProperties} />
              ))}
            </span>
          </div>
          <div className="cineJp-env-panel cineJp-env-r paper-grain" aria-hidden />
          <div className="cineJp-seam" aria-hidden />
          <div className="cineJp-kamon" aria-hidden>
            ❀
          </div>
          <div className="cineJp-mizuhiki" aria-hidden />
          <button
            type="button"
            className="cineJp-seal focus-ring"
            onClick={openSeal}
            aria-label={t('openInvitation')}
          >
            <span className="cineJp-wax">
              <span className="cineJp-wax-mono">{initials}</span>
              <span className="cineJp-wax-shine" aria-hidden />
            </span>
            <span className="cineJp-wax-ring" aria-hidden />
          </button>
          <span className="cineJp-shock" aria-hidden />
          <span className="cineJp-seal-hint">{t('tapSeal')}</span>
        </div>
      )}

      {/* ---- flash de transition (au-dessus de l'enveloppe) ---- */}
      {!isReduced && <div className="cineJp-flash" aria-hidden />}
    </div>
  );
}
