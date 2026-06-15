import { describe, it, expect } from 'vitest';
import {
  monthKey,
  inMonth,
  recentMonths,
  csvCell,
  buildBillingCsv,
  BILLING_INVOICE_STATUS,
  type BillingExportRow,
} from '../../../lib/pro/billing-export';

const JUNE = Date.UTC(2026, 5, 15, 10, 0, 0); // 15 juin 2026
const MAY = Date.UTC(2026, 4, 3, 10, 0, 0);

describe('monthKey / inMonth', () => {
  it('clé YYYY-MM en UTC', () => {
    expect(monthKey(JUNE)).toBe('2026-06');
    expect(monthKey(MAY)).toBe('2026-05');
  });
  it('inMonth filtre par mois', () => {
    expect(inMonth(JUNE, '2026-06')).toBe(true);
    expect(inMonth(MAY, '2026-06')).toBe(false);
  });
});

describe('recentMonths', () => {
  it('retourne les N derniers mois, courant en tête, avec passage d’année', () => {
    const months = recentMonths(Date.UTC(2026, 1, 10), 3); // févr 2026
    expect(months.map((m) => m.value)).toEqual(['2026-02', '2026-01', '2025-12']);
    expect(months[0]!.label).toBe('février 2026');
  });
});

describe('csvCell', () => {
  it('échappe guillemets / séparateur / saut de ligne', () => {
    expect(csvCell('simple')).toBe('simple');
    expect(csvCell('a;b')).toBe('"a;b"');
    expect(csvCell('a"b')).toBe('"a""b"');
    expect(csvCell(12)).toBe('12');
  });
});

describe('buildBillingCsv', () => {
  const rows: BillingExportRow[] = [
    {
      date: JUNE,
      type: 'Abonnement',
      reference: 'FAC-001',
      amountMinor: 44900,
      currency: 'EUR',
      status: 'Payée',
    },
    {
      date: MAY,
      type: 'PAYG',
      reference: 'cs_test_123',
      amountMinor: 7900,
      currency: 'EUR',
      status: 'Payée',
    },
  ];
  it('en-tête + lignes (séparateur ; et montant en unités)', () => {
    const csv = buildBillingCsv(rows);
    const lines = csv.split('\r\n');
    expect(lines[0]).toBe('Date;Type;Référence;Montant;Devise;Statut');
    expect(lines[1]).toBe('2026-06-15;Abonnement;FAC-001;449.00;EUR;Payée');
    expect(lines[2]).toContain('PAYG;cs_test_123;79.00;EUR');
  });
  it('liste vide → en-tête seul', () => {
    expect(buildBillingCsv([])).toBe('Date;Type;Référence;Montant;Devise;Statut');
  });
});

describe('libellés de statut', () => {
  it('mappe paid/open/draft', () => {
    expect(BILLING_INVOICE_STATUS.paid.label).toBe('Payée');
    expect(BILLING_INVOICE_STATUS.open.tone).toBe('warn');
  });
});
