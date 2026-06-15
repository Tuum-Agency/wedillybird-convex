'use client';

/**
 * Plan de table agence (dark « Linear-grade ») — éditeur spatial sur canvas.
 *
 * Trois colonnes : pool des invités à placer · canvas (tables positionnées,
 * sièges par personne, pan/zoom, drag) · inspecteur de table. Placement par
 * glisser-déposer (pool↔table, siège↔pool) + menu « Assigner à… » accessible.
 * Auto-placement intelligent paramétrable (regroupe par catégorie, garde les
 * groupes ensemble, équilibre/ tasse, crée des tables au besoin).
 *
 * Persistance via les server actions seating (assignSeat / createTable /
 * updateTable / deleteTable / autoAssignGuests) ; état local optimiste +
 * router.refresh() comme filet de sécurité.
 */

import { useCallback, useMemo, useRef, useState, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  AlertTriangle,
  Armchair,
  Check,
  Circle,
  CircleCheck,
  Crown,
  Maximize2,
  Minus,
  Plus,
  RectangleHorizontal,
  Search,
  Settings2,
  Trash2,
  Users,
  Wand2,
  X,
  ZoomIn,
  ZoomOut,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import {
  UNASSIGNED,
  applyMove,
  containerOf,
  defaultTablePos,
  type BoardState,
  type SeatGuest,
  type SeatTable,
  type SeatingPlan,
} from '@/lib/seating/board';
import {
  AUTO_PLACE_PRESET,
  categoryMeta,
  occState,
  parseSeatUnit,
  seatInitials,
  seatPositions,
  tableDims,
  type AutoPlaceSettings,
} from '@/lib/pro/seating';
import {
  assignSeatAction,
  autoAssignGuestsAction,
  createTableAction,
  deleteTableAction,
  updateTableAction,
} from '@/app/[locale]/(app)/events/[eventId]/seating/actions';

type Shape = 'round' | 'rect';

interface DragState {
  unitId: string;
  name: string;
  category?: string;
  seats: number;
  x: number;
  y: number;
}

export function SeatingPlanner({
  eventId,
  initialPlan,
  coupleA,
  coupleB,
  dateLabel,
}: {
  eventId: string;
  initialPlan: SeatingPlan;
  coupleA: string;
  coupleB: string;
  dateLabel: string;
}) {
  const router = useRouter();
  const t = useTranslations('Pro.seatingBoard');
  const [board, setBoard] = useState<BoardState>({
    tables: initialPlan.tables,
    unassigned: initialPlan.unassigned,
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Set<string>>(() => new Set());
  const [view, setView] = useState({ x: 24, y: 16, k: 0.8 });
  const [drag, setDrag] = useState<DragState | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; cant: boolean } | null>(null);
  const [autoOpen, setAutoOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

  const wrapRef = useRef<HTMLDivElement>(null);
  const panRef = useRef({ active: false, sx: 0, sy: 0, ox: 0, oy: 0 });

  const totals = useMemo(() => {
    const seated = board.tables.reduce((s, t) => s + t.occupancy, 0);
    const pool = board.unassigned.reduce((s, g) => s + g.seats, 0);
    return { seated, pool, total: seated + pool };
  }, [board]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const g of board.unassigned) if (g.category) set.add(g.category);
    for (const t of board.tables) for (const g of t.assigned) if (g.category) set.add(g.category);
    return [...set];
  }, [board]);

  const selected = board.tables.find((t) => t._id === selectedId) ?? null;

  const tablePos = useCallback(
    (t: SeatTable, i: number) => ({
      x: t.posX ?? defaultTablePos(i).x,
      y: t.posY ?? defaultTablePos(i).y,
    }),
    [],
  );

  /* ---------- mutations ---------- */
  const persistMove = useCallback(
    (unitId: string, target: string) => {
      const { guestId, memberIndex } = parseSeatUnit(unitId);
      startTransition(async () => {
        const res = await assignSeatAction(
          eventId,
          guestId,
          memberIndex,
          target === UNASSIGNED ? null : target,
        );
        if (!res.ok) router.refresh();
      });
    },
    [eventId, router],
  );

  const moveUnit = useCallback(
    (unitId: string, target: string): boolean => {
      const from = containerOf(board, unitId);
      if (from === target) return false;
      const unit =
        board.unassigned.find((g) => g._id === unitId) ??
        board.tables.flatMap((t) => t.assigned).find((g) => g._id === unitId);
      if (!unit) return false;
      if (target !== UNASSIGNED) {
        const t = board.tables.find((x) => x._id === target);
        if (!t) return false;
        if (t.occupancy + unit.seats > t.capacity) return false;
      }
      setBoard((b) => applyMove(b, unitId, target));
      persistMove(unitId, target);
      return true;
    },
    [board, persistMove],
  );

  const addTable = useCallback(
    (shape: Shape, capacity: number) => {
      setAddOpen(false);
      setBusy(true);
      startTransition(async () => {
        const res = await createTableAction(eventId, { capacity });
        if (res.ok && res.tableId) {
          await updateTableAction(res.tableId, { shape });
        }
        router.refresh();
        setBusy(false);
      });
    },
    [eventId, router],
  );

  const patchTable = useCallback(
    (tableId: string, patch: { name?: string; capacity?: number; shape?: Shape }) => {
      setBoard((b) => ({
        ...b,
        tables: b.tables.map((t) =>
          t._id === tableId
            ? { ...t, ...patch, overCapacity: (patch.capacity ?? t.capacity) < t.occupancy }
            : t,
        ),
      }));
      startTransition(async () => {
        const res = await updateTableAction(tableId, patch);
        if (!res.ok) router.refresh();
      });
    },
    [router],
  );

  const removeTable = useCallback(
    (tableId: string) => {
      setBoard((b) => {
        const t = b.tables.find((x) => x._id === tableId);
        if (!t) return b;
        return {
          tables: b.tables.filter((x) => x._id !== tableId),
          unassigned: [...b.unassigned, ...t.assigned],
        };
      });
      setSelectedId(null);
      startTransition(async () => {
        const res = await deleteTableAction(tableId);
        if (!res.ok) router.refresh();
      });
    },
    [router],
  );

  const persistTablePos = useCallback((tableId: string, x: number, y: number) => {
    startTransition(async () => {
      await updateTableAction(tableId, { posX: x, posY: y });
    });
  }, []);

  const runAutoPlace = useCallback(
    (settings: AutoPlaceSettings, mode: 'unplaced' | 'all') => {
      setAutoOpen(false);
      setBusy(true);
      startTransition(async () => {
        const res = await autoAssignGuestsAction(eventId, { mode, settings });
        if (res.ok) {
          setBoard({ tables: res.plan.tables, unassigned: res.plan.unassigned });
        } else {
          router.refresh();
        }
        setBusy(false);
      });
    },
    [eventId, router],
  );

  /* ---------- drag d'un invité (pointeur) ---------- */
  function hitTarget(
    x: number,
    y: number,
  ): { kind: 'table'; id: string } | { kind: 'pool' } | null {
    const el = document.elementFromPoint(x, y);
    if (!el) return null;
    const tnode = el.closest('[data-table-id]');
    if (tnode) return { kind: 'table', id: tnode.getAttribute('data-table-id')! };
    if (el.closest('[data-pool]')) return { kind: 'pool' };
    return null;
  }

  const startGuestDrag = useCallback(
    (unitId: string, e: React.PointerEvent) => {
      if (e.button !== 0) return;
      const unit =
        board.unassigned.find((g) => g._id === unitId) ??
        board.tables.flatMap((t) => t.assigned).find((g) => g._id === unitId);
      if (!unit) return;
      e.preventDefault();
      setDrag({
        unitId,
        name: unit.fullName,
        category: unit.category,
        seats: unit.seats,
        x: e.clientX,
        y: e.clientY,
      });
      const move = (ev: PointerEvent) => {
        const tgt = hitTarget(ev.clientX, ev.clientY);
        let dt: { id: string; cant: boolean } | null = null;
        if (tgt?.kind === 'table') {
          const t = board.tables.find((x) => x._id === tgt.id);
          const from = containerOf(board, unitId);
          if (t)
            dt = { id: tgt.id, cant: from !== tgt.id && t.occupancy + unit.seats > t.capacity };
        }
        setDropTarget(dt);
        setDrag((d) => (d ? { ...d, x: ev.clientX, y: ev.clientY } : d));
      };
      const up = (ev: PointerEvent) => {
        const tgt = hitTarget(ev.clientX, ev.clientY);
        if (tgt?.kind === 'table') moveUnit(unitId, tgt.id);
        else if (tgt?.kind === 'pool') moveUnit(unitId, UNASSIGNED);
        setDrag(null);
        setDropTarget(null);
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    },
    [board, moveUnit],
  );

  /* ---------- déplacer une table sur le canvas ---------- */
  const startTableDrag = useCallback(
    (tableId: string, i: number, e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const start = tablePos(board.tables[i]!, i);
      const sx = e.clientX;
      const sy = e.clientY;
      let last = start;
      const move = (ev: PointerEvent) => {
        const nx = Math.round(start.x + (ev.clientX - sx) / view.k);
        const ny = Math.round(start.y + (ev.clientY - sy) / view.k);
        last = { x: Math.max(0, nx), y: Math.max(0, ny) };
        setBoard((b) => ({
          ...b,
          tables: b.tables.map((t) =>
            t._id === tableId ? { ...t, posX: last.x, posY: last.y } : t,
          ),
        }));
      };
      const up = () => {
        persistTablePos(tableId, last.x, last.y);
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    },
    [board.tables, tablePos, view.k, persistTablePos],
  );

  /* ---------- pan / zoom ---------- */
  function onBgDown(e: React.PointerEvent) {
    if (e.button !== 0) return;
    setSelectedId(null);
    panRef.current = { active: true, sx: e.clientX, sy: e.clientY, ox: view.x, oy: view.y };
    const move = (ev: PointerEvent) => {
      if (!panRef.current.active) return;
      setView((v) => ({
        ...v,
        x: panRef.current.ox + (ev.clientX - panRef.current.sx),
        y: panRef.current.oy + (ev.clientY - panRef.current.sy),
      }));
    };
    const up = () => {
      panRef.current.active = false;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }
  const zoom = (d: number) =>
    setView((v) => ({ ...v, k: Math.min(1.6, Math.max(0.4, +(v.k + d).toFixed(2))) }));
  function onWheel(e: React.WheelEvent) {
    if (!(e.ctrlKey || e.metaKey)) return;
    setView((v) => ({
      ...v,
      k: Math.min(1.6, Math.max(0.4, +(v.k - Math.sign(e.deltaY) * 0.1).toFixed(2))),
    }));
  }

  const toggleFilter = (c: string) =>
    setFilters((f) => {
      const n = new Set(f);
      if (n.has(c)) n.delete(c);
      else n.add(c);
      return n;
    });

  const pool = useMemo(() => {
    const q = search.trim().toLowerCase();
    return board.unassigned.filter(
      (g) =>
        (filters.size === 0 || (g.category != null && filters.has(g.category))) &&
        (!q || g.fullName.toLowerCase().includes(q)),
    );
  }, [board.unassigned, search, filters]);

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-3">
        <div className="flex flex-col">
          <span className="font-display text-lg text-[color:var(--color-foreground)] italic">
            {coupleA} <span style={{ color: 'var(--color-gold-500)' }}>&amp;</span> {coupleB}
          </span>
          <span className="font-mono text-[10px] tracking-[0.14em] text-[color:var(--color-muted-foreground)] uppercase">
            {dateLabel} · {t('guestCount', { count: totals.total })}
          </span>
        </div>
        <span className="flex-1" />
        <span className="hidden items-center gap-1.5 rounded-lg border border-[color:var(--color-border)] px-3 py-1.5 font-mono text-xs text-[color:var(--color-muted-foreground)] sm:inline-flex">
          <b className="text-[color:var(--color-foreground)] tabular-nums">{totals.seated}</b>/
          {totals.total} {t('seatedSuffix')}
        </span>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--color-border)] px-3 py-1.5 text-sm text-[color:var(--color-foreground)] transition-colors hover:border-[color:var(--color-border-strong)]"
        >
          <Plus className="h-4 w-4" strokeWidth={2.2} aria-hidden /> {t('addTable')}
        </button>
        <div className="relative">
          <button
            type="button"
            onClick={() => setAutoOpen((o) => !o)}
            disabled={busy}
            aria-expanded={autoOpen}
            className="focus-ring inline-flex items-center gap-1.5 rounded-lg bg-[color:var(--color-primary)] px-3.5 py-1.5 text-sm font-semibold text-[color:var(--color-primary-foreground)] transition-colors hover:bg-[color:var(--color-primary-hover)] disabled:opacity-50"
          >
            <Wand2
              className={cn('h-4 w-4', busy && 'animate-pulse')}
              strokeWidth={1.9}
              aria-hidden
            />{' '}
            {t('autoPlace')}
          </button>
          {autoOpen ? (
            <AutoPlacePopover
              onClose={() => setAutoOpen(false)}
              onRun={runAutoPlace}
              poolCount={board.unassigned.length}
            />
          ) : null}
        </div>
      </div>

      <div
        className={cn(
          'grid gap-4',
          selected ? 'lg:grid-cols-[260px_1fr_300px]' : 'lg:grid-cols-[260px_1fr]',
        )}
      >
        {/* Pool */}
        <PoolPanel
          pool={pool}
          poolCountAll={board.unassigned.length}
          totals={totals}
          search={search}
          setSearch={setSearch}
          categories={categories}
          filters={filters}
          toggleFilter={toggleFilter}
          onChipDown={startGuestDrag}
          dropping={drag != null}
        />

        {/* Canvas */}
        <div
          ref={wrapRef}
          onPointerDown={onBgDown}
          onWheel={onWheel}
          className="relative h-[clamp(420px,62vh,760px)] cursor-grab overflow-hidden rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-ink-700)]/20 active:cursor-grabbing"
          style={{ touchAction: 'none' }}
        >
          {board.tables.length === 0 ? (
            <EmptyCanvas onAdd={() => setAddOpen(true)} onAuto={() => setAutoOpen(true)} />
          ) : null}
          {/* légende */}
          {categories.length > 0 ? (
            <div className="pointer-events-none absolute top-3 left-3 z-10 flex flex-wrap gap-2 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)]/85 px-3 py-2 backdrop-blur-sm">
              {categories.slice(0, 5).map((c) => {
                const m = categoryMeta(c);
                return (
                  <span
                    key={c}
                    className="inline-flex items-center gap-1.5 font-mono text-[10px] text-[color:var(--color-muted-foreground)]"
                  >
                    <span className="h-2 w-2 rounded-full" style={{ background: m.color }} />{' '}
                    {m.label}
                  </span>
                );
              })}
            </div>
          ) : null}

          <div
            className="absolute top-0 left-0 origin-top-left"
            style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}
          >
            {board.tables.map((t, i) => (
              <TableNode
                key={t._id}
                table={t}
                pos={tablePos(t, i)}
                selected={selectedId === t._id}
                dropState={dropTarget?.id === t._id ? (dropTarget.cant ? 'cant' : 'ok') : null}
                onSelect={() => setSelectedId(t._id)}
                onMoveStart={(e) => startTableDrag(t._id, i, e)}
                onSeatDown={startGuestDrag}
              />
            ))}
          </div>

          {/* zoom */}
          <div className="absolute right-3 bottom-3 z-10 flex items-center gap-1 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-1">
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => zoom(-0.1)}
              aria-label={t('zoomOut')}
              className="grid h-7 w-7 place-items-center rounded-lg text-[color:var(--color-muted-foreground)] hover:text-[color:var(--color-foreground)]"
            >
              <ZoomOut className="h-4 w-4" strokeWidth={1.9} aria-hidden />
            </button>
            <span className="w-10 text-center font-mono text-[11px] text-[color:var(--color-muted-foreground)] tabular-nums">
              {Math.round(view.k * 100)}%
            </span>
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => zoom(0.1)}
              aria-label={t('zoomIn')}
              className="grid h-7 w-7 place-items-center rounded-lg text-[color:var(--color-muted-foreground)] hover:text-[color:var(--color-foreground)]"
            >
              <ZoomIn className="h-4 w-4" strokeWidth={1.9} aria-hidden />
            </button>
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => setView({ x: 24, y: 16, k: 0.8 })}
              aria-label={t('resetView')}
              className="grid h-7 w-7 place-items-center rounded-lg text-[color:var(--color-muted-foreground)] hover:text-[color:var(--color-foreground)]"
            >
              <Maximize2 className="h-[14px] w-[14px]" strokeWidth={1.9} aria-hidden />
            </button>
          </div>
        </div>

        {/* Inspector */}
        {selected ? (
          <Inspector
            table={selected}
            onClose={() => setSelectedId(null)}
            onRename={(name) => patchTable(selected._id, { name })}
            onShape={(shape) => patchTable(selected._id, { shape })}
            onCap={(capacity) => patchTable(selected._id, { capacity })}
            onRemoveGuest={(unitId) => moveUnit(unitId, UNASSIGNED)}
            onDelete={() => removeTable(selected._id)}
            onSeatDown={startGuestDrag}
          />
        ) : null}
      </div>

      {/* ghost de drag */}
      {drag ? (
        <div
          className="pointer-events-none fixed z-50 flex w-52 items-center gap-2.5 rounded-xl border px-3 py-2 shadow-[var(--shadow-lifted)]"
          style={{
            left: drag.x + 12,
            top: drag.y + 12,
            background: 'var(--color-surface-elevated)',
            borderColor: categoryMeta(drag.category).color,
          }}
        >
          <span
            className="grid h-7 w-7 place-items-center rounded-full font-mono text-[11px] font-medium"
            style={{
              background: categoryMeta(drag.category).soft,
              color: categoryMeta(drag.category).color,
            }}
          >
            {seatInitials(drag.name)}
          </span>
          <span className="flex-1 truncate text-sm text-[color:var(--color-foreground)]">
            {drag.name}
          </span>
          <span className="inline-flex items-center gap-0.5 font-mono text-[11px] text-[color:var(--color-muted-foreground)]">
            <Users className="h-3 w-3" strokeWidth={2} aria-hidden /> {drag.seats}
          </span>
        </div>
      ) : null}

      {addOpen ? <AddTableDialog onClose={() => setAddOpen(false)} onAdd={addTable} /> : null}
    </div>
  );
}

