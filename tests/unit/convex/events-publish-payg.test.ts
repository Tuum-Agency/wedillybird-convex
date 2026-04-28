import { describe, expect, it } from 'vitest';
import { decidePublishGate, type PaygPublishGateInput } from '../../../convex/events';

/**
 * Tests d'intégration "fonctionnels" du gating PAYG côté event publish.
 * Complète `publish-gate.test.ts` (qui couvre l'arbre de décision pur) en
 * simulant les deux chemins critiques côté webhook/UX :
 *   1. Pro avec subscription active → publish autorisé sans toucher aux crédits
 *   2. Pro PAYG → décrémente atomiquement de 1, signale `nextCredits` à patch
 *   3. Pro sans rien → throw `PAYG_CREDIT_REQUIRED`
 *
 * On simule la mutation Convex en encadrant `decidePublishGate` par un mock
 * decrement (= patch sur `paygCredits`) pour vérifier l'absence de TOCTOU.
 */

const orgId = 'org_acme' as unknown as never;

function makeOrgState(
  initialCredits: number,
  status?: PaygPublishGateInput['organization'] extends infer T
    ? T extends { subscriptionStatus?: infer S }
      ? S
      : never
    : never,
) {
  let credits = initialCredits;
  return {
    snapshot: () => ({ subscriptionStatus: status, paygCredits: credits }),
    patch: (next: number) => {
      credits = next;
    },
    get current() {
      return credits;
    },
  };
}

describe('publish gating PAYG — chemin subscription active (no decrement)', () => {
  it('autorise publish pour orga `active` sans toucher aux crédits', () => {
    const orgState = makeOrgState(0, 'active');
    const decision = decidePublishGate({
      event: { planTier: undefined, organizationId: orgId },
      organization: orgState.snapshot(),
    });
    expect(decision).toEqual({ ok: true, consumeCredit: false });
    // Crédits inchangés : on ne les a pas patchés.
    expect(orgState.current).toBe(0);
  });

  it('autorise publish pour orga `trialing` sans toucher aux crédits', () => {
    const orgState = makeOrgState(7, 'trialing');
    const decision = decidePublishGate({
      event: { planTier: undefined, organizationId: orgId },
      organization: orgState.snapshot(),
    });
    expect(decision).toEqual({ ok: true, consumeCredit: false });
    expect(orgState.current).toBe(7);
  });
});

describe('publish gating PAYG — chemin pay-as-you-go (decrement)', () => {
  it('décrémente de 1 quand l’orga a 1 crédit et publie', () => {
    const orgState = makeOrgState(1, undefined);
    const decision = decidePublishGate({
      event: { planTier: undefined, organizationId: orgId },
      organization: orgState.snapshot(),
    });
    if (!decision.ok || !decision.consumeCredit) {
      throw new Error('expected consumeCredit decision');
    }
    expect(decision.nextCredits).toBe(0);
    // Simule l'effet de bord côté Convex : patch atomique.
    orgState.patch(decision.nextCredits);
    expect(orgState.current).toBe(0);
  });

  it('décrémente correctement de N à N-1 (pas d’overflow ni de double consume)', () => {
    const orgState = makeOrgState(5, undefined);
    const decision = decidePublishGate({
      event: { planTier: undefined, organizationId: orgId },
      organization: orgState.snapshot(),
    });
    if (!decision.ok || !decision.consumeCredit) {
      throw new Error('expected consumeCredit decision');
    }
    expect(decision.nextCredits).toBe(4);
    orgState.patch(decision.nextCredits);
    // Une seconde décision sur le même snapshot ré-évaluerait à partir du
    // nouvel état : c'est exactement la garantie single-thread Convex.
    const second = decidePublishGate({
      event: { planTier: undefined, organizationId: orgId },
      organization: { subscriptionStatus: undefined, paygCredits: orgState.current },
    });
    if (!second.ok || !second.consumeCredit) {
      throw new Error('expected second decision to be consumeCredit');
    }
    expect(second.nextCredits).toBe(3);
  });
});

describe('publish gating PAYG — chemin refusé', () => {
  it('rejette PAYG_CREDIT_REQUIRED quand orga `canceled` et 0 crédit', () => {
    const orgState = makeOrgState(0, 'canceled');
    const decision = decidePublishGate({
      event: { planTier: undefined, organizationId: orgId },
      organization: orgState.snapshot(),
    });
    expect(decision).toEqual({ ok: false, error: 'PAYG_CREDIT_REQUIRED' });
    expect(orgState.current).toBe(0);
  });

  it('rejette PAYG_CREDIT_REQUIRED quand orga sans sub et paygCredits undefined', () => {
    const decision = decidePublishGate({
      event: { planTier: undefined, organizationId: orgId },
      organization: { subscriptionStatus: undefined, paygCredits: undefined },
    });
    expect(decision).toEqual({ ok: false, error: 'PAYG_CREDIT_REQUIRED' });
  });

  it("rejette PLAN_REQUIRED quand l'event n'a ni plan particulier ni orga", () => {
    const decision = decidePublishGate({
      event: { planTier: undefined },
      organization: null,
    });
    expect(decision).toEqual({ ok: false, error: 'PLAN_REQUIRED' });
  });
});
