'use client';

import { useEffect, useMemo, useRef, useState, useTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  LayoutGrid,
  Rows3,
  Search,
  Filter,
  UserCheck,
  ArrowUpDown,
  ChevronDown,
  Check,
  X,
  Trash2,
  Calendar,
  Tag,
  GripVertical,
} from 'lucide-react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { useRouter as useIntlRouter } from '@/i18n/navigation';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { cn } from '@/lib/cn';
import {
  CLIENT_STAGES,
  CLIENT_STAGE_LABEL,
  CLIENT_STAGE_PLURAL,
  CLIENT_SOURCES,
  groupByStage,
  pipelineTotals,
  isClientStage,
  coupleInitials,
  coupleHue,
  relativeFr,
  daysUntil,
  type ClientStage,
} from '@/lib/pro/clients';
import { formatEurMinor, formatDateFr, parseEurToMinor } from '@/lib/pro/format';
import { STAGE_PILL } from '@/components/pro/clients/stage-colors';
import { ClientDetail } from '@/components/pro/clients/client-detail';
import type { ClientRow, MemberOption } from '@/components/pro/clients/types';
import {
  createClientAction,
  updateClientAction,
  updateClientStageAction,
  removeClientAction,
  convertClientAction,
} from '@/app/[locale]/(app)/pro/clients/actions';

export type { ClientRow } from '@/components/pro/clients/types';

const ERROR_LABEL: Record<string, string> = {
  INVALID_PARTNER_A: 'Le nom du couple est requis.',
  INVALID_BUDGET: 'Budget invalide.',
  FEATURE_NOT_IN_PLAN: 'Le CRM est réservé aux forfaits Business et Agency.',
  FORBIDDEN: 'Vous n’avez pas les droits requis.',
  NEEDS_FUTURE_DATE: 'Renseignez une date de mariage future pour convertir ce lead.',
  NO_ORG: 'Organisation introuvable.',
  UNAUTHENTICATED: 'Session expirée, reconnectez-vous.',
};
const errLabel = (c: string) => ERROR_LABEL[c] ?? 'Une erreur est survenue. Réessayez.';

const SORT_OPTS = [
  { key: 'couple', label: 'Client (A→Z)' },
  { key: 'stage', label: 'Étape du pipeline' },
  { key: 'date', label: 'Date du mariage' },
  { key: 'budget', label: 'Budget estimé' },
  { key: 'contact', label: 'Dernier contact' },
] as const;
type SortKey = (typeof SORT_OPTS)[number]['key'];

const STAGE_ORDER: Record<ClientStage, number> = {
  lead: 0,
  contacted: 1,
  quote: 2,
  booked: 3,
  in_progress: 4,
  delivered: 5,
};

function coupleLabel(c: ClientRow): string {
  return c.partnerB ? `${c.partnerA} & ${c.partnerB}` : c.partnerA;
}

function toDateInput(ms: number | undefined): string {
  if (!ms) return '';
  return new Date(ms).toISOString().slice(0, 10);
}

function MiniAvatar({ name, size = 28 }: { name: string; size?: number }) {
  const hue = coupleHue(name);
  return (
    <span
      aria-hidden
      className="flex flex-shrink-0 items-center justify-center rounded-full font-mono"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.36),
        background: `oklch(42% 0.07 ${hue})`,
        color: `oklch(94% 0.03 ${hue})`,
      }}
    >
      {coupleInitials(name)}
    </span>
  );
}

function StagePill({ stage }: { stage: ClientStage }) {
  const s = STAGE_PILL[stage];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-mono text-[9px] tracking-[0.12em] uppercase"
      style={{ background: s.bg, color: s.fg }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.dot }} aria-hidden />
      {CLIENT_STAGE_LABEL[stage]}
    </span>
  );
}

/** Nom du couple avec l'esperluette dorée (« Awa <gold>&</gold> Karim »). */
function CoupleName({ name }: { name: string }) {
  const parts = name.split(' & ');
  if (parts.length < 2) return <>{name}</>;
  return (
    <>
      {parts[0]} <span style={{ color: 'var(--color-gold-500)' }}>&amp;</span>{' '}
      {parts.slice(1).join(' & ')}
    </>
  );
}

/** Pastille de compte à rebours (« J−42 », ou « Livré » si la date est passée). */
function JChip({ days }: { days: number }) {
  const past = days < 0;
  const deliv = STAGE_PILL.delivered;
  return (
    <span
      className="ml-auto inline-flex items-baseline gap-[3px] rounded-full px-2 py-0.5 font-mono text-[11px]"
      style={
        past
          ? { color: deliv.fg, background: deliv.bg }
          : {
              color: 'var(--color-blush-300)',
              background: 'color-mix(in oklch, var(--color-blush-500) 16%, transparent)',
            }
      }
    >
      {past ? (
        'Livré'
      ) : (
        <>
          J−<b className="text-[12px] font-semibold">{days}</b>
        </>
      )}
    </span>
  );
}

