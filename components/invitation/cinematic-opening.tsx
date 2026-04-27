'use client';

import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useState } from 'react';

/**
 * Cinématique d'ouverture invitation V4 — auto-play full-screen.
 *
 * Pattern Awwwards (50% du WoW factor selon le brief) : quand un invité
 * ouvre son lien WhatsApp, il reçoit une animation de 4-5s qui plante
 * l'émotion avant de révéler les détails du mariage.
 *
 * Phases orchestrées (tout auto-play, pas scroll-driven) :
 *   00.  envelope     — enveloppe scellée centrée, halo blush
 *   01.  seal-break   — sceau de cire éclate en 2 morceaux (spring)
 *   02.  flap-open    — rabat se déplie vers le haut (perspective)
 *   03.  card-emerge  — carte sort vers le haut avec léger swing
 *   04.  flourish     — motifs floraux apparaissent autour
 *   05.  reveal       — couple + date + lieu se révèlent en stagger
 *   06.  done         — déclenche onComplete pour passer au content
 *
 * Skip button toujours visible (top-right) pour accessibility.
 * prefers-reduced-motion → skip direct vers done.
 *
 * Couleur d'accent personnalisée via prop accentColor (theme.primaryColor
 * du couple). Fallback sur le blush V4 par défaut.
 */
export interface CinematicOpeningProps {
  partnerA: string;
  partnerB: string;
  formattedDate: string;
  venueName?: string;
  /** Couleur d'accent du couple — sceau cire + filets. Fallback blush. */
  accentColor?: string;
  /** Callback déclenché quand la cinématique se termine OU est skippée. */
  onComplete: () => void;
}

type Phase =
  | 'envelope'
  | 'seal-break'
  | 'flap-open'
  | 'card-emerge'
  | 'flourish'
  | 'reveal'
  | 'done';

// Délais cumulatifs entre phases (ms). Total ~4.6s.
const PHASE_TIMING: Record<Phase, number> = {
  envelope: 600,
  'seal-break': 700,
  'flap-open': 800,
  'card-emerge': 1000,
  flourish: 700,
  reveal: 800,
  done: 0,
};

