'use client';
// Écran — Plan de table (perso). Moteur seating porté du back-office, rendu LIGHT.
// Le pool d'invités est DÉRIVÉ de la liste d'invités du mariage (pas un mock séparé) ;
// le couple peut aussi ajouter des personnes manuellement. PAS de multi-event.

import { useState, useRef, useEffect, type CSSProperties } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Icon } from './icons';
import { McBtn } from './parts';
import { McModal, McField, McInput, McSelect } from './modal';
import { MC_COUPLE, MC_GUESTS, mcDateShort, type McGuest } from './data';
import {
  SEAT_CATS,
  SEAT_CAT_KEYS,
  type SeatCatKey,
  type SeatGuest,
  type SeatShape,
  type SeatTable,
  type SeatView,
  seatInitials,
  tableGuests,
  tableOccupancy,
  seatTotals,
  occState,
  PoolPanel,
  RoomCanvas,
  Inspector,
  AssignMenu,
} from './seating-engine';

/* ---- liste d'invités du mariage → invités à placer (forme SEAT) ---- */
function groupToCat(group: string): SeatCatKey {
  const g = group.toLowerCase();
  if (g.includes('famille') || g.includes('family')) return 'family';
  if (g.includes('collègue') || g.includes('collegue') || g.includes('collèg')) return 'colleagues';
  if (g.includes('presta') || g.includes('pro')) return 'pro';
  return 'friends';
}
function guestsToSeat(guests: McGuest[]): SeatGuest[] {
  return guests.map((g) => ({
    id: g.id,
    name: g.name,
    category: groupToCat(g.group),
    partySize: Math.max(1, g.count),
  }));
}

/* ---- tables de départ (label/notes = clés i18n, traduites au seed de l'état) ---- */
interface StarterTable extends Omit<SeatTable, 'label' | 'notes'> {
  labelKey: string;
  notesKey?: string;
}
const STARTER_TABLES: StarterTable[] = [
  {
    id: 'T0',
    labelKey: 'MonMariage.seating.starter.head',
    shape: 'head',
    capacity: 8,
    x: 540,
    y: 120,
    notesKey: 'MonMariage.seating.starter.headNote',
  },
  {
    id: 'T1',
    labelKey: 'MonMariage.seating.starter.family',
    shape: 'round',
    capacity: 10,
    x: 280,
    y: 360,
  },
  {
    id: 'T2',
    labelKey: 'MonMariage.seating.starter.friends',
    shape: 'round',
    capacity: 10,
    x: 600,
    y: 360,
    notesKey: 'MonMariage.seating.starter.friendsNote',
  },
  {
    id: 'T3',
    labelKey: 'MonMariage.seating.starter.table3',
    shape: 'round',
    capacity: 8,
    x: 880,
    y: 360,
  },
  {
    id: 'T4',
    labelKey: 'MonMariage.seating.starter.table4',
    shape: 'round',
    capacity: 8,
    x: 280,
    y: 640,
  },
  {
    id: 'T5',
    labelKey: 'MonMariage.seating.starter.table5',
    shape: 'rect',
    capacity: 10,
    x: 620,
    y: 660,
  },
];

let seatNewId = 100;
// [valeur, clé i18n] — dérivé de SEAT_CATS
const CAT_OPTS: ReadonlyArray<[string, string]> = SEAT_CAT_KEYS.map((k) => [k, SEAT_CATS[k].label]);

// [forme, clé i18n du libellé, icône]
const SHAPE_OPTS: ReadonlyArray<[SeatShape, string, string]> = [
  ['round', 'shapeRound', 'Circle'],
  ['rect', 'shapeRect', 'RectangleH'],
  ['head', 'shapeHead', 'Crown'],
];

interface DragInfo {
  guestId: string;
  fromTableId: string | null;
  name: string;
  cat: SeatCatKey;
  party: number;
}
interface DragState extends DragInfo {
  x: number;
  y: number;
}
type HitTarget = { kind: 'table'; id: string } | { kind: 'pool' } | null;

