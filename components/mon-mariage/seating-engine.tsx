'use client';
// Wedillybird — Plan de table · MOTEUR DE RENDU (primitives pseudo-3D + panneaux)
// Rendu LIGHT « mariage éditorial ». La logique d'état/drag vit dans screen-seating.

import { useRef, useEffect, type CSSProperties, type ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { Icon } from './icons';
import {
  BASE_PPM,
  TILT_3D,
  SEAT_CATS,
  SEAT_CAT_KEYS,
  TABLE_SHAPES,
  TABLE_SHAPE_KEYS,
  ELEMENT_KINDS,
  type SeatCatKey,
  type SeatGuest,
  type SeatTable,
  type RoomElement,
  type RoomConfig,
  type SeatView,
  type SeatTotals,
  type TableShape,
  type ElementKind,
  seatInitials,
  tableGuests,
  tableOccupancy,
  occState,
  tableSurfaceM,
  tableFootprintM,
  tableChairsM,
  fmtM,
} from './seating-model';

const px = (m: number): number => Math.round(m * BASE_PPM);
const tRootKey = (k: string): string => k.replace(/^MonMariage\./, '');

export function elAccent(a: string): string {
  return a === 'gold'
    ? 'var(--color-gold-500)'
    : a === 'blush'
      ? 'var(--brand)'
      : a === 'sage'
        ? 'var(--color-sage-500)'
        : 'var(--color-ink-500)';
}

/* ============================ PRIMITIVES ============================ */
export function OccRing({
  occ,
  cap,
  size = 22,
  stroke = 3,
}: {
  occ: number;
  cap: number;
  size?: number;
  stroke?: number;
}): ReactElement {
  const r = (size - stroke) / 2;
  const C = 2 * Math.PI * r;
  const frac = cap > 0 ? Math.min(occ / cap, 1) : 0;
  const color =
    occ > cap ? 'var(--color-danger)' : occ === cap ? 'var(--color-sage-500)' : 'var(--brand)';
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden="true"
      className="tc-ring"
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--color-border)"
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
          style={{ transition: 'stroke-dasharray .35s var(--ease-out-quint)' }}
        />
      </g>
    </svg>
  );
}

export function GuestChip({
  guest,
  dragging,
  onPointerDown,
  onAssignClick,
}: {
  guest: SeatGuest;
  dragging?: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
  onAssignClick: (e: React.MouseEvent) => void;
}): ReactElement {
  const t = useTranslations('MonMariage.seating');
  const tRoot = useTranslations('MonMariage');
  const cat = SEAT_CATS[guest.category];
  const catLabel = tRoot(tRootKey(cat.label));
  return (
    <div
      className={'gchip' + (dragging ? ' dragging' : '')}
      style={{ '--cat': cat.color, '--cat-soft': cat.soft, '--cat-ink': cat.ink } as CSSProperties}
      onPointerDown={onPointerDown}
      role="button"
      tabIndex={0}
      aria-label={t('chipAria', { name: guest.name, count: guest.partySize, cat: catLabel })}
    >
      <span className="gchip-av">{seatInitials(guest.name)}</span>
      <span className="gchip-main">
        <span className="gchip-name">
          {guest.status && <span className={'gchip-rsvp ' + guest.status} aria-hidden="true" />}
          {guest.name}
        </span>
        <span className="gchip-meta">
          <span className="gchip-party">
            <Icon name="Users" size={10} stroke={2} />
            <b>{guest.partySize}</b>
          </span>
          <span className="gchip-cat">{tRoot(tRootKey(cat.short))}</span>
        </span>
      </span>
      <button
        className="gchip-assign-btn"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={onAssignClick}
        aria-label={t('assignToTable', { name: guest.name })}
      >
        <Icon name="MoreVertical" size={15} stroke={2} />
      </button>
    </div>
  );
}

