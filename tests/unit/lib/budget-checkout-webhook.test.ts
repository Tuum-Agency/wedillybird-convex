import { describe, expect, it } from 'vitest';
import { classifyBudgetSession } from '../../../lib/payments/drivers/stripe';

/**
 * Classification d'une session Checkout en paiement de budget (helper pur,
 * sans appel réseau). Cible : ne router QUE les sessions estampillées
 * `kind: 'budget_payment'`, sans confondre avec un forfait particulier ou un
 * achat PAYG.
 */
const sess = (metadata: Record<string, string> | null) => ({ id: 'cs_test_1', metadata });

describe('classifyBudgetSession', () => {
  it('completed + metadata budget_payment → succeeded', () => {
    expect(
      classifyBudgetSession(
        sess({ kind: 'budget_payment', budgetPaymentId: 'pay_1' }),
        'checkout.session.completed',
        'evt_1',
      ),
    ).toEqual({
      kind: 'budget_payment',
      budgetPaymentId: 'pay_1',
      providerSessionId: 'cs_test_1',
      providerEventId: 'evt_1',
      status: 'succeeded',
    });
  });

  it('expired → failed', () => {
    expect(
      classifyBudgetSession(
        sess({ kind: 'budget_payment', budgetPaymentId: 'pay_1' }),
        'checkout.session.expired',
        'evt_2',
      )?.status,
    ).toBe('failed');
  });

  it('async_payment_failed → failed', () => {
    expect(
      classifyBudgetSession(
        sess({ kind: 'budget_payment', budgetPaymentId: 'pay_1' }),
        'checkout.session.async_payment_failed',
        'evt_3',
      )?.status,
    ).toBe('failed');
  });

  it('kind ≠ budget_payment (payg) → null', () => {
    expect(
      classifyBudgetSession(sess({ kind: 'payg' }), 'checkout.session.completed', 'evt'),
    ).toBeNull();
  });

  it('budgetPaymentId manquant → null', () => {
    expect(
      classifyBudgetSession(sess({ kind: 'budget_payment' }), 'checkout.session.completed', 'evt'),
    ).toBeNull();
  });

  it('event non-checkout → null', () => {
    expect(
      classifyBudgetSession(
        sess({ kind: 'budget_payment', budgetPaymentId: 'pay_1' }),
        'customer.subscription.updated',
        'evt',
      ),
    ).toBeNull();
  });

  it('metadata null → null', () => {
    expect(classifyBudgetSession(sess(null), 'checkout.session.completed', 'evt')).toBeNull();
  });
});
