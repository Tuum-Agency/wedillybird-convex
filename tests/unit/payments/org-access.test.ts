import { describe, expect, it } from 'vitest';
import { orgHasActiveAccess as appAccess } from '../../../lib/payments/entitlements';
import { orgHasActiveAccess as convexAccess } from '../../../convex/lib/entitlements';

/**
 * Miroir app-side de `orgHasActiveAccess` (sert la bannière « choisir un forfait »
 * et masque les actions de création). Doit rester en phase avec la source de
 * vérité serveur (`convex/lib/entitlements.ts`).
 */
const CASES = [
  { subscriptionStatus: 'active' as const },
  { subscriptionStatus: 'trialing' as const },
  { subscriptionStatus: 'past_due' as const },
  { subscriptionStatus: 'canceled' as const },
  { subscriptionStatus: 'unpaid' as const },
  { paygCredits: 0 },
  { paygCredits: 4 },
  { subscriptionStatus: 'canceled' as const, paygCredits: 3 },
  { subscriptionStatus: undefined, paygCredits: 0 },
  {},
];

describe('orgHasActiveAccess (app-side)', () => {
  it('rend exactement la même vérité que le miroir Convex', () => {
    for (const c of CASES) {
      expect(appAccess(c)).toBe(convexAccess(c));
    }
  });

  it('active / trialing / crédit → accès', () => {
    expect(appAccess({ subscriptionStatus: 'active' })).toBe(true);
    expect(appAccess({ subscriptionStatus: 'trialing' })).toBe(true);
    expect(appAccess({ paygCredits: 1 })).toBe(true);
  });

  it('null / undefined / canceled sans crédit → pas d’accès', () => {
    expect(appAccess(null)).toBe(false);
    expect(appAccess(undefined)).toBe(false);
    expect(appAccess({ subscriptionStatus: 'canceled' })).toBe(false);
  });

  it('tolère les champs null (forme du retour Convex myOrganization)', () => {
    expect(appAccess({ subscriptionStatus: null, paygCredits: null })).toBe(false);
    expect(appAccess({ subscriptionStatus: 'active', paygCredits: null })).toBe(true);
  });
});
