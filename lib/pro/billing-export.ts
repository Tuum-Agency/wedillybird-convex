/**
 * Export comptable de la facturation agence (abonnement Stripe + crédits PAYG).
 * Helpers purs partagés UI / route handler / tests. Montants en **centimes**.
 */

export type BillingInvoiceStatus = 'paid' | 'open' | 'void' | 'uncollectible' | 'draft';

export const BILLING_INVOICE_STATUS: Record<
  BillingInvoiceStatus,
  { label: string; tone: 'ok' | 'warn' | 'muted' | 'danger' }
> = {
  paid: { label: 'Payée', tone: 'ok' },
  open: { label: 'À régler', tone: 'warn' },
  draft: { label: 'Brouillon', tone: 'muted' },
  void: { label: 'Annulée', tone: 'muted' },
  uncollectible: { label: 'Irrécouvrable', tone: 'danger' },
};

export interface BillingExportRow {
  /** Date (ms). */
  date: number;
  /** Type d'écriture : Abonnement (facture Stripe) ou PAYG (crédit). */
  type: 'Abonnement' | 'PAYG';
  reference: string;
  amountMinor: number;
  currency: string;
  status: string;
}

const PAD = (n: number) => String(n).padStart(2, '0');

/** Clé de mois `YYYY-MM` (UTC) d'un timestamp. */
export function monthKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getUTCFullYear()}-${PAD(d.getUTCMonth() + 1)}`;
}

/** Vrai si le timestamp tombe dans le mois `YYYY-MM`. */
export function inMonth(ts: number, month: string): boolean {
  return monthKey(ts) === month;
}

const MONTHS_FR = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];

/** Les `count` derniers mois (courant en tête) sous forme `{ value, label }`. */
export function recentMonths(now: number, count = 6): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  const base = new Date(now);
  let y = base.getUTCFullYear();
  let m = base.getUTCMonth();
  for (let i = 0; i < count; i += 1) {
    out.push({ value: `${y}-${PAD(m + 1)}`, label: `${MONTHS_FR[m]} ${y}` });
    m -= 1;
    if (m < 0) {
      m = 11;
      y -= 1;
    }
  }
  return out;
}

/** Échappe une cellule CSV (guillemets + séparateur `;` FR-Excel). */
export function csvCell(value: string | number): string {
  const s = String(value);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Construit un CSV (séparateur `;`) à partir des écritures de facturation. */
export function buildBillingCsv(rows: BillingExportRow[]): string {
  const header = ['Date', 'Type', 'Référence', 'Montant', 'Devise', 'Statut'];
  const lines = [header.join(';')];
  for (const r of rows) {
    const date = new Date(r.date).toISOString().slice(0, 10);
    lines.push(
      [
        csvCell(date),
        csvCell(r.type),
        csvCell(r.reference),
        csvCell((r.amountMinor / 100).toFixed(2)),
        csvCell(r.currency),
        csvCell(r.status),
      ].join(';'),
    );
  }
  return lines.join('\r\n');
}
