import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Fix sécurité F-09 (audit avril 2026) — `extendRetentionPostEvent` doit
 * être une `internalMutation` (et non une `mutation` publique). La version
 * publique permettait à n'importe quel owner d'événement d'étendre la
 * rétention galerie à 5 ans sans payer l'upsell post-event.
 *
 * On vérifie via grep AST-light. Convex génère les types runtime à partir
 * du source, donc le moyen le plus fiable de garantir l'invariant est de
 * lire le source.
 */
describe('convex/payments.ts — extendRetentionPostEvent (F-09)', () => {
  const paymentsSrc = readFileSync(
    resolve(__dirname, '..', '..', '..', 'convex', 'payments.ts'),
    'utf-8',
  );

  it('est exporté en `internalMutation`', () => {
    expect(paymentsSrc).toMatch(/export const extendRetentionPostEvent\s*=\s*internalMutation\(/);
  });

  it("n'est PAS exporté en `mutation` publique (régression guard)", () => {
    expect(paymentsSrc).not.toMatch(/export const extendRetentionPostEvent\s*=\s*mutation\(/);
  });

  it('importe bien `internalMutation` du serveur Convex', () => {
    expect(paymentsSrc).toMatch(/internalMutation/);
  });
});