/* ============================ TABLE (objet 3D) ============================ */
export function TableObject({
  table,
  guests,
  selected,
  dropState,
  onSelect,
  onMove,
  onChairDown,
}: {
  table: SeatTable;
  guests: SeatGuest[];
  selected: boolean;
  dropState: 'ok' | 'cant' | null;
  onSelect: (id: string) => void;
  onMove: (id: string, e: React.PointerEvent) => void;
  onChairDown: (guestId: string, tableId: string, e: React.PointerEvent) => void;
}): ReactElement {
  const surf = tableSurfaceM(table.shape, table.capacity);
  const foot = tableFootprintM(table.shape, table.capacity);
  const chairs = tableChairsM(table.shape, table.capacity);
  const seated = tableGuests(guests, table.id);
  const occ = seated.reduce((a, g) => a + g.partySize, 0);
  const st = occState(occ, table.capacity);
  // déplie les personnes sur les chaises (les `occ` premières chaises sont occupées)
  const persons: SeatGuest[] = [];
  seated.forEach((g) => {
    for (let i = 0; i < g.partySize; i++) persons.push(g);
  });
  const honor = table.honor || table.shape === 'sweetheart';

  return (
    <div
      className={
        'tobj' +
        (selected ? ' sel' : '') +
        (st === 'over' ? ' over' : '') +
        (dropState === 'ok' ? ' drop' : dropState === 'cant' ? ' drop cant' : '')
      }
      style={{ left: px(table.x), top: px(table.y), width: px(foot.w), height: px(foot.h) }}
      onPointerDown={(e) => {
        e.stopPropagation();
        onSelect(table.id);
      }}
    >
      <div
        className="tobj-shadow"
        style={{
          width: px(surf.w) * 1.1,
          height: px(surf.h) * 1.1,
          left: '50%',
          top: '50%',
          transform: 'translate(-50%,-50%)',
        }}
      />
      <div className="tobj-rot" style={{ '--rot': table.rotation + 'deg' } as CSSProperties}>
        <div
          className={'tobj-top ' + table.shape + (honor ? ' honor' : '')}
          data-table-id={table.id}
          style={{ width: px(surf.w), height: px(surf.h) }}
          onPointerDown={(e) => {
            e.stopPropagation();
            onSelect(table.id);
            onMove(table.id, e);
          }}
        />
        {chairs.map((c, i) => {
          const g = persons[i];
          const cat = g ? SEAT_CATS[g.category] : null;
          return (
            <span
              key={i}
              className={'chair ' + (g ? 'occ' : 'free')}
              style={
                {
                  left: `calc(50% + ${px(c.x)}px)`,
                  top: `calc(50% + ${px(c.y)}px)`,
                  transform: `translate(-50%,-50%) rotate(${c.rot}deg)`,
                  '--cat': cat ? cat.color : undefined,
                } as CSSProperties
              }
              title={g ? g.name : undefined}
              onPointerDown={
                g
                  ? (e) => {
                      e.stopPropagation();
                      onChairDown(g.id, table.id, e);
                    }
                  : undefined
              }
            >
              <i />
            </span>
          );
        })}
      </div>
      <div className={'tobj-card ' + st}>
        <span className="tc-name">
          {honor && <Icon name="Crown" size={11} stroke={1.9} />}
          {table.label}
        </span>
        <span className="tc-occ">
          <OccRing occ={occ} cap={table.capacity} />
          <span>
            <b>{occ}</b>/{table.capacity}
          </span>
        </span>
      </div>
    </div>
  );
}

/* ============================ ÉLÉMENT DE SALLE (objet 3D) ============================ */
export function RoomElementObject({
  el,
  selected,
  onSelect,
  onMove,
}: {
  el: RoomElement;
  selected: boolean;
  onSelect: (id: string) => void;
  onMove: (id: string, e: React.PointerEvent) => void;
}): ReactElement {
  const t = useTranslations('MonMariage.seating');
  const spec = ELEMENT_KINDS[el.kind];
  return (
    <div
      className={'eobj' + (selected ? ' sel' : '')}
      style={
        {
          left: px(el.x),
          top: px(el.y),
          width: px(el.w),
          height: px(el.h),
          '--rot': el.rotation + 'deg',
          '--el-accent': elAccent(spec.accent),
        } as CSSProperties
      }
      onPointerDown={(e) => {
        e.stopPropagation();
        onSelect(el.id);
        onMove(el.id, e);
      }}
    >
      <div className={'eobj-body ' + spec.variant}>
        {spec.variant !== 'line' && (
          <span className="eobj-icon">
            <Icon
              name={spec.icon}
              size={Math.min(28, Math.max(15, px(Math.min(el.w, el.h)) * 0.3))}
              stroke={1.6}
            />
          </span>
        )}
      </div>
      {spec.variant !== 'line' && (
        <span className="eobj-label">
          <Icon name={spec.icon} size={10} stroke={1.9} />
          {el.label || t(spec.labelKey)}
        </span>
      )}
    </div>
  );
}

