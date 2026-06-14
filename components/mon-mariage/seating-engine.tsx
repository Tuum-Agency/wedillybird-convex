'use client';

import { useRef, useEffect, type CSSProperties, type ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { Icon } from './icons';

/* Wedillybird — Plan de table · moteur (données helpers + primitives + canvas + panneaux)
   Modèle UNIT-PERSONS : un invité « +2 » occupe 3 places. La capacité se compte
   en personnes. Source de vérité = guest.tableId ; l'occupation d'une table se
   recalcule depuis les invités. */

/* ============================ TYPES ============================ */
export type SeatCatKey = 'family' | 'friends' | 'colleagues' | 'pro';
export type SeatShape = 'round' | 'rect' | 'head';

export interface SeatGuest {
  id: string;
  name: string;
  category: SeatCatKey;
  partySize: number;
  tableId?: string;
  keepWith?: string[];
  keepApart?: string[];
}

export interface SeatTable {
  id: string;
  label: string;
  shape: SeatShape;
  capacity: number;
  x: number;
  y: number;
  notes?: string;
}

export interface SeatTotals {
  total: number;
  seated: number;
  pool: number;
}

export interface SeatView {
  x: number;
  y: number;
  k: number;
}

/* ---- catégories (couleur = garder les groupes ensemble) ----
   `label`/`short` sont des clés i18n (`MonMariage.seating.cats.*`), traduites au render. */
export const SEAT_CATS: Record<
  SeatCatKey,
  { label: string; short: string; color: string; soft: string }
> = {
  family: {
    label: 'MonMariage.seating.cats.family.label',
    short: 'MonMariage.seating.cats.family.short',
    color: 'oklch(72% 0.09 22)',
    soft: 'oklch(30% 0.05 22)',
  },
  friends: {
    label: 'MonMariage.seating.cats.friends.label',
    short: 'MonMariage.seating.cats.friends.short',
    color: 'oklch(72% 0.09 150)',
    soft: 'oklch(28% 0.05 150)',
  },
  colleagues: {
    label: 'MonMariage.seating.cats.colleagues.label',
    short: 'MonMariage.seating.cats.colleagues.short',
    color: 'oklch(78% 0.10 80)',
    soft: 'oklch(30% 0.05 80)',
  },
  pro: {
    label: 'MonMariage.seating.cats.pro.label',
    short: 'MonMariage.seating.cats.pro.short',
    color: 'oklch(70% 0.10 250)',
    soft: 'oklch(30% 0.05 250)',
  },
};

export const SEAT_CAT_KEYS: SeatCatKey[] = ['family', 'friends', 'colleagues', 'pro'];

/* ============================ HELPERS ============================ */
/* occupation (personnes) d'une table à partir de la liste d'invités */
export function tableOccupancy(guests: SeatGuest[], tableId: string): number {
  return guests.filter((g) => g.tableId === tableId).reduce((a, g) => a + g.partySize, 0);
}

export function tableGuests(guests: SeatGuest[], tableId: string): SeatGuest[] {
  return guests.filter((g) => g.tableId === tableId);
}

/* totaux globaux en personnes */
export function seatTotals(guests: SeatGuest[]): SeatTotals {
  const total = guests.reduce((a, g) => a + g.partySize, 0);
  const seated = guests.filter((g) => g.tableId).reduce((a, g) => a + g.partySize, 0);
  return { total, seated, pool: total - seated };
}

/* statut d'occupation : 'over' | 'full' | 'ok' | 'empty' */
export function occState(occ: number, cap: number): 'over' | 'full' | 'ok' | 'empty' {
  if (occ > cap) return 'over';
  if (occ === cap) return 'full';
  if (occ === 0) return 'empty';
  return 'ok';
}

/* initiales depuis un nom (« Famille Ndiaye » → « FN ») */
export function seatInitials(name: string): string {
  const clean = name.replace(/[«»]/g, '').trim();
  const parts = clean.split(/[\s&]+/).filter(Boolean);
  return (parts[0] ? (parts[0][0] ?? '') : '') + (parts[1] ? (parts[1][0] ?? '') : '');
}

/* positions des sièges autour d'une forme (round/rect/head) */
export function seatPositions(
  shape: SeatShape,
  count: number,
  w: number,
  h: number,
): Array<{ x: number; y: number }> {
  const pts: Array<{ x: number; y: number }> = [];
  const cx = w / 2,
    cy = h / 2;
  if (shape === 'round') {
    const rx = w / 2 + 18,
      ry = h / 2 + 18;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * 2 * Math.PI - Math.PI / 2;
      pts.push({ x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) });
    }
  } else {
    // rect / head : répartir sur le périmètre (haut/bas en priorité)
    const top = Math.ceil(count / 2),
      bot = count - top;
    const pad = 30;
    for (let i = 0; i < top; i++)
      pts.push({ x: pad + (w - 2 * pad) * (top === 1 ? 0.5 : i / (top - 1)), y: -18 });
    for (let i = 0; i < bot; i++)
      pts.push({ x: pad + (w - 2 * pad) * (bot === 1 ? 0.5 : i / (bot - 1)), y: h + 18 });
  }
  return pts;
}

