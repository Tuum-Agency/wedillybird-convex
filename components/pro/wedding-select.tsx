'use client';

/**
 * Sélecteur de mariage stylisé (dark agence) — réutilisé sur tout le dashboard
 * (budget, rétroplanning, plan de table…). Carte : avatar coloré + nom du
 * couple en Bodoni italic (& doré) + date · J− + chevrons. Menu déroulant
 * riche : avatar + nom + date · lieu + J− + coche sur l'option active.
 */

import { useState } from 'react';
import { Calendar, Check, ChevronsUpDown, MapPin } from 'lucide-react';
import { cn } from '@/lib/cn';
import { nowMs } from '@/lib/pro/format';

export interface WeddingOption {
  _id: string;
  partnerA: string;
  partnerB: string;
  eventDate: number;
  timezone?: string;
  venue?: string;
  status?: 'draft' | 'active' | 'archived' | 'cancelled';
}

const STATUS_DOT: Record<NonNullable<WeddingOption['status']>, string> = {
  active: 'oklch(72% 0.08 145)',
  draft: 'oklch(78% 0.075 78)',
  archived: 'oklch(72% 0.018 65)',
  cancelled: 'oklch(72% 0.09 20)',
};

const AVATAR_HUES = [185, 265, 22, 150, 95, 320];
function avatarHue(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 997;
  return AVATAR_HUES[h % AVATAR_HUES.length]!;
}
function coupleInitials(a: string, b: string): string {
  return ((a.trim()[0] ?? '') + (b.trim()[0] ?? '')).toUpperCase() || '··';
}

function CoupleAvatar({ a, b, size = 40 }: { a: string; b: string; size?: number }) {
  const hue = avatarHue(`${a} ${b}`);
  return (
    <span
      aria-hidden
      className="inline-flex flex-shrink-0 items-center justify-center rounded-full font-mono font-medium"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.34),
        background: `oklch(58% 0.1 ${hue})`,
        color: 'oklch(98% 0.01 250)',
      }}
    >
      {coupleInitials(a, b)}
    </span>
  );
}

function formatDateFr(ms: number, timeZone?: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: timeZone || 'UTC',
  }).format(new Date(ms));
}

function jLabel(ms: number, now: number): string {
  const d = Math.ceil((ms - now) / 86_400_000);
  if (d < 0) return `J+${-d}`;
  return `J−${d}`;
}

export function WeddingSelect({
  events,
  value,
  onChange,
  label = 'Mariage',
  now,
  showVenue = false,
}: {
  events: ReadonlyArray<WeddingOption>;
  value: string;
  onChange: (id: string) => void;
  label?: string;
  now?: number;
  /** Affiche le lieu du mariage sélectionné sous le sélecteur (cohérence cross-pages). */
  showVenue?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = now ?? nowMs();
  const sel = events.find((e) => e._id === value) ?? events[0];
  if (!sel) return null;

  return (
    <div className="flex flex-col gap-1.5">
      {label ? (
        <span className="font-mono text-[9px] tracking-[0.18em] text-[color:var(--color-muted-foreground)] uppercase">
          {label}
        </span>
      ) : null}
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label="Choisir le mariage"
          className="focus-ring inline-flex min-w-[240px] cursor-pointer items-center gap-3 rounded-2xl border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface-elevated)] px-3 py-2 text-left transition-colors hover:border-[color:var(--color-blush-400)]"
        >
          <CoupleAvatar a={sel.partnerA} b={sel.partnerB} />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="font-display truncate text-lg leading-tight text-[color:var(--color-foreground)] italic">
              {sel.partnerA} <span style={{ color: 'var(--color-gold-500)' }}>&amp;</span>{' '}
              {sel.partnerB}
            </span>
            <span className="inline-flex items-center gap-1.5 font-mono text-[10px] text-[color:var(--color-muted-foreground)] tabular-nums">
              <Calendar className="h-3 w-3" strokeWidth={1.9} aria-hidden />
              {formatDateFr(sel.eventDate, sel.timezone)}
              <span className="text-[color:var(--color-border-strong)]">·</span>
              <span className="text-[color:var(--color-blush-300)]">
                {jLabel(sel.eventDate, ref)}
              </span>
            </span>
          </span>
          <ChevronsUpDown
            className="h-4 w-4 flex-shrink-0 text-[color:var(--color-muted-foreground)]"
            strokeWidth={1.9}
            aria-hidden
          />
        </button>

        {open ? (
          <>
            <button
              type="button"
              aria-hidden
              tabIndex={-1}
              className="fixed inset-0 z-30 cursor-default"
              onClick={() => setOpen(false)}
            />
            <ul
              role="listbox"
              aria-label="Mariages"
              className="absolute top-full left-0 z-40 mt-2 flex max-h-[340px] w-[clamp(280px,100%,360px)] flex-col gap-0.5 overflow-y-auto rounded-2xl border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface)] p-1.5 shadow-[var(--shadow-popover)]"
            >
              {events.map((ev) => {
                const on = ev._id === value;
                return (
                  <li key={ev._id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={on}
                      onClick={() => {
                        onChange(ev._id);
                        setOpen(false);
                      }}
                      className={cn(
                        'flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors',
                        on
                          ? 'bg-[color:var(--color-surface-elevated)]'
                          : 'hover:bg-[color:var(--color-surface-elevated)]',
                      )}
                    >
                      <CoupleAvatar a={ev.partnerA} b={ev.partnerB} size={34} />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="font-display truncate text-base leading-tight text-[color:var(--color-foreground)] italic">
                          {ev.partnerA}{' '}
                          <span style={{ color: 'var(--color-gold-500)' }}>&amp;</span>{' '}
                          {ev.partnerB}
                        </span>
                        <span className="truncate font-mono text-[10px] text-[color:var(--color-muted-foreground)] tabular-nums">
                          {formatDateFr(ev.eventDate, ev.timezone)}
                          {ev.venue ? ` · ${ev.venue}` : ''}
                        </span>
                      </span>
                      <span className="inline-flex flex-shrink-0 items-center gap-1.5">
                        {ev.status ? (
                          <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ background: STATUS_DOT[ev.status] }}
                            aria-hidden
                          />
                        ) : null}
                        <span className="font-mono text-[10px] text-[color:var(--color-muted-foreground)] tabular-nums">
                          {jLabel(ev.eventDate, ref)}
                        </span>
                        {on ? (
                          <Check
                            className="h-4 w-4 text-[color:var(--color-blush-300)]"
                            strokeWidth={2.4}
                            aria-hidden
                          />
                        ) : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        ) : null}
      </div>

      {showVenue ? (
        sel.venue ? (
          <span className="inline-flex items-center gap-1.5 text-sm text-[color:var(--color-muted-foreground)]">
            <MapPin
              className="h-4 w-4 flex-shrink-0 text-[color:var(--color-blush-300)]"
              strokeWidth={1.9}
              aria-hidden
            />
            {sel.venue}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-sm text-[color:var(--color-muted-foreground)]/60">
            <MapPin className="h-4 w-4 flex-shrink-0" strokeWidth={1.9} aria-hidden />
            Lieu à renseigner
          </span>
        )
      ) : null}
    </div>
  );
}