function PipelineColumn({
  stage,
  count,
  budgetMinor,
  children,
}: {
  stage: ClientStage;
  count: number;
  budgetMinor: number;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  return (
    <section
      ref={setNodeRef}
      aria-label={CLIENT_STAGE_PLURAL[stage]}
      className={cn(
        'flex min-w-0 flex-col gap-[11px] rounded-[14px] border p-3 transition-colors',
        isOver
          ? 'border-[color:var(--color-blush-400)] bg-[color:var(--color-surface-elevated)]'
          : 'border-[color:var(--color-border)]',
      )}
      style={isOver ? undefined : { background: 'oklch(17% 0.013 28)' }}
    >
      <header className="flex flex-col gap-[9px]">
        <div className="flex items-center gap-[9px]">
          <span
            className="h-2 w-2 flex-none rounded-full"
            style={{ background: STAGE_PILL[stage].dot }}
            aria-hidden
          />
          <span className="min-w-0 truncate text-[13px] font-semibold text-[color:var(--color-foreground)]">
            {CLIENT_STAGE_PLURAL[stage]}
          </span>
          <span className="ml-auto rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-2 py-0.5 font-mono text-[11px] text-[color:var(--color-muted-foreground)] tabular-nums">
            {count}
          </span>
        </div>
        <span className="font-mono text-[11px] tracking-[-0.01em] text-[color:var(--color-ink-700)] tabular-nums">
          {budgetMinor > 0 ? (
            formatEurMinor(budgetMinor)
          ) : (
            <span className="text-[color:var(--color-muted-foreground)]">—</span>
          )}
        </span>
      </header>
      <div className="flex min-h-10 flex-col gap-2.5">
        {count === 0 ? (
          <div className="rounded-[10px] border border-dashed border-[color:var(--color-border)] px-4 py-[18px] text-center font-mono text-[10px] tracking-[0.1em] text-[color:var(--color-muted-foreground)] uppercase">
            Déposez ici
          </div>
        ) : (
          children
        )}
      </div>
    </section>
  );
}

function PipelineCard({
  client,
  draggable,
  onOpen,
  now,
}: {
  client: ClientRow;
  draggable: boolean;
  onOpen: () => void;
  now: number;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: client._id,
    disabled: !draggable,
  });
  return (
    <article
      ref={setNodeRef}
      {...(draggable ? listeners : {})}
      {...attributes}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      aria-label={`${coupleLabel(client)}, étape ${CLIENT_STAGE_LABEL[client.stage]}. Entrée pour ouvrir la fiche.`}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onOpen();
      }}
      className={cn(
        'group focus-ring relative flex flex-col gap-3 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-3.5 transition-[border-color,box-shadow,transform] hover:-translate-y-px hover:border-[color:var(--color-border-strong)] hover:shadow-[var(--shadow-soft)]',
        draggable ? 'cursor-grab' : 'cursor-pointer',
        isDragging && 'opacity-40',
      )}
      style={{ touchAction: 'none' }}
    >
      <CardFace client={client} showGrip={draggable} now={now} />
    </article>
  );
}

