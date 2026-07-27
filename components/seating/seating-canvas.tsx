'use client';

import { useCallback, type CSSProperties } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { AlertTriangle, Circle, RectangleHorizontal, Trash2, Users } from 'lucide-react';
import { defaultTablePos, type SeatTable } from '@/lib/seating/board';

export const TABLE_DRAG_PREFIX = 'table:';

interface CanvasLabels {
  shapeToggle: string;
  del: string;
  unassign: string;
  empty: string;
}

interface SeatingCanvasProps {
  tables: SeatTable[];
  onUnassignGuest: (guestId: string) => void;
  onToggleShape: (tableId: string, next: 'round' | 'rect') => void;
  onDelete: (tableId: string) => void;
  labels: CanvasLabels;
}

export function SeatingCanvas({
  tables,
  onUnassignGuest,
  onToggleShape,
  onDelete,
  labels,
}: SeatingCanvasProps) {
  return (
    <div
      className="relative h-[560px] w-full overflow-auto rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-ivory-50)]"
      style={{
        backgroundImage:
          'radial-gradient(circle, color-mix(in oklch, var(--color-border) 55%, transparent) 1px, transparent 1px)',
        backgroundSize: '24px 24px',
      }}
      data-testid="seating-canvas"
    >
      <div className="relative h-[1000px] w-[1000px]">
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
  labels,
}: {
  table: SeatTable;
  fallback: { left: number; top: number };
  onUnassignGuest: (guestId: string) => void;
  onToggleShape: (tableId: string, next: 'round' | 'rect') => void;
  onDelete: (tableId: string) => void;
  labels: CanvasLabels;
}) {
  const {
    setNodeRef: setDragRef,
    listeners,
    attributes,
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
  const round = (table.shape ?? 'round') === 'round';
  const style: CSSProperties = {
    left,
    top,
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    zIndex: isDragging ? 30 : 1,
  };

  return (
    <div
      ref={setRefs}
      style={style}
      data-testid="table-node"
      data-table-id={table._id}
      className={[
        'absolute w-48 border bg-[color:var(--color-surface)] shadow-sm transition-colors select-none',
        round ? 'rounded-[36px]' : 'rounded-xl',
        isOver
          ? 'border-[color:var(--color-accent)] ring-2 ring-[color:var(--color-accent)]/40'
          : table.overCapacity
            ? 'border-[color:var(--color-danger)]/50'
            : 'border-[color:var(--color-border)]',
      ].join(' ')}
    >
      {/* En-tête = poignée de déplacement de la table. */}
      <div
        {...listeners}
        {...attributes}
        data-testid="table-node-handle"
        className="flex cursor-grab touch-none items-center justify-between gap-2 px-3 pt-2.5 active:cursor-grabbing"
      >
        <span className="truncate text-sm font-semibold text-[color:var(--color-ink-900)]">
          {table.name}
        </span>
        <span
          className={`inline-flex items-center gap-1 text-[11px] ${
            table.overCapacity
              ? 'text-[color:var(--color-danger)]'
              : 'text-[color:var(--color-ink-500)]'
          }`}
        >
          <Users className="h-3 w-3" strokeWidth={2} aria-hidden />
          {table.occupancy}/{table.capacity}
          {table.overCapacity ? (
            <AlertTriangle className="h-3 w-3" strokeWidth={2} aria-hidden />
          ) : null}
        </span>
      </div>

      <div className="flex items-center gap-1 px-3 pt-1">
        <button
          type="button"
          onClick={() => onToggleShape(table._id, round ? 'rect' : 'round')}
          aria-label={labels.shapeToggle}
          title={labels.shapeToggle}
          data-testid="table-shape-toggle"
          className="focus-ring flex h-6 w-6 items-center justify-center rounded text-[color:var(--color-ink-500)] hover:bg-[color:var(--color-ivory-100)]"
        >
          {round ? (
            <Circle className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
          ) : (
            <RectangleHorizontal className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
          )}
        </button>
        <button
          type="button"
          onClick={() => onDelete(table._id)}
          aria-label={labels.del}
          title={labels.del}
          data-testid="delete-table"
          className="focus-ring flex h-6 w-6 items-center justify-center rounded text-[color:var(--color-ink-500)] hover:bg-[color:var(--color-danger)]/10 hover:text-[color:var(--color-danger)]"
        >
          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
        </button>
      </div>

      <div className="flex flex-col gap-1 px-3 pt-1.5 pb-3">
        {table.assigned.length === 0 ? (
          <p className="rounded-md border border-dashed border-[color:var(--color-border)] px-2 py-3 text-center text-[11px] text-[color:var(--color-ink-500)]">
            {labels.empty}
          </p>
        ) : (
          table.assigned.map((g) => (
            <button
              key={g._id}
              type="button"
              onClick={() => onUnassignGuest(g._id)}
              title={labels.unassign}
              data-testid="node-guest"
              className="focus-ring flex items-center justify-between gap-1 truncate rounded-md bg-[color:var(--color-ivory-100)] px-2 py-1 text-left text-xs text-[color:var(--color-ink-900)] hover:bg-[color:var(--color-danger)]/10"
            >
              <span className="truncate">{g.fullName}</span>
              {g.seats > 1 ? (
                <span className="shrink-0 text-[10px] text-[color:var(--color-ink-500)]">
                  +{g.seats - 1}
                </span>
              ) : null}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
