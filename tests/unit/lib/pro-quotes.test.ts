import { describe, it, expect } from 'vitest';
import {
  lineTotalMinor,
  docSubtotalMinor,
  docDiscountMinor,
  docTaxMinor,
  docTotalMinor,
  docPaidMinor,
  docRemainingMinor,
  computeInvoiceStatus,
  quoteKpis,
  formatDocNumber,
  statusLabel,
  statusTone,
  isQuoteStatus,
  isInvoiceStatus,
  type DocLike,
} from '../../../lib/pro/quotes';

const invoice: DocLike = {
  type: 'invoice',
  status: 'partial',
  lineItems: [
    { label: 'Coordination', qty: 1, unitPriceMinor: 140000 },
    { label: 'Supervision', qty: 1, unitPriceMinor: 80000 },
    { label: 'Repérage', qty: 1, unitPriceMinor: 30000 },
  ],
  schedule: [
    { label: 'Acompte 30 %', amountMinor: 75000, paid: true },
    { label: 'Solde', amountMinor: 175000, paid: false },
  ],
};

describe('calculs devis/facture', () => {
  it('lineTotal & sous-total', () => {
    expect(lineTotalMinor({ label: 'x', qty: 2, unitPriceMinor: 5000 })).toBe(10000);
    expect(docSubtotalMinor(invoice)).toBe(250000);
  });
  it('remise fixe et en pourcentage', () => {
    expect(docDiscountMinor({ lineItems: invoice.lineItems, discountMinor: 20000 })).toBe(20000);
    expect(docDiscountMinor({ lineItems: invoice.lineItems, discountPct: 10 })).toBe(25000);
  });
  it('taxe', () => {
    expect(docTaxMinor({ lineItems: invoice.lineItems, taxRate: 20 })).toBe(50000);
    expect(docTaxMinor({ lineItems: invoice.lineItems })).toBe(0);
  });
  it('total avec remise + taxe', () => {
    expect(docTotalMinor(invoice)).toBe(250000);
    expect(docTotalMinor({ lineItems: invoice.lineItems, discountMinor: 20000, taxRate: 20 })).toBe(
      276000,
    );
  });
  it('payé & restant via échéancier', () => {
    expect(docPaidMinor(invoice)).toBe(75000);
    expect(docRemainingMinor(invoice)).toBe(175000);
  });
  it('restant sans échéancier suit le statut', () => {
    const q: DocLike = {
      type: 'quote',
      status: 'sent',
      lineItems: [{ label: 'x', qty: 1, unitPriceMinor: 100000 }],
    };
    expect(docRemainingMinor(q)).toBe(100000);
    expect(docRemainingMinor({ ...q, status: 'paid' })).toBe(0);
  });
});

describe('quoteKpis', () => {
  it('agrège encaissé / en attente / en retard / devis en cours', () => {
    const docs: DocLike[] = [
      invoice,
      {
        type: 'invoice',
        status: 'overdue',
        lineItems: [{ label: 'x', qty: 1, unitPriceMinor: 150000 }],
        schedule: [{ label: 'Acompte', amountMinor: 150000, paid: false }],
      },
      {
        type: 'quote',
        status: 'sent',
        lineItems: [{ label: 'x', qty: 1, unitPriceMinor: 330000 }],
      },
      {
        type: 'quote',
        status: 'draft',
        lineItems: [{ label: 'x', qty: 1, unitPriceMinor: 100000 }],
      },
    ];
    const k = quoteKpis(docs);
    expect(k.collectedMinor).toBe(75000);
    expect(k.pendingMinor).toBe(175000);
    expect(k.overdueMinor).toBe(150000);
    expect(k.openQuotesMinor).toBe(330000);
  });
  it('liste vide → tout à zéro', () => {
    expect(quoteKpis([])).toEqual({
      collectedMinor: 0,
      pendingMinor: 0,
      overdueMinor: 0,
      openQuotesMinor: 0,
    });
  });
});

describe('numérotation + statuts', () => {
  it('formatDocNumber', () => {
    expect(formatDocNumber('quote', 2026, 14)).toBe('DEV-2026-014');
    expect(formatDocNumber('invoice', 2026, 31)).toBe('FAC-2026-031');
  });
  it('libellés', () => {
    expect(statusLabel('quote', 'accepted')).toBe('Accepté');
    expect(statusLabel('invoice', 'paid')).toBe('Payée');
    expect(statusLabel('invoice', 'partial')).toBe('Partiellement payée');
  });
  it('tonalités', () => {
    expect(statusTone('invoice', 'overdue')).toBe('danger');
    expect(statusTone('invoice', 'paid')).toBe('ok');
    expect(statusTone('quote', 'sent')).toBe('info');
    expect(statusTone('quote', 'draft')).toBe('muted');
  });
  it('gardes de type', () => {
    expect(isQuoteStatus('accepted')).toBe(true);
    expect(isQuoteStatus('partial')).toBe(false);
    expect(isInvoiceStatus('overdue')).toBe(true);
    expect(isInvoiceStatus('accepted')).toBe(false);
  });
});

describe('computeInvoiceStatus (encaissement manuel)', () => {
  it('passe à « paid » quand tout est encaissé', () => {
    expect(computeInvoiceStatus(5000, 5000, 'sent')).toBe('paid');
    expect(computeInvoiceStatus(6000, 5000, 'partial')).toBe('paid');
  });

  it('passe à « partial » quand un acompte est encaissé', () => {
    expect(computeInvoiceStatus(2000, 5000, 'sent')).toBe('partial');
  });

  it('conserve le statut courant si rien n’est encaissé', () => {
    expect(computeInvoiceStatus(0, 5000, 'sent')).toBe('sent');
    expect(computeInvoiceStatus(0, 5000, 'overdue')).toBe('overdue');
  });

  it('ne passe pas « paid » sur un total nul', () => {
    expect(computeInvoiceStatus(0, 0, 'draft')).toBe('draft');
  });
});
