'use client';
// AUTO-PORTED from Claude Design bundle (couple/mc-parts.jsx), typed.
// Primitives partagées : McBtn · Fleuron · Ornament · CoupleNames · McPill ·
// RsvpDonut · QuotaGauge · QrMono · RingChart.

import { type CSSProperties, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Icon } from './icons';

type BtnVariant = 'primary' | 'outline' | 'ghost' | 'soft' | 'halo';
type BtnSize = 'sm' | 'md' | 'lg';

export function McBtn({
  variant = 'primary',
  size = 'md',
  block,
  children,
  onClick,
  style,
  disabled,
  type = 'button',
  ariaLabel,
  className,
}: {
  variant?: BtnVariant;
  size?: BtnSize;
  block?: boolean;
  children: ReactNode;
  onClick?: () => void;
  style?: CSSProperties;
  disabled?: boolean;
  type?: 'button' | 'submit';
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <button
      type={type}
      aria-label={ariaLabel}
      onClick={onClick}
      disabled={disabled}
      className={`mc-btn ${variant} ${size}${block ? 'block' : ''}${className ? ' ' + className : ''}`}
      style={style}
    >
      {children}
    </button>
  );
}

export function Fleuron({ size = 14, style }: { size?: number; style?: CSSProperties }) {
  return (
    <span className="mc-fleuron" style={{ fontSize: size, ...style }}>
      ✦
    </span>
  );
}

export function Ornament({ size = 14 }: { size?: number }) {
  return (
    <div className="mc-ornament">
      <Fleuron size={size} />
    </div>
  );
}

/* « Camille & Hugo » — & teinté blush */
export function CoupleNames({ names, className }: { names: string; className?: string }) {
  const parts = String(names).split('&');
  return (
    <span className={className}>
      {parts.map((p, i) => (
        <span key={i}>
          {i > 0 && <span className="amp">&amp;</span>}
          {p.trim()}
          {i < parts.length - 1 ? ' ' : ''}
        </span>
      ))}
    </span>
  );
}

export function McPill({ kind, children }: { kind: string; children: ReactNode }) {
  return (
    <span className={'mc-pill ' + kind}>
      <span className="d" />
      {children}
    </span>
  );
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    !!window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/* Donut RSVP — sage=confirmé, blush=attente, danger=refusé, muted=sans réponse */
export function RsvpDonut({
  confirmed,
  pending,
  declined,
  noreply,
  size = 152,
  stroke = 22,
}: {
  confirmed: number;
  pending: number;
  declined: number;
  noreply: number;
  size?: number;
  stroke?: number;
}) {
  const t = useTranslations('MonMariage.common');
  const reduce = prefersReducedMotion();
  const r = (size - stroke) / 2;
  const C = 2 * Math.PI * r;
  const segs = [
    { v: confirmed, c: 'var(--color-sage-500)' },
    { v: pending, c: 'var(--color-blush-400)' },
    { v: declined, c: 'var(--color-danger)' },
    { v: noreply, c: 'var(--color-border-strong)' },
  ].filter((s) => s.v > 0);
  const sum = segs.reduce((a, s) => a + s.v, 0) || 1;
  const gap = segs.length > 1 ? 0.012 : 0;
  const fracs = segs.map((s) => s.v / sum);
  const arcs = segs.map((s, i) => {
    const seg = Math.max(fracs[i]! - gap, 0.001);
    const prior = fracs.slice(0, i).reduce((a, b) => a + b, 0);
    return { key: i, c: s.c, len: seg * C, off: -prior * C };
  });
  return (
    <div
      className="mc-donut"
      style={{ width: size, height: size }}
      role="img"
      aria-label={t('donutAria', { confirmed, sum })}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-surface-elevated)"
          strokeWidth={stroke}
        />
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          {arcs.map((a) => (
            <circle
              key={a.key}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={a.c}
              strokeWidth={stroke}
              strokeDasharray={`${a.len} ${C - a.len}`}
              strokeDashoffset={a.off}
              strokeLinecap="butt"
              style={{ transition: reduce ? 'none' : 'stroke-dasharray .9s var(--ease-out-quint)' }}
            />
          ))}
        </g>
      </svg>
      <div className="mc-donut-c">
        <span className="v">{confirmed}</span>
        <span className="l">{t('confirmed')}</span>
      </div>
    </div>
  );
}

