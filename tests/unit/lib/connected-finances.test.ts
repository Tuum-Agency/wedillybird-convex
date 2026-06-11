import { describe, expect, it } from 'vitest';
import type Stripe from 'stripe';
import {
  mapConnectedBalance,
  mapConnectedPayout,
  mapConnectedPayment,
} from '../../../lib/payments/drivers/stripe';
import { isChargeRefundable, type ConnectedPayment } from '../../../lib/pro/payments';

/**
 * Mappers purs (compte Stripe connecté → formes client-safe). Cible : sommer le
 * solde EUR, convertir les dates Stripe (secondes → ms), normaliser les champs
 * absents en null. Aucun appel réseau.
 */

describe('mapConnectedBalance', () => {
  it('somme les montants EUR (available + pending), ignore les autres devises', () => {
    const balance = {
      available: [
        { amount: 12000, currency: 'eur' },
        { amount: 999, currency: 'usd' },
      ],
      pending: [{ amount: 3000, currency: 'eur' }],
    } as unknown as Stripe.Balance;
    expect(mapConnectedBalance(balance)).toEqual({
      availableMinor: 12000,
      pendingMinor: 3000,
      currency: 'EUR',
    });
  });

  it('tableaux vides → 0', () => {
    const balance = { available: [], pending: [] } as unknown as Stripe.Balance;
    expect(mapConnectedBalance(balance)).toEqual({
      availableMinor: 0,
      pendingMinor: 0,
      currency: 'EUR',
    });
  });
});

describe('mapConnectedPayout', () => {
  it('mappe + convertit les dates (s → ms)', () => {
    const p = {
      id: 'po_1',
      amount: 50000,
      currency: 'eur',
      status: 'in_transit',
      arrival_date: 1700000000,
      created: 1699000000,
    } as unknown as Stripe.Payout;
    expect(mapConnectedPayout(p)).toEqual({
      id: 'po_1',
      amountMinor: 50000,
      currency: 'EUR',
      status: 'in_transit',
      arrivalDate: 1700000000000,
      created: 1699000000000,
    });
  });
});

describe('mapConnectedPayment', () => {
  it('mappe une charge (reçu + email + description)', () => {
    const c = {
      id: 'ch_1',
      amount: 30000,
      currency: 'eur',
      status: 'succeeded',
      created: 1699000000,
      description: 'Acompte',
      billing_details: { email: 'a@b.fr' },
      receipt_url: 'https://receipt',
    } as unknown as Stripe.Charge;
    expect(mapConnectedPayment(c)).toEqual({
      id: 'ch_1',
      amountMinor: 30000,
      currency: 'EUR',
      status: 'succeeded',
      created: 1699000000000,
      description: 'Acompte',
      customerEmail: 'a@b.fr',
      receiptUrl: 'https://receipt',
      refunded: false,
    });
  });

  it('champs absents → null', () => {
    const c = {
      id: 'ch_2',
      amount: 100,
      currency: 'eur',
      status: 'pending',
      created: 0,
      description: null,
      billing_details: {},
      receipt_url: null,
    } as unknown as Stripe.Charge;
    const r = mapConnectedPayment(c);
    expect(r.description).toBeNull();
    expect(r.customerEmail).toBeNull();
    expect(r.receiptUrl).toBeNull();
    expect(r.refunded).toBe(false);
  });

  it('refunded=true est propagé', () => {
    const c = {
      id: 'ch_3',
      amount: 100,
      currency: 'eur',
      status: 'succeeded',
      created: 0,
      description: null,
      billing_details: {},
      receipt_url: null,
      refunded: true,
    } as unknown as Stripe.Charge;
    expect(mapConnectedPayment(c).refunded).toBe(true);
  });
});

describe('isChargeRefundable', () => {
  const base: ConnectedPayment = {
    id: 'ch',
    amountMinor: 1000,
    currency: 'EUR',
    status: 'succeeded',
    created: 0,
    description: null,
    customerEmail: null,
    receiptUrl: null,
    refunded: false,
  };
  it('charge réussie non remboursée → remboursable', () => {
    expect(isChargeRefundable(base)).toBe(true);
  });
  it('déjà remboursée → non remboursable', () => {
    expect(isChargeRefundable({ ...base, refunded: true })).toBe(false);
  });
  it('non réussie (pending) → non remboursable', () => {
    expect(isChargeRefundable({ ...base, status: 'pending' })).toBe(false);
  });
});