/* dimensions d'une table selon forme + capacité */
export function tableDims(table: SeatTable): { w: number; h: number } {
  if (table.shape === 'head') return { w: 210, h: 88 };
  if (table.shape === 'rect') return { w: 130 + table.capacity * 9, h: 96 };
  const d = 92 + table.capacity * 8;
  return { w: d, h: d };
}

/* ============================ PRIMITIVES ============================ */
/* anneau d'occupation SVG (sièges remplis / capacité) */
export function OccupancyRing({
  occ,
  cap,
  size = 30,
  stroke = 3.5,
}: {
  occ: number;
  cap: number;
  size?: number;
  stroke?: number;
}): ReactElement {
  const r = (size - stroke) / 2,
    C = 2 * Math.PI * r;
  const frac = cap > 0 ? Math.min(occ / cap, 1) : 0;
  const over = occ > cap;
  const color = over
    ? 'var(--color-danger)'
    : occ === cap
      ? 'var(--color-sage-500)'
      : 'var(--brand)';
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden="true"
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

/* chip invité (pool ou liste) — draggable via pointer (géré par l'app) */
export function GuestChip({
  guest,
  seated,
  onPointerDown,
  onAssignClick,
  dragging,
  warn,
}: {
  guest: SeatGuest;
  seated?: boolean;
  dragging?: boolean;
  warn?: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
  onAssignClick: (e: React.MouseEvent) => void;
}): ReactElement {
  const t = useTranslations('MonMariage.seating');
  const tRoot = useTranslations('MonMariage');
  const cat = SEAT_CATS[guest.category];
  const catLabel = tRoot(cat.label.replace(/^MonMariage\./, ''));
  return (
    <div
      className={'gchip' + (seated ? ' seated' : '') + (dragging ? ' dragging' : '')}
      style={{ '--cat': cat.color, '--cat-soft': cat.soft } as CSSProperties}
      onPointerDown={onPointerDown}
      role="button"
      tabIndex={0}
      aria-label={t('chipAria', { name: guest.name, count: guest.partySize, cat: catLabel })}
    >
      <span className="gchip-av">{seatInitials(guest.name)}</span>
      <span className="gchip-main">
        <span className="gchip-name">{guest.name}</span>
        <span className="gchip-meta">
          <span className="gchip-party">
            <Icon name="Users" size={10} stroke={2} />
            <b>{guest.partySize}</b>
          </span>
          <span className="gchip-cat">{tRoot(cat.short.replace(/^MonMariage\./, ''))}</span>
          {warn && (
            <span className="gchip-flag" title={t('placementConstraint')}>
              <Icon name="AlertTriangle" size={11} stroke={2} />
            </span>
          )}
          {(guest.keepWith || guest.keepApart) && !warn && (
            <span
              style={{ color: 'var(--color-muted-foreground)' }}
              title={guest.keepWith ? t('keepTogether') : t('keepApart')}
            >
              <Icon name={guest.keepWith ? 'Link2' : 'CornerUpLeft'} size={11} stroke={1.8} />
            </span>
          )}
        </span>
      </span>
      <span className="gchip-assign">
        <button
          className="gchip-assign-btn"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onAssignClick}
          aria-label={t('assignToTable', { name: guest.name })}
        >
          <Icon name="MoreVertical" size={14} stroke={2} />
        </button>
      </span>
    </div>
  );
}

