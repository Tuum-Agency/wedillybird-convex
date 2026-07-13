import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Garde-fou « forfait choisi » — câblage serveur.
 *
 * Une agence sans abonnement actif ni crédit Pay-as-you-go ne doit PAS pouvoir
 * créer de mariage, de rétroplanning ni de fiche prestataire. Le repo n'a pas
 * de harnais convex-test : on vérifie donc, comme le test F-01
 * (`organizations-update-subscription.test.ts`), que le garde-fou est bien
 * présent dans les sources des mutations de création — la logique pure est
 * couverte par `org-access.test.ts`.
 */
function convexSrc(...segments: string[]): string {
  return readFileSync(resolve(__dirname, '..', '..', '..', 'convex', ...segments), 'utf-8');
}

describe('convex/lib/orgAuth.ts — assertOrgProvisioned', () => {
  const src = convexSrc('lib', 'orgAuth.ts');

  it('exporte le garde-fou', () => {
    expect(src).toMatch(/export async function assertOrgProvisioned\(/);
  });

  it('refuse avec SUBSCRIPTION_REQUIRED via orgHasActiveAccess', () => {
    expect(src).toMatch(/orgHasActiveAccess\(/);
    expect(src).toMatch(/throw new Error\('SUBSCRIPTION_REQUIRED'\)/);
  });
});

describe('convex/events.ts — création de mariage gated (parcours agence)', () => {
  const src = convexSrc('events.ts');

  it('la mutation create exige membership + forfait pour un event d’organisation', () => {
    // Le garde-fou vit dans le bloc `if (args.organizationId)` : membership
    // (assertOrgWrite) + accès actif (orgHasActiveAccess) → SUBSCRIPTION_REQUIRED.
    expect(src).toMatch(/if \(args\.organizationId\)\s*\{[\s\S]*?assertOrgWrite\(/);
    expect(src).toMatch(/orgHasActiveAccess\(orgForCurrency\)/);
    expect(src).toMatch(/SUBSCRIPTION_REQUIRED/);
  });

  it('n’impacte pas le parcours couple : le gate est conditionné à organizationId', () => {
    // La création sans organizationId (couple one-shot) ne passe jamais par le
    // garde-fou : il est strictement à l'intérieur du `if (args.organizationId)`.
    const gateIndex = src.indexOf('orgHasActiveAccess(orgForCurrency)');
    const condIndex = src.indexOf('if (args.organizationId)');
    expect(condIndex).toBeGreaterThan(-1);
    expect(gateIndex).toBeGreaterThan(condIndex);
  });
});

describe('convex/planning.ts — rétroplanning gated', () => {
  const src = convexSrc('planning.ts');

  it('importe assertOrgProvisioned', () => {
    expect(src).toMatch(/import\s*\{[^}]*assertOrgProvisioned[^}]*\}\s*from\s*'\.\/lib\/orgAuth'/);
  });

  it('gate les 4 mutations de création (task, tasks, saveTemplate, applyTemplate)', () => {
    const calls = src.match(/assertOrgProvisioned\(ctx, event\.organizationId\)/g) ?? [];
    expect(calls.length).toBeGreaterThanOrEqual(4);
  });
});

describe('convex/vendors.ts — prestataires gated', () => {
  const src = convexSrc('vendors.ts');

  it('la création de fiche exige un forfait actif', () => {
    expect(src).toMatch(/assertOrgProvisioned\(ctx, args\.organizationId\)/);
  });
});