function CardFace({
  client,
  dragging,
  showGrip,
  now,
}: {
  client: ClientRow;
  dragging?: boolean;
  showGrip?: boolean;
  now: number;
}) {
  const dleft = daysUntil(client.weddingDate, now);
  const active = client.stage === 'booked' || client.stage === 'in_progress';
  const booked = client.budgetBookedMinor ?? 0;
  const pct = client.budgetMinor
    ? Math.min(100, Math.round((booked / client.budgetMinor) * 100))
    : 0;
  return (
    <div
      className={cn(
        'flex flex-col gap-3',
        dragging &&
          'w-[248px] rounded-xl border border-[color:var(--color-blush-400)] bg-[color:var(--color-surface-elevated)] p-3.5 shadow-[var(--shadow-lifted)]',
      )}
    >
      {/* Nom du couple + poignée */}
      <div className="flex items-start justify-between gap-2.5">
        <span className="font-display text-[17px] leading-[1.1] tracking-[-0.016em] text-balance text-[color:var(--color-foreground)] italic">
          <CoupleName name={coupleLabel(client)} />
        </span>
        {showGrip ? (
          <GripVertical
            className="mt-0.5 h-[15px] w-[15px] flex-none text-[color:var(--color-muted-foreground)] opacity-0 transition-opacity group-hover:opacity-[0.55]"
            strokeWidth={1.8}
            aria-hidden
          />
        ) : null}
      </div>

      {/* Date + budget */}
      <div className="flex flex-col gap-[7px]">
        <div className="flex min-h-[18px] items-center gap-2 text-[12.5px] leading-[1.3] text-[color:var(--color-ink-700)]">
          <Calendar
            className="h-[13px] w-[13px] flex-none text-[color:var(--color-muted-foreground)]"
            strokeWidth={1.8}
            aria-hidden
          />
          {client.weddingDate ? (
            <>
              <span className="font-mono text-[12px] whitespace-nowrap">
                {formatDateFr(client.weddingDate)}
              </span>
              {dleft != null ? <JChip days={dleft} /> : null}
            </>
          ) : (
            <span className="text-[color:var(--color-muted-foreground)]">Date à définir</span>
          )}
        </div>
        <div className="flex min-h-[18px] items-center gap-2 text-[12.5px] leading-[1.3] text-[color:var(--color-ink-700)]">
          <Tag
            className="h-[13px] w-[13px] flex-none text-[color:var(--color-muted-foreground)]"
            strokeWidth={1.8}
            aria-hidden
          />
          <span className="min-w-0 flex-1 truncate text-[color:var(--color-muted-foreground)]">
            {client.budgetMinor ? 'Budget estimé' : 'Budget à estimer'}
          </span>
          <span className="ml-auto flex-none font-mono whitespace-nowrap text-[color:var(--color-foreground)]">
            {formatEurMinor(client.budgetMinor)}
          </span>
        </div>
      </div>

      {/* Pied : progression « Réservé » OU dernier contact, + avatar assigné·e */}
      <div className="flex items-center justify-between gap-2.5 border-t border-[color:var(--color-border)] pt-[11px]">
        {active && client.budgetMinor ? (
          <div className="flex min-w-0 flex-1 flex-col gap-[5px]">
            <div className="flex justify-between font-mono text-[9.5px] whitespace-nowrap text-[color:var(--color-muted-foreground)]">
              <span>Réservé</span>
              <b className="font-medium text-[color:var(--color-ink-700)]">{pct} %</b>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-[color:var(--color-border)]">
              <span
                className="block h-full rounded-full"
                style={{ width: `${pct}%`, background: 'var(--color-blush-500)' }}
                aria-hidden
              />
            </div>
          </div>
        ) : (
          <span className="font-mono text-[10px] text-[color:var(--color-muted-foreground)]">
            {relativeFr(client.lastContactAt, now)}
          </span>
        )}
        {client.assigneeName ? (
          <span title={client.assigneeName} className="flex-none">
            <MiniAvatar name={client.assigneeName} size={26} />
          </span>
        ) : (
          <span
            title="Non assigné"
            aria-hidden
            className="flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full border border-dashed border-[color:var(--color-border-strong)] text-[10px] text-[color:var(--color-muted-foreground)]"
          >
            ·
          </span>
        )}
      </div>
    </div>
  );
}

