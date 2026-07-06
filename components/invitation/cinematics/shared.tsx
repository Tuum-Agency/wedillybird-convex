'use client';

import { useTranslations } from 'next-intl';
import {
  useEffect,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type RefObject,
} from 'react';

/**
 * Socle commun des cinématiques d'ouverture (extrait de la v3 « sceau ») :
 *  - timeline auto-jouée par phases cumulatives (waits par thème) ;
 *  - parallaxe pointeur (desktop) + gyroscope (mobile sans permission) ;
 *  - compte à rebours SSR-safe (horloge 30 s en useSyncExternalStore) ;
 *  - chrome partagé : bouton « Passer », bloc compte à rebours, cue de scroll.
 *
 * Chaque thème garde la main sur son DOM et son CSS (préfixe de classes
 * propre) — seul le comportement est mutualisé. Contrat identique à la v3 :
 * 6 phases 0→5, `holdPhase` fige (storyboard), reduced-motion saute à
 * l'état apaisé, `onDone` déclenché en fin de séquence ou au skip.
 */
export interface CinematicSceneProps {
  partnerA: string;
  partnerB: string;
  formattedDate: string;
  venueName?: string;
  /** Couleur d'accent (theme.primaryColor du couple) — teinte les accents du thème. */
  accentColor?: string;
  /** Date de l'événement (epoch ms ou ISO) — affiche le compte à rebours si fourni. */
  eventDate?: number | string;
  /** Force le mouvement réduit (sinon dérivé de prefers-reduced-motion). */
  reduced?: boolean;
  /** Parallaxe au pointeur (desktop) / gyroscope (mobile). */
  parallax?: boolean;
  /** Fige sur une phase précise (storyboard) — désactive l'auto-play. */
  holdPhase?: number | null;
  /** Incrémenter pour rejouer la séquence. */
  playKey?: number;
  /** Déclenché à la fin de la séquence (ou au skip). */
  onDone?: () => void;
  /** Mode plein écran (invitation) : affiche le bouton « Passer ». */
  live?: boolean;
}

/* ------------------------------ timeline ------------------------------ */

export function useCinematicTimeline({
  waits,
  playKey,
  holdPhase,
  isReduced,
  onDone,
}: {
  waits: ReadonlyArray<number>;
  playKey?: number;
  holdPhase?: number | null;
  isReduced: boolean;
  onDone?: () => void;
}) {
  const finalPhase = waits.length;
  const [phase, setPhase] = useState(0);

  // Phase affichée dérivée : hold (storyboard) et reduced court-circuitent
  // l'auto-play sans passer par un setState d'effet.
  const effectivePhase = holdPhase ?? (isReduced ? finalPhase : phase);

  // Rejoue depuis 0 quand l'identité du run change — ajustement d'état
  // pendant le render (pattern v3), pas en effet.
  const runKey = `${playKey ?? 0}|${holdPhase == null ? 'auto' : 'hold'}|${isReduced ? 'still' : 'anim'}`;
  const [prevRunKey, setPrevRunKey] = useState(runKey);
  if (runKey !== prevRunKey) {
    setPrevRunKey(runKey);
    setPhase(0);
  }

  useEffect(() => {
    if (holdPhase != null) return;
    if (isReduced) {
      const id = setTimeout(() => onDone?.(), 600);
      return () => clearTimeout(id);
    }
    let i = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = () => {
      if (i >= waits.length) {
        timer = setTimeout(() => onDone?.(), 1100);
        return;
      }
      timer = setTimeout(() => {
        i += 1;
        setPhase(i);
        tick();
      }, waits[i]);
    };
    tick();
    return () => {
      if (timer) clearTimeout(timer);
    };
    // onDone est stable (callback du parent) ; waits est une constante module.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playKey, holdPhase, isReduced]);

  return {
    effectivePhase,
    skipToEnd: () => setPhase(finalPhase),
  };
}

/* ------------------------------ parallaxe ------------------------------ */

export function useSceneParallax(
  sceneRef: RefObject<HTMLDivElement | null>,
  { enabled, intensity = 1 }: { enabled: boolean; intensity?: number },
) {
  // Gyroscope (mobile) : uniquement quand l'API est disponible SANS permission
  // explicite (Android, vieux iOS) — iOS 13+ exige un geste utilisateur.
  // Baseline = première mesure, deltas amortis et bornés.
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;
    const DOE = window.DeviceOrientationEvent as
      | (typeof DeviceOrientationEvent & { requestPermission?: () => Promise<string> })
      | undefined;
    if (!DOE || typeof DOE.requestPermission === 'function') return;
    let base: { beta: number; gamma: number } | null = null;
    const onOrient = (e: DeviceOrientationEvent) => {
      if (e.beta == null || e.gamma == null || !sceneRef.current) return;
      if (!base) base = { beta: e.beta, gamma: e.gamma };
      const clamp = (v: number, m: number) => Math.max(-m, Math.min(m, v));
      const ry = clamp((e.gamma - base.gamma) * 0.35 * intensity, 8 * intensity);
      const rx = clamp((base.beta - e.beta) * 0.3 * intensity, 6 * intensity);
      sceneRef.current.style.setProperty('--ry', `${ry.toFixed(2)}deg`);
      sceneRef.current.style.setProperty('--rx', `${rx.toFixed(2)}deg`);
    };
    window.addEventListener('deviceorientation', onOrient);
    return () => window.removeEventListener('deviceorientation', onOrient);
  }, [enabled, sceneRef, intensity]);

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!enabled || !sceneRef.current) return;
    const r = sceneRef.current.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    sceneRef.current.style.setProperty('--ry', `${(x * 9 * intensity).toFixed(2)}deg`);
    sceneRef.current.style.setProperty('--rx', `${(-y * 6 * intensity).toFixed(2)}deg`);
  }
  function onPointerLeave() {
    if (!sceneRef.current) return;
    sceneRef.current.style.setProperty('--ry', '0deg');
    sceneRef.current.style.setProperty('--rx', '0deg');
  }

  return { onPointerMove, onPointerLeave };
}

