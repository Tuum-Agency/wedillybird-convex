/**
 * Devis & Factures — types et helpers purs (calculs + libellés), partagés
 * UI + Convex + tests. Tous les montants sont en **centimes** (minor), comme
 * le reste du back-office (cf. budget). Les calculs n'ont aucun effet de bord.
 */

export type QuoteDocType = 'quote' | 'invoice';

/** Statuts d'un devis. */
export const QUOTE_STATUSES = ['draft', 'sent', 'accepted', 'refused', 'expired'] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

/** Statuts d'une facture. */
export const INVOICE_STATUSES = ['draft', 'sent', 'partial', 'paid', 'overdue'] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export type DocStatus = QuoteStatus | InvoiceStatus;

export interface LineItem {
  label: string;
  qty: number;
  unitPriceMinor: number;
}

export interface ScheduleEntry {
  label: string;
  amountMinor: number;
  dueDate?: number;
  paid: boolean;
}

export interface DocLike {
  type: QuoteDocType;
  lineItems: LineItem[];
  /** Remise en centimes (montant fixe) — ignorée si `discountPct` est fourni. */
  discountMinor?: number;
  /** Remise en pourcentage du sous-total. */
  discountPct?: number;
  /** Taux de TVA/taxe en pourcentage (0 par défaut). */
  taxRate?: number;
  status: DocStatus;
  schedule?: ScheduleEntry[];
}

/* ------------------------------ libellés ------------------------------ */

export const QUOTE_STATUS_LABEL: Record<QuoteStatus, string> = {
  draft: 'Brouillon',
  sent: 'Envoyé',
  accepted: 'Accepté',
  refused: 'Refusé',
  expired: 'Expiré',
};

export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  draft: 'Brouillon',
  sent: 'Envoyée',
  partial: 'Partiellement payée',
  paid: 'Payée',
  overdue: 'En retard',
};

/** Tonalité visuelle d'un statut (pour la pastille). */
export type StatusTone = 'muted' | 'info' | 'ok' | 'warn' | 'danger';

const QUOTE_TONE: Record<QuoteStatus, StatusTone> = {
  draft: 'muted',
  sent: 'info',
  accepted: 'ok',
  refused: 'danger',
  expired: 'muted',
};
const INVOICE_TONE: Record<InvoiceStatus, StatusTone> = {
  draft: 'muted',
  sent: 'info',
  partial: 'warn',
  paid: 'ok',
  overdue: 'danger',
};

export function statusLabel(type: QuoteDocType, status: DocStatus): string {
  return type === 'quote'
    ? (QUOTE_STATUS_LABEL[status as QuoteStatus] ?? '—')
    : (INVOICE_STATUS_LABEL[status as InvoiceStatus] ?? '—');
}

export function statusTone(type: QuoteDocType, status: DocStatus): StatusTone {
  return type === 'quote'
    ? (QUOTE_TONE[status as QuoteStatus] ?? 'muted')
    : (INVOICE_TONE[status as InvoiceStatus] ?? 'muted');
}

export function isQuoteStatus(v: unknown): v is QuoteStatus {
  return typeof v === 'string' && (QUOTE_STATUSES as readonly string[]).includes(v);
}
export function isInvoiceStatus(v: unknown): v is InvoiceStatus {
  return typeof v === 'string' && (INVOICE_STATUSES as readonly string[]).includes(v);
}

/* ------------------------------ calculs ------------------------------ */

export function lineTotalMinor(li: LineItem): number {
  return Math.round((li.qty || 0) * (li.unitPriceMinor || 0));
}

export function docSubtotalMinor(doc: Pick<DocLike, 'lineItems'>): number {
  return (doc.lineItems || []).reduce((a, li) => a + lineTotalMinor(li), 0);
}

export function docDiscountMinor(
  doc: Pick<DocLike, 'lineItems' | 'discountMinor' | 'discountPct'>,
): number {
  const sub = docSubtotalMinor(doc);
  if (doc.discountPct) return Math.round((sub * doc.discountPct) / 100);
  return Math.max(0, Math.round(doc.discountMinor ?? 0));
}

export function docTaxMinor(
  doc: Pick<DocLike, 'lineItems' | 'discountMinor' | 'discountPct' | 'taxRate'>,
): number {
  const base = docSubtotalMinor(doc) - docDiscountMinor(doc);
  return Math.round((base * (doc.taxRate || 0)) / 100);
}

export function docTotalMinor(
  doc: Pick<DocLike, 'lineItems' | 'discountMinor' | 'discountPct' | 'taxRate'>,
): number {
  return docSubtotalMinor(doc) - docDiscountMinor(doc) + docTaxMinor(doc);
}

export function docPaidMinor(doc: Pick<DocLike, 'schedule'>): number {
  return (doc.schedule || []).filter((s) => s.paid).reduce((a, s) => a + s.amountMinor, 0);
}

export function docRemainingMinor(doc: DocLike): number {
  const total = docTotalMinor(doc);
  if (doc.schedule && doc.schedule.length) return Math.max(0, total - docPaidMinor(doc));
  return doc.status === 'paid' ? 0 : total;
}

/**
 * Statut d'une facture recalculé après un encaissement (versement manuel) :
 * `paid` si tout est réglé, `partial` s'il reste un solde mais qu'un montant a
 * été encaissé, sinon on garde le statut courant. **Miroir pur** de la logique
 * de la mutation Convex `recordSchedulePayment` → testable + réutilisé pour la
 * mise à jour optimiste de l'UI. Suivi 100 % manuel, sans Wedillybird Pay.
 */
export function computeInvoiceStatus(
  paidMinor: number,
  totalMinor: number,
  fallback: DocStatus,
): DocStatus {
  if (totalMinor > 0 && paidMinor >= totalMinor) return 'paid';
  if (paidMinor > 0) return 'partial';
  return fallback;
}

/* --------------------------- numérotation --------------------------- */

/** « DEV-2026-014 » / « FAC-2026-031 » à partir d'un type, d'une année et d'un rang. */
export function formatDocNumber(type: QuoteDocType, year: number, seq: number): string {
  const prefix = type === 'quote' ? 'DEV' : 'FAC';
  return `${prefix}-${year}-${String(seq).padStart(3, '0')}`;
}

/* ------------------------------ agrégats ------------------------------ */

export interface QuoteKpis {
  /** Encaissé ce mois (factures, montants payés). */
  collectedMinor: number;
  /** En attente (factures envoyées/partielles, restant dû). */
  pendingMinor: number;
  /** En retard (factures overdue, restant dû). */
  overdueMinor: number;
  /** Devis en cours (devis sent/accepted, total). */
  openQuotesMinor: number;
}

/**
 * KPIs du module à partir des documents. `monthStart` = timestamp ms du 1er du
 * mois courant pour borner « encaissé ce mois » (paiements à partir de cette date).
 */
export function quoteKpis(docs: DocLike[]): QuoteKpis {
  let collectedMinor = 0;
  let pendingMinor = 0;
  let overdueMinor = 0;
  let openQuotesMinor = 0;
  for (const d of docs) {
    if (d.type === 'invoice') {
      collectedMinor += docPaidMinor(d);
      if (d.status === 'overdue') overdueMinor += docRemainingMinor(d);
      else if (d.status === 'sent' || d.status === 'partial') pendingMinor += docRemainingMinor(d);
    } else if (d.status === 'sent' || d.status === 'accepted') {
      openQuotesMinor += docTotalMinor(d);
    }
  }
  return { collectedMinor, pendingMinor, overdueMinor, openQuotesMinor };
}
