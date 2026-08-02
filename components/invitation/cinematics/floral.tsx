'use client';

import { useTranslations } from 'next-intl';
import { useReducedMotion } from 'motion/react';
import { useEffect, useRef, useSyncExternalStore, type CSSProperties } from 'react';
import {
  CinematicCountdown,
  CinematicSkip,
  useCinematicTimeline,
  useCountdown,
  useSceneParallax,
  type CinematicSceneProps,
} from './shared';
import './floral.css';

/**
 * « L'Éclosion » — le jardin écrit l'invitation.
 *
 * Plaque vidéo ambiante (muette) en profondeur, sur laquelle le faire-part
 * s'inscrit en texte DOM : un bouton de rose couvert de rosée s'ouvre à
 * l'aube (le geste signature), puis le jardin se découvre et la caméra
 * remonte l'allée jusque sous l'arche fleurie — où le mariage s'annonce.
 *
 * Phases : 0 éclosion · 1 garden (le jardin se découvre) · 2 invited
 *          (« Mariage ») · 3 named (les prénoms) · 4 dated (la date)
 *          · 5 settled (le lieu + compte à rebours).
 *
 * Univers LIGHT : le fond est lumineux, donc le texte est en encre chaude
 * sur un voile ivoire (contraste AA), à l'inverse des thèmes sombres.
 * Garde-fous : vidéo muette + `playsInline` (autoplay mobile), poster de
 * chargement, `prefers-reduced-motion` → image fixe de l'état apaisé,
 * `holdPhase` cale la vidéo sur le temps de la phase (vignettes/storyboard).
 */

const PLATE_SRC = '/cinematics/floral/plate.mp4';
/** Première image (bouton fermé) — affichée pendant le chargement. */
const POSTER_SRC = '/cinematics/floral/poster.jpg';
/** Dernière image (sous l'arche) — fond fixe en mouvement réduit. */
const STILL_SRC = '/cinematics/floral/still.jpg';

// ms par phase : éclosion · jardin · « Mariage » · prénoms · date → apaisé
const WAITS = [4400, 1200, 1100, 1200, 1100] as const;
const FINAL = WAITS.length;
const PHASE_CLASSES = ['garden', 'invited', 'named', 'dated', 'settled'] as const;
/** Position (s) de chaque phase dans la plaque — utilisée quand on fige. */
const PHASE_TIME = [0, 4.4, 5.6, 6.7, 7.9, 9] as const;

/**
 * Pétales étagés en profondeur. Chaque couche vit à un Z FIXE : sous
 * `preserve-3d`, un plan éloigné se déplace moins qu'un plan proche quand la
 * scène pivote — c'est de là que vient la parallaxe, pas d'un calcul JS.
 *
 * Le flou des pétales proches est porté par le CONTENEUR de couche, jamais par
 * les pétales : `filter` sur un enfant le sortirait du tri de profondeur et le
 * ferait réapparaître dans l'ordre du DOM (z-fighting).
 */
interface Petal {
  /** Position horizontale de départ (% de la scène). */
  x: number;
  /** Décalage horizontal parcouru pendant la chute (px). */
  drift: number;
  /** Taille (px). */
  s: number;
  /** Durée de la chute (s). */
  dur: number;
  /** Décalage de démarrage (s) — désynchronise les pétales. */
  delay: number;
  /** Inclinaison propre du pétale dans l'espace (deg). */
  tilt: number;
}