/* ============================ SCÈNE (centre) ============================ */
type StageObject =
  | { type: 'table'; y: number; table: SeatTable }
  | { type: 'element'; y: number; el: RoomElement };

export function RoomStage({
  room,
  tables,
  elements,
  guests,
  selectedId,
  dropTargetId,
  dropCant,
  view,
  setView,
  stageRef,
  onSelect,
  onSelectNone,
  onMoveTable,
  onMoveElement,
  onChairDown,
}: {
  room: RoomConfig;
  tables: SeatTable[];
  elements: RoomElement[];
  guests: SeatGuest[];
  selectedId: string | null;
  dropTargetId: string | null;
  dropCant: boolean | null;
  view: SeatView;
  setView: React.Dispatch<React.SetStateAction<SeatView>>;
  stageRef: React.RefObject<HTMLDivElement | null>;
  onSelect: (id: string) => void;
  onSelectNone: () => void;
  onMoveTable: (id: string, e: React.PointerEvent) => void;
  onMoveElement: (id: string, e: React.PointerEvent) => void;
  onChairDown: (guestId: string, tableId: string, e: React.PointerEvent) => void;
}): ReactElement {
  const t = useTranslations('MonMariage.seating');
  const tRoot = useTranslations('MonMariage');
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const pan = useRef({ active: false, sx: 0, sy: 0, ox: 0, oy: 0 });
  const tilt = view.mode === '3d' ? TILT_3D : 0;

  function onBgDown(e: React.PointerEvent) {
    if (e.button !== 0) return;
    onSelectNone();
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
    setView((v) => ({ ...v, k: Math.min(1.8, Math.max(0.35, +(v.k + d).toFixed(2))) }));
  }
  function onWheel(e: React.WheelEvent) {
    if (!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    setView((v) => ({
      ...v,
      k: Math.min(1.8, Math.max(0.35, +(v.k - Math.sign(e.deltaY) * 0.12).toFixed(2))),
    }));
  }

  const objects: StageObject[] = [
    ...elements.map((el) => ({ type: 'element' as const, y: el.y, el })),
    ...tables.map((tb) => ({ type: 'table' as const, y: tb.y, table: tb })),
  ].sort((a, b) => a.y - b.y);

  const empty = tables.length === 0 && elements.length === 0;

  return (
    <div
      className={'room-stage ' + (view.mode === '3d' ? 'is-3d' : 'is-plan')}
      ref={(el) => {
        wrapRef.current = el;
        if (stageRef) stageRef.current = el;
      }}
      onPointerDown={onBgDown}
      onWheel={onWheel}
    >
      <div
        className="room-floor"
        style={
          {
            '--vx': view.x + 'px',
            '--vy': view.y + 'px',
            '--vk': view.k,
            '--tilt': tilt + 'deg',
            width: px(room.widthM),
            height: px(room.lengthM),
          } as CSSProperties
        }
      >
        <div className={'floor-surface floor-' + room.floor}>
          <div className="floor-grid" />
          <div className="floor-grid major" />
        </div>
        <span className="floor-label">
          <Icon name="MapPin" size={11} stroke={1.9} />
          {room.name} · {fmtM(room.widthM)} × {fmtM(room.lengthM)} m
        </span>
        {objects.map((o) =>
          o.type === 'table' ? (
            <TableObject
              key={o.table.id}
              table={o.table}
              guests={guests}
              selected={selectedId === o.table.id}
              dropState={dropTargetId === o.table.id ? (dropCant ? 'cant' : 'ok') : null}
              onSelect={onSelect}
              onMove={onMoveTable}
              onChairDown={onChairDown}
            />
          ) : (
            <RoomElementObject
              key={o.el.id}
              el={o.el}
              selected={selectedId === o.el.id}
              onSelect={onSelect}
              onMove={onMoveElement}
            />
          ),
        )}
      </div>

      <div className="room-legend" aria-hidden="true">
        {SEAT_CAT_KEYS.map((k) => (
          <span className="lg" key={k}>
            <span className="cdot" style={{ background: SEAT_CATS[k].color }} />
            {tRoot(tRootKey(SEAT_CATS[k].label))}
          </span>
        ))}
      </div>

      <div className="room-zoom" role="group" aria-label={t('zoom')}>
        <button onClick={() => zoom(-0.12)} aria-label={t('zoomOut')}>
          <Icon name="ZoomOut" size={16} stroke={1.9} />
        </button>
        <span className="zlevel">{Math.round(view.k * 100)}%</span>
        <button onClick={() => zoom(0.12)} aria-label={t('zoomIn')}>
          <Icon name="ZoomIn" size={16} stroke={1.9} />
        </button>
      </div>

      <span className="room-hint">
        <Icon name={view.mode === '3d' ? 'Move' : 'Maximize2'} size={13} stroke={1.9} />
        {view.mode === '3d' ? t('hint3d') : t('hintPlan')}
      </span>

      {empty && (
        <div className="seat-empty-room">
          <div className="seat-empty-inner">
            <span className="ic">
              <Icon name="Armchair" size={28} stroke={1.6} />
            </span>
            <h2>{t('emptyTitle')}</h2>
            <p>{t('emptyDesc')}</p>
          </div>
        </div>
      )}
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
  onAddPerson,
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
  onAddPerson: () => void;
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
            <button onClick={() => setSearch('')} aria-label={t('clear')}>
              <Icon name="X" size={14} stroke={2} />
            </button>
          )}
        </label>
        <div className="seat-filters">
          {SEAT_CAT_KEYS.map((k) => (
            <button
              key={k}
              className={'seat-fchip' + (filters.includes(k) ? ' on' : '')}
              style={
                { '--cat': SEAT_CATS[k].color, '--cat-soft': SEAT_CATS[k].soft } as CSSProperties
              }
              onClick={() => toggleFilter(k)}
              aria-pressed={filters.includes(k)}
            >
              <span className="cdot" style={{ background: SEAT_CATS[k].color }} />
              {tRoot(tRootKey(SEAT_CATS[k].short))}
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
      <button
        className="seat-tbtn"
        style={{ margin: 12, justifyContent: 'center' }}
        onClick={onAddPerson}
      >
        <Icon name="UserPlus" size={15} stroke={2} />
        {t('addPerson')}
      </button>
    </div>
  );
}

/* ============================ INSPECTEUR (droite) ============================ */
const RESIZABLE: ReadonlySet<ElementKind> = new Set<ElementKind>([
  'dancefloor',
  'stage',
  'dj',
  'bar',
  'buffet',
  'photobooth',
]);

function Stepper({
  value,
  min,
  max,
  step = 1,
  onChange,
  fmt,
  decLabel,
  incLabel,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  fmt?: (v: number) => string;
  decLabel: string;
  incLabel: string;
}): ReactElement {
  const r = (v: number): number => Math.round(v * 100) / 100;
  return (
    <div className="ins-stepper">
      <button
        onClick={() => onChange(r(Math.max(min, value - step)))}
        disabled={value <= min}
        aria-label={decLabel}
      >
        <Icon name="Minus" size={15} stroke={2} />
      </button>
      <span className="v">{fmt ? fmt(value) : value}</span>
      <button
        onClick={() => onChange(r(Math.min(max, value + step)))}
        disabled={value >= max}
        aria-label={incLabel}
      >
        <Icon name="Plus" size={15} stroke={2} />
      </button>
    </div>
  );
}

function RotationRow({
  rotation,
  onRotate,
}: {
  rotation: number;
  onRotate: (deg: number) => void;
}): ReactElement {
  const t = useTranslations('MonMariage.seating');
  const norm = (d: number): number => ((Math.round(d) % 360) + 360) % 360;
  return (
    <div className="ins-sec">
      <span className="ins-lab">{t('rotationLabel')}</span>
      <div className="ins-rot">
        <button
          className="ins-rot-btn"
          onClick={() => onRotate(norm(rotation - 45))}
          aria-label={t('rotateLeft')}
        >
          <Icon name="RotateCcw" size={15} stroke={1.9} />
        </button>
        <input
          type="range"
          min={0}
          max={345}
          step={15}
          value={norm(rotation)}
          onChange={(e) => onRotate(Number(e.target.value))}
          aria-label={t('rotationLabel')}
        />
        <span className="deg">{norm(rotation)}°</span>
        <button
          className="ins-rot-btn"
          onClick={() => onRotate(norm(rotation + 45))}
          aria-label={t('rotateRight')}
        >
          <Icon name="RotateCw" size={15} stroke={1.9} />
        </button>
      </div>
    </div>
  );
}

export function Inspector({
  table,
  element,
  guests,
  onClose,
  onRenameTable,
  onShape,
  onCap,
  onRotate,
  onHonor,
  onNotes,
  onRemoveGuest,
  onDuplicate,
  onDelete,
  onChairDown,
  onResize,
}: {
  table: SeatTable | null;
  element: RoomElement | null;
  guests: SeatGuest[];
  onClose: () => void;
  onRenameTable: (id: string, label: string) => void;
  onShape: (id: string, shape: TableShape) => void;
  onCap: (id: string, capacity: number) => void;
  onRotate: (id: string, deg: number) => void;
  onHonor: (id: string, honor: boolean) => void;
  onNotes: (id: string, notes: string) => void;
  onRemoveGuest: (guestId: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onChairDown: (guestId: string, tableId: string, e: React.PointerEvent) => void;
  onResize: (id: string, w: number, h: number) => void;
}): ReactElement | null {
  const t = useTranslations('MonMariage.seating');

  if (element) {
    const spec = ELEMENT_KINDS[element.kind];
    const resizable = RESIZABLE.has(element.kind);
    return (
      <aside
        className="seat-inspect"
        aria-label={t('inspectElementAria', { label: t(spec.labelKey) })}
      >
        <div className="seat-inspect-head">
          <span className="ic gold">
            <Icon name={spec.icon} size={18} stroke={1.7} />
          </span>
          <div className="grow">
            <h3>{element.label || t(spec.labelKey)}</h3>
            <span className="sub">
              {t('elementSub', { w: fmtM(element.w), h: fmtM(element.h) })}
            </span>
          </div>
          <button className="dr-close" onClick={onClose} aria-label={t('closeInspector')}>
            <Icon name="X" size={16} stroke={2} />
          </button>
        </div>
        <div className="seat-inspect-body">
          {resizable && (
            <div className="ins-grid2">
              <div className="ins-sec">
                <span className="ins-lab">{t('widthLabel')}</span>
                <Stepper
                  value={element.w}
                  min={1}
                  max={14}
                  step={0.5}
                  onChange={(v) => onResize(element.id, v, element.h)}
                  fmt={(v) => fmtM(v) + ' m'}
                  decLabel={t('decrease')}
                  incLabel={t('increase')}
                />
              </div>
              <div className="ins-sec">
                <span className="ins-lab">{t('depthLabel')}</span>
                <Stepper
                  value={element.h}
                  min={0.5}
                  max={14}
                  step={0.5}
                  onChange={(v) => onResize(element.id, element.w, v)}
                  fmt={(v) => fmtM(v) + ' m'}
                  decLabel={t('decrease')}
                  incLabel={t('increase')}
                />
              </div>
            </div>
          )}
          <RotationRow rotation={element.rotation} onRotate={(d) => onRotate(element.id, d)} />
          <div className="ins-actions">
            <button className="ins-act" onClick={() => onDuplicate(element.id)}>
              <Icon name="Copy" size={14} stroke={1.8} />
              {t('duplicate')}
            </button>
            <button className="ins-act danger" onClick={() => onDelete(element.id)}>
              <Icon name="Trash2" size={14} stroke={1.8} />
              {t('delete')}
            </button>
          </div>
        </div>
      </aside>
    );
  }

  if (!table) return null;
  const seated = tableGuests(guests, table.id);
  const occ = seated.reduce((a, g) => a + g.partySize, 0);
  const st = occState(occ, table.capacity);
  const free = table.capacity - occ;
  const spec = TABLE_SHAPES[table.shape];
  const honor = table.honor || table.shape === 'sweetheart';

  return (
    <aside className="seat-inspect" aria-label={t('inspectorAria', { label: table.label })}>
      <div className="seat-inspect-head">
        <span className={'ic' + (honor ? ' gold' : '')}>
          <Icon name={spec.icon} size={18} stroke={1.8} />
        </span>
        <div className="grow">
          <h3>{table.label}</h3>
          <span className="sub">
            {t('inspectorSub', { occ, cap: table.capacity, shape: t(spec.labelKey) })}
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
            onChange={(e) => onRenameTable(table.id, e.target.value)}
          />
        </div>

        <div className="ins-sec">
          <span className="ins-lab">{t('shapeLabel')}</span>
          <div className="ins-shapes">
            {TABLE_SHAPE_KEYS.map((k) => (
              <button
                key={k}
                className={'ins-shape' + (table.shape === k ? ' on' : '')}
                onClick={() => onShape(table.id, k)}
                aria-pressed={table.shape === k}
              >
                <Icon name={TABLE_SHAPES[k].icon} size={16} stroke={1.7} />
                {t(TABLE_SHAPES[k].shortKey)}
              </button>
            ))}
          </div>
        </div>

        {!spec.fixedCap && (
          <div className="ins-sec">
            <span className="ins-lab">{t('capacityLabel')}</span>
            <div className="ins-cap">
              <Stepper
                value={table.capacity}
                min={spec.minCap}
                max={spec.maxCap}
                onChange={(v) => onCap(table.id, v)}
                decLabel={t('decrease')}
                incLabel={t('increase')}
              />
              <span className={'ins-cap-state ' + st}>
                {st === 'over'
                  ? t('capExceeded', { occ, cap: table.capacity })
                  : st === 'full'
                    ? t('capFull')
                    : t('capFree', { count: free })}
              </span>
            </div>
          </div>
        )}

        <RotationRow rotation={table.rotation} onRotate={(d) => onRotate(table.id, d)} />

        <div className="ins-honor">
          <span className="ic">
            <Icon name="Crown" size={18} stroke={1.8} />
          </span>
          <span className="tx">
            <b>{t('honorLabel')}</b>
            <span>{t('honorHint')}</span>
          </span>
          <button
            className={'mc-switch' + (honor ? ' on' : '')}
            role="switch"
            aria-checked={honor}
            aria-label={t('honorLabel')}
            disabled={table.shape === 'sweetheart'}
            onClick={() => onHonor(table.id, !table.honor)}
          >
            <i />
          </button>
        </div>

        <div className="ins-sec">
          <span className="ins-lab">{t('seatedGuests', { count: seated.length })}</span>
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
                    onPointerDown={(e) => onChairDown(g.id, table.id, e)}
                  >
                    <span className="nm">{g.name}</span>
                    <span className="ps">{t('partySizeShort', { count: g.partySize })}</span>
                    <button
                      className="rm"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => onRemoveGuest(g.id)}
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

/* ============================ PALETTE D'AJOUT (popover) ============================ */
export function AddPalette({
  mode,
  pos,
  onPickShape,
  onPickElement,
  onClose,
}: {
  mode: 'table' | 'element';
  pos: { x: number; y: number };
  onPickShape: (shape: TableShape) => void;
  onPickElement: (kind: ElementKind) => void;
  onClose: () => void;
}): ReactElement {
  const t = useTranslations('MonMariage.seating');
  const ref = useRef<HTMLDivElement>(null);
  usePopoverDismiss(ref, onClose);
  const style: CSSProperties = {
    left: Math.max(
      12,
      Math.min(pos.x, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 336),
    ),
    top: pos.y,
  };
  return (
    <div className="seat-palette" ref={ref} style={style} role="menu">
      <h4>{mode === 'table' ? t('chooseShape') : t('chooseElement')}</h4>
      <div className="seat-palette-grid">
        {mode === 'table'
          ? TABLE_SHAPE_KEYS.map((k) => (
              <button
                key={k}
                className="palette-item"
                role="menuitem"
                onClick={() => onPickShape(k)}
              >
                <span className="pic">
                  <Icon name={TABLE_SHAPES[k].icon} size={20} stroke={1.6} />
                </span>
                {t(TABLE_SHAPES[k].labelKey)}
              </button>
            ))
          : (Object.keys(ELEMENT_KINDS) as ElementKind[]).map((k) => (
              <button
                key={k}
                className="palette-item"
                role="menuitem"
                onClick={() => onPickElement(k)}
              >
                <span className="pic" style={{ color: elAccent(ELEMENT_KINDS[k].accent) }}>
                  <Icon name={ELEMENT_KINDS[k].icon} size={20} stroke={1.6} />
                </span>
                {t(ELEMENT_KINDS[k].labelKey)}
              </button>
            ))}
      </div>
    </div>
  );
}

/* ============================ MENU CONTEXTUEL OBJET ============================ */
export function ObjectMenu({
  pos,
  onClose,
  onInspect,
  onDuplicate,
  onDelete,
}: {
  pos: { x: number; y: number };
  onClose: () => void;
  onInspect: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}): ReactElement {
  const t = useTranslations('MonMariage.seating');
  const ref = useRef<HTMLDivElement>(null);
  usePopoverDismiss(ref, onClose);
  return (
    <div
      className="seat-menu"
      ref={ref}
      style={{
        left: Math.min(pos.x, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 220),
        top: pos.y,
      }}
      role="menu"
    >
      <button className="seat-menu-item" role="menuitem" onClick={onInspect}>
        <Icon name="Pencil" size={14} stroke={1.8} />
        {t('renameEdit')}
      </button>
      <button className="seat-menu-item" role="menuitem" onClick={onDuplicate}>
        <Icon name="Copy" size={14} stroke={1.8} />
        {t('duplicate')}
      </button>
      <div className="seat-menu-sep" />
      <button className="seat-menu-item danger" role="menuitem" onClick={onDelete}>
        <Icon name="Trash2" size={14} stroke={1.8} />
        {t('delete')}
      </button>
    </div>
  );
}

/* ============================ MENU « PLACER À… » ============================ */
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
}): ReactElement {
  const t = useTranslations('MonMariage.seating');
  const ref = useRef<HTMLDivElement>(null);
  usePopoverDismiss(ref, onClose);
  const w = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const h = typeof window !== 'undefined' ? window.innerHeight : 800;
  const style: CSSProperties = { left: Math.min(pos.x, w - 232), top: Math.min(pos.y, h - 340) };
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
            <Icon name={TABLE_SHAPES[tbl.shape].icon} size={14} stroke={1.7} />
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

/* ---- util : fermeture popover (clic extérieur + Échap) ---- */
function usePopoverDismiss(ref: React.RefObject<HTMLDivElement | null>, onClose: () => void): void {
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
  }, [ref, onClose]);
}

/* ---- aperçu liste (mobile + impression) ---- */
export function SeatList({
  room,
  tables,
  guests,
}: {
  room: RoomConfig;
  tables: SeatTable[];
  guests: SeatGuest[];
}): ReactElement {
  const t = useTranslations('MonMariage.seating');
  return (
    <div className="seat-list">
      <div className="note-box">
        <Icon name="Info" size={15} stroke={1.8} />
        <p>{t('mobileNote')}</p>
      </div>
      {tables.map((tbl) => {
        const gs = tableGuests(guests, tbl.id);
        const occ = gs.reduce((a, g) => a + g.partySize, 0);
        return (
          <div key={tbl.id} className="seat-list-card">
            <div className="h">
              <span className="nm">{tbl.label}</span>
              <span className="oc">
                {occ}/{tbl.capacity}
              </span>
            </div>
            {gs.length === 0 ? (
              <span style={{ fontSize: 12.5, color: 'var(--color-muted-foreground)' }}>
                {t('empty')}
              </span>
            ) : (
              <div className="gs">
                {gs.map((g) => (
                  <span
                    key={g.id}
                    className="g"
                    style={{ '--cat': SEAT_CATS[g.category].color } as CSSProperties}
                  >
                    {g.name}
                    {g.partySize > 1 ? ' +' + (g.partySize - 1) : ''}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
      <span style={{ display: 'none' }}>{room.name}</span>
    </div>
  );
}
