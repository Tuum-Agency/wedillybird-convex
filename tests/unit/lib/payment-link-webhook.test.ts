import { describe, expect, it } from 'vitest';
import {
  classifyPaymentLinkSession,
  classifyBudgetSession,
} from '../../../lib/payments/drivers/stripe';

/**
 * Classification d'une session Checkout en paiement d'un lien générique (facture
 * ou libre). Helper pur. Cible : ne router QUE les sessions `kind: 'payment_link'`,
 * sans les confondre avec un paiement de budget ni un forfait.
 */
const sess = (metadata: Record<string, string> | null) => ({ id: 'cs_test_pl', metadata });

describe('classifyPaymentLinkSession', () => {
  it('completed + metadata payment_link → succeeded', () => {
    expect(
      classifyPaymentLinkSession(
        sess({ kind: 'payment_link', paymentLinkId: 'pl_1' }),
        'checkout.session.completed',
        'evt_1',
      ),
    ).toEqual({
      kind: 'payment_link',
      paymentLinkId: 'pl_1',
      providerSessionId: 'cs_test_pl',
      providerEventId: 'evt_1',
      status: 'succeeded',
    });
  });

  it('expired → failed', () => {
    expect(
      classifyPaymentLinkSession(
        sess({ kind: 'payment_link', paymentLinkId: 'pl_1' }),
        'checkout.session.expired',
        'evt_2',
      )?.status,
    ).toBe('failed');
  });

  it('async_payment_failed → failed', () => {
    expect(
      classifyPaymentLinkSession(
        sess({ kind: 'payment_link', paymentLinkId: 'pl_1' }),
        'checkout.session.async_payment_failed',
        'evt_3',
      )?.status,
    ).toBe('failed');
  });

  it('paymentLinkId manquant → null', () => {
    expect(
      classifyPaymentLinkSession(
        sess({ kind: 'payment_link' }),
        'checkout.session.completed',
        'evt',
      ),
    ).toBeNull();
  });

  it('event non-checkout → null', () => {
    expect(
      classifyPaymentLinkSession(
        sess({ kind: 'payment_link', paymentLinkId: 'pl_1' }),
        'customer.subscription.updated',
        'evt',
      ),
    ).toBeNull();
  });

  it('metadata null → null', () => {
    expect(classifyPaymentLinkSession(sess(null), 'checkout.session.completed', 'evt')).toBeNull();
  });

  it('les deux classifieurs ne se confondent pas (budget ↔ payment_link)', () => {
    const pl = sess({ kind: 'payment_link', paymentLinkId: 'pl_1' });
    const budget = sess({ kind: 'budget_payment', budgetPaymentId: 'pay_1' });
    // un lien de paiement n'est PAS un paiement de budget, et inversement
    expect(classifyBudgetSession(pl, 'checkout.session.completed', 'e')).toBeNull();
    expect(classifyPaymentLinkSession(budget, 'checkout.session.completed', 'e')).toBeNull();
  });
});