/* ============================ POOL ============================ */
function PoolPanel({
  pool,
  poolCountAll,
  totals,
  search,
  setSearch,
  categories,
  filters,
  toggleFilter,
  onChipDown,
  dropping,
}: {
  pool: SeatGuest[];
  poolCountAll: number;
  totals: { seated: number; total: number };
  search: string;
  setSearch: (s: string) => void;
  categories: string[];
  filters: Set<string>;
  toggleFilter: (c: string) => void;
  onChipDown: (unitId: string, e: React.PointerEvent) => void;
  dropping: boolean;
}) {
  const t = useTranslations('Pro.seatingBoard');
  return (
    <div className="flex max-h-[clamp(420px,62vh,760px)] flex-col gap-3 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-base text-[color:var(--color-foreground)] italic">
          {t('poolTitle')}
        </h2>
        <span className="font-mono text-[11px] text-[color:var(--color-muted-foreground)] tabular-nums">
          <b className="text-[color:var(--color-foreground)]">{totals.seated}</b>/{totals.total}
        </span>
      </div>
      <label className="flex items-center gap-2 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-elevated)] px-3 py-2">
        <Search
          className="h-4 w-4 text-[color:var(--color-muted-foreground)]"
          strokeWidth={1.9}
          aria-hidden
        />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('searchPlaceholder')}
          aria-label={t('searchAria')}
          className="w-full bg-transparent text-sm text-[color:var(--color-foreground)] outline-none placeholder:text-[color:var(--color-muted-foreground)]"
        />
      </label>
      {categories.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {categories.map((c) => {
            const m = categoryMeta(c);
            const on = filters.has(c);
            return (
              <button
                key={c}
                type="button"
                onClick={() => toggleFilter(c)}
                aria-pressed={on}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors',
                  on
                    ? 'border-[color:var(--color-border-strong)] bg-[color:var(--color-surface-elevated)] text-[color:var(--color-foreground)]'
                    : 'border-[color:var(--color-border)] text-[color:var(--color-muted-foreground)] hover:text-[color:var(--color-foreground)]',
                )}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: m.color }} />{' '}
                {m.short}
              </button>
            );
          })}
        </div>
      ) : null}
      <div
        data-pool="1"
        className={cn(
          'flex min-h-24 flex-1 flex-col gap-1.5 overflow-y-auto rounded-xl pr-1 transition-colors',
          dropping &&
            'bg-[color:var(--color-surface-elevated)]/40 ring-1 ring-[color:var(--color-border-strong)] ring-inset',
        )}
      >
        {pool.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <CircleCheck
              className="h-6 w-6 text-[color:var(--color-sage-500)]"
              strokeWidth={1.7}
              aria-hidden
            />
            <p className="text-sm text-[color:var(--color-muted-foreground)]">
              {poolCountAll === 0 ? t('poolAllSeated') : t('poolNoMatch')}
            </p>
          </div>
        ) : (
          pool.map((g) => (
            <GuestChip key={g._id} guest={g} onPointerDown={(e) => onChipDown(g._id, e)} />
          ))
        )}
      </div>
    </div>
  );
}

