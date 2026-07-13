import { describe, expect, it } from 'vitest';
import { orgHasActiveAccess } from '../../../convex/lib/entitlements';

/**
 * `orgHasActiveAccess` — garde-fou « forfait choisi » (source de vérité
 * serveur). Une agence n'accède au back-office (créer un mariage, rétroplanning,
 * prestataires…) qu'après avoir un abonnement actif/essai OU un crédit
 * Pay-as-you-go. Table de vérité exhaustive.
 */
describe('orgHasActiveAccess (convex)', () => {
  it('abonnement active / trialing → accès', () => {
    expect(orgHasActiveAccess({ subscriptionStatus: 'active' })).toBe(true);
    expect(orgHasActiveAccess({ subscriptionStatus: 'trialing' })).toBe(true);
  });

  it('agence fraîchement onboardée (aucun statut, 0 crédit) → PAS d’accès', () => {
    expect(orgHasActiveAccess({})).toBe(false);
    expect(orgHasActiveAccess({ subscriptionStatus: undefined, paygCredits: 0 })).toBe(false);
  });

  it('past_due / canceled / unpaid sans crédit → PAS d’accès', () => {
    expect(orgHasActiveAccess({ subscriptionStatus: 'past_due' })).toBe(false);
    expect(orgHasActiveAccess({ subscriptionStatus: 'canceled' })).toBe(false);
    expect(orgHasActiveAccess({ subscriptionStatus: 'unpaid' })).toBe(false);
  });

  it('crédit PAYG > 0 sans abonnement → accès (au moins un event payé)', () => {
    expect(orgHasActiveAccess({ paygCredits: 1 })).toBe(true);
    // Même un abonnement annulé garde l'accès tant qu'il reste un crédit PAYG.
    expect(orgHasActiveAccess({ subscriptionStatus: 'canceled', paygCredits: 2 })).toBe(true);
  });

  it('crédit 0 ou négatif → PAS d’accès (garde-fou)', () => {
    expect(orgHasActiveAccess({ paygCredits: 0 })).toBe(false);
    expect(orgHasActiveAccess({ paygCredits: -1 })).toBe(false);
  });

  it('null / undefined → PAS d’accès', () => {
    expect(orgHasActiveAccess(null)).toBe(false);
    expect(orgHasActiveAccess(undefined)).toBe(false);
  });

  it('cohérent avec decidePublishGate : seuls active/trialing sont « sub active »', () => {
    // Le publish gate (convex/events.ts) traite active/trialing comme sub active
    // et retombe sur PAYG sinon. Le gate d'accès applique la même règle en amont
    // (création), pas seulement à la publication.
    expect(orgHasActiveAccess({ subscriptionStatus: 'active', paygCredits: 0 })).toBe(true);
    expect(orgHasActiveAccess({ subscriptionStatus: 'past_due', paygCredits: 0 })).toBe(false);
  });
});