/** Loin derrière : petits, lents, presque immobiles au parallaxe. */
const PETALS_FAR: readonly Petal[] = [
  { x: 12, drift: 26, s: 7, dur: 15, delay: 0, tilt: 24 },
  { x: 34, drift: -18, s: 6, dur: 18, delay: 4.2, tilt: -40 },
  { x: 58, drift: 22, s: 8, dur: 16, delay: 8.1, tilt: 62 },
  { x: 79, drift: -24, s: 6.5, dur: 19, delay: 2.4, tilt: -18 },
  { x: 91, drift: 16, s: 7, dur: 17, delay: 11, tilt: 36 },
];
/** À hauteur du texte : taille moyenne, dérive plus marquée. */
const PETALS_MID: readonly Petal[] = [
  { x: 20, drift: 42, s: 13, dur: 12, delay: 1.5, tilt: -52 },
  { x: 47, drift: -34, s: 11, dur: 13.5, delay: 6.8, tilt: 30 },
  { x: 72, drift: 38, s: 14, dur: 11.5, delay: 3.6, tilt: -26 },
  { x: 88, drift: -28, s: 12, dur: 14, delay: 9.4, tilt: 48 },
];
/** Tout près de l'objectif : grands, rapides, volontairement flous. */
const PETALS_NEAR: readonly Petal[] = [
  { x: 8, drift: 70, s: 26, dur: 8.5, delay: 0.8, tilt: -34 },
  { x: 55, drift: -62, s: 30, dur: 9.5, delay: 5.2, tilt: 44 },
  { x: 84, drift: 54, s: 24, dur: 8, delay: 2.9, tilt: -58 },
];

/**
 * « Sommes-nous montés côté client ? » exposé en store externe : `false` au
 * rendu serveur, `true` au client. Permet de n'honorer `prefers-reduced-motion`
 * qu'après hydratation sans écrire d'état depuis un effet.
 */
const subscribeMount = () => () => {};
const getMounted = () => true;
const getMountedOnServer = () => false;

function petalStyle(p: Petal): CSSProperties {
  return {
    left: `${p.x}%`,
    width: p.s,
    height: p.s,
    '--drift': `${p.drift}px`,
    '--dur': `${p.dur}s`,
    '--delay': `-${p.delay}s`,
    '--tilt': `${p.tilt}deg`,
  } as CSSProperties;
}

