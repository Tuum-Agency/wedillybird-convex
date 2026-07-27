import { describe, it, expect } from 'vitest';
import {
  computeCommissionMinor,
  summarizeCommissions,
  groupPendingForPayout,
  type CommissionLike,
} from '../../../lib/payments/affiliate';

describe('computeCommissionMinor', () => {
  it('calcule un pourcentage simple', () => {
    // 59,00 € × 20 % = 11,80 €
    expect(computeCommissionMinor(5900, 20)).toBe(1180);
  });

  it('arrondit à l’unité mineure la plus proche', () => {
    // 29,00 € × 15 % = 4,35 € → 435 ; 4999 × 15 % = 749,85 → 750
    expect(computeCommissionMinor(2900, 15)).toBe(435);
    expect(computeCommissionMinor(4999, 15)).toBe(750);
  });

  it('gère un taux décimal', () => {
    expect(computeCommissionMinor(10000, 12.5)).toBe(1250);
  });

  it('retourne 0 pour un montant ou un taux nul/négatif', () => {
    expect(computeCommissionMinor(0, 20)).toBe(0);
    expect(computeCommissionMinor(5900, 0)).toBe(0);
    expect(computeCommissionMinor(-5900, 20)).toBe(0);
    expect(computeCommissionMinor(5900, -5)).toBe(0);
  });

  it('retourne 0 pour des entrées non finies (robustesse webhook)', () => {
    expect(computeCommissionMinor(Number.NaN, 20)).toBe(0);
    expect(computeCommissionMinor(5900, Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe('summarizeCommissions', () => {
  const rows: CommissionLike[] = [
    { commissionMinor: 1180, currency: 'EUR', status: 'pending' },
    { commissionMinor: 435, currency: 'EUR', status: 'pending' },
    { commissionMinor: 800, currency: 'USD', status: 'pending' },
    { commissionMinor: 2000, currency: 'EUR', status: 'paid' },
    { commissionMinor: 9999, currency: 'EUR', status: 'reversed' },
  ];

  it('ventile les montants dus par devise', () => {
    const t = summarizeCommissions(rows);
    expect(t.pendingByCurrency).toEqual({ EUR: 1615, USD: 800 });
    expect(t.totalPendingMinor).toBe(2415);
    expect(t.pendingCount).toBe(3);
  });

  it('ventile les montants versés et ignore les reversées', () => {
    const t = summarizeCommissions(rows);
    expect(t.paidByCurrency).toEqual({ EUR: 2000 });
    expect(t.totalPaidMinor).toBe(2000);
  });

  it('gère un lot vide', () => {
    const t = summarizeCommissions([]);
    expect(t.totalPendingMinor).toBe(0);
    expect(t.totalPaidMinor).toBe(0);
    expect(t.pendingCount).toBe(0);
    expect(t.pendingByCurrency).toEqual({});
  });
});

describe('groupPendingForPayout', () => {
  it('regroupe les commissions dues par devise avec leurs IDs', () => {
    const rows = [
      { _id: 'c1', commissionMinor: 1180, currency: 'EUR' as const, status: 'pending' as const },
      { _id: 'c2', commissionMinor: 435, currency: 'EUR' as const, status: 'pending' as const },
      { _id: 'c3', commissionMinor: 800, currency: 'USD' as const, status: 'pending' as const },
      { _id: 'c4', commissionMinor: 2000, currency: 'EUR' as const, status: 'paid' as const },
    ];
    const groups = groupPendingForPayout(rows).sort((a, b) => a.currency.localeCompare(b.currency));
    expect(groups).toEqual([
      { currency: 'EUR', amountMinor: 1615, commissionIds: ['c1', 'c2'] },
      { currency: 'USD', amountMinor: 800, commissionIds: ['c3'] },
    ]);
  });

  it('exclut les lignes non-pending et les montants nuls', () => {
    const rows = [
      { _id: 'c1', commissionMinor: 0, currency: 'EUR' as const, status: 'pending' as const },
      { _id: 'c2', commissionMinor: 500, currency: 'EUR' as const, status: 'reversed' as const },
    ];
    expect(groupPendingForPayout(rows)).toEqual([]);
  });
});
