import { describe, expect, it } from 'vitest';
import {
  PLAN_LABELS,
  formatInvoiceAmount,
  formatInvoiceDate,
  invoiceNumber,
  type InvoicePdfPayment,
} from '@/components/billing/invoice-pdf-types';

const PAYMENT: InvoicePdfPayment = {
  _id: 'pmt_abcdef123456',
  plan: 'premium',
  currency: 'EUR',
  amountMinor: 7900,
  provider: 'stripe',
  status: 'succeeded',
  // 2026-04-25T00:00:00Z (UTC) → year=2026, month=04
  createdAt: Date.UTC(2026, 3, 25),
};

describe('invoice helpers', () => {
  it('invoiceNumber produces a stable WDB-YYYYMM-XXXXXX number', () => {
    expect(invoiceNumber(PAYMENT)).toBe('WDB-202604-123456');
  });

  it('invoiceNumber uppercases short ids', () => {
    expect(invoiceNumber({ ...PAYMENT, _id: 'p_abc', createdAt: Date.UTC(2026, 0, 1) })).toBe(
      'WDB-202601-P_ABC',
    );
  });

  it('formatInvoiceAmount formats EUR with 2 decimals', () => {
    expect(formatInvoiceAmount(7900, 'EUR')).toContain('79,00');
    expect(formatInvoiceAmount(7900, 'EUR')).toContain('€');
  });

  it('formatInvoiceAmount formats XOF with no decimals + FCFA suffix', () => {
    expect(formatInvoiceAmount(50_000_00, 'XOF')).toContain('FCFA');
  });

  it('formatInvoiceDate produces a French long date', () => {
    const out = formatInvoiceDate(Date.UTC(2026, 3, 25, 12));
    expect(out).toMatch(/avril 2026/);
  });

  it('PLAN_LABELS maps known plans', () => {
    expect(PLAN_LABELS.essential).toBe('Plan Essential');
    expect(PLAN_LABELS.premium).toBe('Plan Premium');
  });
});