function GuestChip({
  guest,
  onPointerDown,
}: {
  guest: SeatGuest;
  onPointerDown: (e: React.PointerEvent) => void;
}) {
  const t = useTranslations('Pro.seatingBoard');
  const m = categoryMeta(guest.category);
  return (
    <div
      onPointerDown={onPointerDown}
      role="button"
      tabIndex={0}
      aria-label={t('guestChipAria', { name: guest.fullName, seats: guest.seats })}
      className="group flex cursor-grab items-center gap-2.5 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-elevated)] px-2.5 py-2 transition-colors hover:border-[color:var(--color-border-strong)] active:cursor-grabbing"
      style={{ borderLeftWidth: 3, borderLeftColor: m.color }}
    >
      <span
        className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-full font-mono text-[11px] font-medium"
        style={{ background: m.soft, color: m.color }}
      >
        {seatInitials(guest.fullName)}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm text-[color:var(--color-foreground)]">
          {guest.fullName}
        </span>
        <span className="inline-flex items-center gap-1.5 font-mono text-[10px] text-[color:var(--color-muted-foreground)]">
          <Users className="h-2.5 w-2.5" strokeWidth={2} aria-hidden />
          {guest.seats}
          {guest.hostName ? (
            <span className="truncate">· {guest.hostName}</span>
          ) : guest.category ? (
            <span>· {m.short}</span>
          ) : null}
        </span>
      </span>
    </div>
  );
}

