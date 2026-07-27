/**
 * Logique PURE du programme d'affiliation influenceurs (calcul de commission,
 * agrégation des montants dus/versés, regroupement des versements par devise).
 *
 * ⚠️ `convex/` et `lib/` sont deux projets tsconfig séparés qui ne peuvent pas
 * s'importer (cf. `convex/payments.ts:computeEventReconciliation`). La formule
 * `computeCommissionMinor` est donc DUPLIQUÉE côté Convex
 * (`convex/affiliates.ts`) et les deux copies doivent rester alignées — elle est
 * testée ici, une seule source de vérité logique.
 */

export type CommissionCurrency = 'EUR' | 'USD' | 'XOF' | 'MAD' | 'TND';
export type CommissionStatus = 'pending' | 'paid' | 'reversed';

/**
 * Commission (unités mineures) = round(montant vente × taux% / 100).
 *
 * Le montant de vente est celui RÉELLEMENT encaissé (net de remise), donc la
 * commission porte sur le revenu effectif de la plateforme. Les entrées
 * négatives ou non finies sont ramenées à 0 (robustesse webhook).
 */
export function computeCommissionMinor(saleAmountMinor: number, commissionPct: number): number {
  if (!Number.isFinite(saleAmountMinor) || !Number.isFinite(commissionPct)) return 0;
  if (saleAmountMinor <= 0 || commissionPct <= 0) return 0;
  return Math.round((saleAmountMinor * commissionPct) / 100);
}

export interface CommissionLike {
  commissionMinor: number;
  currency: CommissionCurrency;
  status: CommissionStatus;
}

export interface CommissionTotals {
  /** Commissions dues (status `pending`), unités mineures, par devise. */
  pendingByCurrency: Record<string, number>;
  /** Commissions versées (status `paid`), unités mineures, par devise. */
  paidByCurrency: Record<string, number>;
  /** Total dû toutes devises confondues (EUR + USD + … additionnés bruts). */
  totalPendingMinor: number;
  totalPaidMinor: number;
  /** Nombre de commissions dues (utile pour activer/désactiver le bouton « Verser »). */
  pendingCount: number;
}

/**
 * Agrège un lot de commissions en totaux dus / versés, ventilés par devise.
 * Les `reversed` sont ignorées (ni dues, ni versées).
 */
export function summarizeCommissions(rows: readonly CommissionLike[]): CommissionTotals {
  const pendingByCurrency: Record<string, number> = {};
  const paidByCurrency: Record<string, number> = {};
  let totalPendingMinor = 0;
  let totalPaidMinor = 0;
  let pendingCount = 0;

  for (const row of rows) {
    if (row.status === 'pending') {
      pendingByCurrency[row.currency] =
        (pendingByCurrency[row.currency] ?? 0) + row.commissionMinor;
      totalPendingMinor += row.commissionMinor;
      pendingCount += 1;
    } else if (row.status === 'paid') {
      paidByCurrency[row.currency] = (paidByCurrency[row.currency] ?? 0) + row.commissionMinor;
      totalPaidMinor += row.commissionMinor;
    }
  }

  return { pendingByCurrency, paidByCurrency, totalPendingMinor, totalPaidMinor, pendingCount };
}

export interface PayoutGroup {
  currency: CommissionCurrency;
  amountMinor: number;
  commissionIds: string[];
}

/**
 * Regroupe les commissions dues par DEVISE pour préparer les versements : un
 * transfer Stripe ne porte qu'une seule devise, donc N devises = N transfers.
 * N'inclut que les lignes `pending` avec un montant strictement positif.
 */
export function groupPendingForPayout(
  rows: readonly (CommissionLike & { _id: string })[],
): PayoutGroup[] {
  const byCurrency = new Map<CommissionCurrency, PayoutGroup>();
  for (const row of rows) {
    if (row.status !== 'pending' || row.commissionMinor <= 0) continue;
    const group = byCurrency.get(row.currency);
    if (group) {
      group.amountMinor += row.commissionMinor;
      group.commissionIds.push(row._id);
    } else {
      byCurrency.set(row.currency, {
        currency: row.currency,
        amountMinor: row.commissionMinor,
        commissionIds: [row._id],
      });
    }
  }
  return [...byCurrency.values()];
}
