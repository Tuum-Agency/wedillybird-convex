import { describe, expect, it } from 'vitest';
import { decidePaymentTransition } from '../../../convex/budget';

/**
 * Idempotence des transitions de statut d'un paiement de budget en ligne
 * (webhook Stripe re-livrable). Garantit qu'on n'encaisse pas deux fois et
 * qu'un event d'échec tardif ne ré-ouvre jamais un paiement déjà réussi.
 */
describe('decidePaymentTransition', () => {
  it('pending → succeeded : applique', () => {
    expect(decidePaymentTransition('pending', 'succeeded')).toEqual({
      apply: true,
      alreadyApplied: false,
    });
  });

  it('pending → failed : applique', () => {
    expect(decidePaymentTransition('pending', 'failed')).toEqual({
      apply: true,
      alreadyApplied: false,
    });
  });

  it('succeeded → succeeded : idempotent (re-livraison)', () => {
    expect(decidePaymentTransition('succeeded', 'succeeded')).toEqual({
      apply: false,
      alreadyApplied: true,
    });
  });

  it('succeeded → failed : ignoré (jamais ré-ouvrir un paiement encaissé)', () => {
    expect(decidePaymentTransition('succeeded', 'failed')).toEqual({
      apply: false,
      alreadyApplied: true,
    });
  });

  it('failed → failed : idempotent', () => {
    expect(decidePaymentTransition('failed', 'failed')).toEqual({
      apply: false,
      alreadyApplied: true,
    });
  });

  it('failed → succeeded : applique (paiement finalement réussi)', () => {
    expect(decidePaymentTransition('failed', 'succeeded')).toEqual({
      apply: true,
      alreadyApplied: false,
    });
  });
});
