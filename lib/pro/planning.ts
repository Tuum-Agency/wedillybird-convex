/**
 * Rétroplanning — types, phases, helpers purs et modèles. Partagés UI + tests.
 */

export const PLANNING_PHASES = ['m12', 'm6', 'm3', 'm1', 'd7', 'dday', 'after'] as const;
export type PlanningPhase = (typeof PLANNING_PHASES)[number];

export const PHASE_LABEL: Record<PlanningPhase, string> = {
  m12: '12 mois & +',
  m6: '6 mois',
  m3: '3 mois',
  m1: '1 mois',
  d7: 'J-7',
  dday: 'Jour J',
  after: 'Après',
};

export function isPlanningPhase(value: unknown): value is PlanningPhase {
  return typeof value === 'string' && (PLANNING_PHASES as readonly string[]).includes(value);
}

export interface TaskLike {
  phase: PlanningPhase;
  done: boolean;
}

export interface PhaseColumn<T extends TaskLike> {
  phase: PlanningPhase;
  label: string;
  items: T[];
  done: number;
  total: number;
}

/** Regroupe par phase (ordre canonique). Option `includeEmpty` pour la vue par phase. */
export function groupByPhase<T extends TaskLike>(
  tasks: readonly T[],
  includeEmpty = true,
): PhaseColumn<T>[] {
  return PLANNING_PHASES.map((phase) => {
    const items = tasks.filter((t) => t.phase === phase);
    return {
      phase,
      label: PHASE_LABEL[phase],
      items,
      done: items.filter((t) => t.done).length,
      total: items.length,
    };
  }).filter((c) => includeEmpty || c.total > 0);
}

export interface PlanningProgress {
  done: number;
  total: number;
  pct: number;
}

export function planningProgress(tasks: readonly TaskLike[]): PlanningProgress {
  const total = tasks.length;
  const done = tasks.filter((t) => t.done).length;
  return { done, total, pct: total === 0 ? 0 : Math.round((done / total) * 100) };
}

export interface TemplateTask {
  phase: PlanningPhase;
  title: string;
}

/** Modèle « mariage classique » (~16 tâches). */
export const TEMPLATE_CLASSIC: ReadonlyArray<TemplateTask> = [
  { phase: 'm12', title: 'Définir le budget global' },
  { phase: 'm12', title: 'Choisir et réserver le lieu' },
  { phase: 'm12', title: 'Établir la liste des invités' },
  { phase: 'm6', title: 'Réserver le traiteur' },
  { phase: 'm6', title: 'Réserver le photographe / vidéaste' },
  { phase: 'm6', title: 'Choisir les tenues des mariés' },
  { phase: 'm3', title: 'Envoyer les faire-part' },
  { phase: 'm3', title: 'Réserver le DJ / groupe' },
  { phase: 'm3', title: 'Commander les fleurs et la décoration' },
  { phase: 'm1', title: 'Finaliser le plan de table' },
  { phase: 'm1', title: 'Confirmer le menu final avec le traiteur' },
  { phase: 'm1', title: 'Relancer les invités sans réponse' },
  { phase: 'd7', title: 'Briefer les prestataires sur le déroulé' },
  { phase: 'd7', title: 'Préparer la trousse de secours jour J' },
  { phase: 'dday', title: 'Coordonner l’arrivée des prestataires' },
  { phase: 'after', title: 'Envoyer les remerciements et la galerie photos' },
];

/** Modèle « mariage intime » (~9 tâches). */
export const TEMPLATE_INTIMATE: ReadonlyArray<TemplateTask> = [
  { phase: 'm6', title: 'Réserver le lieu intimiste' },
  { phase: 'm6', title: 'Définir le budget global' },
  { phase: 'm3', title: 'Réserver le traiteur ou le restaurant' },
  { phase: 'm3', title: 'Réserver le photographe' },
  { phase: 'm1', title: 'Prévenir les proches (liste réduite)' },
  { phase: 'm1', title: 'Choisir les tenues' },
  { phase: 'd7', title: 'Confirmer le déroulé avec le lieu' },
  { phase: 'dday', title: 'Coordonner la journée' },
  { phase: 'after', title: 'Partager la galerie photos' },
];

