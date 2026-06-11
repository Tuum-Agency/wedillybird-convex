'use client';

import { Fragment, useMemo, useState, useTransition, type FormEvent } from 'react';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Trash2,
  X,
  Sparkles,
  Save,
  BookMarked,
  LayoutTemplate,
  Rows3,
  Columns3,
  GanttChart,
  ChevronLeft,
  ChevronRight,
  Calendar,
  AlertTriangle,
  StickyNote,
  Check,
  Search,
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
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { WeddingSelect } from '@/components/pro/wedding-select';
import { cn } from '@/lib/cn';
import {
  PLANNING_PHASES,
  PHASE_LABEL,
  PLANNING_STATUSES,
  PLANNING_TEMPLATES,
  STATUS_LABEL,
  STATUS_TONE,
  groupByPhase,
  groupByStatus,
  planningProgress,
  dueInfo,
  overdueCount,
  nextStatus,
  type PlanningPhase,
  type TaskStatus,
} from '@/lib/pro/planning';
import { formatDateFr } from '@/lib/pro/format';
import {
  createTaskAction,
  updateTaskAction,
  setTaskStatusAction,
  setSubtasksAction,
  removeTaskAction,
  applyTemplateAction,
  applyCustomTemplateAction,
  saveTemplateAction,
  deleteTemplateAction,
} from '@/app/[locale]/(app)/pro/planning/actions';

export interface PlanningTaskRow {
  _id: string;
  phase: PlanningPhase;
  title: string;
  done: boolean;
  status: TaskStatus;
  notes?: string;
  subtasks?: Array<{ label: string; done: boolean }>;
  dueDate?: number;
  assigneeId?: string;
  priority?: 'low' | 'normal' | 'high';
  order: number;
}

/** Modèle personnalisé (org-level), enregistré depuis un rétroplanning existant. */
export interface CustomTemplate {
  _id: string;
  name: string;
  tasks: Array<{ phase: PlanningPhase; title: string }>;
  createdAt: number;
}

/** Descripteur unifié pour le dialogue : modèle intégré (builtin) ou maison (custom). */
interface DialogTemplate {
  id: string;
  kind: 'builtin' | 'custom';
  label: string;
  tasks: ReadonlyArray<{ phase: PlanningPhase; title: string }>;
}

const BUILTIN_PREFIX = 'builtin:';
/** Sentinel « non assigné » (Radix Select interdit value=""). Normalisé en '' avant submit. */
const ASSIGNEE_NONE = '__none__';

type ViewKey = 'phase' | 'board' | 'frise';
const VIEWS: ReadonlyArray<{ key: ViewKey; label: string; Icon: typeof Rows3 }> = [
  { key: 'phase', label: 'Par phase', Icon: Rows3 },
  { key: 'board', label: 'Tableau', Icon: Columns3 },
  { key: 'frise', label: 'Frise', Icon: GanttChart },
];

const PRIORITY_OPTS = [
  { key: 'low', label: 'Basse' },
  { key: 'normal', label: 'Normale' },
  { key: 'high', label: 'Haute' },
] as const;

/** ms → « yyyy-mm-dd » (UTC) pour un <input type="date">. Appelé hors render. */
function toDateInput(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

interface PlanningMember {
  userId: string;
  name: string;
}

interface EventOption {
  _id: string;
  label: string;
  partnerA: string;
  partnerB: string;
  eventDate: number;
  timezone?: string;
  venue?: string;
  status: 'draft' | 'active' | 'archived' | 'cancelled';
}

function memberInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map((p) => p.charAt(0).toUpperCase()).join('') || '·';
}
function memberHue(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return h;
}