function hitTarget(x: number, y: number): HitTarget {
  const el = document.elementFromPoint(x, y);
  if (!el) return null;
  const tn = el.closest('[data-table-id]');
  if (tn) return { kind: 'table', id: tn.getAttribute('data-table-id') ?? '' };
  if (el.closest('[data-pool]')) return { kind: 'pool' };
  return null;
}

/* ---- menu contextuel d'une table ---- */
function McTableMenu({
  pos,
  onClose,
  onInspect,
  onDup,
  onDelete,
}: {
  pos: { x: number; y: number };
  onClose: () => void;
  onInspect: () => void;
  onDup: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations('MonMariage.seating');
  const ref = useRef<HTMLDivElement>(null);
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
  return (
    <div
      className="seat-menu"
      ref={ref}
      style={{ left: Math.min(pos.x, window.innerWidth - 210), top: pos.y }}
      role="menu"
    >
      <button className="seat-menu-item" role="menuitem" onClick={onInspect}>
        <Icon name="Pencil" size={14} stroke={1.8} />
        {t('renameEdit')}
      </button>
      <button className="seat-menu-item" role="menuitem" onClick={onDup}>
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

/* ---- dialog : ajouter une table ---- */
function McAddTable({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (shape: SeatShape, cap: number) => void;
}) {
  const t = useTranslations('MonMariage.seating');
  const [shape, setShape] = useState<SeatShape>('round');
  const [cap, setCap] = useState(10);
  return (
    <McModal
      eyebrow={t('eyebrow')}
      title={t('addTable')}
      onClose={onClose}
      footer={
        <>
          <McBtn variant="ghost" size="md" onClick={onClose}>
            {t('cancel')}
          </McBtn>
          <McBtn
            variant="halo"
            size="md"
            onClick={() => {
              onAdd(shape, cap);
              onClose();
            }}
          >
            <Icon name="Plus" size={16} stroke={2.1} />
            {t('add')}
          </McBtn>
        </>
      }
    >
      <div className="mc-fld" style={{ marginBottom: 16 }}>
        <span className="lab">{t('shapeLabel')}</span>
        <div className="mc-shapes">
          {SHAPE_OPTS.map(([k, lKey, ic]) => (
            <button
              key={k}
              type="button"
              className={'mc-shape' + (shape === k ? ' on' : '')}
              onClick={() => setShape(k)}
            >
              <Icon name={ic} size={18} stroke={1.7} />
              {t(lKey)}
            </button>
          ))}
        </div>
      </div>
      <div className="mc-fld">
        <span className="lab">{t('seatsLabel')}</span>
        <div className="mc-stepper">
          <button
            type="button"
            onClick={() => setCap((c) => Math.max(1, c - 1))}
            aria-label={t('decreaseSign')}
          >
            <Icon name="Minus" size={16} stroke={2} />
          </button>
          <span className="v">{cap}</span>
          <button type="button" onClick={() => setCap((c) => c + 1)} aria-label={t('increaseSign')}>
            <Icon name="Plus" size={16} stroke={2} />
          </button>
        </div>
      </div>
    </McModal>
  );
}

/* ---- dialog : ajouter une personne manuellement (va dans le pool) ---- */
function McAddPerson({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (name: string, party: number, cat: SeatCatKey) => void;
}) {
  const t = useTranslations('MonMariage.seating');
  const tRoot = useTranslations('MonMariage');
  const catOpts: ReadonlyArray<[string, string]> = CAT_OPTS.map(([k, key]) => [
    k,
    tRoot(key.replace(/^MonMariage\./, '')),
  ]);
  const [name, setName] = useState('');
  const [party, setParty] = useState(1);
  const [cat, setCat] = useState<SeatCatKey>('family');
  const submit = () => {
    if (!name.trim()) return;
    onAdd(name.trim(), party, cat);
    onClose();
  };
  return (
    <McModal
      eyebrow={t('eyebrow')}
      title={t('addPerson')}
      onClose={onClose}
      footer={
        <>
          <McBtn variant="ghost" size="md" onClick={onClose}>
            {t('cancel')}
          </McBtn>
          <McBtn variant="halo" size="md" onClick={submit}>
            <Icon name="UserPlus" size={16} stroke={2} />
            {t('addToList')}
          </McBtn>
        </>
      }
    >
      <div className="mc-formgrid">
        <McField label={t('nameLabel')} hint={t('nameHint')} full>
          <McInput
            icon="Users"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('namePlaceholder')}
            autoFocus
          />
        </McField>
        <McField label={t('categoryLabel')}>
          <McSelect value={cat} onChange={(v) => setCat(v as SeatCatKey)} options={catOpts} />
        </McField>
        <McField label={t('peopleCountLabel')}>
          <div className="mc-stepper">
            <button
              type="button"
              onClick={() => setParty((p) => Math.max(1, p - 1))}
              aria-label={t('decreaseSign')}
            >
              <Icon name="Minus" size={16} stroke={2} />
            </button>
            <span className="v">{party}</span>
            <button
              type="button"
              onClick={() => setParty((p) => p + 1)}
              aria-label={t('increaseSign')}
            >
              <Icon name="Plus" size={16} stroke={2} />
            </button>
          </div>
        </McField>
      </div>
    </McModal>
  );
}

/* ---- liste mobile (lecture seule) ---- */
function McSeatMobile({ tables, guests }: { tables: SeatTable[]; guests: SeatGuest[] }) {
  const t = useTranslations('MonMariage.seating');
  return (
    <div className="seat-mobile">
      <div className="note-box">
        <Icon name="Info" size={15} stroke={1.8} />
        <p>{t('mobileNote')}</p>
      </div>
      {tables.map((tbl) => {
        const gs = tableGuests(guests, tbl.id);
        const occ = gs.reduce((a, g) => a + g.partySize, 0);
        const st = occState(occ, tbl.capacity);
        return (
          <div
            key={tbl.id}
            className="mc-card"
            style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span
                style={{
                  fontFamily: 'var(--font-display)',
                  fontStyle: 'italic',
                  fontSize: 18,
                  color: 'var(--color-ink-900)',
                }}
              >
                {tbl.label}
              </span>
              <span
                style={{
                  marginInlineStart: 'auto',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                  color:
                    st === 'over'
                      ? 'var(--color-danger)'
                      : st === 'full'
                        ? 'var(--color-sage-700)'
                        : 'var(--color-ink-700)',
                }}
              >
                {occ}/{tbl.capacity}
              </span>
            </div>
            {gs.length === 0 ? (
              <span style={{ fontSize: 12.5, color: 'var(--color-muted-foreground)' }}>
                {t('empty')}
              </span>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                {gs.map((g) => (
                  <span
                    key={g.id}
                    style={{
                      fontSize: 12.5,
                      color: 'var(--color-ink-700)',
                      borderInlineStart: '3px solid ' + SEAT_CATS[g.category].color,
                      paddingInlineStart: 7,
                    }}
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
    </div>
  );
}

export function SeatingScreen() {
  const t = useTranslations('MonMariage.seating');
  const tRoot = useTranslations('MonMariage');
  const locale = useLocale();
  const [guests, setGuests] = useState<SeatGuest[]>(() => guestsToSeat(MC_GUESTS));
  const [tables, setTables] = useState<SeatTable[]>(() =>
    STARTER_TABLES.map((s) => ({
      id: s.id,
      shape: s.shape,
      capacity: s.capacity,
      x: s.x,
      y: s.y,
      label: tRoot(s.labelKey.replace(/^MonMariage\./, '')),
      notes: s.notesKey ? tRoot(s.notesKey.replace(/^MonMariage\./, '')) : '',
    })),
  );
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<SeatCatKey[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<SeatView>({ x: 20, y: 14, k: 0.6 });
  const [drag, setDrag] = useState<DragState | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; cant: boolean } | null>(null);
  const [tableMenu, setTableMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [assignMenu, setAssignMenu] = useState<{ guestId: string; x: number; y: number } | null>(
    null,
  );
  const [addDialog, setAddDialog] = useState(false);
  const [personDialog, setPersonDialog] = useState(false);
  const [autoPlacing, setAutoPlacing] = useState(false);
  const liveRef = useRef<HTMLSpanElement>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);

  const announce = (m: string) => {
    if (liveRef.current) liveRef.current.textContent = m;
  };
  const totals = seatTotals(guests);
  const selected = tables.find((t) => t.id === selectedId) || null;

  const assign = (guestId: string, tableId: string | null): boolean => {
    const g = guests.find((x) => x.id === guestId);
    if (!g) return false;
    if (tableId) {
      const occ = tableOccupancy(guests, tableId) - (g.tableId === tableId ? g.partySize : 0);
      const cap = tables.find((tbl) => tbl.id === tableId)?.capacity ?? 0;
      if (occ + g.partySize > cap) {
        announce(t('announceCapacityExceeded', { occ: occ + g.partySize, cap }));
        return false;
      }
    }
    setGuests((gs) =>
      gs.map((x) => (x.id === guestId ? { ...x, tableId: tableId || undefined } : x)),
    );
    return true;
  };

  const renameT = (id: string, label: string) =>
    setTables((ts) => ts.map((t) => (t.id === id ? { ...t, label } : t)));
  const shapeT = (id: string, shape: SeatShape) =>
    setTables((ts) => ts.map((t) => (t.id === id ? { ...t, shape } : t)));
  const capT = (id: string, capacity: number) =>
    setTables((ts) => ts.map((t) => (t.id === id ? { ...t, capacity } : t)));
  const notesT = (id: string, notes: string) =>
    setTables((ts) => ts.map((t) => (t.id === id ? { ...t, notes } : t)));
  const dupT = (id: string) => {
    const tbl = tables.find((x) => x.id === id);
    if (!tbl) return;
    const nid = 'Tn' + ++seatNewId;
    setTables((ts) => [
      ...ts,
      {
        ...tbl,
        id: nid,
        label: t('copyLabel', { label: tbl.label }),
        x: tbl.x + 60,
        y: tbl.y + 60,
      },
    ]);
    setSelectedId(nid);
    setTableMenu(null);
  };
  const delT = (id: string) => {
    setGuests((gs) => gs.map((g) => (g.tableId === id ? { ...g, tableId: undefined } : g)));
    setTables((ts) => ts.filter((tbl) => tbl.id !== id));
    setSelectedId(null);
    setTableMenu(null);
    announce(t('announceTableDeleted'));
  };
  const addT = (shape: SeatShape, capacity: number) => {
    const nid = 'Tn' + ++seatNewId;
    const n = tables.length;
    setTables((ts) => [
      ...ts,
      {
        id: nid,
        label: t('tableN', { n: n + 1 }),
        shape,
        capacity,
        x: 540 + (n % 3) * 60,
        y: 420 + (n % 4) * 40,
        notes: '',
      },
    ]);
    setSelectedId(nid);
  };
  const addPerson = (name: string, party: number, cat: SeatCatKey) => {
    const nid = 'gn' + ++seatNewId;
    setGuests((gs) => [{ id: nid, name, partySize: party, category: cat }, ...gs]);
    announce(t('announcePersonAdded', { name }));
  };

  const autoPlace = () => {
    setAutoPlacing(true);
    setTimeout(() => {
      setGuests((gs) => {
        const next = gs.map((g) => ({ ...g }));
        const occ: Record<string, number> = {};
        tables.forEach((t) => {
          occ[t.id] = 0;
        });
        next.forEach((g) => {
          if (g.tableId) occ[g.tableId] = (occ[g.tableId] ?? 0) + g.partySize;
        });
        let placed = 0;
        next
          .filter((g) => !g.tableId)
          .forEach((g) => {
            const tbl = tables.find((tb) => (occ[tb.id] ?? 0) + g.partySize <= tb.capacity);
            if (tbl) {
              g.tableId = tbl.id;
              occ[tbl.id] = (occ[tbl.id] ?? 0) + g.partySize;
              placed++;
            }
          });
        announce(t('announceAutoPlaced', { count: placed }));
        return next;
      });
      setAutoPlacing(false);
    }, 800);
  };

  const startDrag = (guestId: string, fromTableId: string | null, e: React.PointerEvent) => {
    if (e.button != null && e.button !== 0) return;
    const g = guests.find((x) => x.id === guestId);
    if (!g) return;
    e.preventDefault();
    const info: DragInfo = {
      guestId,
      fromTableId,
      name: g.name,
      cat: g.category,
      party: g.partySize,
    };
    setDrag({ ...info, x: e.clientX, y: e.clientY });
    const move = (ev: PointerEvent) => {
      const tgt = hitTarget(ev.clientX, ev.clientY);
      let dt: { id: string; cant: boolean } | null = null;
      if (tgt && tgt.kind === 'table') {
        const occ = tableOccupancy(guests, tgt.id) - (g.tableId === tgt.id ? g.partySize : 0);
        const cap = tables.find((tbl) => tbl.id === tgt.id)?.capacity ?? 0;
        dt = { id: tgt.id, cant: occ + g.partySize > cap };
      }
      setDropTarget(dt);
      setDrag((d) => (d ? { ...d, x: ev.clientX, y: ev.clientY } : d));
    };
    const up = (ev: PointerEvent) => {
      const tgt = hitTarget(ev.clientX, ev.clientY);
      if (tgt && tgt.kind === 'table') assign(guestId, tgt.id);
      else if (tgt && tgt.kind === 'pool') assign(guestId, null);
      setDrag(null);
      setDropTarget(null);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const moveTable = (tableId: string, e: React.PointerEvent) => {
    e.preventDefault();
    const tbl = tables.find((x) => x.id === tableId);
    if (!tbl) return;
    const sx = e.clientX,
      sy = e.clientY,
      ox = tbl.x,
      oy = tbl.y,
      k = view.k;
    const move = (ev: PointerEvent) => {
      setTables((ts) =>
        ts.map((tb) =>
          tb.id === tableId
            ? {
                ...tb,
                x: Math.round(ox + (ev.clientX - sx) / k),
                y: Math.round(oy + (ev.clientY - sy) / k),
              }
            : tb,
        ),
      );
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const toggleFilter = (k: SeatCatKey) =>
    setFilters((f) => (f.includes(k) ? f.filter((x) => x !== k) : [...f, k]));
  const openTableMenu = (id: string, e: React.MouseEvent) => {
    const r = e.currentTarget.getBoundingClientRect();
    setTableMenu({ id, x: r.left, y: r.bottom + 4 });
  };
  const openAssign = (guestId: string, e: React.MouseEvent) => {
    const r = e.currentTarget.getBoundingClientRect();
    setAssignMenu({ guestId, x: r.right - 210, y: r.bottom + 4 });
  };
  const assignGuest = assignMenu ? guests.find((g) => g.id === assignMenu.guestId) : null;
  const menuTable = tableMenu ? tables.find((x) => x.id === tableMenu.id) : null;

  return (
    <>
      <header className="mc-pagehead">
        <div className="ph-l">
          <span className="mc-eyebrow">{t('eyebrow')}</span>
          <h1>{t('title')}</h1>
        </div>
        <p className="ph-sub">{t('subtitle')}</p>
      </header>

      <div className="mc-seat-editor">
        <div className="seat-toolbar">
          <span className="seat-ctx">
            <span className="ev">
              <span>{(MC_COUPLE.names.split('&')[0] ?? '').trim()} </span>
              <span className="amp">&amp;</span>
              <span> {(MC_COUPLE.names.split('&')[1] ?? '').trim()}</span>
            </span>
            <span className="dt">
              {mcDateShort(MC_COUPLE.weddingDate, locale)} ·{' '}
              {t('seatedRatio', { seated: totals.seated, total: totals.total })}
            </span>
          </span>
          <span className="seat-tb-grow" />
          <button className="seat-tbtn" onClick={() => setPersonDialog(true)}>
            <Icon name="UserPlus" size={15} stroke={2} />
            {t('addPerson')}
          </button>
          <button className="seat-tbtn" onClick={autoPlace} disabled={autoPlacing}>
            <Icon
              name={autoPlacing ? 'Loader' : 'Wand2'}
              size={14}
              stroke={1.9}
              className={autoPlacing ? 'spin' : ''}
            />
            {t('autoPlace')}
          </button>
          <button className="seat-tbtn primary" onClick={() => setAddDialog(true)}>
            <Icon name="Plus" size={15} stroke={2.2} />
            {t('addTable')}
          </button>
        </div>

        <div className="seat-mobile-note">
          <McSeatMobile tables={tables} guests={guests} />
        </div>

        <div className={'seat-cols' + (selected ? ' inspect' : '')}>
          <PoolPanel
            guests={guests}
            totals={totals}
            search={search}
            setSearch={setSearch}
            filters={filters}
            toggleFilter={toggleFilter}
            onChipDown={startDrag}
            onAssign={openAssign}
            dropping={!!(drag && drag.fromTableId)}
          />
          <RoomCanvas
            tables={tables}
            guests={guests}
            selectedId={selectedId}
            dropTargetId={dropTarget ? dropTarget.id : null}
            dropCant={dropTarget ? dropTarget.cant : null}
            onSelect={setSelectedId}
            onMenu={openTableMenu}
            onMoveTable={moveTable}
            onSeatDown={startDrag}
            view={view}
            setView={setView}
            canvasRef={canvasRef}
          />
          <Inspector
            table={selected}
            guests={guests}
            onClose={() => setSelectedId(null)}
            onRename={renameT}
            onShape={shapeT}
            onCap={capT}
            onRemove={(gid) => assign(gid, null)}
            onNotes={notesT}
            onDuplicate={dupT}
            onDelete={delT}
            onSeatDown={startDrag}
          />
        </div>
      </div>

      {drag && (
        <div
          className="seat-ghost gchip"
          style={
            {
              left: drag.x,
              top: drag.y,
              width: 220,
              '--cat': SEAT_CATS[drag.cat].color,
              '--cat-soft': SEAT_CATS[drag.cat].soft,
            } as CSSProperties
          }
        >
          <span className="gchip-av">{seatInitials(drag.name)}</span>
          <span className="gchip-main">
            <span className="gchip-name">{drag.name}</span>
            <span className="gchip-meta">
              <span className="gchip-party">
                <Icon name="Users" size={10} stroke={2} />
                <b>{drag.party}</b>
              </span>
            </span>
          </span>
        </div>
      )}

      {tableMenu && menuTable && (
        <McTableMenu
          pos={tableMenu}
          onClose={() => setTableMenu(null)}
          onInspect={() => {
            setSelectedId(menuTable.id);
            setTableMenu(null);
          }}
          onDup={() => dupT(menuTable.id)}
          onDelete={() => delT(menuTable.id)}
        />
      )}
      {assignMenu && assignGuest && (
        <AssignMenu
          guest={assignGuest}
          tables={tables}
          guests={guests}
          pos={assignMenu}
          onClose={() => setAssignMenu(null)}
          onPick={(tid) => {
            assign(assignMenu.guestId, tid);
            setAssignMenu(null);
          }}
        />
      )}
      {addDialog && <McAddTable onClose={() => setAddDialog(false)} onAdd={addT} />}
      {personDialog && <McAddPerson onClose={() => setPersonDialog(false)} onAdd={addPerson} />}

      <span ref={liveRef} className="sr-only" role="status" aria-live="polite" />
    </>
  );
}