export const PLANNING_TEMPLATES = {
  classic: { label: 'Mariage classique', tasks: TEMPLATE_CLASSIC },
  intimate: { label: 'Mariage intime', tasks: TEMPLATE_INTIMATE },
} as const;

export type TemplateKey = keyof typeof PLANNING_TEMPLATES;

export function isTemplateKey(value: unknown): value is TemplateKey {
  return value === 'classic' || value === 'intimate';
}

/* -------------------------------------------------------------------------- */
/*  Statut tri-état (vue Tableau / kanban)                                    */
/* -------------------------------------------------------------------------- */

export const PLANNING_STATUSES = ['todo', 'doing', 'done'] as const;
export type TaskStatus = (typeof PLANNING_STATUSES)[number];

export const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: 'À faire',
  doing: 'En cours',
  done: 'Fait',
};

/** Couleurs de pastille par statut (univers dark). */
export const STATUS_TONE: Record<TaskStatus, { bg: string; fg: string; dot: string }> = {
  todo: {
    bg: 'var(--color-surface-elevated)',
    fg: 'var(--color-muted-foreground)',
    dot: 'var(--color-muted-foreground)',
  },
  doing: { bg: 'oklch(28% 0.022 78)', fg: 'oklch(85% 0.05 78)', dot: 'oklch(78% 0.08 78)' },
  done: { bg: 'oklch(26% 0.04 145)', fg: 'oklch(82% 0.07 145)', dot: 'oklch(72% 0.08 145)' },
};

/** Cycle de statut au clic sur la pastille : À faire → En cours → Fait → À faire. */
export function nextStatus(s: TaskStatus): TaskStatus {
  return s === 'todo' ? 'doing' : s === 'doing' ? 'done' : 'todo';
}

export function isTaskStatus(value: unknown): value is TaskStatus {
  return value === 'todo' || value === 'doing' || value === 'done';
}

export interface StatusLike {
  status: TaskStatus;
}

export interface StatusColumn<T extends StatusLike> {
  status: TaskStatus;
  label: string;
  items: T[];
}

/** Regroupe par statut (ordre canonique todo/doing/done) pour la vue Tableau. */
export function groupByStatus<T extends StatusLike>(tasks: readonly T[]): StatusColumn<T>[] {
  return PLANNING_STATUSES.map((status) => ({
    status,
    label: STATUS_LABEL[status],
    items: tasks.filter((t) => t.status === status),
  }));
}

/* -------------------------------------------------------------------------- */
/*  Échéances relatives (overdue / soon)                                      */
/* -------------------------------------------------------------------------- */

export type DueKind = 'overdue' | 'today' | 'soon' | 'ok';

export interface DueInfo {
  kind: DueKind;
  days: number;
  /** Libellé long (« En retard de 3 j », « Dans 12 j », « Aujourd'hui »). */
  label: string;
  /** Badge court (« J+3 », « Jour J », « J−12 »). */
  badge: string;
}

/** État d'échéance relatif à `now` (passé en argument → testable + hydration-safe). */
export function dueInfo(dueDate: number, now: number): DueInfo {
  const days = Math.ceil((dueDate - now) / 86_400_000);
  const badge = days < 0 ? `J+${-days}` : days === 0 ? 'Jour J' : `J−${days}`;
  if (days < 0) return { kind: 'overdue', days, label: `En retard de ${-days} j`, badge };
  if (days === 0) return { kind: 'today', days, label: "Aujourd'hui", badge };
  if (days <= 21) return { kind: 'soon', days, label: `Dans ${days} j`, badge };
  return { kind: 'ok', days, label: `Dans ${days} j`, badge };
}

/** Nombre de tâches non faites dont l'échéance est dépassée. */
export function overdueCount(
  tasks: readonly { done: boolean; dueDate?: number }[],
  now: number,
): number {
  return tasks.filter((t) => !t.done && t.dueDate != null && t.dueDate < now).length;
}
