/**
 * Paiements — types + helpers purs (agrégation des échéances de factures +
 * calcul de frais), partagés UI + Convex + tests. Montants en **centimes**.
 *
 * Le ledger « Paiements » est dérivé des factures du module Devis & Factures :
 * chaque entrée d'échéancier (acompte / solde / échéance) d'une facture devient
 * une échéance encaissable. Pas d'appel Stripe réel (Connect = à brancher).
 */

export type MilestoneStatus = 'paid' | 'overdue' | 'upcoming';

export interface InvoiceLike {
  _id: string;
  number: string;
  clientName: string;
  eventId?: string;
  status: string;
  schedule?: { label: string; amountMinor: number; dueDate?: number; paid: boolean }[];
}

export interface Milestone {
  docId: string;
  docNumber: string;
  clientName: string;
  /** Index de l'entrée dans `schedule` (pour marquer payé). */
  index: number;
  label: string;
  amountMinor: number;
  dueDate?: number;
  paid: boolean;
  status: MilestoneStatus;
}

export interface PaymentsKpis {
  /** Total encaissé (échéances payées). */
  collectedMinor: number;
  /** À venir (échéances non payées, échéance future ou sans date). */
  upcomingMinor: number;
  /** En retard (échéances non payées, échéance passée). */
  overdueMinor: number;
}

export const PAY_STATUS_LABEL: Record<MilestoneStatus, string> = {
  paid: 'Payé',
  overdue: 'En retard',
  upcoming: 'À venir',
};

/* ------------------------------ mode d'encaissement ------------------------------ */

export type PaymentMode = 'byop' | 'manual';
export type PayoutSchedule = 'daily' | 'weekly' | 'manual';

export interface PaymentModeMeta {
  label: string;
  /** Commission Wedillybird : toujours 0 — la plateforme n'est jamais dans le flux. */
  commissionRate: number;
  commissionLabel: string;
  consequence: string;
  desc: string;
  recommended?: boolean;
}

/** Les 2 modes d'encaissement proposés à l'agence. */
export const PAYMENT_MODE_META: Record<PaymentMode, PaymentModeMeta> = {
  byop: {
    label: 'Mon compte Stripe',
    commissionRate: 0,
    commissionLabel: 'Commission 0 %',
    consequence:
      'Vous connectez votre propre compte Stripe : les paiements arrivent directement chez vous, sans commission Wedillybird. Vous gérez vos frais Stripe et vos litiges depuis votre tableau de bord Stripe.',
    desc: 'Encaissez en ligne (carte) via votre propre compte Stripe. L’argent va directement sur votre compte — Wedillybird ne prélève aucune commission et ne touche jamais vos fonds.',
    recommended: true,
  },
  manual: {
    label: 'Suivi manuel',
    commissionRate: 0,
    commissionLabel: 'Hors ligne',
    consequence:
      'Aucun encaissement en ligne : vous marquez chaque échéance comme réglée à la main (virement, chèque, espèces…).',
    desc: 'Pas d’encaissement en ligne. Vous suivez ici qui a payé quoi, sans connecter de compte Stripe.',
  },
};

export const PAYMENT_MODE_ORDER: PaymentMode[] = ['byop', 'manual'];

export const PAYOUT_SCHEDULE_LABEL: Record<PayoutSchedule, string> = {
  daily: 'Quotidien',
  weekly: 'Hebdomadaire',
  manual: 'Manuel',
};

export function payoutScheduleHelp(schedule: PayoutSchedule): string {
  if (schedule === 'daily') return 'Versement automatique chaque jour ouvré (défaut).';
  if (schedule === 'weekly') return 'Versement automatique chaque lundi.';
  return 'Vous déclenchez chaque versement manuellement.';
}

/* ------------------------------ termes localisés (FR) ------------------------------ */

export type TermType = 'arrhes' | 'acompte' | 'retainer';

export const TERM_LABELS: Record<TermType, { label: string; note: string }> = {
  arrhes: {
    label: 'Arrhes',
    note: 'Dédit réciproque : le couple peut renoncer en perdant les arrhes ; l’agence qui se désiste en rembourse le double (art. 1590 C. civ.).',
  },
  acompte: {
    label: 'Acompte',
    note: 'Engagement ferme : le couple s’engage à payer la totalité ; en cas d’annulation, le solde peut rester dû.',
  },
  retainer: {
    label: 'Non-refundable retainer',
    note: 'Liquidated damages — courant dans les contrats US. Le caractère exécutoire varie selon l’État.',
  },
};

export const TERM_DISCLAIMER =
  'Le caractère remboursable dépend du contrat de l’agence et du droit local.';

/* ------------------------------ type d'échéance (par position) ------------------------------ */

export type MilestoneType = 'acompte' | 'echeance' | 'solde';

export const TX_TYPE_LABEL: Record<MilestoneType, string> = {
  acompte: 'Acompte',
  echeance: 'Échéance',
  solde: 'Solde',
};

/** Déduit le type d'une échéance depuis sa position : 1re = acompte, dernière = solde. */
export function milestoneType(index: number, total: number): MilestoneType {
  if (index === 0) return 'acompte';
  if (index >= total - 1) return 'solde';
  return 'echeance';
}

