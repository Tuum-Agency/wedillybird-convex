'use client';

import { useTranslations } from 'next-intl';

/**
 * Mini-visuels SVG pour les 4 piliers V4.
 *
 * Chaque visuel illustre la fonctionnalité de manière abstraite et éditoriale —
 * pas un mockup d'écran cliché, plutôt une "marque graphique" qui devient
 * mémorable. Pattern Stripe / Linear features illustrations.
 *
 * Tous en SVG pur (palette blush + champagne + ivoire), perf-friendly,
 * réagissent au hover du parent (.group:hover) avec micro-animations CSS.
 */

export function VisualInvitations() {
  const t = useTranslations('Landing.features.visuals');
  return (
    <svg viewBox="0 0 240 160" className="h-full w-full" aria-hidden>
      <defs>
        <linearGradient id="bubble-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="oklch(95% 0.025 22)" />
          <stop offset="100%" stopColor="oklch(91% 0.045 22)" />
        </linearGradient>
        <linearGradient id="card-grad-i" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="oklch(98% 0.012 25)" />
          <stop offset="100%" stopColor="oklch(95% 0.025 22)" />
        </linearGradient>
      </defs>

      {/* Bulles WhatsApp en cascade */}
      <g className="origin-center transition-transform duration-700 [.group:hover_&]:scale-105">
        <rect
          x="20"
          y="22"
          width="110"
          height="22"
          rx="11"
          fill="url(#bubble-grad)"
          stroke="oklch(82% 0.045 22)"
          strokeWidth="0.6"
        />
        <text x="32" y="36" fontFamily="var(--font-sans)" fontSize="9" fill="oklch(28% 0.02 28)">
          {t('invitationSent')}
        </text>

        <rect
          x="60"
          y="56"
          width="160"
          height="80"
          rx="6"
          fill="url(#card-grad-i)"
          stroke="oklch(78% 0.075 78)"
          strokeWidth="0.6"
        />
        <text
          x="140"
          y="80"
          textAnchor="middle"
          fontFamily="var(--font-mono)"
          fontSize="7"
          fill="oklch(58% 0.075 80)"
          letterSpacing="2"
        >
          {t('invitationKicker')}
        </text>
        <text
          x="140"
          y="104"
          textAnchor="middle"
          fontFamily="var(--font-display)"
          fontStyle="italic"
          fontSize="22"
          fill="oklch(22% 0.018 28)"
          letterSpacing="-0.025em"
        >
          Camille &amp; Hugo
        </text>
        <line x1="115" y1="116" x2="165" y2="116" stroke="oklch(78% 0.075 78)" strokeWidth="0.5" />
        <text
          x="140"
          y="128"
          textAnchor="middle"
          fontFamily="var(--font-mono)"
          fontSize="6"
          fill="oklch(45% 0.022 28)"
          letterSpacing="2"
        >
          {t('invitationDate')}
        </text>
      </g>

      {/* Coche "vu" verte WhatsApp en bas-droite */}
      <g
        className="origin-center transition-opacity duration-500 [.group:hover_&]:opacity-100"
        opacity="0.6"
      >
        <path
          d="M 195 138 L 200 143 L 211 132 M 199 138 L 204 143 L 215 132"
          fill="none"
          stroke="oklch(50% 0.08 145)"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}

export function VisualRSVP() {
  const t = useTranslations('Landing.features.visuals');
  return (
    <svg viewBox="0 0 240 160" className="h-full w-full" aria-hidden>
      <defs>
        <linearGradient id="rsvp-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="oklch(98% 0.012 25)" />
          <stop offset="100%" stopColor="oklch(95% 0.025 22)" />
        </linearGradient>
      </defs>

      {/* Donut chart — confirmés / déclinés / en attente */}
      <g transform="translate(80 80)">
        {/* Background ring */}
        <circle cx="0" cy="0" r="48" fill="none" stroke="oklch(94% 0.022 78)" strokeWidth="14" />
        {/* Confirmés (73%, blush) */}
        <circle
          cx="0"
          cy="0"
          r="48"
          fill="none"
          stroke="oklch(72% 0.09 20)"
          strokeWidth="14"
          strokeDasharray="220 301"
          strokeDashoffset="0"
          transform="rotate(-90)"
          strokeLinecap="round"
          className="origin-center transition-all duration-700 [.group:hover_&]:[stroke-dasharray:240_301]"
        />
        {/* Déclinés (12%, gold) */}
        <circle
          cx="0"
          cy="0"
          r="48"
          fill="none"
          stroke="oklch(78% 0.075 78)"
          strokeWidth="14"
          strokeDasharray="36 265"
          strokeDashoffset="-220"
          transform="rotate(-90)"
          strokeLinecap="round"
        />

        <text
          x="0"
          y="-2"
          textAnchor="middle"
          fontFamily="var(--font-sans)"
          fontWeight="200"
          fontSize="32"
          fill="oklch(22% 0.018 28)"
          letterSpacing="-0.04em"
        >
          73
        </text>
        <text
          x="0"
          y="14"
          textAnchor="middle"
          fontFamily="var(--font-mono)"
          fontSize="7"
          fill="oklch(45% 0.022 28)"
          letterSpacing="2"
        >
          {t('rsvpConfirmed')}
        </text>
      </g>

      {/* Petites lignes RSVP à droite */}
      <g transform="translate(150 38)">
        <RsvpRow y={0} status="confirmed" name="Aminata D." />
        <RsvpRow y={20} status="confirmed" name="Léa &amp; Tom" />
        <RsvpRow y={40} status="pending" name="Mamadou K." />
        <RsvpRow y={60} status="confirmed" name="Sophie &amp; Antoine" />
        <RsvpRow y={80} status="declined" name="Awa N." />
      </g>
    </svg>
  );
}

function RsvpRow({
  y,
  status,
  name,
}: {
  y: number;
  status: 'confirmed' | 'declined' | 'pending';
  name: string;
}) {
  const colorMap = {
    confirmed: 'oklch(72% 0.09 20)',
    declined: 'oklch(78% 0.075 78)',
    pending: 'oklch(82% 0.045 78)',
  };
  return (
    <g transform={`translate(0 ${y})`}>
      <circle cx="4" cy="6" r="2.5" fill={colorMap[status]} />
      <text x="14" y="10" fontFamily="var(--font-sans)" fontSize="9" fill="oklch(28% 0.02 28)">
        {name}
      </text>
    </g>
  );
}

export function VisualCheckin() {
  const t = useTranslations('Landing.features.visuals');
  return (
    <svg viewBox="0 0 240 160" className="h-full w-full" aria-hidden>
      <defs>
        <linearGradient id="qr-card-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="oklch(98% 0.012 25)" />
          <stop offset="100%" stopColor="oklch(94% 0.022 78)" />
        </linearGradient>
      </defs>

      {/* Carte QR centrée */}
      <g transform="translate(80 22)">
        <rect
          x="0"
          y="0"
          width="80"
          height="116"
          rx="6"
          fill="url(#qr-card-grad)"
          stroke="oklch(78% 0.075 78)"
          strokeWidth="0.6"
        />

        {/* QR code stylisé (3 finder patterns + dots) */}
        <g transform="translate(14 14)">
          {/* Finder pattern haut-gauche */}
          <rect x="0" y="0" width="14" height="14" rx="1.5" fill="oklch(22% 0.018 28)" />
          <rect x="3" y="3" width="8" height="8" rx="0.5" fill="oklch(98% 0.012 25)" />
          <rect x="5" y="5" width="4" height="4" fill="oklch(22% 0.018 28)" />

          {/* Finder pattern haut-droit */}
          <rect x="38" y="0" width="14" height="14" rx="1.5" fill="oklch(22% 0.018 28)" />
          <rect x="41" y="3" width="8" height="8" rx="0.5" fill="oklch(98% 0.012 25)" />
          <rect x="43" y="5" width="4" height="4" fill="oklch(22% 0.018 28)" />

          {/* Finder pattern bas-gauche */}
          <rect x="0" y="38" width="14" height="14" rx="1.5" fill="oklch(22% 0.018 28)" />
          <rect x="3" y="41" width="8" height="8" rx="0.5" fill="oklch(98% 0.012 25)" />
          <rect x="5" y="43" width="4" height="4" fill="oklch(22% 0.018 28)" />

          {/* Modules data (faux pattern aléatoire mais consistant) */}
          {[
            [16, 0],
            [20, 0],
            [24, 0],
            [28, 0],
            [32, 0],
            [16, 4],
            [22, 4],
            [30, 4],
            [16, 8],
            [20, 8],
            [26, 8],
            [32, 8],
            [0, 16],
            [4, 16],
            [12, 16],
            [16, 16],
            [22, 16],
            [28, 16],
            [34, 16],
            [40, 16],
            [44, 16],
            [50, 16],
            [4, 20],
            [10, 20],
            [16, 20],
            [24, 20],
            [30, 20],
            [38, 20],
            [44, 20],
            [0, 24],
            [8, 24],
            [14, 24],
            [22, 24],
            [28, 24],
            [34, 24],
            [42, 24],
            [50, 24],
            [4, 28],
            [12, 28],
            [18, 28],
            [26, 28],
            [32, 28],
            [40, 28],
            [46, 28],
            [0, 32],
            [8, 32],
            [16, 32],
            [22, 32],
            [30, 32],
            [38, 32],
            [44, 32],
            [50, 32],
            [16, 38],
            [24, 38],
            [30, 38],
            [40, 38],
            [44, 38],
            [50, 38],
            [16, 42],
            [22, 42],
            [28, 42],
            [38, 42],
            [44, 42],
            [16, 46],
            [20, 46],
            [26, 46],
            [32, 46],
            [42, 46],
            [50, 46],
            [16, 50],
            [22, 50],
            [30, 50],
            [38, 50],
            [44, 50],
          ].map(([x, y], idx) => (
            <rect key={idx} x={x} y={y} width="3" height="3" fill="oklch(22% 0.018 28)" />
          ))}
        </g>

        <text
          x="40"
          y="92"
          textAnchor="middle"
          fontFamily="var(--font-mono)"
          fontSize="6"
          fill="oklch(45% 0.022 28)"
          letterSpacing="1.5"
        >
          {t('checkinGuestId')}
        </text>

        <text
          x="40"
          y="106"
          textAnchor="middle"
          fontFamily="var(--font-display)"
          fontStyle="italic"
          fontSize="11"
          fill="oklch(22% 0.018 28)"
          letterSpacing="-0.018em"
        >
          Aminata D.
        </text>
      </g>

      {/* Faisceau de scan animé */}
      <g className="opacity-0 transition-opacity duration-500 [.group:hover_&]:opacity-100">
        <line
          x1="80"
          y1="80"
          x2="160"
          y2="80"
          stroke="oklch(72% 0.09 20)"
          strokeWidth="1.5"
          opacity="0.85"
        >
          <animate attributeName="y1" values="22;138;22" dur="2.4s" repeatCount="indefinite" />
          <animate attributeName="y2" values="22;138;22" dur="2.4s" repeatCount="indefinite" />
        </line>
      </g>

      {/* Indicateur "offline" en haut-gauche — positionné au-dessus du
          niveau du haut de la carte QR (y=22) pour éviter qu'il semble
          collé à la carte sur la même ligne horizontale. */}
      <g transform="translate(20 12)">
        <circle cx="0" cy="0" r="3" fill="oklch(50% 0.08 145)" />
        <text
          x="9"
          y="3"
          fontFamily="var(--font-mono)"
          fontSize="7"
          fill="oklch(28% 0.02 28)"
          letterSpacing="1.5"
        >
          {t('checkinOffline')}
        </text>
      </g>
    </svg>
  );
}

export function VisualGallery() {
  const t = useTranslations('Landing.features.visuals');
  return (
    <svg viewBox="0 0 240 160" className="h-full w-full" aria-hidden>
      <defs>
        <linearGradient id="polaroid-grad-1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="oklch(91% 0.045 22)" />
          <stop offset="100%" stopColor="oklch(82% 0.085 22)" />
        </linearGradient>
        <linearGradient id="polaroid-grad-2" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="oklch(92% 0.035 80)" />
          <stop offset="100%" stopColor="oklch(78% 0.075 78)" />
        </linearGradient>
        <linearGradient id="polaroid-grad-3" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="oklch(95% 0.025 22)" />
          <stop offset="100%" stopColor="oklch(85% 0.06 22)" />
        </linearGradient>
      </defs>

      {/* 3 polaroids en éventail */}
      {/* Polaroid 1 — gauche, rotaté -8° */}
      <g
        transform="translate(35 28) rotate(-8)"
        className="origin-center transition-transform duration-700 [.group:hover_&]:translate-x-[-4px] [.group:hover_&]:rotate-[-12deg]"
      >
        <rect
          x="0"
          y="0"
          width="64"
          height="80"
          fill="white"
          stroke="oklch(85% 0.06 22)"
          strokeWidth="0.8"
        />
        <rect x="6" y="6" width="52" height="52" fill="url(#polaroid-grad-1)" />
        <text
          x="32"
          y="74"
          textAnchor="middle"
          fontFamily="var(--font-display)"
          fontStyle="italic"
          fontSize="9"
          fill="oklch(28% 0.02 28)"
        >
          {t('galleryCaption1')}
        </text>
      </g>

      {/* Polaroid 2 — centre, droit */}
      <g
        transform="translate(95 22)"
        className="origin-center transition-transform duration-700 [.group:hover_&]:translate-y-[-4px]"
      >
        <rect
          x="0"
          y="0"
          width="64"
          height="80"
          fill="white"
          stroke="oklch(85% 0.06 22)"
          strokeWidth="0.8"
        />
        <rect x="6" y="6" width="52" height="52" fill="url(#polaroid-grad-2)" />
        <text
          x="32"
          y="74"
          textAnchor="middle"
          fontFamily="var(--font-display)"
          fontStyle="italic"
          fontSize="9"
          fill="oklch(28% 0.02 28)"
        >
          {t('galleryCaption2')}
        </text>
      </g>

      {/* Polaroid 3 — droite, rotaté +6° */}
      <g
        transform="translate(155 30) rotate(6)"
        className="origin-center transition-transform duration-700 [.group:hover_&]:translate-x-[4px] [.group:hover_&]:rotate-[10deg]"
      >
        <rect
          x="0"
          y="0"
          width="64"
          height="80"
          fill="white"
          stroke="oklch(85% 0.06 22)"
          strokeWidth="0.8"
        />
        <rect x="6" y="6" width="52" height="52" fill="url(#polaroid-grad-3)" />
        <text
          x="32"
          y="74"
          textAnchor="middle"
          fontFamily="var(--font-display)"
          fontStyle="italic"
          fontSize="9"
          fill="oklch(28% 0.02 28)"
        >
          {t('galleryCaption3')}
        </text>
      </g>

      {/* Compteur "+ 247 photos" en bas */}
      <g transform="translate(120 138)">
        <rect
          x="-44"
          y="-10"
          width="88"
          height="18"
          rx="9"
          fill="white"
          stroke="oklch(85% 0.06 22)"
          strokeWidth="0.6"
        />
        <text
          x="0"
          y="3"
          textAnchor="middle"
          fontFamily="var(--font-mono)"
          fontSize="8"
          fill="oklch(48% 0.085 22)"
          letterSpacing="2"
          textLength="80"
          lengthAdjust="spacingAndGlyphs"
        >
          {t('galleryCounter')}
        </text>
      </g>
    </svg>
  );
}