export function PlanningBoard({
  events,
  selectedEventId,
  orgName,
  tasks: initialTasks,
  canWrite,
  now,
  eventDate,
  members = [],
  customTemplates = [],
}: {
  events: ReadonlyArray<EventOption>;
  selectedEventId: string;
  orgName: string;
  tasks: PlanningTaskRow[];
  canWrite: boolean;
  now: number;
  eventDate: number | null;
  members?: PlanningMember[];
  customTemplates?: CustomTemplate[];
}) {
  const router = useRouter();
  const memberById = useMemo(() => new Map(members.map((m) => [m.userId, m.name])), [members]);
  const [tasks, setTasks] = useState<PlanningTaskRow[]>(initialTasks);
  const [customs, setCustoms] = useState<CustomTemplate[]>(customTemplates);
  const [view, setView] = useState<ViewKey>('phase');
  const [query, setQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | TaskStatus>('all');
  const [filterAssignee, setFilterAssignee] = useState<'all' | 'unassigned' | string>('all');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [presetPhase, setPresetPhase] = useState<PlanningPhase>('m3');
  const [editing, setEditing] = useState<PlanningTaskRow | null>(null);
  const [editDue, setEditDue] = useState('');
  const [drawerSubtasks, setDrawerSubtasks] = useState<Array<{ label: string; done: boolean }>>([]);
  const [subtaskDraft, setSubtaskDraft] = useState('');
  const [templateDialogId, setTemplateDialogId] = useState<string | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Modèles intégrés + modèles maison, fusionnés pour le dialogue d'application.
  const allTemplates = useMemo<DialogTemplate[]>(
    () => [
      ...(Object.keys(PLANNING_TEMPLATES) as Array<keyof typeof PLANNING_TEMPLATES>).map((k) => ({
        id: `${BUILTIN_PREFIX}${k}`,
        kind: 'builtin' as const,
        label: PLANNING_TEMPLATES[k].label,
        tasks: PLANNING_TEMPLATES[k].tasks,
      })),
      ...customs.map((t) => ({
        id: t._id,
        kind: 'custom' as const,
        label: t.name,
        tasks: t.tasks,
      })),
    ],
    [customs],
  );

  const progress = planningProgress(tasks);
  const overdue = overdueCount(tasks, now);

  const filteredTasks = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tasks.filter((t) => {
      if (filterStatus !== 'all' && t.status !== filterStatus) return false;
      if (filterAssignee === 'unassigned' && t.assigneeId) return false;
      if (
        filterAssignee !== 'all' &&
        filterAssignee !== 'unassigned' &&
        t.assigneeId !== filterAssignee
      )
        return false;
      if (q && !t.title.toLowerCase().includes(q) && !(t.notes ?? '').toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [tasks, query, filterStatus, filterAssignee]);

  function resetFilters() {
    setQuery('');
    setFilterStatus('all');
    setFilterAssignee('all');
  }

  function openCreate(phase: PlanningPhase) {
    setEditing(null);
    setPresetPhase(phase);
    setEditDue('');
    setDrawerSubtasks([]);
    setSubtaskDraft('');
    setFormError(null);
    setDrawerOpen(true);
  }

  function openEdit(task: PlanningTaskRow) {
    if (!canWrite) return;
    setEditing(task);
    setPresetPhase(task.phase);
    setEditDue(task.dueDate ? toDateInput(task.dueDate) : '');
    setDrawerSubtasks((task.subtasks ?? []).map((s) => ({ ...s })));
    setSubtaskDraft('');
    setFormError(null);
    setDrawerOpen(true);
  }

  function addSubtask() {
    const label = subtaskDraft.trim();
    if (!label) return;
    setDrawerSubtasks((s) => [...s, { label, done: false }]);
    setSubtaskDraft('');
  }

  function closeDrawer(open: boolean) {
    setDrawerOpen(open);
    if (!open) setEditing(null);
  }

  function applyStatus(task: PlanningTaskRow, status: TaskStatus) {
    if (!canWrite || status === task.status) return;
    const prevStatus = task.status;
    const prevDone = task.done;
    setTasks((prev) =>
      prev.map((t) => (t._id === task._id ? { ...t, status, done: status === 'done' } : t)),
    );
    startTransition(async () => {
      const res = await setTaskStatusAction(task._id, status);
      if (!res.ok) {
        setTasks((prev) =>
          prev.map((t) => (t._id === task._id ? { ...t, status: prevStatus, done: prevDone } : t)),
        );
      }
    });
  }

  function onRemove(task: PlanningTaskRow) {
    setTasks((prev) => prev.filter((t) => t._id !== task._id));
    startTransition(async () => {
      const res = await removeTaskAction(task._id);
      if (!res.ok) router.refresh();
    });
  }

  function onCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    // Le Select « Assigné·e » soumet un sentinel pour « non assigné » → on le
    // remet à '' pour que FormData/serveur le traitent comme vide (clearAssignee).
    if (fd.get('assigneeId') === ASSIGNEE_NONE) fd.set('assigneeId', '');
    const title = String(fd.get('title') ?? '').trim();
    const phase = (String(fd.get('phase') ?? 'm3') as PlanningPhase) ?? 'm3';
    const dueRaw = String(fd.get('dueDate') ?? '');
    const prRaw = String(fd.get('priority') ?? '');
    const priority = prRaw === 'low' || prRaw === 'normal' || prRaw === 'high' ? prRaw : undefined;
    const assigneeId = String(fd.get('assigneeId') ?? '') || undefined;
    const notes = String(fd.get('notes') ?? '').trim() || undefined;
    if (!title) {
      setFormError('Le titre est requis.');
      return;
    }
    const dueParsed = dueRaw ? Date.parse(dueRaw) || undefined : undefined;

    if (editing) {
      const id = editing._id;
      const subtasksSnapshot = drawerSubtasks.map((s) => ({ ...s }));
      setTasks((prev) =>
        prev.map((t) =>
          t._id === id
            ? {
                ...t,
                title,
                phase,
                dueDate: dueParsed,
                priority: priority ?? t.priority,
                assigneeId,
                notes,
                subtasks: subtasksSnapshot,
              }
            : t,
        ),
      );
      setFormError(null);
      startTransition(async () => {
        const res = await updateTaskAction(id, fd);
        if (!res.ok) {
          setFormError('Une erreur est survenue. Réessayez.');
          return;
        }
        await setSubtasksAction(id, subtasksSnapshot);
        closeDrawer(false);
        router.refresh();
      });
      return;
    }

    const nowT = Date.now();
    const subtasksSnapshot = drawerSubtasks.map((s) => ({ ...s }));
    const optimistic: PlanningTaskRow = {
      _id: `tmp_${nowT}`,
      phase,
      title,
      done: false,
      status: 'todo',
      notes,
      subtasks: subtasksSnapshot,
      dueDate: dueParsed,
      assigneeId,
      order: nowT,
    };
    setFormError(null);
    startTransition(async () => {
      const res = await createTaskAction(selectedEventId, fd);
      if (!res.ok) {
        setFormError('Une erreur est survenue. Réessayez.');
        return;
      }
      const newId = res.id ?? optimistic._id;
      if (subtasksSnapshot.length > 0 && res.id) await setSubtasksAction(res.id, subtasksSnapshot);
      setTasks((prev) => [...prev, { ...optimistic, _id: newId }]);
      closeDrawer(false);
      router.refresh();
    });
  }

  function onApplyTemplate(template: DialogTemplate) {
    const nowT = Date.now();
    const optimistic: PlanningTaskRow[] = template.tasks.map((t, i) => ({
      _id: `tmp_${nowT}_${i}`,
      phase: t.phase,
      title: t.title,
      done: false,
      status: 'todo',
      order: nowT + i,
    }));
    setTemplateDialogId(null);
    startTransition(async () => {
      const res =
        template.kind === 'builtin'
          ? await applyTemplateAction(selectedEventId, template.id.slice(BUILTIN_PREFIX.length))
          : await applyCustomTemplateAction(selectedEventId, template.id);
      if (!res.ok) return;
      setTasks((prev) => [...prev, ...optimistic]);
      router.refresh();
    });
  }

  function onDeleteTemplate(id: string) {
    setCustoms((prev) => prev.filter((t) => t._id !== id));
    startTransition(async () => {
      const res = await deleteTemplateAction(id);
      if (!res.ok) router.refresh();
    });
  }

  function onSaveTemplate(rawName: string): boolean {
    const name = rawName.trim();
    if (!name) {
      setFormError('Le nom du modèle est requis.');
      return false;
    }
    // Instantané optimiste depuis les tâches courantes (phase + titre, triées).
    const snapshot = [...tasks]
      .sort((a, b) => a.order - b.order)
      .map((t) => ({ phase: t.phase, title: t.title }));
    const tempId = `tmp_tpl_${Date.now()}`;
    startTransition(async () => {
      const res = await saveTemplateAction(selectedEventId, name);
      if (!res.ok) {
        setFormError(
          res.error === 'TEMPLATE_LIMIT_REACHED'
            ? 'Limite de modèles atteinte (20). Supprimez-en un.'
            : 'Une erreur est survenue. Réessayez.',
        );
        // Annule l'ajout optimiste si présent.
        setCustoms((prev) => prev.filter((t) => t._id !== tempId));
        return;
      }
      setCustoms((prev) =>
        prev
          .filter((t) => t._id !== tempId)
          .concat({ _id: res.id, name, tasks: snapshot, createdAt: Date.now() })
          .sort((a, b) => a.name.localeCompare(b.name, 'fr')),
      );
      setSaveOpen(false);
      router.refresh();
    });
    return true;
  }

  return (
    <div className="container-page flex flex-col gap-6 py-8 sm:py-10">
      {/* En-tête : eyebrow + (sélecteur · lieu) à gauche · (avancement + actions) à droite */}
      <header className="flex flex-col gap-5">
        <span className="font-mono text-[10px] tracking-[0.32em] text-[color:var(--color-muted-foreground)] uppercase">
          Rétroplanning · {orgName}
        </span>
        <h1 className="sr-only">Rétroplanning</h1>

        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          {/* Gauche : sélecteur de mariage + lieu */}
          <WeddingSelect
            events={events}
            value={selectedEventId}
            now={now}
            label=""
            showVenue
            onChange={(id) => router.push(`/pro/planning?event=${id}` as Route)}
          />

          {/* Droite : carte d'avancement + actions */}
          <div className="flex flex-wrap items-center gap-3 lg:justify-end">
            <ProgressCard
              pct={progress.pct}
              done={progress.done}
              total={progress.total}
              overdue={overdue}
            />
            {canWrite ? (
              <div className="flex items-center gap-2">
                {tasks.length > 0 ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-11 w-11"
                    title="Enregistrer le planning comme modèle"
                    aria-label="Enregistrer le planning comme modèle"
                    onClick={() => {
                      setFormError(null);
                      setSaveOpen(true);
                    }}
                    data-testid="save-template"
                  >
                    <Save className="h-4 w-4" strokeWidth={2} aria-hidden />
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  onClick={() => setTemplateDialogId(`${BUILTIN_PREFIX}classic`)}
                  data-testid="apply-classic"
                >
                  <LayoutTemplate className="h-4 w-4" strokeWidth={2} aria-hidden />
                  Appliquer un modèle
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  onClick={() => openCreate('m3')}
                  data-testid="new-task"
                >
                  <Plus className="h-4 w-4" strokeWidth={2.2} aria-hidden />
                  Nouvelle tâche
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      {tasks.length === 0 ? (
        <div className="flex flex-col items-center gap-5 rounded-3xl border border-dashed border-[color:var(--color-border-strong)] bg-[color:var(--color-surface)]/40 px-8 py-14 text-center">
          <p className="max-w-sm text-sm text-[color:var(--color-muted-foreground)]">
            Aucune tâche. {canWrite ? 'Appliquez un modèle pour démarrer.' : ''}
          </p>
          {canWrite ? (
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={() => setTemplateDialogId(`${BUILTIN_PREFIX}classic`)}
              >
                <Sparkles className="h-4 w-4" strokeWidth={2} aria-hidden />
                Modèle « Mariage classique »
              </Button>
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={() => setTemplateDialogId(`${BUILTIN_PREFIX}intimate`)}
              >
                Modèle « Mariage intime »
              </Button>
              {customs.length > 0 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="md"
                  onClick={() => setTemplateDialogId(customs[0]!._id)}
                >
                  <BookMarked className="h-4 w-4" strokeWidth={2} aria-hidden />
                  Mes modèles ({customs.length})
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : (
        <>
          {/* Sélecteur de vue + filtres */}
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div
              className="flex items-center gap-1 self-start rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-1"
              role="tablist"
              aria-label="Vue du rétroplanning"
            >
              {VIEWS.map((vw) => (
                <button
                  key={vw.key}
                  type="button"
                  role="tab"
                  aria-selected={view === vw.key}
                  onClick={() => setView(vw.key)}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors',
                    view === vw.key
                      ? 'bg-[color:var(--color-surface-elevated)] font-medium text-[color:var(--color-foreground)]'
                      : 'text-[color:var(--color-muted-foreground)] hover:text-[color:var(--color-foreground)]',
                  )}
                >
                  <vw.Icon className="h-4 w-4" strokeWidth={1.85} aria-hidden />
                  {vw.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="relative flex items-center">
                <Search
                  className="pointer-events-none absolute left-2.5 h-4 w-4 text-[color:var(--color-muted-foreground)]"
                  strokeWidth={1.9}
                  aria-hidden
                />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Rechercher…"
                  aria-label="Rechercher une tâche"
                  className="focus-ring h-9 w-44 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] pr-3 pl-8 text-sm text-[color:var(--color-foreground)] placeholder:text-[color:var(--color-muted-foreground)]"
                />
              </label>
              <Select
                value={filterStatus}
                onValueChange={(v) => setFilterStatus(v as 'all' | TaskStatus)}
              >
                <SelectTrigger
                  aria-label="Filtrer par statut"
                  className="h-9 w-auto min-w-[124px] border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-2.5"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous statuts</SelectItem>
                  {PLANNING_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterAssignee} onValueChange={setFilterAssignee}>
                <SelectTrigger
                  aria-label="Filtrer par assigné·e"
                  className="h-9 w-auto min-w-[124px] border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-2.5"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="unassigned">Non assigné·e</SelectItem>
                  {members.map((m) => (
                    <SelectItem key={m.userId} value={m.userId}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {filteredTasks.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-[color:var(--color-border-strong)] bg-[color:var(--color-surface)]/40 px-8 py-12 text-center">
              <p className="text-sm text-[color:var(--color-muted-foreground)]">
                Aucune tâche ne correspond à ces filtres.
              </p>
              <button
                type="button"
                onClick={resetFilters}
                className="text-xs text-[color:var(--color-blush-300)] underline-offset-2 hover:underline"
              >
                Réinitialiser les filtres
              </button>
            </div>
          ) : view === 'phase' ? (
            <PhaseView
              tasks={filteredTasks}
              now={now}
              canWrite={canWrite}
              memberById={memberById}
              onCycle={(t) => applyStatus(t, nextStatus(t.status))}
              onRemove={onRemove}
              onAdd={openCreate}
              onEdit={openEdit}
            />
          ) : view === 'board' ? (
            <BoardView tasks={filteredTasks} now={now} canWrite={canWrite} onMove={applyStatus} />
          ) : (
            <FriseView tasks={filteredTasks} now={now} eventDate={eventDate} />
          )}
        </>
      )}

      <Dialog open={drawerOpen} onOpenChange={closeDrawer}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Modifier la tâche' : 'Nouvelle tâche'}</DialogTitle>
          </DialogHeader>
          <form
            key={editing?._id ?? `new-${presetPhase}`}
            onSubmit={onCreate}
            className="flex flex-col gap-4 pb-2"
          >
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-[color:var(--color-muted-foreground)]">
                Tâche *
              </span>
              <Input
                name="title"
                required
                placeholder="Réserver le photographe"
                defaultValue={editing?.title ?? ''}
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-[color:var(--color-muted-foreground)]">
                  Phase
                </span>
                <Select name="phase" defaultValue={presetPhase}>
                  <SelectTrigger aria-label="Phase">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLANNING_PHASES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {PHASE_LABEL[p]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-[color:var(--color-muted-foreground)]">
                  Échéance
                </span>
                <Input name="dueDate" type="date" defaultValue={editDue} />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-[color:var(--color-muted-foreground)]">
                  Priorité
                </span>
                <Select name="priority" defaultValue={editing?.priority ?? 'normal'}>
                  <SelectTrigger aria-label="Priorité">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITY_OPTS.map((p) => (
                      <SelectItem key={p.key} value={p.key}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-[color:var(--color-muted-foreground)]">
                  Assigné·e
                </span>
                <Select name="assigneeId" defaultValue={editing?.assigneeId ?? ASSIGNEE_NONE}>
                  <SelectTrigger aria-label="Assigné·e">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ASSIGNEE_NONE}>Non assigné·e</SelectItem>
                    {members.map((m) => (
                      <SelectItem key={m.userId} value={m.userId}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-[color:var(--color-muted-foreground)]">
                Note
              </span>
              <textarea
                name="notes"
                defaultValue={editing?.notes ?? ''}
                rows={2}
                maxLength={2000}
                placeholder="Détails, contacts, rappels…"
                className="focus-ring resize-none rounded-lg border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface-elevated)] px-3 py-2.5 text-sm text-[color:var(--color-foreground)] outline-none placeholder:text-[color:var(--color-muted-foreground)]"
              />
            </label>
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium text-[color:var(--color-muted-foreground)]">
                Sous-tâches
                {drawerSubtasks.length > 0 ? (
                  <span className="ml-1 font-mono tabular-nums">
                    ({drawerSubtasks.filter((s) => s.done).length}/{drawerSubtasks.length})
                  </span>
                ) : null}
              </span>
              {drawerSubtasks.length > 0 ? (
                <ul className="flex flex-col gap-1.5">
                  {drawerSubtasks.map((s, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={s.done}
                        aria-label={s.label}
                        onClick={() =>
                          setDrawerSubtasks((arr) =>
                            arr.map((x, xi) => (xi === i ? { ...x, done: !x.done } : x)),
                          )
                        }
                        className={cn(
                          'focus-ring flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border',
                          s.done
                            ? 'border-[color:var(--color-sage-500)] bg-[color:var(--color-sage-500)] text-[color:var(--color-background)]'
                            : 'border-[color:var(--color-border-strong)]',
                        )}
                      >
                        {s.done ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
                      </button>
                      <span
                        className={cn(
                          'flex-1 text-sm',
                          s.done
                            ? 'text-[color:var(--color-muted-foreground)] line-through'
                            : 'text-[color:var(--color-foreground)]',
                        )}
                      >
                        {s.label}
                      </span>
                      <button
                        type="button"
                        onClick={() => setDrawerSubtasks((arr) => arr.filter((_, xi) => xi !== i))}
                        aria-label={`Retirer ${s.label}`}
                        className="focus-ring rounded p-0.5 text-[color:var(--color-muted-foreground)] hover:text-[color:var(--color-danger)]"
                      >
                        <X className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="flex items-center gap-2">
                <input
                  value={subtaskDraft}
                  onChange={(e) => setSubtaskDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addSubtask();
                    }
                  }}
                  placeholder="Ajouter une sous-tâche…"
                  className="focus-ring h-9 flex-1 rounded-lg border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface-elevated)] px-3 text-sm text-[color:var(--color-foreground)] outline-none placeholder:text-[color:var(--color-muted-foreground)]"
                />
                <button
                  type="button"
                  onClick={addSubtask}
                  aria-label="Ajouter la sous-tâche"
                  className="focus-ring inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[color:var(--color-border-strong)] text-[color:var(--color-foreground)] transition-colors hover:border-[color:var(--color-blush-400)]"
                >
                  <Plus className="h-4 w-4" strokeWidth={2.2} aria-hidden />
                </button>
              </div>
            </div>
            {formError ? (
              <p role="alert" className="text-sm text-[color:var(--color-danger)]">
                {formError}
              </p>
            ) : null}
            <div className="mt-1 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => closeDrawer(false)}
                className={cn(buttonVariants({ variant: 'ghost', size: 'md' }))}
              >
                <X className="h-4 w-4" strokeWidth={2} aria-hidden />
                Annuler
              </button>
              <Button type="submit" variant="primary" size="md" disabled={pending}>
                {pending ? 'Enregistrement…' : editing ? 'Enregistrer' : 'Ajouter'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {templateDialogId ? (
        <TemplateDialog
          templates={allTemplates}
          initialId={templateDialogId}
          now={now}
          eventDate={eventDate}
          hasTasks={tasks.length > 0}
          canWrite={canWrite}
          pending={pending}
          onClose={() => setTemplateDialogId(null)}
          onApply={onApplyTemplate}
          onDelete={onDeleteTemplate}
        />
      ) : null}

      {saveOpen ? (
        <SaveTemplateDialog
          taskCount={tasks.length}
          error={formError}
          pending={pending}
          onClose={() => setSaveOpen(false)}
          onSave={onSaveTemplate}
        />
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Dialogue « Enregistrer comme modèle »                                     */
/* -------------------------------------------------------------------------- */

function SaveTemplateDialog({
  taskCount,
  error,
  pending,
  onClose,
  onSave,
}: {
  taskCount: number;
  error: string | null;
  pending: boolean;
  onClose: () => void;
  onSave: (name: string) => void;
}) {
  const [name, setName] = useState('');
  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[color:var(--color-surface-elevated)] text-[color:var(--color-blush-300)]">
              <Save className="h-5 w-5" strokeWidth={1.85} aria-hidden />
            </span>
            <div className="flex flex-col gap-0.5">
              <span className="font-mono text-[10px] tracking-[0.16em] text-[color:var(--color-muted-foreground)] uppercase">
                Modèle maison
              </span>
              <DialogTitle>Enregistrer comme modèle</DialogTitle>
            </div>
          </div>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSave(name);
          }}
          className="flex flex-col gap-4"
        >
          <DialogDescription>
            Les {taskCount} tâche{taskCount > 1 ? 's' : ''} actuelle{taskCount > 1 ? 's' : ''}{' '}
            (phase + intitulé) seront enregistrées comme modèle réutilisable. Les dates, statuts et
            assignations ne sont pas conservés.
          </DialogDescription>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-[color:var(--color-muted-foreground)]">
              Nom du modèle *
            </span>
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              placeholder="Mariage champêtre, Pack premium…"
              aria-label="Nom du modèle"
            />
          </label>
          {error ? (
            <p role="alert" className="text-sm text-[color:var(--color-danger)]">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm text-[color:var(--color-muted-foreground)] hover:text-[color:var(--color-foreground)]"
            >
              Annuler
            </button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={pending || name.trim().length === 0}
              data-testid="confirm-save-template"
            >
              <Save className="h-4 w-4" strokeWidth={2} aria-hidden />
              {pending ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/*  Dialogue « Appliquer un modèle » (aperçu)                                 */
/* -------------------------------------------------------------------------- */

const PHASE_OFFSET_DAYS: Record<PlanningPhase, number> = {
  m12: -365,
  m6: -180,
  m3: -90,
  m1: -30,
  d7: -7,
  dday: 0,
  after: 14,
};

function TemplateDialog({
  templates,
  initialId,
  now,
  eventDate,
  hasTasks,
  canWrite,
  pending,
  onClose,
  onApply,
  onDelete,
}: {
  templates: DialogTemplate[];
  initialId: string;
  now: number;
  eventDate: number | null;
  hasTasks: boolean;
  canWrite: boolean;
  pending: boolean;
  onClose: () => void;
  onApply: (template: DialogTemplate) => void;
  onDelete: (customId: string) => void;
}) {
  const [selectedId, setSelectedId] = useState<string>(initialId);
  // Le modèle sélectionné peut disparaître (suppression) → repli sur le premier.
  const selected = templates.find((t) => t.id === selectedId) ?? templates[0];
  const grouped = selected
    ? PLANNING_PHASES.map((phase) => ({
        phase,
        label: PHASE_LABEL[phase],
        items: selected.tasks.filter((t) => t.phase === phase),
      })).filter((c) => c.items.length > 0)
    : [];

  function jBadge(phase: PlanningPhase): string | null {
    if (eventDate == null) return null;
    const date = eventDate + PHASE_OFFSET_DAYS[phase] * 86_400_000;
    const days = Math.ceil((date - now) / 86_400_000);
    return days < 0 ? `J+${-days}` : days === 0 ? 'Jour J' : `J−${days}`;
  }

  const count = selected?.tasks.length ?? 0;

  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[color:var(--color-surface-elevated)] text-[color:var(--color-blush-300)]">
              <Sparkles className="h-5 w-5" strokeWidth={1.85} aria-hidden />
            </span>
            <div className="flex flex-col gap-0.5">
              <span className="font-mono text-[10px] tracking-[0.16em] text-[color:var(--color-muted-foreground)] uppercase">
                Modèle de rétroplanning
              </span>
              <DialogTitle>Appliquer un modèle</DialogTitle>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="grid max-h-[184px] grid-cols-2 gap-2 overflow-y-auto">
            {templates.map((t) => {
              const on = t.id === selected?.id;
              const isCustom = t.kind === 'custom';
              return (
                <div key={t.id} className="relative">
                  <button
                    type="button"
                    onClick={() => setSelectedId(t.id)}
                    className={cn(
                      'flex w-full flex-col gap-0.5 rounded-xl border px-3 py-2.5 text-left transition-colors',
                      isCustom && canWrite ? 'pr-9' : '',
                      on
                        ? 'border-[color:var(--color-blush-400)] bg-[color:var(--color-surface-elevated)]'
                        : 'border-[color:var(--color-border)] hover:border-[color:var(--color-border-strong)]',
                    )}
                  >
                    <b className="truncate text-sm text-[color:var(--color-foreground)]">
                      {t.label}
                    </b>
                    <span className="font-mono text-[10px] text-[color:var(--color-muted-foreground)] tabular-nums">
                      {t.tasks.length} tâches{isCustom ? ' · maison' : ''}
                    </span>
                  </button>
                  {isCustom && canWrite ? (
                    <button
                      type="button"
                      onClick={() => onDelete(t.id)}
                      aria-label={`Supprimer le modèle ${t.label}`}
                      className="focus-ring absolute top-1.5 right-1.5 rounded-md p-1 text-[color:var(--color-muted-foreground)] transition-colors hover:text-[color:var(--color-danger)]"
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>

          <div className="flex flex-col gap-3 overflow-y-auto rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-elevated)]/40 p-3">
            {grouped.length === 0 ? (
              <p className="px-1 py-4 text-center text-sm text-[color:var(--color-muted-foreground)]">
                Ce modèle ne contient aucune tâche.
              </p>
            ) : (
              grouped.map((col) => (
                <div key={col.phase} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[9px] tracking-[0.18em] text-[color:var(--color-muted-foreground)] uppercase">
                      {col.label}
                    </span>
                    {jBadge(col.phase) ? (
                      <span className="rounded-full bg-[color:var(--color-surface)] px-1.5 py-0.5 font-mono text-[9px] text-[color:var(--color-muted-foreground)] tabular-nums">
                        {jBadge(col.phase)}
                      </span>
                    ) : null}
                  </div>
                  <ul className="flex flex-col gap-1 pl-1">
                    {col.items.map((t, i) => (
                      <li
                        key={i}
                        className="flex items-center gap-2 text-sm text-[color:var(--color-foreground)]"
                      >
                        <span
                          className="h-1 w-1 flex-shrink-0 rounded-full bg-[color:var(--color-blush-400)]"
                          aria-hidden
                        />
                        {t.title}
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}
          </div>

          {hasTasks && count > 0 ? (
            <p className="text-xs text-[color:var(--color-muted-foreground)]">
              Les {count} tâches s’ajouteront au rétroplanning existant.
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-[color:var(--color-muted-foreground)] hover:text-[color:var(--color-foreground)]"
          >
            Annuler
          </button>
          <Button
            type="button"
            variant="primary"
            size="md"
            disabled={pending || !selected || count === 0}
            onClick={() => selected && onApply(selected)}
            data-testid="confirm-template"
          >
            <Sparkles className="h-4 w-4" strokeWidth={2} aria-hidden />
            Appliquer {count} tâches
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/*  Vue PAR PHASE                                                             */
/* -------------------------------------------------------------------------- */

function MemberDot({ name }: { name: string }) {
  const h = memberHue(name);
  return (
    <span
      title={name}
      aria-label={`Assigné à ${name}`}
      className="inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full font-mono text-[9px] font-medium"
      style={{ background: `oklch(32% 0.045 ${h})`, color: `oklch(84% 0.06 ${h})` }}
    >
      {memberInitials(name)}
    </span>
  );
}

function PhaseView({
  tasks,
  now,
  canWrite,
  memberById,
  onCycle,
  onRemove,
  onAdd,
  onEdit,
}: {
  tasks: PlanningTaskRow[];
  now: number;
  canWrite: boolean;
  memberById: Map<string, string>;
  onCycle: (t: PlanningTaskRow) => void;
  onRemove: (t: PlanningTaskRow) => void;
  onAdd: (phase: PlanningPhase) => void;
  onEdit: (t: PlanningTaskRow) => void;
}) {
  const columns = groupByPhase(tasks).filter((c) => c.total > 0);
  return (
    <div className="flex flex-col gap-3">
      {columns.map((col) => {
        const late = col.items.filter(
          (t) => !t.done && t.dueDate != null && t.dueDate < now,
        ).length;
        return (
          <section
            key={col.phase}
            className="overflow-hidden rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)]"
          >
            <div className="flex items-center justify-between border-b border-[color:var(--color-border)] px-4 py-3">
              <div className="flex items-center gap-2.5">
                <h2 className="font-mono text-base font-semibold tracking-[0.08em] text-[color:var(--color-foreground)] uppercase">
                  {col.label}
                </h2>
                {late > 0 ? (
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-mono text-[9px] text-[color:var(--color-danger)]"
                    style={{ background: 'oklch(28% 0.06 25)' }}
                  >
                    {late} en retard
                  </span>
                ) : null}
              </div>
              <span className="font-mono text-[10px] text-[color:var(--color-muted-foreground)] tabular-nums">
                {col.done}/{col.total}
              </span>
            </div>
            <ul>
              {col.items.map((t) => (
                <li
                  key={t._id}
                  className="flex items-center gap-3 border-b border-[color:var(--color-border)] px-4 py-2.5 last:border-0"
                >
                  <StatusPill status={t.status} onClick={canWrite ? () => onCycle(t) : undefined} />
                  {canWrite ? (
                    <button
                      type="button"
                      onClick={() => onEdit(t)}
                      className={cn(
                        'focus-ring flex-1 rounded text-left text-sm transition-colors hover:text-[color:var(--color-blush-300)]',
                        t.done
                          ? 'text-[color:var(--color-muted-foreground)] line-through'
                          : 'text-[color:var(--color-foreground)]',
                      )}
                    >
                      {t.title}
                    </button>
                  ) : (
                    <span
                      className={cn(
                        'flex-1 text-sm',
                        t.done
                          ? 'text-[color:var(--color-muted-foreground)] line-through'
                          : 'text-[color:var(--color-foreground)]',
                      )}
                    >
                      {t.title}
                    </span>
                  )}
                  {t.subtasks && t.subtasks.length > 0 ? (
                    <span
                      className="inline-flex flex-shrink-0 items-center gap-1 font-mono text-[10px] text-[color:var(--color-muted-foreground)] tabular-nums"
                      title="Sous-tâches"
                    >
                      <Check className="h-3 w-3" strokeWidth={2.4} aria-hidden />
                      {t.subtasks.filter((s) => s.done).length}/{t.subtasks.length}
                    </span>
                  ) : null}
                  {t.notes ? (
                    <StickyNote
                      className="h-3.5 w-3.5 flex-shrink-0 text-[color:var(--color-muted-foreground)]"
                      strokeWidth={1.8}
                      aria-label="A une note"
                    />
                  ) : null}
                  {t.assigneeId && memberById.has(t.assigneeId) ? (
                    <MemberDot name={memberById.get(t.assigneeId)!} />
                  ) : null}
                  {t.dueDate ? <DueBadge dueDate={t.dueDate} now={now} done={t.done} /> : null}
                  {canWrite ? (
                    <button
                      type="button"
                      onClick={() => onRemove(t)}
                      aria-label={`Supprimer ${t.title}`}
                      className="focus-ring rounded-md p-1 text-[color:var(--color-muted-foreground)] hover:text-[color:var(--color-danger)]"
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={1.85} />
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
            {canWrite ? (
              <button
                type="button"
                onClick={() => onAdd(col.phase)}
                className="focus-ring flex w-full items-center gap-2 border-t border-[color:var(--color-border)] px-4 py-2 text-left text-xs text-[color:var(--color-muted-foreground)] transition-colors hover:bg-[color:var(--color-surface-elevated)] hover:text-[color:var(--color-foreground)]"
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                Ajouter une tâche
              </button>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Vue TABLEAU (kanban tri-état)                                             */
/* -------------------------------------------------------------------------- */

function BoardView({
  tasks,
  now,
  canWrite,
  onMove,
}: {
  tasks: PlanningTaskRow[];
  now: number;
  canWrite: boolean;
  onMove: (t: PlanningTaskRow, status: TaskStatus) => void;
}) {
  const columns = groupByStatus(tasks);
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const activeTask = activeId ? (tasks.find((t) => t._id === activeId) ?? null) : null;

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }
  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const overId = e.over?.id;
    if (!overId) return;
    const status = String(overId) as TaskStatus;
    if (!PLANNING_STATUSES.includes(status)) return;
    const task = tasks.find((t) => t._id === String(e.active.id));
    if (task && task.status !== status) onMove(task, status);
  }

  const grid = (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {columns.map((col) => (
        <KanbanColumn
          key={col.status}
          status={col.status}
          label={col.label}
          count={col.items.length}
          droppable={canWrite}
        >
          {col.items.length === 0 ? (
            <p className="rounded-xl border border-dashed border-[color:var(--color-border)] px-3 py-6 text-center text-xs text-[color:var(--color-muted-foreground)]">
              Aucune tâche
            </p>
          ) : (
            col.items.map((t) => (
              <KanbanCard
                key={t._id}
                task={t}
                now={now}
                canWrite={canWrite}
                onMove={onMove}
                dragging={activeId === t._id}
              />
            ))
          )}
        </KanbanColumn>
      ))}
    </div>
  );

  if (!canWrite) return grid;

  return (
    <DndContext
      id="planning-kanban"
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      {grid}
      <DragOverlay>
        {activeTask ? <KanbanCardFace task={activeTask} now={now} dragging /> : null}
      </DragOverlay>
    </DndContext>
  );
}

function KanbanColumn({
  status,
  label,
  count,
  droppable,
  children,
}: {
  status: TaskStatus;
  label: string;
  count: number;
  droppable: boolean;
  children: React.ReactNode;
}) {
  const tone = STATUS_TONE[status];
  const { setNodeRef, isOver } = useDroppable({ id: status, disabled: !droppable });
  return (
    <section
      ref={setNodeRef}
      className={cn(
        'flex flex-col gap-3 rounded-2xl border bg-[color:var(--color-surface)] p-3 transition-colors',
        isOver ? 'border-[color:var(--color-blush-400)]' : 'border-[color:var(--color-border)]',
      )}
    >
      <div className="flex items-center justify-between px-1">
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[color:var(--color-foreground)]">
          <span className="h-2 w-2 rounded-full" style={{ background: tone.dot }} aria-hidden />
          {label}
        </span>
        <span className="font-mono text-[10px] text-[color:var(--color-muted-foreground)] tabular-nums">
          {count}
        </span>
      </div>
      <div className="flex min-h-[40px] flex-col gap-2">{children}</div>
    </section>
  );
}

function KanbanCard({
  task,
  now,
  canWrite,
  onMove,
  dragging,
}: {
  task: PlanningTaskRow;
  now: number;
  canWrite: boolean;
  onMove: (t: PlanningTaskRow, status: TaskStatus) => void;
  dragging: boolean;
}) {
  const { attributes, listeners, setNodeRef } = useDraggable({ id: task._id, disabled: !canWrite });
  return (
    <article
      ref={setNodeRef}
      className={cn(
        'flex flex-col gap-2 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-elevated)] p-3',
        dragging && 'opacity-40',
      )}
    >
      <p
        {...(canWrite ? { ...attributes, ...listeners } : {})}
        className={cn(
          'text-sm',
          canWrite && 'cursor-grab active:cursor-grabbing',
          task.done
            ? 'text-[color:var(--color-muted-foreground)] line-through'
            : 'text-[color:var(--color-foreground)]',
        )}
      >
        {task.title}
      </p>
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5">
          <PhaseChip phase={task.phase} />
          {task.dueDate ? <DueBadge dueDate={task.dueDate} now={now} done={task.done} /> : null}
        </span>
        {canWrite ? <KanbanArrows task={task} onMove={onMove} /> : null}
      </div>
    </article>
  );
}

/** Aperçu statique de carte (DragOverlay). */
function KanbanCardFace({
  task,
  now,
  dragging,
}: {
  task: PlanningTaskRow;
  now: number;
  dragging?: boolean;
}) {
  return (
    <article
      className={cn(
        'flex w-[var(--overlay-w,260px)] flex-col gap-2 rounded-xl border border-[color:var(--color-blush-400)] bg-[color:var(--color-surface-elevated)] p-3 shadow-[var(--shadow-lifted)]',
        dragging && 'rotate-1',
      )}
    >
      <p
        className={cn(
          'text-sm',
          task.done
            ? 'text-[color:var(--color-muted-foreground)] line-through'
            : 'text-[color:var(--color-foreground)]',
        )}
      >
        {task.title}
      </p>
      <span className="inline-flex items-center gap-1.5">
        <PhaseChip phase={task.phase} />
        {task.dueDate ? <DueBadge dueDate={task.dueDate} now={now} done={task.done} /> : null}
      </span>
    </article>
  );
}

function KanbanArrows({
  task,
  onMove,
}: {
  task: PlanningTaskRow;
  onMove: (t: PlanningTaskRow, status: TaskStatus) => void;
}) {
  const idx = PLANNING_STATUSES.indexOf(task.status);
  return (
    <span className="flex items-center gap-0.5">
      <button
        type="button"
        disabled={idx === 0}
        onClick={() => onMove(task, PLANNING_STATUSES[idx - 1]!)}
        aria-label={`Déplacer « ${task.title} » vers la gauche`}
        className="focus-ring rounded-md p-1 text-[color:var(--color-muted-foreground)] transition-colors hover:text-[color:var(--color-foreground)] disabled:opacity-30"
      >
        <ChevronLeft className="h-4 w-4" strokeWidth={2} aria-hidden />
      </button>
      <button
        type="button"
        disabled={idx === PLANNING_STATUSES.length - 1}
        onClick={() => onMove(task, PLANNING_STATUSES[idx + 1]!)}
        aria-label={`Déplacer « ${task.title} » vers la droite`}
        className="focus-ring rounded-md p-1 text-[color:var(--color-muted-foreground)] transition-colors hover:text-[color:var(--color-foreground)] disabled:opacity-30"
      >
        <ChevronRight className="h-4 w-4" strokeWidth={2} aria-hidden />
      </button>
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/*  Vue FRISE (timeline)                                                      */
/* -------------------------------------------------------------------------- */

function FriseView({
  tasks,
  now,
  eventDate,
}: {
  tasks: PlanningTaskRow[];
  now: number;
  eventDate: number | null;
}) {
  const { dated, undatedCount, upcoming, firstUpcomingIdx } = useMemo(() => {
    const withDue = tasks.filter((t) => t.dueDate != null) as Array<
      PlanningTaskRow & { dueDate: number }
    >;
    withDue.sort((a, b) => a.dueDate - b.dueDate);
    const up = withDue.filter((t) => !t.done && t.dueDate >= now).slice(0, 4);
    // Index de la première tâche dont l'échéance est aujourd'hui ou à venir
    // (sépare passé / futur sur la frise). -1 si tout est passé.
    const idx = withDue.findIndex((t) => t.dueDate >= now);
    return {
      dated: withDue,
      undatedCount: tasks.length - withDue.length,
      upcoming: up,
      firstUpcomingIdx: idx,
    };
  }, [tasks, now]);

  return (
    <div className="flex flex-col gap-5">
      {/* Prochaines échéances */}
      <section className="flex flex-col gap-3 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg text-[color:var(--color-foreground)] italic">
            Prochaines échéances
          </h2>
          {eventDate ? (
            <span className="inline-flex items-center gap-1.5 font-mono text-[10px] tracking-[0.14em] text-[color:var(--color-muted-foreground)] uppercase">
              <Calendar className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden /> Jour J ·{' '}
              {formatDateFr(eventDate)}
            </span>
          ) : null}
        </div>
        {upcoming.length === 0 ? (
          <p className="text-sm text-[color:var(--color-muted-foreground)]">
            Aucune échéance à venir.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {upcoming.map((t) => (
              <div
                key={t._id}
                className="flex items-center gap-3 rounded-xl border border-[color:var(--color-border)] px-3.5 py-2.5"
              >
                <DueBadge dueDate={t.dueDate} now={now} done={t.done} />
                <span className="flex-1 truncate text-sm text-[color:var(--color-foreground)]">
                  {t.title}
                </span>
                <PhaseChip phase={t.phase} />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Timeline */}
      {dated.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[color:var(--color-border-strong)] bg-[color:var(--color-surface)]/40 px-8 py-12 text-center text-sm text-[color:var(--color-muted-foreground)]">
          Aucune tâche datée. Ajoutez des échéances pour afficher la frise.
        </p>
      ) : (
        <ol className="relative flex flex-col gap-1 border-l border-[color:var(--color-border)] pl-6">
          {dated.map((t, i) => {
            const info = dueInfo(t.dueDate, now);
            const color = t.done
              ? 'var(--color-sage-500)'
              : info.kind === 'overdue'
                ? 'var(--color-danger)'
                : info.kind === 'soon' || info.kind === 'today'
                  ? 'var(--color-warning)'
                  : 'var(--color-border-strong)';
            return (
              <Fragment key={t._id}>
                {i === firstUpcomingIdx ? <TodayMarker now={now} /> : null}
                <li className="relative flex items-center gap-3 py-2">
                  <span
                    className="absolute top-1/2 left-[-1.5rem] h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[color:var(--color-surface)]"
                    style={{ background: color }}
                    aria-hidden
                  />
                  <span className="w-24 flex-shrink-0 font-mono text-[11px] text-[color:var(--color-muted-foreground)] tabular-nums">
                    {formatDateFr(t.dueDate)}
                  </span>
                  <DueBadge dueDate={t.dueDate} now={now} done={t.done} />
                  <span
                    className={cn(
                      'flex-1 truncate text-sm',
                      t.done
                        ? 'text-[color:var(--color-muted-foreground)] line-through'
                        : 'text-[color:var(--color-foreground)]',
                    )}
                  >
                    {t.title}
                  </span>
                  <PhaseChip phase={t.phase} />
                </li>
              </Fragment>
            );
          })}
          {/* Tout est passé → repère en bas de frise. */}
          {firstUpcomingIdx === -1 ? <TodayMarker now={now} /> : null}
        </ol>
      )}

      {undatedCount > 0 ? (
        <p className="font-mono text-[11px] text-[color:var(--color-muted-foreground)]">
          + {undatedCount} tâche{undatedCount > 1 ? 's' : ''} sans échéance
        </p>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Petites parties                                                          */
/* -------------------------------------------------------------------------- */

/** Repère « Aujourd'hui » inséré dans la frise entre passé et à-venir. */
function TodayMarker({ now }: { now: number }) {
  return (
    <li className="relative flex items-center gap-3 py-1.5" aria-label="Aujourd'hui">
      <span
        className="absolute top-1/2 left-[-1.5rem] h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[color:var(--color-surface)] ring-2 ring-[color:var(--color-blush-400)]/40"
        style={{ background: 'var(--color-blush-400)' }}
        aria-hidden
      />
      <span className="w-24 flex-shrink-0 font-mono text-[11px] font-medium text-[color:var(--color-blush-300)] tabular-nums">
        {formatDateFr(now)}
      </span>
      <span className="inline-flex items-center rounded-full bg-[color:var(--color-blush-500)]/15 px-2 py-0.5 font-mono text-[9px] tracking-[0.14em] text-[color:var(--color-blush-300)] uppercase">
        Aujourd’hui
      </span>
      <span
        className="h-px flex-1 bg-gradient-to-r from-[color:var(--color-blush-400)]/40 to-transparent"
        aria-hidden
      />
    </li>
  );
}

function StatusPill({ status, onClick }: { status: TaskStatus; onClick?: () => void }) {
  const tone = STATUS_TONE[status];
  const inner = (
    <>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: tone.dot }} aria-hidden />
      {STATUS_LABEL[status]}
    </>
  );
  if (!onClick) {
    return (
      <span
        className="inline-flex w-[88px] flex-shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium"
        style={{ background: tone.bg, color: tone.fg }}
      >
        {inner}
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Statut : ${STATUS_LABEL[status]} — changer`}
      className="focus-ring inline-flex w-[88px] flex-shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-opacity hover:opacity-80"
      style={{ background: tone.bg, color: tone.fg }}
    >
      {inner}
    </button>
  );
}

function DueBadge({ dueDate, now, done }: { dueDate: number; now: number; done: boolean }) {
  if (done) {
    return (
      <span
        className="inline-flex flex-shrink-0 items-center rounded-full px-1.5 py-0.5 font-mono text-[10px] tabular-nums"
        style={{ background: 'oklch(26% 0.04 145)', color: 'oklch(82% 0.07 145)' }}
      >
        Fait
      </span>
    );
  }
  const info = dueInfo(dueDate, now);
  const style =
    info.kind === 'overdue'
      ? { background: 'oklch(28% 0.06 25)', color: 'oklch(85% 0.08 25)' }
      : info.kind === 'today' || info.kind === 'soon'
        ? { background: 'oklch(28% 0.022 78)', color: 'oklch(85% 0.05 78)' }
        : { background: 'var(--color-surface-elevated)', color: 'var(--color-muted-foreground)' };
  return (
    <span
      className="inline-flex flex-shrink-0 items-center rounded-full px-1.5 py-0.5 font-mono text-[10px] tabular-nums"
      style={style}
      title={info.label}
    >
      {info.badge}
    </span>
  );
}

function PhaseChip({ phase }: { phase: PlanningPhase }) {
  return (
    <span className="inline-flex flex-shrink-0 items-center rounded-md bg-[color:var(--color-surface-elevated)] px-2 py-1 font-mono text-[11px] font-medium tracking-[0.06em] text-[color:var(--color-ink-700)] uppercase">
      {PHASE_LABEL[phase]}
    </span>
  );
}

/** Carte d'avancement compacte (anneau + compteur + retards) pour l'entête. */
function ProgressCard({
  pct,
  done,
  total,
  overdue,
}: {
  pct: number;
  done: number;
  total: number;
  overdue: number;
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-5 py-3">
      <ProgressRing pct={pct} size={52} stroke={5} />
      <div className="flex flex-col gap-0.5">
        <span className="font-mono text-[9px] tracking-[0.2em] text-[color:var(--color-muted-foreground)] uppercase">
          Avancement
        </span>
        <span className="text-sm font-medium text-[color:var(--color-foreground)] tabular-nums">
          {done} / {total} tâche{total > 1 ? 's' : ''}
        </span>
        {overdue > 0 ? (
          <span className="inline-flex items-center gap-1 text-xs text-[color:var(--color-danger)]">
            <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" strokeWidth={2} aria-hidden />{' '}
            {overdue} en retard
          </span>
        ) : (
          <span className="text-xs text-[color:var(--color-muted-foreground)]">À jour</span>
        )}
      </div>
    </div>
  );
}

function ProgressRing({
  pct,
  size = 60,
  stroke = 6,
}: {
  pct: number;
  size?: number;
  stroke?: number;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div
      className="relative flex flex-shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${pct}% des tâches faites`}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ transform: 'rotate(-90deg)' }}
        aria-hidden
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-surface-elevated)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-sage-500)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${(pct / 100) * c} ${c}`}
          style={{ transition: 'stroke-dasharray .5s var(--ease-out-quint)' }}
        />
      </svg>
      <span className="absolute font-mono text-sm font-medium text-[color:var(--color-foreground)] tabular-nums">
        {pct}%
      </span>
    </div>
  );
}