/* ============================ CANVAS ============================ */
export function TableNode({
  table,
  guests,
  selected,
  dropState,
  onSelect,
  onMenu,
  onMoveStart,
  onSeatDown,
}: {
  table: SeatTable;
  guests: SeatGuest[];
  selected: boolean;
  dropState: 'ok' | 'cant' | null;
  onSelect: (id: string | null) => void;
  onMenu: (id: string, e: React.MouseEvent) => void;
  onMoveStart: (id: string, e: React.PointerEvent) => void;
  onSeatDown: (guestId: string, tableId: string | null, e: React.PointerEvent) => void;
}): ReactElement {
  const t = useTranslations('MonMariage.seating');
  const dims = tableDims(table);
  const seated = tableGuests(guests, table.id);
  const occ = seated.reduce((a, g) => a + g.partySize, 0);
  const st = occState(occ, table.capacity);
  // sièges : un point par PERSONNE (déplie partySize)
  const personSlots: Array<{ g: SeatGuest; idx: number }> = [];
  seated.forEach((g) => {
    for (let i = 0; i < g.partySize; i++) personSlots.push({ g, idx: i });
  });
  const slotCount = Math.max(personSlots.length, table.capacity);
  const pts = seatPositions(
    table.shape === 'head' ? 'rect' : table.shape,
    slotCount,
    dims.w,
    dims.h,
  );

  return (
    <div
      className={
        'tnode ' +
        table.shape +
        (selected ? ' selected' : '') +
        (st === 'over' ? ' over' : st === 'full' ? ' full' : '') +
        (dropState === 'ok' ? ' drop' : dropState === 'cant' ? ' drop cant' : '')
      }
      style={{ left: table.x, top: table.y }}
      onPointerDown={(e) => {
        e.stopPropagation();
        onSelect(table.id);
      }}
    >
      <div
        className="tnode-surface"
        style={{ width: dims.w, height: dims.h }}
        data-table-id={table.id}
      >
        <button
          className="tmenu-btn"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => onMenu(table.id, e)}
          aria-label={t('tableOptions', { label: table.label })}
        >
          <Icon name="MoreVertical" size={15} stroke={2} />
        </button>
        <button
          className="tnode-grab"
          onPointerDown={(e) => {
            e.stopPropagation();
            onMoveStart(table.id, e);
          }}
          aria-label={t('moveTable', { label: table.label })}
          title={t('move')}
        >
          <Icon name="Maximize2" size={13} stroke={1.8} />
        </button>
        <div className="tnode-center">
          {table.shape === 'head' && (
            <Icon name="Crown" size={15} stroke={1.8} style={{ color: 'var(--color-gold-500)' }} />
          )}
          <span className="tnode-label">{table.label}</span>
          <span className="tnode-ring">
            <OccupancyRing occ={occ} cap={table.capacity} size={26} />
            <span className="tnode-occ">
              {occ}
              <span className="cap">/{table.capacity}</span>
            </span>
            {st === 'over' && (
              <span className="tnode-warn" title={t('capacityExceeded')}>
                <Icon name="AlertTriangle" size={13} stroke={2} />
              </span>
            )}
          </span>
        </div>
        {/* sièges occupés (un point par personne) ; les places libres restent vides */}
        {pts.map((p, i) => {
          const slot = personSlots[i];
          if (!slot) return null;
          const cat = SEAT_CATS[slot.g.category];
          return (
            <span
              key={i}
              className="seat-dot"
              style={{ left: p.x, top: p.y, '--cat': cat.color } as CSSProperties}
              title={slot.g.name}
              onPointerDown={(e) => {
                e.stopPropagation();
                onSeatDown(slot.g.id, table.id, e);
              }}
            >
              {seatInitials(slot.g.name)}
            </span>
          );
        })}
      </div>
    </div>
  );
}

