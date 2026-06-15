/**
 * CRM clients — types et helpers purs (pipeline) partagés UI + tests.
 */

export const CLIENT_STAGES = [
  'lead',
  'contacted',
  'quote',
  'booked',
  'in_progress',
  'delivered',
] as const;

export type ClientStage = (typeof CLIENT_STAGES)[number];

export const CLIENT_STAGE_LABEL: Record<ClientStage, string> = {
  lead: 'Lead',
  contacted: 'Contacté',
  quote: 'Devis envoyé',
  booked: 'Réservé',
  in_progress: 'En cours',
  delivered: 'Livré',
};

/** Libellé pluriel pour les en-têtes de colonnes kanban. */
export const CLIENT_STAGE_PLURAL: Record<ClientStage, string> = {
  lead: 'Leads',
  contacted: 'Contactés',
  quote: 'Devis envoyés',
  booked: 'Réservés',
  in_progress: 'En cours',
  delivered: 'Livrés',
};

/** Sources de lead prédéfinies. */
export const CLIENT_SOURCES = [
  'Recommandation',
  'Instagram',
  'Salon',
  'Site web',
  'Autre',
] as const;

export function isClientStage(value: unknown): value is ClientStage {
  return typeof value === 'string' && (CLIENT_STAGES as readonly string[]).includes(value);
}

export interface ClientLike {
  stage: ClientStage;
  budgetMinor?: number;
}

export interface StageColumn<T extends ClientLike> {
  stage: ClientStage;
  label: string;
  items: T[];
  count: number;
  budgetMinor: number;
}

/** Regroupe les clients par étape de pipeline (ordre canonique, colonnes vides incluses). */
export function groupByStage<T extends ClientLike>(clients: readonly T[]): StageColumn<T>[] {
  return CLIENT_STAGES.map((stage) => {
    const items = clients.filter((c) => c.stage === stage);
    const budgetMinor = items.reduce((sum, c) => sum + (c.budgetMinor ?? 0), 0);
    return { stage, label: CLIENT_STAGE_LABEL[stage], items, count: items.length, budgetMinor };
  });
}

export interface PipelineTotals {
  count: number;
  budgetMinor: number;
  /** Réservés ou au-delà (booked / in_progress / delivered). */
  bookedCount: number;
  /** Part des clients qui ont atteint au moins l'étape « réservé » (0..1). */
  conversionRate: number;
}

const BOOKED_OR_BEYOND: ReadonlySet<ClientStage> = new Set<ClientStage>([
  'booked',
  'in_progress',
  'delivered',
]);

export function pipelineTotals(clients: readonly ClientLike[]): PipelineTotals {
  const count = clients.length;
  const budgetMinor = clients.reduce((sum, c) => sum + (c.budgetMinor ?? 0), 0);
  const bookedCount = clients.filter((c) => BOOKED_OR_BEYOND.has(c.stage)).length;
  const conversionRate = count === 0 ? 0 : bookedCount / count;
  return { count, budgetMinor, bookedCount, conversionRate };
}

/** Libellé couple → initiales (« Awa & Karim » → « AK »). */
export function coupleInitials(name: string): string {
  const parts = name
    .split('&')
    .map((s) => s.trim())
    .filter(Boolean);
  const initials = parts.map((p) => p.charAt(0)).join('');
  return (initials || name.charAt(0) || '·').toUpperCase().slice(0, 2);
}

/** Teinte d'avatar dérivée du nom (hue 0–359 stable). */
export function coupleHue(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return h;
}

/** Compte à rebours en jours entiers jusqu'à `ms` (négatif si passé). null si pas de date. */
export function daysUntil(ms: number | null | undefined, now: number): number | null {
  if (ms == null) return null;
  return Math.round((ms - now) / 86_400_000);
}

/** Date relative FR (« il y a 3 h », « hier », « il y a 2 j »). */
export function relativeFr(ms: number | null | undefined, now: number): string {
  if (ms == null) return '—';
  const mins = Math.round((now - ms) / 60000);
  if (mins < 0) return 'à venir';
  if (mins < 60) return `il y a ${Math.max(1, mins)} min`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `il y a ${hrs} h`;
  const days = Math.round(hrs / 24);
  if (days === 1) return 'hier';
  if (days < 7) return `il y a ${days} j`;
  const wk = Math.round(days / 7);
  if (wk < 5) return `il y a ${wk} sem.`;
  return `il y a ${Math.round(days / 30)} mois`;
}
