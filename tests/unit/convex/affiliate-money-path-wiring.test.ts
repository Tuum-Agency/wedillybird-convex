import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Câblage money-path affiliation — vérifs sur les sources (le repo n'a pas de
 * harnais convex-test ; la logique pure est couverte par `affiliate.test.ts` et
 * `affiliate-discount.test.ts`). On verrouille ici les points d'intégration :
 *  - la remise « communauté » (`buyerDiscountBps`) est bien APPLIQUÉE au checkout ;
 *  - la commission se calcule sur le NET (`commissionBaseMinor`), pas le catalogue ;
 *  - le comp admin réconcilie l'event et journalise.
 */
function repoSrc(...segments: string[]): string {
  return readFileSync(resolve(__dirname, '..', '..', '..', ...segments), 'utf-8');
}

describe('app/api/checkout/route.ts — remise affilié appliquée + base commission stockée', () => {
  const src = repoSrc('app', 'api', 'checkout', 'route.ts');

  it('résout la remise « communauté » du code (buyerDiscountBps) — plus du code mort', () => {
    expect(src).toMatch(/buyerDiscountBps/);
    expect(src).toMatch(/affiliateBuyerDiscountMinor\(/);
  });

  it('réserve le crédit de parrainage seulement sur ce qui reste APRÈS la remise', () => {
    expect(src).toMatch(/amountMinor - affiliateDiscountMinor/);
  });

  it('cumule remise + crédit dans un seul coupon Stripe', () => {
    expect(src).toMatch(/affiliateDiscountMinor \+ reserved\.appliedMinor/);
    expect(src).toMatch(/createOneTimeAmountCoupon\(totalDiscountMinor/);
  });

  it('transmet la remise réellement appliquée à l’intent (base de commission)', () => {
    expect(src).toMatch(/appliedAffiliateDiscountMinor/);
    expect(src).toMatch(/affiliateDiscountMinor: appliedAffiliateDiscountMinor/);
  });
});

describe('convex/payments.ts — commission sur le NET + remise persistée', () => {
  const src = repoSrc('convex', 'payments.ts');

  it('recordIntent stocke affiliateDiscountMinor', () => {
    expect(src).toMatch(/affiliateDiscountMinor: v\.optional\(v\.number\(\)\)/);
    expect(src).toMatch(/affiliateDiscountMinor: args\.affiliateDiscountMinor/);
  });

  it('markSucceeded calcule netMinor via commissionBaseMinor (pas le prix catalogue)', () => {
    expect(src).toMatch(/import \{ commissionBaseMinor \} from '\.\/lib\/affiliate'/);
    expect(src).toMatch(
      /netMinor: commissionBaseMinor\(payment\.amountMinor, payment\.affiliateDiscountMinor/,
    );
    // L'ancien bug (netMinor = prix catalogue) ne doit plus exister.
    expect(src).not.toMatch(/netMinor: payment\.amountMinor,/);
  });
});

describe('convex/admin.ts — comp forfait particulier (Premium offert)', () => {
  const src = repoSrc('convex', 'admin.ts');

  it('expose adminCompEventPlan (admin-only) qui réconcilie l’event', () => {
    expect(src).toMatch(/export const adminCompEventPlan = mutation\(/);
    expect(src).toMatch(/assertAdmin\(ctx, adminId\)/);
    expect(src).toMatch(/planTier: tier/);
    expect(src).toMatch(/galleryExpiresAt/);
  });

  it('journalise le cadeau dans l’audit log', () => {
    expect(src).toMatch(/action: 'comp_event_plan'/);
  });

  it('expose la recherche d’event par email (ciblage du mariage à offrir)', () => {
    expect(src).toMatch(/export const adminFindEventsByEmail = query\(/);
    expect(src).toMatch(/withIndex\('by_email'/);
  });
});

describe('convex/schema.ts — champ affiliateDiscountMinor sur payments', () => {
  const src = repoSrc('convex', 'schema.ts');
  it('la table payments porte la remise affilié', () => {
    expect(src).toMatch(/affiliateDiscountMinor: v\.optional\(v\.number\(\)\)/);
  });
});
