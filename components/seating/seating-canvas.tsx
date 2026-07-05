'use client';

import { useCallback, useState, type CSSProperties } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { AlertTriangle, Circle, RectangleHorizontal, Square, Trash2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { defaultTablePos, type SeatTable } from '@/lib/seating/board';
import {
  TABLE_SHAPES,
  categoryMeta,
  seatInitials,
  seatPositions,
  tableDims,
  type TableShape,
} from '@/lib/pro/seating';

const SHAPE_ICON: Record<TableShape, typeof Circle> = {
  round: Circle,
  oval: Circle,
  rect: RectangleHorizontal,
  square: Square,
};
// arrondi du plateau selon la forme (round/oval = plein, rect/square = arrondi doux)
const SHAPE_RADIUS: Record<TableShape, string> = {
  round: 'rounded-full',
  oval: 'rounded-full',
  rect: 'rounded-2xl',
  square: 'rounded-xl',
};

export const TABLE_DRAG_PREFIX = 'table:';

interface CanvasLabels {
  shapeToggle: string;
  move: string;
  del: string;
  unassign: string;
  empty: string;
  nameLabel: string;
  renameHint: string;
}

interface SeatingCanvasProps {
  tables: SeatTable[];
  onUnassignGuest: (guestId: string) => void;
  onToggleShape: (tableId: string, next: TableShape) => void;
  onDelete: (tableId: string) => void;
  onRename: (tableId: string, name: string) => void;
  labels: CanvasLabels;
}

export function SeatingCanvas({
  tables,
  onUnassignGuest,
  onToggleShape,
  onDelete,
  onRename,
  labels,
}: SeatingCanvasProps) {
  return (
    <div
      className="relative h-[560px] w-full overflow-auto rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-background)]"
      style={{
        backgroundImage:
          'radial-gradient(circle, color-mix(in oklch, var(--color-border) 55%, transparent) 1px, transparent 1px)',
        backgroundSize: '24px 24px',
      }}
      data-testid="seating-canvas"
    >
      <div className="relative h-[1100px] w-[1200px]">
        {tables.map((table, i) => {
          const fb = defaultTablePos(i);
          return (
            <TableNode
              key={table._id}
              table={table}
              fallback={{ left: fb.x, top: fb.y }}
              onUnassignGuest={onUnassignGuest}
              onToggleShape={onToggleShape}
              onDelete={onDelete}
              onRename={onRename}
              labels={labels}
            />
          );
        })}
      </div>
    </div>
  );
}

function TableNode({
  table,
  fallback,
  onUnassignGuest,
  onToggleShape,
  onDelete,
  onRename,
  labels,
}: {
  table: SeatTable;
  fallback: { left: number; top: number };
  onUnassignGuest: (guestId: string) => void;
  onToggleShape: (tableId: string, next: TableShape) => void;
  onDelete: (tableId: string) => void;
  onRename: (tableId: string, name: string) => void;
  labels: CanvasLabels;
}) {
  const {
    setNodeRef: setDragRef,
    listeners,
    transform,
    isDragging,
  } = useDraggable({
    id: `${TABLE_DRAG_PREFIX}${table._id}`,
    data: { type: 'table', tableId: table._id },
  });
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: table._id });
  const setRefs = useCallback(
    (el: HTMLElement | null) => {
      setDragRef(el);
      setDropRef(el);
    },
    [setDragRef, setDropRef],
  );

  const left = table.posX ?? fallback.left;
  const top = table.posY ?? fallback.top;
  const shape: TableShape = table.shape ?? 'round';
  const ShapeIcon = SHAPE_ICON[shape];
  const nextShape = TABLE_SHAPES[(TABLE_SHAPES.indexOf(shape) + 1) % TABLE_SHAPES.length]!;
  const [editing, setEditing] = useState(false);
  const dims = tableDims(shape, table.capacity);
  const slots = seatPositions(
    shape,
    Math.max(table.assigned.length, table.capacity),
    dims.w,
    dims.h,
  );

  const style: CSSProperties = {
    left,
    top,
    width: dims.w,
    height: dims.h,
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    zIndex: isDragging ? 30 : 1,
  };

  return (
    <div
      ref={setRefs}
      style={style}
      data-testid="table-node"
      data-table-id={table._id}
      {...listeners}
      title={labels.move}
      className={cn(
        // tout le corps de la table est saisissable pour la déplacer (curseur grab partout)
        'group absolute grid cursor-grab touch-none place-items-center border-2 bg-[color:var(--color-surface)] shadow-sm transition-colors active:cursor-grabbing',
        SHAPE_RADIUS[shape],
        isOver
          ? 'border-[color:var(--color-accent)] ring-2 ring-[color:var(--color-accent)]/40'
          : table.overCapacity
            ? 'border-[color:var(--color-danger)]/60'
            : 'border-[color:var(--color-border-strong)]',
      )}
    >
      {/* contrôles : forme + suppression (clic seul — ne déclenche pas le déplacement) */}
      <div
        onPointerDown={(e) => e.stopPropagation()}
        className="absolute top-1.5 right-1.5 z-10 flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100"
      >
        <button
          type="button"
          onClick={() => onToggleShape(table._id, nextShape)}
          aria-label={labels.shapeToggle}
          title={labels.shapeToggle}
          data-testid="table-shape-toggle"
          className="focus-ring grid h-6 w-6 place-items-center rounded-lg bg-[color:var(--color-surface)]/70 text-[color:var(--color-muted-foreground)] hover:bg-[color:var(--color-surface-elevated)]"
        >
          <ShapeIcon className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => onDelete(table._id)}
          aria-label={labels.del}
          title={labels.del}
          data-testid="delete-table"
          className="focus-ring grid h-6 w-6 place-items-center rounded-lg bg-[color:var(--color-surface)]/70 text-[color:var(--color-muted-foreground)] hover:bg-[color:var(--color-danger)]/10 hover:text-[color:var(--color-danger)]"
        >
          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
        </button>
      </div>

      {/* centre : nom + occupation (référence e2e ; pointer-events-none → le drag remonte au corps) */}
      <div
        data-testid="table-node-handle"
        className="pointer-events-none flex max-w-[88%] flex-col items-center gap-0.5 text-center"
      >
        {editing ? (
          <input
            autoFocus
            defaultValue={table.name}
            aria-label={labels.nameLabel}
            onPointerDown={(e) => e.stopPropagation()}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v && v !== table.name) onRename(table._id, v);
              setEditing(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
              if (e.key === 'Escape') setEditing(false);
            }}
            className="pointer-events-auto w-full rounded-md border border-[color:var(--color-primary)] bg-[color:var(--color-surface)] px-1 py-0.5 text-center text-sm font-semibold text-[color:var(--color-foreground)] outline-none"
          />
        ) : (
          <span
            className="pointer-events-auto cursor-text truncate text-sm font-semibold text-[color:var(--color-foreground)]"
            onDoubleClick={() => setEditing(true)}
            title={labels.renameHint}
          >
            {table.name}
          </span>
        )}
        <span
          className={cn(
            'inline-flex items-center gap-1 font-mono text-[11px] tabular-nums',
            table.overCapacity
              ? 'text-[color:var(--color-danger)]'
              : 'text-[color:var(--color-muted-foreground)]',
          )}
        >
          {table.occupancy}/{table.capacity}
          {table.overCapacity ? (
            <AlertTriangle className="h-3 w-3" strokeWidth={2} aria-hidden />
          ) : null}
        </span>
      </div>

      {/* sièges occupés (un par invité placé), colorés par catégorie */}
      {table.assigned.map((g, i) => {
        const p = slots[i];
        if (!p) return null;
        const m = categoryMeta(g.category);
        return (
          <button
            key={g._id}
            type="button"
            data-testid="node-guest"
            data-member-index={g.memberIndex}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => onUnassignGuest(g._id)}
            title={`${g.fullName} — ${labels.unassign}`}
            className="absolute z-10 grid h-6 w-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 font-mono text-[9px] font-medium transition-transform hover:scale-110"
            style={{
              left: p.x,
              top: p.y,
              background: m.soft,
              color: m.color,
              borderColor: 'var(--color-surface)',
            }}
          >
            {seatInitials(g.fullName)}
          </button>
        );
      })}
    </div>
  );
}
