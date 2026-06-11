/**
 * Budget mariage — types et helpers purs (totaux, regroupement, statut de ligne).
 * Partagés UI + tests.
 */

export const BUDGET_CATEGORIES = [
  'Lieu',
  'Traiteur',
  'Photo / Vidéo',
  'Décoration & Fleurs',
  'Tenues',
  'Musique / DJ',
  'Papeterie',
  'Transport',
  'Divers',
] as const;

export type BudgetCategory = (typeof BUDGET_CATEGORIES)[number];

export interface BudgetLineLike {
  category: string;
  plannedMinor: number;
  paidMinor: number;
  dueDate?: number;
}

export type LineStatus = 'todo' | 'partial' | 'paid' | 'overdue';

/** Statut d'une ligne. `overdue` si échéance passée et pas entièrement payée. */
export function lineStatus(line: BudgetLineLike, now: number): LineStatus {
  const fullyPaid = line.plannedMinor > 0 && line.paidMinor >= line.plannedMinor;
  if (fullyPaid) return 'paid';
  if (line.dueDate != null && line.dueDate < now && line.paidMinor < line.plannedMinor) {
    return 'overdue';
  }
  if (line.paidMinor > 0) return 'partial';
  return 'todo';
}

/* ----------------------------- paiements ----------------------------- */

export type PaymentMethod = 'transfer' | 'card' | 'cash' | 'check' | 'online' | 'other';

export const PAYMENT_METHODS: readonly PaymentMethod[] = [
  'transfer',
  'card',
  'cash',
  'check',
  'online',
  'other',
] as const;

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  transfer: 'Virement',
  card: 'Carte',
  cash: 'Espèces',
  check: 'Chèque',
  online: 'Paiement en ligne',
  other: 'Autre',
};

export type PaymentStatus = 'succeeded' | 'pending' | 'failed';

export interface BudgetPaymentLike {
  amountMinor: number;
  status: PaymentStatus;
}

/** Somme des paiements encaissés (`succeeded`) d'une ligne, en centimes. */
export function sumPaidMinor(payments: readonly BudgetPaymentLike[]): number {
  let total = 0;
  for (const p of payments) {
    if (p.status === 'succeeded') total += p.amountMinor;
  }
  return total;
}

export interface BudgetSummary {
  plannedMinor: number;
  paidMinor: number;
  remainingMinor: number;
  /** Au moins une ligne où payé > prévu. */
  overPaid: boolean;
  lineCount: number;
}

export function summarizeBudget(lines: readonly BudgetLineLike[]): BudgetSummary {
  let plannedMinor = 0;
  let paidMinor = 0;
  let overPaid = false;
  for (const l of lines) {
    plannedMinor += l.plannedMinor;
    paidMinor += l.paidMinor;
    if (l.paidMinor > l.plannedMinor) overPaid = true;
  }
  return {
    plannedMinor,
    paidMinor,
    remainingMinor: plannedMinor - paidMinor,
    overPaid,
    lineCount: lines.length,
  };
}

export interface CategoryGroup<T extends BudgetLineLike> {
  category: string;
  items: T[];
  plannedMinor: number;
  paidMinor: number;
}

/**
 * Regroupe les lignes par catégorie. L'ordre suit `BUDGET_CATEGORIES`, puis les
 * catégories hors-liste (custom) en fin, par ordre d'apparition. Catégories
 * vides exclues.
 */
export function groupByCategory<T extends BudgetLineLike>(lines: readonly T[]): CategoryGroup<T>[] {
  const groups = new Map<string, CategoryGroup<T>>();
  const order: string[] = [];
  for (const l of lines) {
    let g = groups.get(l.category);
    if (!g) {
      g = { category: l.category, items: [], plannedMinor: 0, paidMinor: 0 };
      groups.set(l.category, g);
      order.push(l.category);
    }
    g.items.push(l);
    g.plannedMinor += l.plannedMinor;
    g.paidMinor += l.paidMinor;
  }
  const rank = (cat: string) => {
    const i = (BUDGET_CATEGORIES as readonly string[]).indexOf(cat);
    return i === -1 ? BUDGET_CATEGORIES.length + order.indexOf(cat) : i;
  };
  return [...groups.values()].sort((a, b) => rank(a.category) - rank(b.category));
}