export function CinematicOpening({
  partnerA,
  partnerB,
  formattedDate,
  venueName,
  accentColor,
  onComplete,
}: CinematicOpeningProps) {
  const reduced = useReducedMotion();
  const [phase, setPhase] = useState<Phase>('envelope');
  const [skipped, setSkipped] = useState(false);
  const accent = accentColor ?? 'oklch(72% 0.09 20)';

  // Orchestration des phases via setTimeout chaîné. Si reduced-motion,
  // on saute directement au done.
  useEffect(() => {
    if (reduced) {
      setPhase('done');
      onComplete();
      return;
    }
    if (skipped) return;

    const sequence: Phase[] = [
      'envelope',
      'seal-break',
      'flap-open',
      'card-emerge',
      'flourish',
      'reveal',
      'done',
    ];

    let idx = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;

    function next() {
      if (idx >= sequence.length - 1) {
        onComplete();
        return;
      }
      const current = sequence[idx]!;
      timer = setTimeout(() => {
        idx += 1;
        setPhase(sequence[idx]!);
        next();
      }, PHASE_TIMING[current]);
    }

    next();

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [reduced, skipped, onComplete]);

  function handleSkip() {
    setSkipped(true);
    setPhase('done');
    onComplete();
  }

  const sealBroken =
    phase === 'seal-break' ||
    phase === 'flap-open' ||
    phase === 'card-emerge' ||
    phase === 'flourish' ||
    phase === 'reveal' ||
    phase === 'done';
  const flapOpen =
    phase === 'flap-open' ||
    phase === 'card-emerge' ||
    phase === 'flourish' ||
    phase === 'reveal' ||
    phase === 'done';
  const cardEmerged =
    phase === 'card-emerge' || phase === 'flourish' || phase === 'reveal' || phase === 'done';
  const flourishVisible = phase === 'flourish' || phase === 'reveal' || phase === 'done';
  const revealText = phase === 'reveal' || phase === 'done';

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden"
      style={{
        background: [
          'radial-gradient(60% 50% at 50% 30%, oklch(95% 0.025 22 / 70%) 0%, transparent 75%)',
          'oklch(98.5% 0.008 85)',
        ].join(', '),
      }}
      role="presentation"
    >
      {/* Texture grain papier */}
      <div aria-hidden className="paper-grain pointer-events-none absolute inset-0" />

      {/* Skip button — accessibility */}
      <button
        type="button"
        onClick={handleSkip}
        className="focus-ring absolute top-6 right-6 z-10 font-mono text-[10px] tracking-[0.32em] text-[color:var(--color-ink-500)] uppercase transition-colors hover:text-[color:var(--color-ink-900)]"
        aria-label="Passer la cinématique"
      >
        Passer →
      </button>

      {/* Stage SVG — l'enveloppe et la carte vivent ici. viewBox compact pour
          éviter qu'on doive jongler avec des coordonnées négatives complexes. */}
      <svg
        viewBox="-220 -300 440 600"
        className="h-[70vh] max-h-[600px] w-full max-w-[480px]"
        aria-hidden
      >
        <defs>
          <filter id="cin-paper-grain" x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.85"
              numOctaves="2"
              stitchTiles="stitch"
              result="noise"
            />
            <feColorMatrix
              in="noise"
              type="matrix"
              values="0 0 0 0 0.4
                      0 0 0 0 0.3
                      0 0 0 0 0.25
                      0 0 0 0.08 0"
            />
            <feComposite in2="SourceGraphic" operator="in" />
          </filter>
          <filter id="cin-card-shadow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="6" />
            <feOffset dx="0" dy="14" result="offsetblur" />
            <feFlood floodColor="oklch(48% 0.085 22)" floodOpacity="0.25" />
            <feComposite in2="offsetblur" operator="in" />
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="cin-env-shadow" x="-15%" y="-15%" width="130%" height="130%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="3" />
            <feOffset dx="0" dy="6" result="offsetblur" />
            <feFlood floodColor="oklch(48% 0.085 22)" floodOpacity="0.2" />
            <feComposite in2="offsetblur" operator="in" />
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <radialGradient id="cin-wax" cx="40%" cy="35%" r="65%">
            <stop offset="0%" stopColor={lightenColor(accent, 0.3)} />
            <stop offset="55%" stopColor={accent} />
            <stop offset="100%" stopColor={darkenColor(accent, 0.3)} />
          </radialGradient>
          <linearGradient id="cin-card-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="oklch(98.5% 0.008 85)" />
            <stop offset="100%" stopColor="oklch(95% 0.025 22)" />
          </linearGradient>
          <linearGradient id="cin-env-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="oklch(96% 0.022 80)" />
            <stop offset="100%" stopColor="oklch(91% 0.045 22)" />
          </linearGradient>
        </defs>

        {/* Motifs floraux (apparition phase 4) */}
        <motion.g
          initial={{ opacity: 0 }}
          animate={{ opacity: flourishVisible ? 1 : 0 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        >
          <FlourishOrnament cx={-180} cy={-200} scale={0.85} accent={accent} delay={0} />
          <FlourishOrnament cx={180} cy={-200} scale={0.85} accent={accent} delay={0.1} flip />
          <FlourishOrnament cx={-200} cy={60} scale={0.6} accent={accent} delay={0.2} />
          <FlourishOrnament cx={200} cy={60} scale={0.6} accent={accent} delay={0.3} flip />
        </motion.g>

        {/* Carte (cachée derrière l'enveloppe, sort en phase card-emerge) */}
        <motion.g
          filter="url(#cin-card-shadow)"
          initial={{ y: 0, rotate: 0, opacity: 0 }}
          animate={{
            y: cardEmerged ? -180 : 0,
            rotate: cardEmerged ? -1.5 : 0,
            opacity: cardEmerged ? 1 : 0,
          }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
        >
          <g transform="translate(0, -35)">
            <rect
              x="-100"
              y="-145"
              width="200"
              height="260"
              rx="4"
              fill="url(#cin-card-grad)"
              stroke="oklch(82% 0.045 22)"
              strokeWidth="0.6"
            />
            <rect
              x="-100"
              y="-145"
              width="200"
              height="260"
              rx="4"
              filter="url(#cin-paper-grain)"
              opacity="0.4"
            />
            <line x1="-65" y1="-105" x2="65" y2="-105" stroke={accent} strokeWidth="0.5" />
            <text
              x="0"
              y="-65"
              textAnchor="middle"
              fontFamily="var(--font-mono)"
              fontWeight="500"
              fontSize="9"
              fill="oklch(45% 0.022 28)"
              letterSpacing="2"
            >
              VOUS ÊTES INVITÉS
            </text>
            <motion.text
              x="0"
              y="-15"
              textAnchor="middle"
              fontFamily="var(--font-display)"
              fontStyle="italic"
              fontWeight="400"
              fontSize="34"
              fill="oklch(22% 0.018 28)"
              letterSpacing="-0.025em"
              initial={{ opacity: 0 }}
              animate={{ opacity: revealText ? 1 : 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              {partnerA}
            </motion.text>
            <motion.text
              x="0"
              y="14"
              textAnchor="middle"
              fontFamily="var(--font-display)"
              fontStyle="italic"
              fontWeight="300"
              fontSize="14"
              fill={accent}
              letterSpacing="0.4em"
              initial={{ opacity: 0 }}
              animate={{ opacity: revealText ? 1 : 0 }}
              transition={{ duration: 0.5, delay: 0.25 }}
            >
              &amp;
            </motion.text>
            <motion.text
              x="0"
              y="50"
              textAnchor="middle"
              fontFamily="var(--font-display)"
              fontStyle="italic"
              fontWeight="400"
              fontSize="34"
              fill="oklch(22% 0.018 28)"
              letterSpacing="-0.025em"
              initial={{ opacity: 0 }}
              animate={{ opacity: revealText ? 1 : 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              {partnerB}
            </motion.text>
            <line x1="-40" y1="80" x2="40" y2="80" stroke={accent} strokeWidth="0.5" />
            <motion.text
              x="0"
              y="100"
              textAnchor="middle"
              fontFamily="var(--font-mono)"
              fontWeight="500"
              fontSize="8"
              fill="oklch(45% 0.022 28)"
              letterSpacing="2"
              initial={{ opacity: 0 }}
              animate={{ opacity: revealText ? 1 : 0 }}
              transition={{ duration: 0.5, delay: 0.55 }}
            >
              {formattedDate}
              {venueName ? ` · ${venueName.toUpperCase()}` : ''}
            </motion.text>
          </g>
        </motion.g>

        {/* Enveloppe corps */}
        <g filter="url(#cin-env-shadow)">
          <rect
            x="-115"
            y="-90"
            width="230"
            height="170"
            rx="3"
            fill="url(#cin-env-grad)"
            stroke={accent}
            strokeWidth="0.8"
          />
          <path d="M -115 80 L 0 -8 L 115 80 Z" fill="oklch(91% 0.045 22)" opacity="0.55" />
          <rect
            x="-115"
            y="-90"
            width="230"
            height="170"
            rx="3"
            filter="url(#cin-paper-grain)"
            opacity="0.5"
          />
        </g>

        {/* Sceau cire — 2 moitiés (left + right) */}
        <motion.path
          d="M 0 -16 L -4 -14 L -10 -10 L -14 -4 L -16 4 L -14 12 L -8 16 L -2 16 L 0 12 L 0 0 Z"
          fill="url(#cin-wax)"
          stroke={darkenColor(accent, 0.4)}
          strokeWidth="0.4"
          opacity="0.95"
          initial={{ x: 0, y: 0, rotate: 0 }}
          animate={{
            x: sealBroken ? -22 : 0,
            y: sealBroken ? 8 : 0,
            rotate: sealBroken ? -25 : 0,
          }}
          transition={{ type: 'spring', stiffness: 220, damping: 15, mass: 0.6 }}
        />
        <motion.path
          d="M 0 -16 L 4 -14 L 10 -10 L 14 -4 L 16 4 L 14 12 L 8 16 L 2 16 L 0 12 L 0 0 Z"
          fill="url(#cin-wax)"
          stroke={darkenColor(accent, 0.4)}
          strokeWidth="0.4"
          opacity="0.95"
          initial={{ x: 0, y: 0, rotate: 0 }}
          animate={{
            x: sealBroken ? 22 : 0,
            y: sealBroken ? 8 : 0,
            rotate: sealBroken ? 30 : 0,
          }}
          transition={{ type: 'spring', stiffness: 220, damping: 15, mass: 0.6 }}
        />
        <motion.text
          x="0"
          y="6"
          textAnchor="middle"
          fontFamily="var(--font-display)"
          fontStyle="italic"
          fontWeight="500"
          fontSize="14"
          fill="oklch(28% 0.05 26)"
          opacity="0.7"
          pointerEvents="none"
          initial={{ opacity: 0.7, scale: 1 }}
          animate={{
            opacity: sealBroken ? 0 : 0.7,
            scale: sealBroken ? 0.6 : 1,
          }}
          transition={{ duration: 0.3 }}
        >
          W
        </motion.text>

        {/* Flap (rabat) qui se déplie en perspective */}
        <motion.g style={{ transformOrigin: '0px -90px' }}>
          <motion.path
            d="M -115 -90 L 0 12 L 115 -90 Z"
            fill="oklch(92% 0.035 80)"
            stroke={accent}
            strokeWidth="0.8"
            initial={{ rotateX: 0 }}
            animate={{ rotateX: flapOpen ? -178 : 0 }}
            transition={{ duration: 0.9, ease: [0.7, 0, 0.3, 1] }}
            style={{ transformOrigin: '0px -90px', transformBox: 'fill-box' as never }}
          />
        </motion.g>
      </svg>

      {/* Texte introductif sous la cinématique — apparait en phase reveal */}
      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: revealText ? 1 : 0, y: revealText ? 0 : 8 }}
        transition={{ duration: 0.6, delay: 0.7, ease: 'easeOut' }}
        className="mt-8 font-mono text-[10px] tracking-[0.32em] text-[color:var(--color-ink-500)] uppercase"
      >
        Faites défiler pour découvrir
      </motion.p>
    </div>
  );
}

/**
 * Petit fleuron floral SVG répété autour de la carte avec stagger.
 */
function FlourishOrnament({
  cx,
  cy,
  scale,
  accent,
  delay,
  flip,
}: {
  cx: number;
  cy: number;
  scale: number;
  accent: string;
  delay: number;
  flip?: boolean;
}) {
  return (
    <motion.g
      transform={`translate(${cx} ${cy}) scale(${flip ? -scale : scale} ${scale})`}
      initial={{ opacity: 0, scale: 0.5, y: 30 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.8, delay, ease: 'easeOut' }}
    >
      <path
        d="M 0 0 C 12 -10 32 -16 52 -10 C 64 -7 74 -2 80 8 M 52 -10 C 58 -28 50 -44 32 -54 M 80 8 C 90 16 92 28 86 38"
        fill="none"
        stroke={accent}
        strokeWidth="1"
        strokeLinecap="round"
      />
      <circle cx="52" cy="-10" r="3.5" fill={lightenColor(accent, 0.2)} />
      <circle cx="32" cy="-54" r="2.8" fill={accent} />
      <circle cx="80" cy="8" r="2.4" fill={lightenColor(accent, 0.2)} />
      <circle cx="86" cy="38" r="2" fill={accent} />
    </motion.g>
  );
}

/**
 * Helpers couleur — manipulent une couleur OKLCH approximativement.
 * Pour un override theme.primaryColor au format hex/oklch, on retombe en
 * cas d'erreur sur la valeur d'origine (no-op).
 */
function lightenColor(color: string, amount: number): string {
  const match = color.match(/oklch\(\s*([\d.]+)%?\s+([\d.]+)\s+([\d.]+)/);
  if (!match) return color;
  const [, l, c, h] = match;
  const newL = Math.min(100, Number.parseFloat(l!) + amount * 100);
  return `oklch(${newL}% ${c} ${h})`;
}

function darkenColor(color: string, amount: number): string {
  const match = color.match(/oklch\(\s*([\d.]+)%?\s+([\d.]+)\s+([\d.]+)/);
  if (!match) return color;
  const [, l, c, h] = match;
  const newL = Math.max(0, Number.parseFloat(l!) - amount * 100);
  return `oklch(${newL}% ${c} ${h})`;
}