export function ClientsBoard({
  initialClients,
  members,
  canWrite,
  now,
  autoCreate = false,
}: {
  initialClients: ClientRow[];
  members: MemberOption[];
  canWrite: boolean;
  /** Horloge figée fournie par le serveur (évite tout mismatch d'hydratation). */
  now: number;
  /** Ouvre directement le tiroir « Nouveau client » au montage (deep-link ?new=1). */
  autoCreate?: boolean;
}) {
  const router = useRouter();
  const intlRouter = useIntlRouter();
  const [clients, setClients] = useState<ClientRow[]>(initialClients);
  const [view, setView] = useState<'table' | 'pipeline'>('table');
  const [query, setQuery] = useState('');
  const [stageF, setStageF] = useState<ClientStage[]>([]);
  const [assigneeF, setAssigneeF] = useState<string[]>([]);
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({
    key: 'stage',
    dir: 'asc',
  });
  const [openMenu, setOpenMenu] = useState<'stage' | 'assignee' | 'sort' | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detailId, setDetailId] = useState<string | null>(null);
  const [formClient, setFormClient] = useState<ClientRow | 'new' | null>(
    autoCreate && canWrite ? 'new' : null,
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const toolbarRef = useRef<HTMLDivElement>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  // Ferme les popovers de filtre/tri au clic en dehors de la barre d'outils.
  useEffect(() => {
    if (!openMenu) return;
    const onDown = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) setOpenMenu(null);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [openMenu]);

  const totals = pipelineTotals(clients);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = clients.filter((c) => {
      if (stageF.length && !stageF.includes(c.stage)) return false;
      if (assigneeF.length) {
        const key = c.assigneeId ?? '__none';
        if (!assigneeF.includes(key)) return false;
      }
      if (q) {
        const hay =
          `${coupleLabel(c)} ${c.email ?? ''} ${c.assigneeName ?? ''} ${c.source ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      switch (sort.key) {
        case 'couple':
          return coupleLabel(a).localeCompare(coupleLabel(b)) * dir;
        case 'stage':
          return (STAGE_ORDER[a.stage] - STAGE_ORDER[b.stage]) * dir;
        case 'date':
          return ((a.weddingDate ?? 0) - (b.weddingDate ?? 0)) * dir;
        case 'budget':
          return ((a.budgetMinor ?? 0) - (b.budgetMinor ?? 0)) * dir;
        case 'contact':
          return ((a.lastContactAt ?? 0) - (b.lastContactAt ?? 0)) * dir;
        default:
          return 0;
      }
    });
  }, [clients, query, stageF, assigneeF, sort]);

  const detailClient = detailId ? (clients.find((c) => c._id === detailId) ?? null) : null;
  const editingClient = formClient && formClient !== 'new' ? formClient : null;
  const hasFilters = query.trim() || stageF.length || assigneeF.length;

  function toggleArr<T>(arr: T[], setArr: (v: T[]) => void, v: T) {
    setArr(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  }

  function rowFromForm(fd: FormData, base: ClientRow | null): ClientRow {
    const get = (k: string) => {
      const v = fd.get(k);
      return typeof v === 'string' && v.trim() ? v.trim() : undefined;
    };
    const stageRaw = get('stage');
    const assigneeId = get('assigneeId');
    const weddingRaw = get('weddingDate');
    const now = Date.now();
    return {
      _id: base?._id ?? `tmp_${now}`,
      partnerA: get('partnerA') ?? '',
      partnerB: get('partnerB'),
      phone: get('phone'),
      email: get('email')?.toLowerCase(),
      whatsapp: get('whatsapp'),
      stage: isClientStage(stageRaw) ? stageRaw : (base?.stage ?? 'lead'),
      source: get('source'),
      weddingDate: weddingRaw ? Date.parse(weddingRaw) || undefined : undefined,
      venue: get('venue'),
      budgetMinor: parseEurToMinor(get('budgetEur')) ?? undefined,
      budgetBookedMinor: parseEurToMinor(get('budgetBookedEur')) ?? undefined,
      assigneeId,
      assigneeName: assigneeId ? members.find((m) => m._id === assigneeId)?.name : undefined,
      notes: get('notes'),
      eventId: base?.eventId,
      lastContactAt: base?.lastContactAt ?? now,
      createdAt: base?.createdAt ?? now,
      updatedAt: now,
    };
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const optimistic = rowFromForm(fd, editingClient);
    setFormError(null);
    startTransition(async () => {
      const res = editingClient
        ? await updateClientAction(editingClient._id, fd)
        : await createClientAction(fd);
      if (!res.ok) {
        setFormError(errLabel(res.error));
        return;
      }
      if (editingClient) {
        setClients((prev) =>
          prev.map((c) => (c._id === editingClient._id ? { ...optimistic } : c)),
        );
      } else {
        const id = res.id ?? optimistic._id;
        setClients((prev) => [{ ...optimistic, _id: id }, ...prev]);
        setDetailId(id);
      }
      setFormClient(null);
      router.refresh();
    });
  }

  function changeStage(id: string, stage: ClientStage) {
    const c = clients.find((x) => x._id === id);
    if (!c || c.stage === stage) return;
    setClients((prev) => prev.map((x) => (x._id === id ? { ...x, stage } : x)));
    startTransition(async () => {
      const res = await updateClientStageAction(id, stage);
      if (!res.ok)
        setClients((prev) => prev.map((x) => (x._id === id ? { ...x, stage: c.stage } : x)));
    });
  }

  function onConvert(c: ClientRow) {
    startTransition(async () => {
      const res = await convertClientAction(c._id);
      if (res.ok && res.eventId) intlRouter.push(`/pro/weddings/${res.eventId}` as never);
      else if (!res.ok) alert(errLabel(res.error));
    });
  }

  function onDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;
    const stage = String(over.id);
    if (!isClientStage(stage)) return;
    changeStage(String(active.id), stage);
  }
  const activeCard = activeId ? (clients.find((c) => c._id === activeId) ?? null) : null;

  /* ---- bulk ---- */
  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function bulkStage(stage: ClientStage) {
    const ids = [...selected];
    setClients((prev) => prev.map((c) => (selected.has(c._id) ? { ...c, stage } : c)));
    setSelected(new Set());
    startTransition(async () => {
      await Promise.all(ids.map((id) => updateClientStageAction(id, stage)));
      router.refresh();
    });
  }
  function bulkDelete() {
    const ids = [...selected];
    if (!confirm(`Supprimer ${ids.length} client${ids.length > 1 ? 's' : ''} ?`)) return;
    setClients((prev) => prev.filter((c) => !selected.has(c._id)));
    setSelected(new Set());
    startTransition(async () => {
      await Promise.all(ids.map((id) => removeClientAction(id)));
      router.refresh();
    });
  }

  const columns = groupByStage(filtered);

  return (
    <div className="container-page flex flex-col gap-5 py-8 sm:py-10">
      {/* Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] tracking-[0.32em] text-[color:var(--color-muted-foreground)] uppercase">
            CRM · {totals.count} dossier{totals.count > 1 ? 's' : ''} ·{' '}
            {formatEurMinor(totals.budgetMinor)} en pipeline
          </span>
          <h1
            className="font-display italic"
            style={{
              fontSize: 'clamp(1.9rem, 4vw, 2.75rem)',
              lineHeight: 1.05,
              letterSpacing: '-0.022em',
              color: 'var(--color-foreground)',
            }}
          >
            Clients
          </h1>
        </div>
        {canWrite ? (
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={() => {
              setFormClient('new');
              setFormError(null);
            }}
            data-testid="new-client"
          >
            <Plus className="h-4 w-4" strokeWidth={2.2} aria-hidden />
            Nouveau client
          </Button>
        ) : null}
      </header>

      {/* Toolbar */}
      <div ref={toolbarRef} className="flex flex-wrap items-center gap-2">
        <div className="flex items-center rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-0.5">
          {(['table', 'pipeline'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              aria-pressed={view === v}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
                view === v
                  ? 'bg-[color:var(--color-surface-elevated)] text-[color:var(--color-foreground)]'
                  : 'text-[color:var(--color-muted-foreground)]',
              )}
            >
              {v === 'table' ? (
                <Rows3 className="h-3.5 w-3.5" strokeWidth={2} />
              ) : (
                <LayoutGrid className="h-3.5 w-3.5" strokeWidth={2} />
              )}
              {v === 'table' ? 'Table' : 'Pipeline'}
            </button>
          ))}
        </div>

        <label className="relative flex min-w-[180px] flex-1 items-center">
          <Search
            className="pointer-events-none absolute left-3 h-4 w-4 text-[color:var(--color-muted-foreground)]"
            strokeWidth={1.9}
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un client…"
            aria-label="Rechercher un client"
            className="focus-ring h-9 w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] pr-3 pl-9 text-sm text-[color:var(--color-foreground)] placeholder:text-[color:var(--color-muted-foreground)]"
          />
        </label>

        {/* Stage filter */}
        <FilterPopover
          open={openMenu === 'stage'}
          onToggle={() => setOpenMenu(openMenu === 'stage' ? null : 'stage')}
          Icon={Filter}
          label="Étape"
          count={stageF.length}
        >
          {CLIENT_STAGES.map((s) => (
            <CheckItem
              key={s}
              checked={stageF.includes(s)}
              onClick={() => toggleArr(stageF, setStageF, s)}
              dot={STAGE_PILL[s].dot}
            >
              {CLIENT_STAGE_LABEL[s]}
            </CheckItem>
          ))}
        </FilterPopover>

        {/* Assignee filter */}
        <FilterPopover
          open={openMenu === 'assignee'}
          onToggle={() => setOpenMenu(openMenu === 'assignee' ? null : 'assignee')}
          Icon={UserCheck}
          label="Assigné·e"
          count={assigneeF.length}
        >
          {members.map((m) => (
            <CheckItem
              key={m._id}
              checked={assigneeF.includes(m._id)}
              onClick={() => toggleArr(assigneeF, setAssigneeF, m._id)}
            >
              {m.name}
            </CheckItem>
          ))}
          <CheckItem
            checked={assigneeF.includes('__none')}
            onClick={() => toggleArr(assigneeF, setAssigneeF, '__none')}
          >
            Non assigné
          </CheckItem>
        </FilterPopover>

        {/* Sort */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpenMenu(openMenu === 'sort' ? null : 'sort')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-2.5 py-1.5 text-xs text-[color:var(--color-muted-foreground)] hover:text-[color:var(--color-foreground)]"
            aria-haspopup="menu"
            aria-expanded={openMenu === 'sort'}
          >
            <ArrowUpDown className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden />
            Trier
            <ChevronDown className="h-3 w-3" strokeWidth={2} aria-hidden />
          </button>
          {openMenu === 'sort' ? (
            <div className="absolute top-full right-0 z-20 mt-1 flex w-52 flex-col rounded-xl border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface-elevated)] p-1 shadow-[var(--shadow-popover)]">
              <span className="px-2 py-1 font-mono text-[9px] tracking-[0.18em] text-[color:var(--color-muted-foreground)] uppercase">
                Trier par
              </span>
              {SORT_OPTS.map((o) => (
                <button
                  key={o.key}
                  type="button"
                  onClick={() =>
                    setSort({
                      key: o.key,
                      dir: o.key === 'couple' || o.key === 'stage' ? 'asc' : 'desc',
                    })
                  }
                  className={cn(
                    'flex items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm hover:bg-[color:var(--color-surface)]',
                    sort.key === o.key
                      ? 'text-[color:var(--color-foreground)]'
                      : 'text-[color:var(--color-muted-foreground)]',
                  )}
                >
                  {o.label}
                  {sort.key === o.key ? <Check className="h-3.5 w-3.5" strokeWidth={2.4} /> : null}
                </button>
              ))}
              <span className="mx-1 my-1 h-px bg-[color:var(--color-border)]" />
              <button
                type="button"
                onClick={() => setSort((s) => ({ ...s, dir: s.dir === 'asc' ? 'desc' : 'asc' }))}
                className="rounded-lg px-2 py-1.5 text-left text-sm text-[color:var(--color-muted-foreground)] hover:bg-[color:var(--color-surface)]"
              >
                {sort.dir === 'asc' ? 'Ordre croissant ↑' : 'Ordre décroissant ↓'}
              </button>
            </div>
          ) : null}
        </div>

        {hasFilters ? (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setStageF([]);
              setAssigneeF([]);
            }}
            className="text-xs text-[color:var(--color-muted-foreground)] underline-offset-2 hover:text-[color:var(--color-foreground)] hover:underline"
          >
            Réinitialiser
          </button>
        ) : null}
      </div>

      {/* Bulk bar */}
      {selected.size > 0 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[color:var(--color-blush-400)] bg-[color:var(--color-surface)] px-4 py-2.5">
          <span className="text-sm font-medium text-[color:var(--color-foreground)]">
            {selected.size} sélectionné{selected.size > 1 ? 's' : ''}
          </span>
          <span className="h-4 w-px bg-[color:var(--color-border)]" />
          <span className="text-xs text-[color:var(--color-muted-foreground)]">
            Déplacer vers :
          </span>
          {CLIENT_STAGES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => bulkStage(s)}
              className="rounded-md px-2 py-1 font-mono text-[10px] tracking-[0.1em] uppercase hover:opacity-80"
              style={{ background: STAGE_PILL[s].bg, color: STAGE_PILL[s].fg }}
            >
              {CLIENT_STAGE_LABEL[s]}
            </button>
          ))}
          <span className="flex-1" />
          <button
            type="button"
            onClick={bulkDelete}
            className="inline-flex items-center gap-1.5 text-xs text-[color:var(--color-danger)] hover:opacity-80"
          >
            <Trash2 className="h-3.5 w-3.5" strokeWidth={1.9} /> Supprimer
          </button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            aria-label="Annuler la sélection"
            className="text-[color:var(--color-muted-foreground)] hover:text-[color:var(--color-foreground)]"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
      ) : null}

      {/* Content */}
      {clients.length === 0 ? (
        <EmptyState canWrite={canWrite} onCreate={() => setFormClient('new')} />
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[color:var(--color-border-strong)] bg-[color:var(--color-surface)]/40 px-8 py-12 text-center text-sm text-[color:var(--color-muted-foreground)]">
          Aucun client ne correspond à ces filtres.
        </div>
      ) : view === 'table' ? (
        <div className="overflow-x-auto rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)]">
          <table className="w-full min-w-[820px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-[color:var(--color-border)] text-left font-mono text-[9px] tracking-[0.18em] text-[color:var(--color-muted-foreground)] uppercase">
                {canWrite ? <th className="w-10 px-4 py-3" /> : null}
                <th className="px-4 py-3 font-medium">Client</th>
                <th className="px-4 py-3 font-medium">Étape</th>
                <th className="px-4 py-3 font-medium">Mariage</th>
                <th className="px-4 py-3 text-right font-medium">Budget</th>
                <th className="px-4 py-3 font-medium">Assigné·e</th>
                <th className="px-4 py-3 font-medium">Dernier contact</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr
                  key={c._id}
                  className="cursor-pointer border-b border-[color:var(--color-border)] transition-colors last:border-0 hover:bg-[color:var(--color-surface-elevated)]"
                  onClick={() => setDetailId(c._id)}
                >
                  {canWrite ? (
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected.has(c._id)}
                        onChange={() => toggleSelect(c._id)}
                        aria-label={`Sélectionner ${coupleLabel(c)}`}
                        className="h-4 w-4 accent-[color:var(--color-blush-500)]"
                      />
                    </td>
                  ) : null}
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-2.5">
                      <MiniAvatar name={coupleLabel(c)} />
                      <span className="font-medium text-[color:var(--color-foreground)]">
                        {coupleLabel(c)}
                      </span>
                      {c.eventId ? (
                        <span className="font-mono text-[9px] tracking-[0.1em] text-[color:var(--color-sage-500)] uppercase">
                          mariage
                        </span>
                      ) : null}
                    </span>
                  </td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    {canWrite ? (
                      <Select
                        value={c.stage}
                        disabled={pending}
                        onValueChange={(v) => isClientStage(v) && changeStage(c._id, v)}
                      >
                        <SelectTrigger
                          aria-label={`Étape de ${coupleLabel(c)}`}
                          className="focus-ring rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface-elevated)] px-2 py-1 text-xs text-[color:var(--color-foreground)]"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CLIENT_STAGES.map((s) => (
                            <SelectItem key={s} value={s}>
                              {CLIENT_STAGE_LABEL[s]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <StagePill stage={c.stage} />
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-[color:var(--color-muted-foreground)]">
                    {formatDateFr(c.weddingDate)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-[color:var(--color-foreground)] tabular-nums">
                    {c.budgetMinor != null ? formatEurMinor(c.budgetMinor) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {c.assigneeName ? (
                      <span className="inline-flex items-center gap-2 text-xs text-[color:var(--color-muted-foreground)]">
                        <MiniAvatar name={c.assigneeName} size={22} />
                        {c.assigneeName}
                      </span>
                    ) : (
                      <span className="text-xs text-[color:var(--color-muted-foreground)]/60">
                        Non assigné
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-[color:var(--color-muted-foreground)]">
                    {relativeFr(c.lastContactAt, now)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <DndContext
          id="clients-kanban"
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={(e: DragStartEvent) => setActiveId(String(e.active.id))}
          onDragEnd={onDragEnd}
          onDragCancel={() => setActiveId(null)}
        >
          <div className="grid auto-cols-[minmax(264px,1fr)] grid-flow-col items-start gap-3.5 overflow-x-auto pb-2 [scrollbar-width:thin]">
            {columns.map((col) => (
              <PipelineColumn
                key={col.stage}
                stage={col.stage}
                count={col.count}
                budgetMinor={col.budgetMinor}
              >
                {col.items.map((c) => (
                  <PipelineCard
                    key={c._id}
                    client={c}
                    draggable={canWrite}
                    onOpen={() => setDetailId(c._id)}
                    now={now}
                  />
                ))}
              </PipelineColumn>
            ))}
          </div>
          <DragOverlay>
            {activeCard ? <CardFace client={activeCard} dragging now={now} /> : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Detail sheet */}
      {detailClient ? (
        <ClientDetail
          key={detailClient._id}
          client={detailClient}
          onClose={() => setDetailId(null)}
          onChangeStage={(stage) => changeStage(detailClient._id, stage)}
          onEdit={() => {
            setDetailId(null);
            setFormClient(detailClient);
            setFormError(null);
          }}
          onConvert={() => onConvert(detailClient)}
        />
      ) : null}

      {/* Create / edit form */}
      <Drawer open={formClient !== null} onOpenChange={(o) => !o && setFormClient(null)}>
        <DrawerContent className="mx-auto max-w-lg">
          <DrawerHeader>
            <DrawerTitle>{editingClient ? 'Modifier le client' : 'Nouveau client'}</DrawerTitle>
          </DrawerHeader>
          <ClientForm
            key={editingClient?._id ?? 'new'}
            editing={editingClient}
            members={members}
            pending={pending}
            error={formError}
            onSubmit={onSubmit}
            onCancel={() => setFormClient(null)}
          />
        </DrawerContent>
      </Drawer>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function FilterPopover({
  open,
  onToggle,
  Icon,
  label,
  count,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  Icon: typeof Filter;
  label: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs',
          count > 0
            ? 'border-[color:var(--color-blush-400)] text-[color:var(--color-foreground)]'
            : 'border-[color:var(--color-border)] text-[color:var(--color-muted-foreground)] hover:text-[color:var(--color-foreground)]',
          'bg-[color:var(--color-surface)]',
        )}
      >
        <Icon className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden />
        {label}
        {count > 0 ? (
          <span className="rounded-full bg-[color:var(--color-blush-500)] px-1.5 text-[10px] text-white">
            {count}
          </span>
        ) : null}
        <ChevronDown className="h-3 w-3" strokeWidth={2} aria-hidden />
      </button>
      {open ? (
        <div className="absolute top-full left-0 z-20 mt-1 flex w-52 flex-col rounded-xl border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface-elevated)] p-1 shadow-[var(--shadow-popover)]">
          {children}
        </div>
      ) : null}
    </div>
  );
}

function CheckItem({
  checked,
  onClick,
  dot,
  children,
}: {
  checked: boolean;
  onClick: () => void;
  dot?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      role="menuitemcheckbox"
      aria-checked={checked}
      className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-[color:var(--color-foreground)] hover:bg-[color:var(--color-surface)]"
    >
      <span
        className={cn(
          'flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border',
          checked
            ? 'border-[color:var(--color-blush-400)] bg-[color:var(--color-blush-500)] text-white'
            : 'border-[color:var(--color-border-strong)]',
        )}
      >
        {checked ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
      </span>
      {dot ? (
        <span className="h-2 w-2 rounded-full" style={{ background: dot }} aria-hidden />
      ) : null}
      <span className="flex-1">{children}</span>
    </button>
  );
}

function EmptyState({ canWrite, onCreate }: { canWrite: boolean; onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center gap-5 rounded-3xl border border-dashed border-[color:var(--color-border-strong)] bg-[color:var(--color-surface)]/40 px-8 py-16 text-center">
      <p className="max-w-sm text-sm text-[color:var(--color-muted-foreground)]">
        Aucun client pour l’instant. Ajoutez votre premier couple pour démarrer le pipeline.
      </p>
      {canWrite ? (
        <Button type="button" variant="primary" size="md" onClick={onCreate}>
          <Plus className="h-4 w-4" strokeWidth={2.2} aria-hidden />
          Nouveau client
        </Button>
      ) : null}
    </div>
  );
}

const selectClass =
  'focus-ring h-10 rounded-lg border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface-elevated)] px-3 text-sm text-[color:var(--color-foreground)]';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-[color:var(--color-muted-foreground)]">
        {label}
      </span>
      {children}
    </label>
  );
}

function ClientForm({
  editing,
  members,
  pending,
  error,
  onSubmit,
  onCancel,
}: {
  editing: ClientRow | null;
  members: MemberOption[];
  pending: boolean;
  error: string | null;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}) {
  const [source, setSource] = useState(editing?.source ?? 'none');
  const [assigneeId, setAssigneeId] = useState(editing?.assigneeId ?? 'none');
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4 pb-2">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Partenaire A *">
          <Input
            name="partnerA"
            required
            defaultValue={editing?.partnerA ?? ''}
            placeholder="Awa"
          />
        </Field>
        <Field label="Partenaire B">
          <Input name="partnerB" defaultValue={editing?.partnerB ?? ''} placeholder="Karim" />
        </Field>
        <Field label="Téléphone">
          <Input name="phone" defaultValue={editing?.phone ?? ''} placeholder="+33…" />
        </Field>
        <Field label="WhatsApp">
          <Input name="whatsapp" defaultValue={editing?.whatsapp ?? ''} placeholder="+33…" />
        </Field>
        <Field label="Email">
          <Input
            name="email"
            type="email"
            defaultValue={editing?.email ?? ''}
            placeholder="couple@email.fr"
          />
        </Field>
        <Field label="Source">
          <input type="hidden" name="source" value={source === 'none' ? '' : source} />
          <Select value={source} onValueChange={setSource}>
            <SelectTrigger className={selectClass}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">—</SelectItem>
              {CLIENT_SOURCES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Étape">
          <Select name="stage" defaultValue={editing?.stage ?? 'lead'}>
            <SelectTrigger className={selectClass}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CLIENT_STAGES.map((s) => (
                <SelectItem key={s} value={s}>
                  {CLIENT_STAGE_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Assigné·e">
          <input type="hidden" name="assigneeId" value={assigneeId === 'none' ? '' : assigneeId} />
          <Select value={assigneeId} onValueChange={setAssigneeId}>
            <SelectTrigger className={selectClass}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— Personne —</SelectItem>
              {members.map((m) => (
                <SelectItem key={m._id} value={m._id}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Date du mariage">
          <Input name="weddingDate" type="date" defaultValue={toDateInput(editing?.weddingDate)} />
        </Field>
        <Field label="Lieu">
          <Input name="venue" defaultValue={editing?.venue ?? ''} placeholder="Domaine…" />
        </Field>
        <Field label="Budget prévu (€)">
          <Input
            name="budgetEur"
            inputMode="decimal"
            defaultValue={editing?.budgetMinor != null ? String(editing.budgetMinor / 100) : ''}
            placeholder="18000"
          />
        </Field>
        <Field label="Budget réservé (€)">
          <Input
            name="budgetBookedEur"
            inputMode="decimal"
            defaultValue={
              editing?.budgetBookedMinor != null ? String(editing.budgetBookedMinor / 100) : ''
            }
            placeholder="0"
          />
        </Field>
      </div>
      {!editing ? (
        <Field label="Note initiale">
          <textarea
            name="notes"
            rows={2}
            className="focus-ring rounded-lg border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface-elevated)] px-3 py-2 text-sm text-[color:var(--color-foreground)]"
            placeholder="Contexte du lead…"
          />
        </Field>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-[color:var(--color-danger)]">
          {error}
        </p>
      ) : null}

      <div className="mt-1 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className={cn(buttonVariants({ variant: 'ghost', size: 'md' }))}
        >
          <X className="h-4 w-4" strokeWidth={2} aria-hidden />
          Annuler
        </button>
        <Button type="submit" variant="primary" size="md" disabled={pending}>
          {pending ? 'Enregistrement…' : editing ? 'Enregistrer' : 'Créer le client'}
        </Button>
      </div>
    </form>
  );
}
