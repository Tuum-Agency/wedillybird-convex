'use client';

import { useTranslations } from 'next-intl';
import { useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import './cinematic2.css';

/**
 * Cinematic2 — Ouverture cinématique 2.5D (design Claude Design « Ouverture cinématique »).
 *
 * Une enveloppe de papeterie qui s'ouvre en profondeur réelle (CSS 3D : perspective +
 * preserve-3d + translateZ), avec parallaxe au pointeur, ombre portée, reflet gold sur
 * le sceau de cire qui se fend, doublure champagne révélée, carte qui émerge, prénoms
 * en Bodoni ligne par ligne, fleurons + compte à rebours. Aucun WebGL.
 *
 * Six phases auto-jouées (cumulatives) :
 *   0 fermé · 1 armed (sceau) · 2 open (rabat) · 3 emerged (carte) · 4 named (prénoms) · 5 settled (apaisement)
 *
 * Pilotable en marque blanche via `accentColor` (sceau + accents) ou `skin="sage"`.
 * `prefers-reduced-motion` → saut direct à l'état apaisé (aucune animation).
 */
export interface Cinematic2Props {
  partnerA: string;
  partnerB: string;
  formattedDate: string;
  venueName?: string;
  /** Couleur d'accent (theme.primaryColor du couple) — teinte sceau + accents. */
  accentColor?: string;
  /** Date de l'événement (epoch ms ou ISO) — affiche le compte à rebours si fourni. */
  eventDate?: number | string;
  /** Force le mouvement réduit (sinon dérivé de prefers-reduced-motion). */
  reduced?: boolean;
  /** Parallaxe au pointeur (desktop). */
  parallax?: boolean;
  /** Fige sur une phase précise (storyboard) — désactive l'auto-play. */
  holdPhase?: number | null;
  /** Incrémenter pour rejouer la séquence. */
  playKey?: number;
  /** Déclenché à la fin de la séquence (ou au skip). */
  onDone?: () => void;
  /** Mode plein écran (invitation) : affiche le bouton « Passer ». */
  live?: boolean;
  skin?: 'blush' | 'sage';
}

const PHASE_CLASSES = ['', 'armed', 'open', 'emerged', 'named', 'settled'] as const;
const WAITS = [820, 560, 1040, 880, 900]; // ms avant chaque phase suivante

function countdown(target: number) {
  const diff = Math.max(0, target - Date.now());
  return {
    d: Math.floor(diff / 86400000),
    h: Math.floor((diff % 86400000) / 3600000),
    m: Math.floor((diff % 3600000) / 60000),
  };
}

// Horloge 30 s exposée comme store externe : null côté serveur (aucun compte à
// rebours SSR, donc aucun mismatch d'hydratation), bucket temporel côté client.
function subscribeToClock(onTick: () => void) {
  const id = setInterval(onTick, 30000);
  return () => clearInterval(id);
}
const getClockBucket = () => Math.floor(Date.now() / 30000);
const getServerClockBucket = () => null;

/** Éclaircit/assombrit une couleur OKLCH ; no-op si le format n'est pas reconnu. */
function shiftL(color: string, delta: number): string {
  const m = color.match(/oklch\(\s*([\d.]+)%?\s+([\d.]+)\s+([\d.]+)/);
  if (!m) return color;
  const l = Math.min(100, Math.max(0, Number.parseFloat(m[1]!) + delta * 100));
  return `oklch(${l}% ${m[2]} ${m[3]})`;
}

export function Cinematic2({
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
  skin = 'blush',
}: Cinematic2Props) {
  const t = useTranslations('Invitation');
  const prefersReduced = useReducedMotion();
  const isReduced = reduced || !!prefersReduced;
  const [phase, setPhase] = useState<number>(0);
  const sceneRef = useRef<HTMLDivElement>(null);

  // La phase affichée est dérivée : hold (storyboard) et reduced court-circuitent
  // l'auto-play sans passer par un setState d'effet.
  const effectivePhase = holdPhase ?? (isReduced ? 5 : phase);

  // Rejoue depuis 0 quand l'identité du run change (replay via playKey, sortie
  // de hold, bascule reduced) — ajustement d'état pendant le render, pas en effet.
  const runKey = `${playKey ?? 0}|${holdPhase == null ? 'auto' : 'hold'}|${isReduced ? 'still' : 'anim'}`;
  const [prevRunKey, setPrevRunKey] = useState(runKey);
  if (runKey !== prevRunKey) {
    setPrevRunKey(runKey);
    setPhase(0);
  }

  const target = eventDate != null ? new Date(eventDate).getTime() : null;

  // Séquence d'ouverture
  useEffect(() => {
    if (holdPhase != null) return;
    if (isReduced) {
      const id = setTimeout(() => onDone?.(), 600);
      return () => clearTimeout(id);
    }
    let i = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = () => {
      if (i >= WAITS.length) {
        timer = setTimeout(() => onDone?.(), 1100);
        return;
      }
      timer = setTimeout(() => {
        i += 1;
        setPhase(i);
        tick();
      }, WAITS[i]);
    };
    tick();
    return () => {
      if (timer) clearTimeout(timer);
    };
    // onDone est stable (callback du parent) ; on rejoue sur playKey/holdPhase/reduced.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playKey, holdPhase, isReduced]);

  // Compte à rebours live : null tant que le client n'a pas pris la main (SSR
  // compris), puis recalculé à chaque tick de l'horloge 30 s.
  const clockBucket = useSyncExternalStore(subscribeToClock, getClockBucket, getServerClockBucket);
  const cd = clockBucket == null || target == null ? null : countdown(target);

  function onMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!parallax || isReduced || !sceneRef.current) return;
    const r = sceneRef.current.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    sceneRef.current.style.setProperty('--ry', `${(x * 9).toFixed(2)}deg`);
    sceneRef.current.style.setProperty('--rx', `${(-y * 6).toFixed(2)}deg`);
  }
  function onLeave() {
    if (!sceneRef.current) return;
    sceneRef.current.style.setProperty('--ry', '0deg');
    sceneRef.current.style.setProperty('--rx', '0deg');
  }

  const sceneCls = [
    'cine2-scene',
    'cine2',
    isReduced && 'reduced',
    holdPhase != null && 'frozen',
    ...PHASE_CLASSES.slice(1, effectivePhase + 1),
  ]
    .filter(Boolean)
    .join(' ');

  // Teinte sceau/accents depuis accentColor (marque blanche couple)
  const tint: React.CSSProperties = accentColor
    ? ({
        '--c-seal': accentColor,
        '--c-seal-dk': shiftL(accentColor, -0.22),
        '--c-seal-lt': shiftL(accentColor, 0.14),
        '--c-accent': shiftL(accentColor, -0.24),
      } as React.CSSProperties)
    : {};

  const initials = `${(partnerA.trim()[0] ?? '').toUpperCase()}&${(partnerB.trim()[0] ?? '').toUpperCase()}`;

  const cell = (v: number | null, u: string) => (
    <div className="cell">
      <span className="n">{v == null ? '—' : String(v).padStart(2, '0')}</span>
      <span className="u">{u}</span>
    </div>
  );

  return (
    <div
      className="cine2-stage paper-grain"
      data-skin={skin === 'sage' ? 'sage' : undefined}
      style={tint}
      role="presentation"
    >
      {live && holdPhase == null && !isReduced && (
        <button
          type="button"
          className="cine2-skip focus-ring"
          onClick={() => {
            setPhase(5);
            onDone?.();
          }}
          aria-label={t('cinematicSkipAria')}
        >
          {t('cinematicSkip')} →
        </button>
      )}

      <div className={sceneCls} ref={sceneRef} onPointerMove={onMove} onPointerLeave={onLeave}>
        <div className="cine2-parallax">
          <div className="env3d">
            <div className="e-shadow" />
            <div className="e-back" />
            <div className="e-lining" />
            <div className="e-glow" />
            <div className="e-side-l" />
            <div className="e-side-r" />
            <div className="e-front" />
            <div className="e-flap" />
            <div className="e-seal">
              <span className="seal-h seal-l" />
              <span className="seal-h seal-r" />
              <span className="seal-shine" />
              <span className="seal-mono">{initials}</span>
            </div>
          </div>

          <div className="card3d">
            <div className="card-face">
              <span className="cf-eyebrow">{t('youreInvited')}</span>
              <span className="cf-rule" />
              <div className="cf-names">
                <span className="cf-clip">
                  <span className="cf-line l1">{partnerA}</span>
                </span>
                <span className="cf-amp">&amp;</span>
                <span className="cf-clip">
                  <span className="cf-line l2">{partnerB}</span>
                </span>
              </div>
              <span className="cf-rule" />
              <span className="cf-date">
                {formattedDate}
                {venueName ? ` · ${venueName}` : ''}
              </span>
            </div>
          </div>
        </div>

        <div className="cine2-orn" aria-hidden>
          <span className="o1">✦</span>
          <span className="o2">✦</span>
          <span className="o3">✦</span>
          <span className="o4">✦</span>
        </div>

        {target != null && (
          <div className="cine2-after">
            <div className="lbl">{t('countdownLabel')}</div>
            <div className="cine2-cd">
              {cell(cd?.d ?? null, t('countdownDays'))}
              <span className="sep">:</span>
              {cell(cd?.h ?? null, t('countdownHours'))}
              <span className="sep">:</span>
              {cell(cd?.m ?? null, t('countdownMinutes'))}
            </div>
          </div>
        )}
      </div>

      <p
        className="cine2-cue"
        style={{ opacity: effectivePhase >= 4 && effectivePhase < 5 ? 1 : 0 }}
      >
        <span className="t">{t('scrollToDiscover')}</span>
      </p>
    </div>
  );
}