/* Jauge de quota — alerte douce à 80 %, pleine à 100 % */
export function QuotaGauge({
  icon,
  label,
  sub,
  used,
  cap,
  fmt,
  gold,
}: {
  icon: string;
  label: string;
  sub?: string;
  used: number;
  cap: number;
  fmt?: (n: number) => string | number;
  gold?: boolean;
}) {
  const t = useTranslations('MonMariage.common');
  const pct = Math.min(100, Math.round((used / cap) * 100));
  const state = pct >= 100 ? 'full' : pct >= 80 ? 'warn' : '';
  const note =
    pct >= 100 ? t('quotaFull') : pct >= 80 ? t('quotaWarn', { pct }) : t('quotaUsed', { pct });
  const f = fmt || ((n: number) => n);
  return (
    <div className={'mc-quota ' + state}>
      <div className="qh">
        <span className={'qic' + (gold ? ' gold' : '')}>
          <Icon name={icon} size={17} stroke={1.9} />
        </span>
        <span className="qt">
          <b>{label}</b>
          {sub && <span>{sub}</span>}
        </span>
        <span className="qv">
          {f(used)} <em>/ {f(cap)}</em>
        </span>
      </div>
      <div className="qtrack">
        <i style={{ width: pct + '%' }} />
      </div>
      <span className={'qnote' + (state ? '' : ' calm')}>
        {state && <Icon name={pct >= 100 ? 'CircleAlert' : 'Info'} size={13} stroke={1.9} />}
        {note}
      </span>
    </div>
  );
}

/* QR mono déterministe (mockup — finder patterns + remplissage seedé).
   Calcul pur hors render (réassignations locales interdites en render par le React Compiler). */
const QR_N = 25;
function qrCells(seed: string): Array<[number, number]> {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const rnd = () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return ((h >>> 0) % 1000) / 1000;
  };
  const finder = (r: number, c: number): boolean | null => {
    const inBox = (r0: number, c0: number) => r >= r0 && r < r0 + 7 && c >= c0 && c < c0 + 7;
    const boxes: ReadonlyArray<[number, number]> = [
      [0, 0],
      [0, QR_N - 7],
      [QR_N - 7, 0],
    ];
    for (const [r0, c0] of boxes) {
      if (inBox(r0, c0)) {
        const rr = r - r0,
          cc = c - c0;
        const ring = rr === 0 || rr === 6 || cc === 0 || cc === 6;
        const core = rr >= 2 && rr <= 4 && cc >= 2 && cc <= 4;
        return ring || core;
      }
    }
    return null;
  };
  const g: Array<[number, number]> = [];
  for (let r = 0; r < QR_N; r++)
    for (let c = 0; c < QR_N; c++) {
      const fnd = finder(r, c);
      if (fnd !== null) {
        if (fnd) g.push([c, r]);
        continue;
      }
      const nearFinder = (r < 8 && c < 8) || (r < 8 && c > QR_N - 9) || (r > QR_N - 9 && c < 8);
      if (nearFinder) continue;
      if (rnd() > 0.52) g.push([c, r]);
    }
  return g;
}

export function QrMono({
  seed = 'wedillybird',
  color = 'var(--color-ink-900)',
}: {
  seed?: string;
  color?: string;
}) {
  const t = useTranslations('MonMariage.common');
  const N = QR_N;
  const cells = qrCells(seed);
  return (
    <svg viewBox={`0 0 ${N} ${N}`} shapeRendering="crispEdges" role="img" aria-label={t('qrAria')}>
      {cells.map(([c, r], i) => (
        <rect key={i} x={c} y={r} width={1} height={1} fill={color} />
      ))}
    </svg>
  );
}

/* Donut générique — segments=[{value,color}], center=node optionnel */
export function RingChart({
  segments,
  size = 150,
  stroke = 22,
  center,
}: {
  segments: Array<{ value: number; color: string }>;
  size?: number;
  stroke?: number;
  center?: ReactNode;
}) {
  const t = useTranslations('MonMariage.common');
  const reduce = prefersReducedMotion();
  const r = (size - stroke) / 2;
  const C = 2 * Math.PI * r;
  const data = segments.filter((s) => s.value > 0);
  const sum = data.reduce((a, s) => a + s.value, 0) || 1;
  const gap = data.length > 1 ? 0.01 : 0;
  const fracs = data.map((s) => s.value / sum);
  const arcs = data.map((s, i) => {
    const seg = Math.max(fracs[i]! - gap, 0.001);
    const prior = fracs.slice(0, i).reduce((a, b) => a + b, 0);
    return { key: i, c: s.color, len: seg * C, off: -prior * C };
  });
  return (
    <div
      className="mc-donut"
      style={{ width: size, height: size }}
      role="img"
      aria-label={t('distribution')}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-surface-elevated)"
          strokeWidth={stroke}
        />
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          {arcs.map((a) => (
            <circle
              key={a.key}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={a.c}
              strokeWidth={stroke}
              strokeDasharray={`${a.len} ${C - a.len}`}
              strokeDashoffset={a.off}
              strokeLinecap="butt"
              style={{ transition: reduce ? 'none' : 'stroke-dasharray .9s var(--ease-out-quint)' }}
            />
          ))}
        </g>
      </svg>
      {center && <div className="mc-donut-c">{center}</div>}
    </div>
  );
}