export function milestoneStatus(
  paid: boolean,
  dueDate: number | undefined,
  now: number,
): MilestoneStatus {
  if (paid) return 'paid';
  if (dueDate != null && dueDate < now) return 'overdue';
  return 'upcoming';
}

/* ------------------------------ échéancier par facture (Screen C) ------------------------------ */

export interface PaymentPlanMilestone extends Milestone {
  type: MilestoneType;
}

export interface PaymentPlan {
  docId: string;
  docNumber: string;
  clientName: string;
  eventId?: string;
  totalMinor: number;
  paidMinor: number;
  /** Nombre d'échéances réglées / total (ex. « 1 / 3 réglé »). */
  paidCount: number;
  totalCount: number;
  milestones: PaymentPlanMilestone[];
}

/**
 * Regroupe les échéances par facture → un « plan de paiement » par couple,
 * pour l'écran Échéancier. Les factures sans échéancier sont ignorées.
 */
export function buildPlans(invoices: InvoiceLike[], now: number): PaymentPlan[] {
  const plans: PaymentPlan[] = [];
  for (const inv of invoices) {
    if (!inv.schedule?.length) continue;
    const total = inv.schedule.length;
    const milestones: PaymentPlanMilestone[] = inv.schedule.map((s, index) => ({
      docId: inv._id,
      docNumber: inv.number,
      clientName: inv.clientName,
      index,
      label: s.label,
      amountMinor: s.amountMinor,
      dueDate: s.dueDate,
      paid: s.paid,
      status: milestoneStatus(s.paid, s.dueDate, now),
      type: milestoneType(index, total),
    }));
    plans.push({
      docId: inv._id,
      docNumber: inv.number,
      clientName: inv.clientName,
      eventId: inv.eventId,
      totalMinor: milestones.reduce((acc, m) => acc + m.amountMinor, 0),
      paidMinor: milestones.reduce((acc, m) => acc + (m.paid ? m.amountMinor : 0), 0),
      paidCount: milestones.filter((m) => m.paid).length,
      totalCount: total,
      milestones,
    });
  }
  return plans;
}

/** Prochaine échéance non réglée (date la plus proche dans le futur), ou null. */
export function nextDueMilestone(milestones: Milestone[], now: number): Milestone | null {
  const upcoming = milestones
    .filter((m) => !m.paid && m.dueDate != null && m.dueDate >= now)
    .sort((a, b) => (a.dueDate ?? 0) - (b.dueDate ?? 0));
  return upcoming[0] ?? null;
}

/** Construit le ledger (échéances triées par date) + les KPIs depuis les factures. */
export function buildLedger(
  invoices: InvoiceLike[],
  now: number,
): { milestones: Milestone[]; kpis: PaymentsKpis } {
  const milestones: Milestone[] = [];
  for (const inv of invoices) {
    if (!inv.schedule?.length) continue;
    inv.schedule.forEach((s, index) => {
      milestones.push({
        docId: inv._id,
        docNumber: inv.number,
        clientName: inv.clientName,
        index,
        label: s.label,
        amountMinor: s.amountMinor,
        dueDate: s.dueDate,
        paid: s.paid,
        status: milestoneStatus(s.paid, s.dueDate, now),
      });
    });
  }
  milestones.sort((a, b) => (b.dueDate ?? 0) - (a.dueDate ?? 0));

  const kpis: PaymentsKpis = { collectedMinor: 0, upcomingMinor: 0, overdueMinor: 0 };
  for (const m of milestones) {
    if (m.status === 'paid') kpis.collectedMinor += m.amountMinor;
    else if (m.status === 'overdue') kpis.overdueMinor += m.amountMinor;
    else kpis.upcomingMinor += m.amountMinor;
  }
  return { milestones, kpis };
}

/* ------------------------------ frais ------------------------------ */

export type PayoutCountry = 'FR' | 'US' | 'CA';

export interface FeeBreakdown {
  clientPaysMinor: number;
  stripeFeeMinor: number;
  platformCommissionMinor: number;
  netReceivedMinor: number;
}

/** Frais Stripe estimés (FR/EU 1,5 % + 0,25 € ; US/CA 2,9 % + 0,30 €). */
export function stripeFeeMinor(amountMinor: number, country: PayoutCountry = 'FR'): number {
  const pct = country === 'FR' ? 0.015 : 0.029;
  const fixedMinor = country === 'FR' ? 25 : 30;
  return Math.round(amountMinor * pct) + fixedMinor;
}

/**
 * Décompose un encaissement : frais Stripe + commission plateforme (0 % par
 * défaut — Wedillybird n'est plus dans le flux) → net reçu. Ex.
 * computeFee(540000) ≈ stripe 8125, commission 0, net 531875.
 */
export function computeFee(
  clientPaysMinor: number,
  commissionRate = 0,
  country: PayoutCountry = 'FR',
): FeeBreakdown {
  const stripe = stripeFeeMinor(clientPaysMinor, country);
  const commission = Math.round(clientPaysMinor * commissionRate);
  return {
    clientPaysMinor,
    stripeFeeMinor: stripe,
    platformCommissionMinor: commission,
    netReceivedMinor: clientPaysMinor - stripe - commission,
  };
}
