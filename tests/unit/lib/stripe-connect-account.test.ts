import { describe, expect, it } from 'vitest';
import type Stripe from 'stripe';
import { mapConnectAccountStatus } from '../../../lib/payments/drivers/stripe';

/**
 * Mappe un compte Stripe connecté → statut Connect (pur). `chargesEnabled` est la
 * clé : il débloque la création de liens de paiement une fois l'onboarding terminé.
 */
const acct = (o: Partial<Stripe.Account>) => o as unknown as Stripe.Account;

describe('mapConnectAccountStatus', () => {
  it('compte onboardé (charges actives) → tout true', () => {
    expect(
      mapConnectAccountStatus(
        acct({ charges_enabled: true, details_submitted: true, payouts_enabled: true }),
      ),
    ).toEqual({ chargesEnabled: true, detailsSubmitted: true, payoutsEnabled: true });
  });

  it('onboarding non commencé → tout false', () => {
    expect(
      mapConnectAccountStatus(
        acct({ charges_enabled: false, details_submitted: false, payouts_enabled: false }),
      ),
    ).toEqual({ chargesEnabled: false, detailsSubmitted: false, payoutsEnabled: false });
  });

  it('infos soumises mais charges pas encore actives (en revue Stripe)', () => {
    const r = mapConnectAccountStatus(
      acct({ charges_enabled: false, details_submitted: true, payouts_enabled: false }),
    );
    expect(r.detailsSubmitted).toBe(true);
    expect(r.chargesEnabled).toBe(false);
  });

  it('champs absents → false (coercition Boolean, pas undefined)', () => {
    expect(mapConnectAccountStatus(acct({}))).toEqual({
      chargesEnabled: false,
      detailsSubmitted: false,
      payoutsEnabled: false,
    });
  });
});
