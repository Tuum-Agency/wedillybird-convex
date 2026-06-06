/**
 * Aperçus produit « Linear-grade » du back-office agence.
 *
 * Chaque aperçu est enveloppé dans `<div data-theme="dark">` : c'est un
 * ARTEFACT encadré (chrome de fenêtre), pas un changement de thème de la page.
 * La page Pros reste en light « mariage éditorial » ; ces cadres montrent
 * l'outil sombre dense que l'agence utilisera au quotidien (cf. DESIGN.md §2).
 *
 * En dark, les tokens `--color-ink-*` / `--color-ivory-*` sont inversés par
 * globals.css, donc on réutilise les mêmes conventions de tokens que partout.
 * Contenu purement décoratif → `aria-hidden` sur le cadre (le texte réel de la
 * fonctionnalité vit dans les sections, pas dans la maquette).
 */

import { type ReactNode } from 'react';
import { Search, Plus, TrendingUp, TrendingDown } from 'lucide-react';

/* -------------------------------------------------------------------------- */
/*  Chrome de fenêtre                                                         */
/* -------------------------------------------------------------------------- */

export function BrowserFrame({
  url,
  children,
  className,
}: {
  url: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      data-theme="dark"
      aria-hidden
      className={[
        'overflow-hidden rounded-2xl border border-[color:var(--color-border-strong)] bg-[color:var(--color-background)] shadow-[var(--shadow-lifted)] select-none',
        className ?? '',
      ].join(' ')}
    >
      {/* Barre de fenêtre */}
      <div className="flex items-center gap-3 border-b border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-2.5">
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[oklch(58%_0.16_25)]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[oklch(75%_0.13_75)]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[oklch(68%_0.10_145)]" />
        </div>
        <div className="flex flex-1 items-center justify-center">
          <span className="inline-flex max-w-full items-center gap-1.5 truncate rounded-md bg-[color:var(--color-surface-elevated)] px-3 py-1 font-mono text-[10px] tracking-tight text-[color:var(--color-muted-foreground)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--color-success)]" />
            {url}
          </span>
        </div>
        <Search
          className="h-3.5 w-3.5 text-[color:var(--color-muted-foreground)]"
          strokeWidth={2}
        />
      </div>
      {/* Corps */}
      <div className="bg-[color:var(--color-background)] p-4 sm:p-5">{children}</div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function Sparkline({ points, up = true }: { points: string; up?: boolean }) {
  const color = up ? 'oklch(72% 0.08 145)' : 'oklch(78% 0.075 22)';
  return (
    <svg viewBox="0 0 80 24" className="h-6 w-20" fill="none" preserveAspectRatio="none">
      <polyline
        points={points}
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function KpiTile({
  label,
  value,
  trend,
  up,
  points,
}: {
  label: string;
  value: string;
  trend: string;
  up: boolean;
  points: string;
}) {
  return (
    <div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-3">
      <p className="font-mono text-[9px] tracking-[0.18em] text-[color:var(--color-muted-foreground)] uppercase">
        {label}
      </p>
      <div className="mt-1.5 flex items-end justify-between gap-2">
        <span className="font-mono text-xl font-medium whitespace-nowrap text-[color:var(--color-foreground)] tabular-nums">
          {value}
        </span>
        <Sparkline points={points} up={up} />
      </div>
      <p
        className="mt-1 inline-flex items-center gap-1 text-[10px]"
        style={{ color: up ? 'oklch(72% 0.08 145)' : 'oklch(78% 0.075 22)' }}
      >
        {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
        {trend}
      </p>
    </div>
  );
}

function QuotaBar({
  label,
  value,
  pct,
  warn = false,
}: {
  label: string;
  value: string;
  pct: number;
  warn?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between font-mono text-[9px] text-[color:var(--color-muted-foreground)]">
        <span className="tracking-[0.12em] uppercase">{label}</span>
        <span className="tabular-nums">{value}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[color:var(--color-surface-elevated)]">
        <div
          className="h-full rounded-full"
          style={{
            width: `${pct}%`,
            background: warn ? 'oklch(75% 0.16 75)' : 'var(--color-primary)',
          }}
        />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Cockpit (aperçu signature, hero)                                          */
/* -------------------------------------------------------------------------- */

export function CockpitMock() {
  return (
    <div className="flex flex-col gap-4">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-display text-lg text-[color:var(--color-foreground)] italic">
            Cockpit
          </span>
          <span className="rounded-full border border-[color:var(--color-border)] px-2 py-0.5 font-mono text-[9px] tracking-wide text-[color:var(--color-accent)]">
            BUSINESS
          </span>
        </div>
        <span className="inline-flex items-center gap-1 rounded-lg bg-[color:var(--color-primary)] px-2.5 py-1 text-[10px] font-medium text-[color:var(--color-primary-foreground)]">
          <Plus className="h-3 w-3" strokeWidth={2.5} /> Nouveau mariage
        </span>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <KpiTile
          label="Mariages actifs"
          value="7"
          trend="+2"
          up
          points="0,18 16,15 32,16 48,9 64,7 80,4"
        />
        <KpiTile
          label="RSVP en attente"
          value="342"
          trend="−38"
          up={false}
          points="0,6 16,8 32,7 48,12 64,11 80,16"
        />
        <KpiTile
          label="Deadlines"
          value="5"
          trend="2 en retard"
          up={false}
          points="0,12 16,10 32,13 48,8 64,11 80,9"
        />
        <KpiTile
          label="CA du mois"
          value="8,4 k€"
          trend="+12 %"
          up
          points="0,20 16,16 32,14 48,11 64,8 80,3"
        />
      </div>

      <div className="grid gap-2.5 lg:grid-cols-[1.4fr_1fr]">
        {/* Prochains mariages */}
        <div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-3">
          <p className="mb-2.5 font-mono text-[9px] tracking-[0.18em] text-[color:var(--color-muted-foreground)] uppercase">
            Prochains mariages
          </p>
          <div className="flex flex-col gap-2.5">
            {[
              { c: 'Camille & Sami', d: 'J−42', r: 78 },
              { c: 'Inès & Théo', d: 'J−61', r: 54 },
              { c: 'Awa & Malik', d: 'J−96', r: 31 },
            ].map((m) => (
              <div key={m.c} className="flex items-center gap-3">
                <span className="font-display text-sm text-[color:var(--color-foreground)] italic">
                  {m.c}
                </span>
                <span className="font-mono text-[9px] text-[color:var(--color-muted-foreground)]">
                  {m.d}
                </span>
                <div className="ml-auto h-1.5 w-20 overflow-hidden rounded-full bg-[color:var(--color-surface-elevated)]">
                  <div
                    className="h-full rounded-full bg-[color:var(--color-accent)]"
                    style={{ width: `${m.r}%` }}
                  />
                </div>
                <span className="w-8 text-right font-mono text-[9px] text-[color:var(--color-muted-foreground)] tabular-nums">
                  {m.r}%
                </span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-col gap-2 border-t border-[color:var(--color-border)] pt-3">
            <QuotaBar label="Événements" value="7 / 20" pct={35} />
            <QuotaBar label="Messages" value="6 200 / 10 000" pct={62} />
            <QuotaBar label="Stockage" value="84 / 200 Go" pct={42} />
          </div>
        </div>

        {/* Activité */}
        <div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-3">
          <p className="mb-2.5 font-mono text-[9px] tracking-[0.18em] text-[color:var(--color-muted-foreground)] uppercase">
            Activité
          </p>
          <div className="flex flex-col gap-2.5">
            {[
              { t: 'Acompte encaissé', s: '1 200 €', d: 'il y a 12 min', c: 'oklch(68% 0.10 145)' },
              { t: 'RSVP reçu', s: 'Camille & Sami', d: 'il y a 1 h', c: 'var(--color-primary)' },
              { t: 'Devis accepté', s: 'Inès & Théo', d: 'il y a 3 h', c: 'var(--color-accent)' },
              { t: 'Nouveau lead', s: 'Instagram', d: 'hier', c: 'oklch(65% 0.11 220)' },
            ].map((a) => (
              <div key={a.t} className="flex items-center gap-2.5">
                <span
                  className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
                  style={{ background: a.c }}
                />
                <span className="text-[11px] text-[color:var(--color-foreground)]">{a.t}</span>
                <span className="truncate font-mono text-[9px] text-[color:var(--color-muted-foreground)]">
                  {a.s}
                </span>
                <span className="ml-auto flex-shrink-0 font-mono text-[9px] text-[color:var(--color-muted-foreground)]">
                  {a.d}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  CRM — pipeline kanban                                                     */
/* -------------------------------------------------------------------------- */

export function CrmMock() {
  const columns = [
    {
      name: 'Lead',
      count: 4,
      tint: 'oklch(65% 0.11 220)',
      cards: [{ c: 'Léa & Noé', d: '14 juin 2026', b: '14 000 €', r: 0 }],
    },
    {
      name: 'Devis envoyé',
      count: 2,
      tint: 'var(--color-accent)',
      cards: [{ c: 'Inès & Théo', d: '5 sept. 2026', b: '22 500 €', r: 0 }],
    },
    {
      name: 'Réservé',
      count: 3,
      tint: 'oklch(68% 0.10 145)',
      cards: [
        { c: 'Camille & Sami', d: '12 juil. 2026', b: '31 000 €', r: 40 },
        { c: 'Awa & Malik', d: '3 oct. 2026', b: '18 000 €', r: 25 },
      ],
    },
  ];
  return (
    <div className="grid grid-cols-3 gap-2.5">
      {columns.map((col) => (
        <div key={col.name} className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 font-mono text-[9px] tracking-[0.14em] text-[color:var(--color-muted-foreground)] uppercase">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: col.tint }} />
              {col.name}
            </span>
            <span className="font-mono text-[9px] text-[color:var(--color-muted-foreground)] tabular-nums">
              {col.count}
            </span>
          </div>
          {col.cards.map((card) => (
            <div
              key={card.c}
              className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-2.5"
            >
              <p className="font-display text-[13px] text-[color:var(--color-foreground)] italic">
                {card.c}
              </p>
              <p className="mt-0.5 font-mono text-[9px] text-[color:var(--color-muted-foreground)]">
                {card.d}
              </p>
              <div className="mt-2 flex flex-col gap-1.5">
                <span className="font-mono text-[10px] whitespace-nowrap text-[color:var(--color-foreground)] tabular-nums">
                  {card.b}
                </span>
                {card.r > 0 && (
                  <span className="inline-flex w-fit items-center self-start rounded-full bg-[color:var(--color-primary-soft)] px-1.5 py-0.5 font-mono text-[8px] whitespace-nowrap text-[color:var(--color-primary)]">
                    {card.r}% réservé
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Budget — donut + lignes                                                   */
/* -------------------------------------------------------------------------- */

export function BudgetMock() {
  // Donut : 4 segments (circonférence 2πr, r=28 → ~175.9).
  const segments = [
    { label: 'Lieu', pct: 38, color: 'var(--color-primary)' },
    { label: 'Traiteur', pct: 30, color: 'var(--color-accent)' },
    { label: 'Photo', pct: 18, color: 'oklch(65% 0.11 220)' },
    { label: 'Autre', pct: 14, color: 'oklch(68% 0.10 145)' },
  ];
  const C = 175.9;
  let offset = 0;
  return (
    <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-center">
      <div className="flex items-center gap-4">
        <svg viewBox="0 0 64 64" className="h-24 w-24 -rotate-90">
          <circle
            cx="32"
            cy="32"
            r="28"
            fill="none"
            stroke="var(--color-surface-elevated)"
            strokeWidth="7"
          />
          {segments.map((s) => {
            const len = (s.pct / 100) * C;
            const el = (
              <circle
                key={s.label}
                cx="32"
                cy="32"
                r="28"
                fill="none"
                stroke={s.color}
                strokeWidth="7"
                strokeDasharray={`${len} ${C - len}`}
                strokeDashoffset={-offset}
              />
            );
            offset += len;
            return el;
          })}
        </svg>
        <div className="flex flex-col gap-1.5">
          {segments.map((s) => (
            <span
              key={s.label}
              className="flex items-center gap-1.5 font-mono text-[9px] text-[color:var(--color-muted-foreground)]"
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.color }} />
              {s.label} {s.pct}%
            </span>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2">
          <span className="font-mono text-[9px] tracking-[0.14em] text-[color:var(--color-muted-foreground)] uppercase">
            Enveloppe
          </span>
          <span className="font-mono text-sm whitespace-nowrap text-[color:var(--color-foreground)] tabular-nums">
            31 000 €
          </span>
        </div>
        {[
          { l: 'Engagé', v: '24 800 €', pct: 80, c: 'var(--color-primary)' },
          { l: 'Payé', v: '12 400 €', pct: 40, c: 'oklch(68% 0.10 145)' },
        ].map((row) => (
          <div key={row.l} className="flex flex-col gap-1">
            <div className="flex items-center justify-between font-mono text-[10px] text-[color:var(--color-muted-foreground)]">
              <span>{row.l}</span>
              <span className="text-[color:var(--color-foreground)] tabular-nums">{row.v}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-[color:var(--color-surface-elevated)]">
              <div
                className="h-full rounded-full"
                style={{ width: `${row.pct}%`, background: row.c }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