/* canvas avec pan + zoom */
export function RoomCanvas({
  tables,
  guests,
  selectedId,
  dropTargetId,
  dropCant,
  onSelect,
  onMenu,
  onMoveTable,
  onSeatDown,
  view,
  setView,
  canvasRef,
}: {
  tables: SeatTable[];
  guests: SeatGuest[];
  selectedId: string | null;
  dropTargetId: string | null;
  dropCant: boolean | null;
  onSelect: (id: string | null) => void;
  onMenu: (id: string, e: React.MouseEvent) => void;
  onMoveTable: (id: string, e: React.PointerEvent) => void;
  onSeatDown: (guestId: string, tableId: string | null, e: React.PointerEvent) => void;
  view: SeatView;
  setView: React.Dispatch<React.SetStateAction<SeatView>>;
  canvasRef: React.RefObject<HTMLDivElement | null>;
}): ReactElement {
  const t = useTranslations('MonMariage.seating');
  const tRoot = useTranslations('MonMariage');
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const pan = useRef({ active: false, sx: 0, sy: 0, ox: 0, oy: 0 });

  function onBgDown(e: React.PointerEvent) {
    if (e.button !== 0) return;
    onSelect(null);
    pan.current = { active: true, sx: e.clientX, sy: e.clientY, ox: view.x, oy: view.y };
    if (wrapRef.current) wrapRef.current.classList.add('panning');
    const move = (ev: PointerEvent) => {
      if (!pan.current.active) return;
      setView((v) => ({
        ...v,
        x: pan.current.ox + (ev.clientX - pan.current.sx),
        y: pan.current.oy + (ev.clientY - pan.current.sy),
      }));
    };
    const up = () => {
      pan.current.active = false;
      if (wrapRef.current) wrapRef.current.classList.remove('panning');
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }
  function zoom(d: number) {
    setView((v) => ({ ...v, k: Math.min(1.6, Math.max(0.4, +(v.k + d).toFixed(2))) }));
  }
  function onWheel(e: React.WheelEvent) {
    if (!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    setView((v) => ({
      ...v,
      k: Math.min(1.6, Math.max(0.4, +(v.k - Math.sign(e.deltaY) * 0.1).toFixed(2))),
    }));
  }

  return (
    <div
      className="seat-canvas-wrap"
      ref={(el) => {
        wrapRef.current = el;
        if (canvasRef) canvasRef.current = el;
      }}
      onPointerDown={onBgDown}
      onWheel={onWheel}
    >
      <div className="seat-legend" aria-hidden="true">
        {SEAT_CAT_KEYS.map((k) => (
          <span className="lg" key={k}>
            <span className="cdot" style={{ background: SEAT_CATS[k].color }} />
            {tRoot(SEAT_CATS[k].label.replace(/^MonMariage\./, ''))}
          </span>
        ))}
      </div>
      <div
        className="seat-canvas"
        style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}
      >
        {tables.map((t) => (
          <TableNode
            key={t.id}
            table={t}
            guests={guests}
            selected={selectedId === t.id}
            dropState={dropTargetId === t.id ? (dropCant ? 'cant' : 'ok') : null}
            onSelect={onSelect}
            onMenu={onMenu}
            onMoveStart={onMoveTable}
            onSeatDown={onSeatDown}
          />
        ))}
      </div>
      <div className="seat-zoombar" role="group" aria-label={t('zoom')}>
        <button onClick={() => zoom(-0.1)} aria-label={t('zoomOut')}>
          <Icon name="ZoomOut" size={16} stroke={1.9} />
        </button>
        <span className="zlevel">{Math.round(view.k * 100)}%</span>
        <button onClick={() => zoom(0.1)} aria-label={t('zoomIn')}>
          <Icon name="ZoomIn" size={16} stroke={1.9} />
        </button>
        <button onClick={() => setView({ x: 40, y: 20, k: 0.7 })} aria-label={t('resetView')}>
          <Icon name="Maximize2" size={15} stroke={1.9} />
        </button>
      </div>
    </div>
  );
}

/* ============================ POOL (gauche) ============================ */
export function PoolPanel({
  guests,
  totals,
  search,
  setSearch,
  filters,
  toggleFilter,
  onChipDown,
  onAssign,
  dropping,
}: {
  guests: SeatGuest[];
  totals: SeatTotals;
  search: string;
  setSearch: (s: string) => void;
  filters: SeatCatKey[];
  toggleFilter: (k: SeatCatKey) => void;
  onChipDown: (guestId: string, tableId: string | null, e: React.PointerEvent) => void;
  onAssign: (guestId: string, e: React.MouseEvent) => void;
  dropping: boolean;
}): ReactElement {
  const t = useTranslations('MonMariage.seating');
  const tRoot = useTranslations('MonMariage');
  const pool = guests.filter((g) => !g.tableId);
  const q = search.trim().toLowerCase();
  const shown = pool.filter(
    (g) =>
      (!filters.length || filters.includes(g.category)) && (!q || g.name.toLowerCase().includes(q)),
  );
  return (
    <div className="seat-pool">
      <div className="seat-pool-head">
        <div className="seat-pool-title">
          <h2>{t('guestsToSeat')}</h2>
          <span className="seat-counter">
            {t.rich('seatedCounter', {
              seated: totals.seated,
              total: totals.total,
              b: (chunks) => <b>{chunks}</b>,
            })}
          </span>
        </div>
        <label className="seat-search">
          <Icon name="Search" size={15} stroke={1.9} />
          <input
            type="text"
            placeholder={t('searchGuest')}
            aria-label={t('search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              aria-label={t('clear')}
              style={{
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                color: 'inherit',
                display: 'grid',
              }}
            >
              <Icon name="X" size={14} stroke={2} />
            </button>
          )}
        </label>
        <div className="seat-filters">
          {SEAT_CAT_KEYS.map((k) => (
            <button
              key={k}
              className={'seat-fchip' + (filters.includes(k) ? ' on' : '')}
              onClick={() => toggleFilter(k)}
              aria-pressed={filters.includes(k)}
            >
              <span className="cdot" style={{ background: SEAT_CATS[k].color }} />
              {tRoot(SEAT_CATS[k].short.replace(/^MonMariage\./, ''))}
            </button>
          ))}
        </div>
      </div>
      <div className={'seat-pool-body' + (dropping ? ' dropping' : '')} data-pool="1">
        {shown.length === 0 ? (
          <div className="seat-pool-empty">
            <span className="ic">
              <Icon name="CheckCircle" size={22} stroke={1.7} />
            </span>
            <p>{pool.length === 0 ? t('allSeated') : t('noGuestFilter')}</p>
          </div>
        ) : (
          shown.map((g) => (
            <GuestChip
              key={g.id}
              guest={g}
              onPointerDown={(e) => onChipDown(g.id, null, e)}
              onAssignClick={(e) => onAssign(g.id, e)}
            />
          ))
        )}
      </div>
    </div>
  );
}

/* ============================ INSPECTEUR (droite) ============================ */
export function Inspector({
  table,
  guests,
  onClose,
  onRename,
  onShape,
  onCap,
  onRemove,
  onNotes,
  onDuplicate,
  onDelete,
  onSeatDown,
}: {
  table: SeatTable | null;
  guests: SeatGuest[];
  onClose: () => void;
  onRename: (id: string, label: string) => void;
  onShape: (id: string, shape: SeatShape) => void;
  onCap: (id: string, capacity: number) => void;
  onRemove: (guestId: string) => void;
  onNotes: (id: string, notes: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onSeatDown: (guestId: string, tableId: string | null, e: React.PointerEvent) => void;
}): ReactElement | null {
  const t = useTranslations('MonMariage.seating');
  if (!table) return null;
  const seated = tableGuests(guests, table.id);
  const occ = seated.reduce((a, g) => a + g.partySize, 0);
  const st = occState(occ, table.capacity);
  const free = table.capacity - occ;
  // [forme, clé i18n du libellé court, icône]
  const SHAPES: Array<[SeatShape, string, string]> = [
    ['round', 'shapeRoundShort', 'Circle'],
    ['rect', 'shapeRectShort', 'RectangleH'],
    ['head', 'shapeHeadShort', 'Crown'],
  ];
  const shapeName =
    table.shape === 'head'
      ? t('shapeHead')
      : table.shape === 'rect'
        ? t('shapeRect')
        : t('shapeRound');
  return (
    <aside className="seat-inspect" aria-label={t('inspectorAria', { label: table.label })}>
      <div className="seat-inspect-head">
        <span className="ic">
          <Icon
            name={
              table.shape === 'head' ? 'Crown' : table.shape === 'rect' ? 'RectangleH' : 'Circle'
            }
            size={18}
            stroke={1.8}
          />
        </span>
        <div className="grow">
          <h3>{table.label}</h3>
          <span className="sub">
            {t('inspectorSub', { occ, cap: table.capacity, shape: shapeName })}
          </span>
        </div>
        <button className="dr-close" onClick={onClose} aria-label={t('closeInspector')}>
          <Icon name="X" size={16} stroke={2} />
        </button>
      </div>
      <div className="seat-inspect-body">
        <div className="ins-sec">
          <label htmlFor="ins-name">{t('tableNameLabel')}</label>
          <input
            id="ins-name"
            className="ins-input"
            value={table.label}
            onChange={(e) => onRename(table.id, e.target.value)}
          />
        </div>
        <div className="ins-sec">
          <label>{t('shapeLabel')}</label>
          <div className="ins-shapes">
            {SHAPES.map(([k, lKey, ic]) => (
              <button
                key={k}
                className={'ins-shape' + (table.shape === k ? ' on' : '')}
                onClick={() => onShape(table.id, k)}
                aria-pressed={table.shape === k}
              >
                <Icon name={ic} size={16} stroke={1.7} />
                {t(lKey)}
              </button>
            ))}
          </div>
        </div>
        <div className="ins-sec">
          <label>{t('capacityLabel')}</label>
          <div className="ins-cap">
            <div className="ins-stepper">
              <button
                onClick={() => onCap(table.id, Math.max(1, table.capacity - 1))}
                aria-label={t('decrease')}
              >
                <Icon name="Minus" size={15} stroke={2} />
              </button>
              <span className="v">{table.capacity}</span>
              <button
                onClick={() => onCap(table.id, table.capacity + 1)}
                aria-label={t('increase')}
              >
                <Icon name="Plus" size={15} stroke={2} />
              </button>
            </div>
            <span className={'ins-cap-state ' + st}>
              {st === 'over'
                ? t('capExceeded', { occ, cap: table.capacity })
                : st === 'full'
                  ? t('capFull')
                  : t('capFree', { count: free })}
            </span>
          </div>
        </div>
        <div className="ins-sec">
          <label>{t('seatedGuests', { count: seated.length })}</label>
          {seated.length === 0 ? (
            <div className="ins-empty">{t('seatedEmpty')}</div>
          ) : (
            <div className="ins-seated">
              {seated.map((g) => {
                const cat = SEAT_CATS[g.category];
                return (
                  <div
                    className="ins-seat-row"
                    key={g.id}
                    style={{ '--cat': cat.color } as CSSProperties}
                    onPointerDown={(e) => onSeatDown(g.id, table.id, e)}
                  >
                    <span className="nm">{g.name}</span>
                    <span className="ps">{t('partySizeShort', { count: g.partySize })}</span>
                    <button
                      className="rm"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => onRemove(g.id)}
                      aria-label={t('removeGuest', { name: g.name })}
                    >
                      <Icon name="X" size={14} stroke={2} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="ins-sec">
          <label htmlFor="ins-notes">{t('notesLabel')}</label>
          <textarea
            id="ins-notes"
            className="ins-textarea"
            placeholder={t('notesPlaceholder')}
            value={table.notes || ''}
            onChange={(e) => onNotes(table.id, e.target.value)}
          />
        </div>
        <div className="ins-actions">
          <button className="ins-act" onClick={() => onDuplicate(table.id)}>
            <Icon name="Copy" size={14} stroke={1.8} />
            {t('duplicate')}
          </button>
          <button className="ins-act danger" onClick={() => onDelete(table.id)}>
            <Icon name="Trash2" size={14} stroke={1.8} />
            {t('delete')}
          </button>
        </div>
      </div>
    </aside>
  );
}

/* ============================ MENU « ASSIGNER À… » (accessible, non-drag) ============================ */
export function AssignMenu({
  guest,
  tables,
  guests,
  pos,
  onPick,
  onClose,
}: {
  guest: SeatGuest;
  tables: SeatTable[];
  guests: SeatGuest[];
  pos: { x: number; y: number };
  onPick: (tableId: string | null) => void;
  onClose: () => void;
}): ReactElement | null {
  const t = useTranslations('MonMariage.seating');
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', h);
    document.addEventListener('keydown', k);
    return () => {
      document.removeEventListener('mousedown', h);
      document.removeEventListener('keydown', k);
    };
  }, [onClose]);
  if (!guest) return null;
  const style = {
    left: Math.min(pos.x, window.innerWidth - 230),
    top: Math.min(pos.y, window.innerHeight - 320),
  };
  return (
    <div
      className="seat-menu"
      ref={ref}
      style={style}
      role="menu"
      aria-label={t('assignMenuAria', { name: guest.name })}
    >
      <div className="seat-menu-lbl">
        {t('assignMenuLabel', { name: guest.name, count: guest.partySize })}
      </div>
      {guest.tableId && (
        <>
          <button className="seat-menu-item" role="menuitem" onClick={() => onPick(null)}>
            <Icon name="CornerUpLeft" size={15} stroke={1.8} />
            {t('returnToPool')}
          </button>
          <div className="seat-menu-sep" />
        </>
      )}
      {tables.map((tbl) => {
        const occ = tableOccupancy(guests, tbl.id);
        const would = occ + (guest.tableId === tbl.id ? 0 : guest.partySize);
        const disabled = guest.tableId === tbl.id || would > tbl.capacity;
        return (
          <button
            key={tbl.id}
            className={'seat-menu-item' + (disabled ? ' disabled' : '')}
            role="menuitem"
            disabled={disabled}
            onClick={() => !disabled && onPick(tbl.id)}
          >
            <Icon
              name={tbl.shape === 'head' ? 'Crown' : tbl.shape === 'rect' ? 'RectangleH' : 'Circle'}
              size={14}
              stroke={1.7}
            />
            {tbl.label}
            <span
              className="occ"
              style={would > tbl.capacity ? { color: 'var(--color-danger)' } : undefined}
            >
              {occ}/{tbl.capacity}
              {guest.tableId === tbl.id
                ? t('hereSuffix')
                : would > tbl.capacity
                  ? t('fullSuffix')
                  : ''}
            </span>
          </button>
        );
      })}
    </div>
  );
}