/* ============================ CANVAS NODE ============================ */
function OccupancyRing({
  occ,
  cap,
  size = 26,
  stroke = 3.2,
}: {
  occ: number;
  cap: number;
  size?: number;
  stroke?: number;
}) {
  const r = (size - stroke) / 2;
  const C = 2 * Math.PI * r;
  const frac = cap > 0 ? Math.min(occ / cap, 1) : 0;
  const color =
    occ > cap
      ? 'var(--color-danger)'
      : occ === cap
        ? 'var(--color-sage-500)'
        : 'var(--color-blush-400)';
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden
      style={{ display: 'block' }}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--color-surface-elevated)"
        strokeWidth={stroke}
      />
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${frac * C} ${C}`}
          style={{ transition: 'stroke-dasharray .3s var(--ease-out-quint)' }}
        />
      </g>
    </svg>
  );
}

function TableNode({
  table,
  pos,
  selected,
  dropState,
  onSelect,
  onMoveStart,
  onSeatDown,
}: {
  table: SeatTable;
  pos: { x: number; y: number };
  selected: boolean;
  dropState: 'ok' | 'cant' | null;
  onSelect: () => void;
  onMoveStart: (e: React.PointerEvent) => void;
  onSeatDown: (unitId: string, e: React.PointerEvent) => void;
}) {
  const t = useTranslations('Pro.seatingBoard');
  const shape = table.shape ?? 'round';
  const dims = tableDims(shape, table.capacity);
  const st = occState(table.occupancy, table.capacity);
  const slots = seatPositions(
    shape,
    Math.max(table.assigned.length, table.capacity),
    dims.w,
    dims.h,
  );

  return (
    <div
      className="absolute"
      style={{ left: pos.x, top: pos.y }}
      onPointerDown={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      <div
        data-table-id={table._id}
        className={cn(
          'relative grid place-items-center rounded-[28px] border-2 transition-shadow',
          shape === 'rect' && 'rounded-2xl',
          selected
            ? 'border-[color:var(--color-blush-400)] shadow-[var(--shadow-lifted)]'
            : st === 'over'
              ? 'border-[color:var(--color-danger)]/70'
              : 'border-[color:var(--color-border-strong)]',
          dropState === 'ok' &&
            'border-[color:var(--color-sage-500)] ring-2 ring-[color:var(--color-sage-500)]/40',
          dropState === 'cant' &&
            'border-[color:var(--color-danger)] ring-2 ring-[color:var(--color-danger)]/40',
        )}
        style={{ width: dims.w, height: dims.h, background: 'var(--color-surface)' }}
      >
        <button
          type="button"
          onPointerDown={(e) => {
            e.stopPropagation();
            onMoveStart(e);
          }}
          aria-label={t('moveTableAria', { name: table.name })}
          title={t('moveTable')}
          className="absolute top-1.5 left-1.5 grid h-6 w-6 cursor-grab place-items-center rounded-lg text-[color:var(--color-muted-foreground)] hover:text-[color:var(--color-foreground)] active:cursor-grabbing"
        >
          <Maximize2 className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden />
        </button>
        <div className="flex flex-col items-center gap-1 px-2 text-center">
          {shape === 'rect' && table.order === 0 ? (
            <Crown
              className="h-4 w-4 text-[color:var(--color-gold-500)]"
              strokeWidth={1.8}
              aria-hidden
            />
          ) : null}
          <span className="font-display max-w-[120px] truncate text-sm text-[color:var(--color-foreground)] italic">
            {table.name}
          </span>
          <span className="flex items-center gap-1.5">
            <OccupancyRing occ={table.occupancy} cap={table.capacity} />
            <span className="font-mono text-xs text-[color:var(--color-foreground)] tabular-nums">
              {table.occupancy}
              <span className="text-[color:var(--color-muted-foreground)]">/{table.capacity}</span>
            </span>
            {st === 'over' ? (
              <AlertTriangle
                className="h-3.5 w-3.5 text-[color:var(--color-danger)]"
                strokeWidth={2}
                aria-hidden
              />
            ) : null}
          </span>
        </div>
        {/* sièges (une pastille par personne assignée) */}
        {table.assigned.map((g, i) => {
          const p = slots[i];
          if (!p) return null;
          const m = categoryMeta(g.category);
          return (
            <span
              key={g._id}
              title={g.fullName}
              onPointerDown={(e) => {
                e.stopPropagation();
                onSeatDown(g._id, e);
              }}
              className="absolute grid h-6 w-6 -translate-x-1/2 -translate-y-1/2 cursor-grab place-items-center rounded-full border-2 font-mono text-[9px] font-medium active:cursor-grabbing"
              style={{
                left: p.x,
                top: p.y,
                background: m.soft,
                color: m.color,
                borderColor: 'var(--color-surface)',
              }}
            >
              {seatInitials(g.fullName)}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function EmptyCanvas({ onAdd, onAuto }: { onAdd: () => void; onAuto: () => void }) {
  const t = useTranslations('Pro.seatingBoard');
  return (
    <div className="absolute inset-0 grid place-items-center p-6">
      <div className="flex max-w-sm flex-col items-center gap-3 text-center">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[color:var(--color-surface-elevated)] text-[color:var(--color-blush-300)]">
          <Armchair className="h-6 w-6" strokeWidth={1.6} aria-hidden />
        </span>
        <h3 className="font-display text-lg text-[color:var(--color-foreground)] italic">
          {t('emptyTitle')}
        </h3>
        <p className="text-sm text-[color:var(--color-muted-foreground)]">
          {t('emptyDescription')}
        </p>
        <div className="mt-1 flex gap-2">
          <button
            type="button"
            onClick={onAuto}
            className="focus-ring inline-flex items-center gap-1.5 rounded-lg bg-[color:var(--color-primary)] px-4 py-2 text-sm font-semibold text-[color:var(--color-primary-foreground)] hover:bg-[color:var(--color-primary-hover)]"
          >
            <Wand2 className="h-4 w-4" strokeWidth={1.9} aria-hidden /> {t('autoPlace')}
          </button>
          <button
            type="button"
            onClick={onAdd}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--color-border)] px-4 py-2 text-sm text-[color:var(--color-foreground)] hover:border-[color:var(--color-border-strong)]"
          >
            <Plus className="h-4 w-4" strokeWidth={2.2} aria-hidden /> {t('addTable')}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================ INSPECTOR ============================ */
function Inspector({
  table,
  onClose,
  onRename,
  onShape,
  onCap,
  onRemoveGuest,
  onDelete,
  onSeatDown,
}: {
  table: SeatTable;
  onClose: () => void;
  onRename: (name: string) => void;
  onShape: (shape: Shape) => void;
  onCap: (cap: number) => void;
  onRemoveGuest: (unitId: string) => void;
  onDelete: () => void;
  onSeatDown: (unitId: string, e: React.PointerEvent) => void;
}) {
  const t = useTranslations('Pro.seatingBoard');
  const st = occState(table.occupancy, table.capacity);
  const free = table.capacity - table.occupancy;
  const SHAPES: ReadonlyArray<[Shape, string, LucideIcon]> = [
    ['round', t('shapeRound'), Circle],
    ['rect', t('shapeRectShort'), RectangleHorizontal],
  ];
  return (
    <aside className="flex max-h-[clamp(420px,62vh,760px)] flex-col gap-4 overflow-y-auto rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4">
      <div className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-[color:var(--color-surface-elevated)] text-[color:var(--color-blush-300)]">
          <Armchair className="h-[18px] w-[18px]" strokeWidth={1.8} aria-hidden />
        </span>
        <div className="flex flex-1 flex-col">
          <h3 className="font-display text-base text-[color:var(--color-foreground)] italic">
            {table.name}
          </h3>
          <span className="font-mono text-[10px] text-[color:var(--color-muted-foreground)]">
            {t('peopleCount', { occupancy: table.occupancy, capacity: table.capacity })}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('close')}
          className="text-[color:var(--color-muted-foreground)] hover:text-[color:var(--color-foreground)]"
        >
          <X className="h-4 w-4" strokeWidth={2} aria-hidden />
        </button>
      </div>

      <Field label={t('tableNameLabel')}>
        <input
          value={table.name}
          onChange={(e) => onRename(e.target.value)}
          className="w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface-elevated)] px-3 py-2 text-sm text-[color:var(--color-foreground)] outline-none focus:border-[color:var(--color-blush-400)]"
        />
      </Field>

      <Field label={t('shapeLabel')}>
        <div className="grid grid-cols-2 gap-2">
          {SHAPES.map(([k, l, Ic]) => (
            <button
              key={k}
              type="button"
              onClick={() => onShape(k)}
              aria-pressed={(table.shape ?? 'round') === k}
              className={cn(
                'inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-colors',
                (table.shape ?? 'round') === k
                  ? 'border-[color:var(--color-blush-400)] bg-[color:var(--color-surface-elevated)] text-[color:var(--color-foreground)]'
                  : 'border-[color:var(--color-border)] text-[color:var(--color-muted-foreground)] hover:text-[color:var(--color-foreground)]',
              )}
            >
              <Ic className="h-4 w-4" strokeWidth={1.7} aria-hidden /> {l}
            </button>
          ))}
        </div>
      </Field>

      <Field label={t('capacityLabel')}>
        <div className="flex items-center gap-3">
          <Stepper value={table.capacity} min={1} onChange={onCap} />
          <span
            className={cn(
              'text-xs',
              st === 'over'
                ? 'text-[color:var(--color-danger)]'
                : st === 'full'
                  ? 'text-[color:var(--color-sage-500)]'
                  : 'text-[color:var(--color-muted-foreground)]',
            )}
          >
            {st === 'over'
              ? t('capacityOver', { occupancy: table.occupancy, capacity: table.capacity })
              : st === 'full'
                ? t('capacityFull')
                : t('capacityFree', { free })}
          </span>
        </div>
      </Field>

      <Field label={t('placedGuestsLabel', { count: table.assigned.length })}>
        {table.assigned.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[color:var(--color-border-strong)] px-3 py-4 text-center text-xs text-[color:var(--color-muted-foreground)]">
            {t('placedGuestsEmpty')}
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {table.assigned.map((g) => {
              const m = categoryMeta(g.category);
              return (
                <div
                  key={g._id}
                  onPointerDown={(e) => onSeatDown(g._id, e)}
                  className="flex cursor-grab items-center gap-2 rounded-lg border border-[color:var(--color-border)] px-2.5 py-1.5 active:cursor-grabbing"
                  style={{ borderLeftWidth: 3, borderLeftColor: m.color }}
                >
                  <span className="flex-1 truncate text-sm text-[color:var(--color-foreground)]">
                    {g.fullName}
                  </span>
                  <button
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => onRemoveGuest(g._id)}
                    aria-label={t('removeGuestAria', { name: g.fullName })}
                    className="text-[color:var(--color-muted-foreground)] hover:text-[color:var(--color-danger)]"
                  >
                    <X className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </Field>

      <button
        type="button"
        onClick={onDelete}
        className="mt-auto inline-flex items-center justify-center gap-1.5 rounded-lg border border-[color:var(--color-danger)]/40 px-3 py-2 text-sm text-[color:var(--color-danger)] transition-colors hover:bg-[color:var(--color-danger)]/10"
      >
        <Trash2 className="h-4 w-4" strokeWidth={1.8} aria-hidden /> {t('deleteTable')}
      </button>
    </aside>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="font-mono text-[10px] tracking-[0.14em] text-[color:var(--color-muted-foreground)] uppercase">
        {label}
      </label>
      {children}
    </div>
  );
}

function Stepper({
  value,
  min = 1,
  onChange,
}: {
  value: number;
  min?: number;
  onChange: (v: number) => void;
}) {
  const t = useTranslations('Pro.seatingBoard');
  return (
    <div className="inline-flex items-center rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface-elevated)]">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        aria-label={t('decrease')}
        className="grid h-8 w-8 place-items-center text-[color:var(--color-muted-foreground)] hover:text-[color:var(--color-foreground)]"
      >
        <Minus className="h-4 w-4" strokeWidth={2} aria-hidden />
      </button>
      <span className="w-8 text-center font-mono text-sm text-[color:var(--color-foreground)] tabular-nums">
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        aria-label={t('increase')}
        className="grid h-8 w-8 place-items-center text-[color:var(--color-muted-foreground)] hover:text-[color:var(--color-foreground)]"
      >
        <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
      </button>
    </div>
  );
}

/* ============================ AUTO-PLACE POPOVER ============================ */
const AUTO_OPTION_KEYS: ReadonlyArray<keyof AutoPlaceSettings> = [
  'groupByCategory',
  'keepGroupsTogether',
  'balanceTables',
  'createTables',
];

function AutoPlacePopover({
  onClose,
  onRun,
  poolCount,
}: {
  onClose: () => void;
  onRun: (settings: AutoPlaceSettings, mode: 'unplaced' | 'all') => void;
  poolCount: number;
}) {
  const t = useTranslations('Pro.seatingBoard');
  const [settings, setSettings] = useState<AutoPlaceSettings>(AUTO_PLACE_PRESET);
  const [mode, setMode] = useState<'unplaced' | 'all'>('unplaced');
  return (
    <>
      <button
        type="button"
        aria-label={t('close')}
        onClick={onClose}
        className="fixed inset-0 z-40 cursor-default"
      />
      <div className="absolute top-full right-0 z-50 mt-2 w-80 rounded-2xl border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface)] p-4 shadow-[var(--shadow-popover)]">
        <div className="mb-3 flex items-center gap-2">
          <Settings2
            className="h-4 w-4 text-[color:var(--color-blush-300)]"
            strokeWidth={1.9}
            aria-hidden
          />
          <span className="font-mono text-[10px] tracking-[0.16em] text-[color:var(--color-muted-foreground)] uppercase">
            {t('autoSettingsTitle')}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          {AUTO_OPTION_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setSettings((s) => ({ ...s, [key]: !s[key] }))}
              className="flex items-start gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-[color:var(--color-surface-elevated)]"
            >
              <span
                className={cn(
                  'mt-0.5 grid h-4 w-4 flex-shrink-0 place-items-center rounded border transition-colors',
                  settings[key]
                    ? 'border-[color:var(--color-blush-400)] bg-[color:var(--color-blush-400)] text-[color:var(--color-ink-700)]'
                    : 'border-[color:var(--color-border-strong)]',
                )}
              >
                {settings[key] ? <Check className="h-3 w-3" strokeWidth={3} aria-hidden /> : null}
              </span>
              <span className="flex flex-col">
                <span className="text-sm text-[color:var(--color-foreground)]">
                  {t(`autoOption.${key}.label`)}
                </span>
                <span className="text-[11px] text-[color:var(--color-muted-foreground)]">
                  {t(`autoOption.${key}.hint`)}
                </span>
              </span>
            </button>
          ))}
        </div>

        <div className="mt-3 flex items-center gap-1 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-elevated)] p-1">
          {(['unplaced', 'all'] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setMode(k)}
              aria-pressed={mode === k}
              className={cn(
                'flex-1 rounded-lg px-2 py-1.5 text-xs transition-colors',
                mode === k
                  ? 'bg-[color:var(--color-surface)] font-medium text-[color:var(--color-foreground)]'
                  : 'text-[color:var(--color-muted-foreground)] hover:text-[color:var(--color-foreground)]',
              )}
            >
              {k === 'unplaced' ? t('modeUnplaced', { count: poolCount }) : t('modeAll')}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => onRun(settings, mode)}
          className="focus-ring mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[color:var(--color-primary)] px-4 py-2 text-sm font-semibold text-[color:var(--color-primary-foreground)] transition-colors hover:bg-[color:var(--color-primary-hover)]"
        >
          <Wand2 className="h-4 w-4" strokeWidth={1.9} aria-hidden /> {t('runPlacement')}
        </button>
      </div>
    </>
  );
}

/* ============================ ADD-TABLE DIALOG ============================ */
function AddTableDialog({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (shape: Shape, cap: number) => void;
}) {
  const t = useTranslations('Pro.seatingBoard');
  const [shape, setShape] = useState<Shape>('round');
  const [cap, setCap] = useState(10);
  const SHAPES: ReadonlyArray<[Shape, string, LucideIcon]> = [
    ['round', t('shapeRound'), Circle],
    ['rect', t('shapeRect'), RectangleHorizontal],
  ];
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t('addTable')}
    >
      <button
        type="button"
        aria-label={t('close')}
        onClick={onClose}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
      />
      <div className="relative flex w-full max-w-sm flex-col gap-5 rounded-2xl border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface)] p-6 shadow-[var(--shadow-popover)]">
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-0.5">
            <span className="font-mono text-[10px] tracking-[0.18em] text-[color:var(--color-muted-foreground)] uppercase">
              {t('newTableEyebrow')}
            </span>
            <h2 className="font-display text-xl text-[color:var(--color-foreground)] italic">
              {t('addTable')}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('close')}
            className="text-[color:var(--color-muted-foreground)] hover:text-[color:var(--color-foreground)]"
          >
            <X className="h-5 w-5" strokeWidth={2} aria-hidden />
          </button>
        </div>
        <Field label={t('shapeLabel')}>
          <div className="grid grid-cols-2 gap-2">
            {SHAPES.map(([k, l, Ic]) => (
              <button
                key={k}
                type="button"
                onClick={() => setShape(k)}
                aria-pressed={shape === k}
                className={cn(
                  'inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2.5 text-sm transition-colors',
                  shape === k
                    ? 'border-[color:var(--color-blush-400)] bg-[color:var(--color-surface-elevated)] text-[color:var(--color-foreground)]'
                    : 'border-[color:var(--color-border)] text-[color:var(--color-muted-foreground)] hover:text-[color:var(--color-foreground)]',
                )}
              >
                <Ic className="h-4 w-4" strokeWidth={1.7} aria-hidden /> {l}
              </button>
            ))}
          </div>
        </Field>
        <Field label={t('capacityLabel')}>
          <Stepper value={cap} min={1} onChange={setCap} />
        </Field>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-[color:var(--color-muted-foreground)] hover:text-[color:var(--color-foreground)]"
          >
            {t('cancel')}
          </button>
          <button
            type="button"
            onClick={() => onAdd(shape, cap)}
            className="focus-ring inline-flex items-center gap-1.5 rounded-lg bg-[color:var(--color-primary)] px-4 py-2 text-sm font-semibold text-[color:var(--color-primary-foreground)] hover:bg-[color:var(--color-primary-hover)]"
          >
            <Plus className="h-4 w-4" strokeWidth={2.2} aria-hidden /> {t('add')}
          </button>
        </div>
      </div>
    </div>
  );
}