/* --------------------------- compte à rebours --------------------------- */

function computeCountdown(target: number) {
  const diff = Math.max(0, target - Date.now());
  return {
    d: Math.floor(diff / 86400000),
    h: Math.floor((diff % 86400000) / 3600000),
    m: Math.floor((diff % 3600000) / 60000),
  };
}

// Horloge 30 s exposée comme store externe : null côté serveur (aucun compte
// à rebours SSR, donc aucun mismatch d'hydratation).
function subscribeToClock(onTick: () => void) {
  const id = setInterval(onTick, 30000);
  return () => clearInterval(id);
}
const getClockBucket = () => Math.floor(Date.now() / 30000);
const getServerClockBucket = () => null;

export function useCountdown(eventDate?: number | string) {
  const target = eventDate != null ? new Date(eventDate).getTime() : null;
  const clockBucket = useSyncExternalStore(subscribeToClock, getClockBucket, getServerClockBucket);
  return clockBucket == null || target == null ? null : computeCountdown(target);
}

/* ------------------------------- teintes ------------------------------- */

/** Éclaircit/assombrit une couleur OKLCH ; no-op si le format n'est pas reconnu. */
export function shiftL(color: string, delta: number): string {
  const m = color.match(/oklch\(\s*([\d.]+)%?\s+([\d.]+)\s+([\d.]+)/);
  if (!m) return color;
  const l = Math.min(100, Math.max(0, Number.parseFloat(m[1]!) + delta * 100));
  return `oklch(${l}% ${m[2]} ${m[3]})`;
}

/* --------------------------- chrome partagé ---------------------------- */

/** Bouton « Passer » (mode live uniquement, pendant l'animation). */
export function CinematicSkip({ onSkip }: { onSkip: () => void }) {
  const t = useTranslations('Invitation');
  return (
    <button
      type="button"
      className="cine2-skip focus-ring"
      onClick={onSkip}
      aria-label={t('cinematicSkipAria')}
    >
      {t('cinematicSkip')} →
    </button>
  );
}

/** Bloc compte à rebours (état apaisé). Styles par thème via `className`. */
export function CinematicCountdown({
  cd,
  className,
}: {
  cd: { d: number; h: number; m: number } | null;
  className: string;
}) {
  const t = useTranslations('Invitation');
  const cell = (v: number | null, u: string) => (
    <div className="cell">
      <span className="n">{v == null ? '—' : String(v).padStart(2, '0')}</span>
      <span className="u">{u}</span>
    </div>
  );
  return (
    <div className={className}>
      <div className="lbl">{t('countdownLabel')}</div>
      <div className="cd">
        {cell(cd?.d ?? null, t('countdownDays'))}
        <span className="sep">:</span>
        {cell(cd?.h ?? null, t('countdownHours'))}
        <span className="sep">:</span>
        {cell(cd?.m ?? null, t('countdownMinutes'))}
      </div>
    </div>
  );
}

/** Style inline pour positionner une particule étagée en profondeur. */
export function dustStyle(p: {
  x: number;
  y: number;
  z: number;
  s: number;
  d: number;
}): CSSProperties {
  return {
    left: `${p.x}%`,
    top: `${p.y}%`,
    width: p.s,
    height: p.s,
    '--dz': `${p.z}px`,
    '--dd': `${p.d}s`,
  } as CSSProperties;
}