/* ------------------------- catégories (teintes) ------------------------- */

/** Teinte OKLCH (hue) par catégorie — donut, barres, en-têtes de groupe. */
const CATEGORY_HUE: Record<string, number> = {
  Lieu: 22,
  Traiteur: 60,
  'Photo / Vidéo': 265,
  'Décoration & Fleurs': 340,
  Tenues: 200,
  'Musique / DJ': 150,
  Papeterie: 85,
  Transport: 30,
  Divers: 0,
};

export function categoryHue(category: string): number {
  const h = CATEGORY_HUE[category];
  if (h != null) return h;
  let acc = 0;
  for (let i = 0; i < category.length; i++) acc = (acc * 31 + category.charCodeAt(i)) % 360;
  return acc;
}

/* ----------------------------- enveloppe ----------------------------- */

export type EnvelopeState = 'under' | 'near' | 'over';

/**
 * Position du prévu par rapport à l'enveloppe (cible fixée avec le couple) :
 * `over` si prévu > enveloppe, `near` si ≥ 92 %, sinon `under`. `under` aussi
 * quand aucune enveloppe n'est définie (≤ 0).
 */
export function envelopeState(plannedMinor: number, envelopeMinor: number): EnvelopeState {
  if (envelopeMinor <= 0) return 'under';
  if (plannedMinor > envelopeMinor) return 'over';
  if (plannedMinor >= envelopeMinor * 0.92) return 'near';
  return 'under';
}

export const ENVELOPE_STATE_LABEL: Record<EnvelopeState, string> = {
  under: 'Sous l’enveloppe',
  near: 'Proche de l’enveloppe',
  over: 'Dépassement de l’enveloppe',
};

/* ------------------------------- donut ------------------------------- */

export interface DonutSegment {
  category: string;
  plannedMinor: number;
  /** Part du total prévu (0..1). */
  pct: number;
  hue: number;
}

/** Répartition du prévu par poste (catégories non vides, ordre des groupes). */
export function donutSegments(
  groups: ReadonlyArray<{ category: string; plannedMinor: number }>,
): DonutSegment[] {
  const total = groups.reduce((a, g) => a + g.plannedMinor, 0);
  return groups
    .filter((g) => g.plannedMinor > 0)
    .map((g) => ({
      category: g.category,
      plannedMinor: g.plannedMinor,
      pct: total > 0 ? g.plannedMinor / total : 0,
      hue: categoryHue(g.category),
    }));
}

/* ------------------------------ alertes ------------------------------ */

export interface BudgetAlert {
  kind: 'envelope' | 'overrun' | 'overdue';
  tone: 'danger' | 'warning';
  title: string;
  body: string;
}

/** Construit les alertes (dépassement d'enveloppe, surcoût ligne, retards). */
export function budgetAlerts(
  lines: readonly BudgetLineLike[],
  summary: BudgetSummary,
  envelopeMinor: number,
  now: number,
): BudgetAlert[] {
  const alerts: BudgetAlert[] = [];
  if (envelopeMinor > 0 && summary.plannedMinor > envelopeMinor) {
    alerts.push({
      kind: 'envelope',
      tone: 'danger',
      title: 'Budget dépassé',
      body: `Le prévu dépasse l’enveloppe de ${(summary.plannedMinor - envelopeMinor) / 100} €.`,
    });
  }
  const over = lines.filter((l) => l.paidMinor > l.plannedMinor).length;
  if (over > 0) {
    alerts.push({
      kind: 'overrun',
      tone: 'danger',
      title: 'Surcoût détecté',
      body:
        over === 1
          ? 'Une ligne a été payée au-delà du montant prévu.'
          : `${over} lignes ont été payées au-delà du prévu.`,
    });
  }
  const late = lines.filter(
    (l) => l.dueDate != null && l.dueDate < now && l.paidMinor < l.plannedMinor,
  ).length;
  if (late > 0) {
    alerts.push({
      kind: 'overdue',
      tone: 'warning',
      title: 'Paiement en retard',
      body:
        late === 1
          ? 'Une échéance est dépassée et non soldée.'
          : `${late} échéances sont dépassées et non soldées.`,
    });
  }
  return alerts;
}
