import { describe, expect, it } from 'vitest';
import { decidePublishGate } from '../../../convex/events';

/**
 * Tests de la décision de publication d'un event :
 *  - Particulier payé / non payé
 *  - Pro avec subscription active / trialing
 *  - Pro sans sub mais avec / sans crédits PAYG
 *  - Cas dégénérés (état incohérent, valeurs limites)
 *
 * On teste la fonction pure (`decidePublishGate`) — la logique Convex DB
 * (read org, patch credits, patch event) est triviale et juste un câblage.
 */

describe('decidePublishGate — particulier', () => {
  it('autorise publish quand planTier est défini, sans toucher l\'orga', () => {
    const decision = decidePublishGate({
      event: { planTier: 'essential' },
      organization: null,
    });
    expect(decision).toEqual({ ok: true, consumeCredit: false });
  });

  it('autorise publish quand planTier=premium', () => {
    const decision = decidePublishGate({
      event: { planTier: 'premium' },
      organization: null,
    });
    expect(decision).toEqual({ ok: true, consumeCredit: false });
  });

  it('rejette PLAN_REQUIRED quand particulier sans plan ni orga', () => {
    const decision = decidePublishGate({
      event: { planTier: undefined },
      organization: null,
    });
    expect(decision).toEqual({ ok: false, error: 'PLAN_REQUIRED' });
  });
});

describe('decidePublishGate — pro avec subscription', () => {
  // organizationId est typé comme `Id<'organizations'>` (string en runtime).
  // On utilise un cast pour échapper au type strict dans les tests.
  const orgId = 'org_123' as unknown as never;

  it('autorise publish avec subscription `active`, sans consommer de crédit', () => {
    const decision = decidePublishGate({
      event: { planTier: undefined, organizationId: orgId },
      organization: { subscriptionStatus: 'active', paygCredits: 0 },
    });
    expect(decision).toEqual({ ok: true, consumeCredit: false });
  });

  it('autorise publish avec subscription `trialing`', () => {
    const decision = decidePublishGate({
      event: { planTier: undefined, organizationId: orgId },
      organization: { subscriptionStatus: 'trialing', paygCredits: 5 },
    });
    expect(decision).toEqual({ ok: true, consumeCredit: false });
  });

  it('ne consomme pas de crédit même si crédits > 0 quand sub est active', () => {
    const decision = decidePublishGate({
      event: { planTier: undefined, organizationId: orgId },
      organization: { subscriptionStatus: 'active', paygCredits: 3 },
    });
    expect(decision).toEqual({ ok: true, consumeCredit: false });
  });
});

describe('decidePublishGate — pro PAYG (sans subscription active)', () => {
  const orgId = 'org_123' as unknown as never;

  it('autorise publish avec 1 crédit, et indique consume à 0', () => {
    const decision = decidePublishGate({
      event: { planTier: undefined, organizationId: orgId },
      organization: { subscriptionStatus: undefined, paygCredits: 1 },
    });
    expect(decision).toEqual({ ok: true, consumeCredit: true, nextCredits: 0 });
  });

  it('autorise publish avec 5 crédits, et décrémente à 4', () => {
    const decision = decidePublishGate({
      event: { planTier: undefined, organizationId: orgId },
      organization: { subscriptionStatus: undefined, paygCredits: 5 },
    });
    expect(decision).toEqual({ ok: true, consumeCredit: true, nextCredits: 4 });
  });

  it('rejette PAYG_CREDIT_REQUIRED avec 0 crédit ET pas de sub', () => {
    const decision = decidePublishGate({
      event: { planTier: undefined, organizationId: orgId },
      organization: { subscriptionStatus: undefined, paygCredits: 0 },
    });
    expect(decision).toEqual({ ok: false, error: 'PAYG_CREDIT_REQUIRED' });
  });

  it('rejette PAYG_CREDIT_REQUIRED quand paygCredits est undefined (jamais alimenté)', () => {
    const decision = decidePublishGate({
      event: { planTier: undefined, organizationId: orgId },
      organization: { subscriptionStatus: undefined, paygCredits: undefined },
    });
    expect(decision).toEqual({ ok: false, error: 'PAYG_CREDIT_REQUIRED' });
  });

  it('rejette PAYG_CREDIT_REQUIRED quand subscription est `canceled`', () => {
    const decision = decidePublishGate({
      event: { planTier: undefined, organizationId: orgId },
      organization: { subscriptionStatus: 'canceled', paygCredits: 0 },
    });
    expect(decision).toEqual({ ok: false, error: 'PAYG_CREDIT_REQUIRED' });
  });

  it('rejette PAYG_CREDIT_REQUIRED quand subscription est `past_due` sans crédits', () => {
    const decision = decidePublishGate({
      event: { planTier: undefined, organizationId: orgId },
      organization: { subscriptionStatus: 'past_due', paygCredits: 0 },
    });
    expect(decision).toEqual({ ok: false, error: 'PAYG_CREDIT_REQUIRED' });
  });

  it('autorise publish PAYG quand sub est `unpaid` mais crédits > 0', () => {
    const decision = decidePublishGate({
      event: { planTier: undefined, organizationId: orgId },
      organization: { subscriptionStatus: 'unpaid', paygCredits: 2 },
    });
    expect(decision).toEqual({ ok: true, consumeCredit: true, nextCredits: 1 });
  });

  it('rejette PAYG_CREDIT_REQUIRED quand orga est null (event lié à orga supprimée)', () => {
    const decision = decidePublishGate({
      event: { planTier: undefined, organizationId: orgId },
      organization: null,
    });
    expect(decision).toEqual({ ok: false, error: 'PAYG_CREDIT_REQUIRED' });
  });
});

describe('decidePublishGate — précédence plan particulier > orga', () => {
  it('un event avec planTier ET organizationId reste dans le flow particulier', () => {
    const orgId = 'org_xyz' as unknown as never;
    const decision = decidePublishGate({
      event: { planTier: 'premium', organizationId: orgId },
      organization: { subscriptionStatus: undefined, paygCredits: 0 },
    });
    // Pas de crédit consommé : le planTier particulier prime.
    expect(decision).toEqual({ ok: true, consumeCredit: false });
  });
});