/** Une couche de pétales, posée à un Z fixe par sa classe. */
function PetalLayer({
  depth,
  petals,
}: {
  depth: 'far' | 'mid' | 'near';
  petals: readonly Petal[];
}) {
  return (
    <div className={`cineFl-depth cineFl-depth-${depth}`} aria-hidden>
      {petals.map((p, i) => (
        <span key={i} className="cineFl-petal" style={petalStyle(p)} />
      ))}
    </div>
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
  // Le serveur ignore `prefers-reduced-motion` : l'appliquer dès le premier
  // rendu ferait diverger le client du HTML SSR (mismatch d'hydratation, la
  // scène partant directement à l'état apaisé). On ne l'honore qu'une fois
  // monté — le rendu initial reste donc identique des deux côtés.
  const mounted = useSyncExternalStore(subscribeMount, getMounted, getMountedOnServer);
  const isReduced = reduced || (mounted && !!prefersReduced);
  // La parallaxe écrit --rx/--ry sur le STAGE, pas sur le monde : les deux
  // contextes 3D (le monde et le plan avant, qui encadrent le texte) héritent
  // ainsi de la même caméra. Les poser sur le monde laisserait le plan avant
  // immobile — et la profondeur ne se lirait que d'un côté du faire-part.
  const stageRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const { effectivePhase, skipToEnd } = useCinematicTimeline({
    waits: WAITS,
    playKey,
    holdPhase,
    isReduced,
    onDone,
  });
  const cd = useCountdown(eventDate);
  // Intensité relevée depuis que la scène est étagée en Z : c'est la rotation
  // qui révèle l'écart entre les plans (sans elle, la profondeur ne se voit pas).
  const { onPointerMove, onPointerLeave } = useSceneParallax(stageRef, {
    enabled: parallax && !isReduced,
    intensity: 1.1,
  });

  // Pilotage de la plaque : rejeu depuis le début (playKey), ou calage sur le
  // temps de la phase quand la scène est figée (vignettes, storyboard).
  useEffect(() => {
    const v = videoRef.current;
    if (!v || isReduced) return;
    if (holdPhase != null) {
      v.pause();
      v.currentTime = PHASE_TIME[Math.min(holdPhase, FINAL)] ?? 0;
      return;
    }
    v.currentTime = 0;
    // Safari rejette parfois la reprise : l'échec laisse simplement le poster.
    void v.play().catch(() => {});
  }, [playKey, holdPhase, isReduced]);

  const stageCls = [
    'cineFl-stage',
    live && 'cineFl-live',
    ...PHASE_CLASSES.slice(0, effectivePhase).map((c) => `cineFl-${c}`),
  ]
    .filter(Boolean)
    .join(' ');
  const stageStyle = accentColor ? ({ '--fl-accent': accentColor } as CSSProperties) : undefined;

  return (
    <div
      ref={stageRef}
      className={stageCls}
      data-phase={effectivePhase}
      style={stageStyle}
      role="presentation"
      onPointerMove={isReduced ? undefined : onPointerMove}
      onPointerLeave={isReduced ? undefined : onPointerLeave}
    >
      {live && holdPhase == null && !isReduced && effectivePhase < FINAL && (
        <CinematicSkip
          onSkip={() => {
            skipToEnd();
            onDone?.();
          }}
        />
      )}

      {/* ---- LE JARDIN (plaque vidéo, en profondeur + parallaxe) ---- */}
      <div className="cineFl-dolly">
        <div className="cineFl-parallax">
          {isReduced ? (
            <div
              className="cineFl-plate cineFl-plate-still"
              style={{ backgroundImage: `url("${STILL_SRC}")` }}
              aria-hidden
            />
          ) : (
            <video
              ref={videoRef}
              className="cineFl-plate"
              autoPlay
              muted
              playsInline
              preload="auto"
              poster={POSTER_SRC}
              aria-hidden
            >
              <source src={PLATE_SRC} type="video/mp4" />
            </video>
          )}
          <div className="cineFl-haze" aria-hidden />
          {/* Couches volumétriques : trois plans à Z distincts autour du texte. */}
          {!isReduced && (
            <>
              <PetalLayer depth="far" petals={PETALS_FAR} />
              <PetalLayer depth="mid" petals={PETALS_MID} />
            </>
          )}
        </div>
      </div>

      {/* ---- lumière d'aube (plat, HORS preserve-3d → pas de z-fighting) ---- */}
      <div className="cineFl-light" aria-hidden>
        <div className="cineFl-bloom" />
      </div>

      {/* ---- voile de lecture ivoire (contraste du texte sur fond clair) ---- */}
      <div className="cineFl-veil" aria-hidden />

      {/* ---- LE FAIRE-PART : mariage · le couple · la date · le lieu ---- */}
      <div className="cineFl-scene">
        <span className="cineFl-eyebrow">{t('weddingLabel')}</span>
        <span className="cineFl-fleuron" aria-hidden>
          ✦
        </span>
        <h1 className="cineFl-names">
          <span className="cineFl-name">{partnerA}</span>
          <span className="cineFl-amp" aria-hidden>
            &amp;
          </span>
          <span className="cineFl-name">{partnerB}</span>
        </h1>
        <span className="cineFl-rule" aria-hidden />
        <span className="cineFl-date">{formattedDate}</span>
        {venueName && <span className="cineFl-venue">{venueName}</span>}
      </div>

      {/* Plan le plus proche de l'objectif : passe DEVANT le faire-part.
          Il vit hors du monde 3D, dans sa propre perspective, pour garantir
          l'ordre d'empilement avec le texte (z-index) sans z-fighting. */}
      {!isReduced && (
        <div className="cineFl-front" aria-hidden>
          <PetalLayer depth="near" petals={PETALS_NEAR} />
        </div>
      )}

      {eventDate != null && <CinematicCountdown cd={cd} className="cineFl-after" />}
    </div>
  );
}
