import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Câblage serveur des déclencheurs de notifications. Le repo n'a pas de harnais
 * convex-test (cf. `org-provisioned-gate.test.ts`) : la logique pure de
 * sélection/lien est couverte par `notify-recipients.test.ts` et l'autorité par
 * `rsvp-config-auth.test.ts` ; ici on vérifie que chaque mutation appelle bien
 * le notifieur avec le bon type et le bon périmètre.
 */
function convexSrc(...segments: string[]): string {
  return readFileSync(resolve(__dirname, '..', '..', '..', 'convex', ...segments), 'utf-8');
}

describe('déclencheurs de notifications — câblage', () => {
  it('rsvps.submit notifie sur réponse à l’invitation', () => {
    const src = convexSrc('rsvps.ts');
    expect(src).toMatch(/notifyEventParties\(/);
    expect(src).toMatch(/type:\s*'rsvp_response'/);
  });

  it('events.updateRsvpConfig prévient l’agence quand le couple modifie', () => {
    const src = convexSrc('events.ts');
    expect(src).toMatch(/type:\s*'rsvp_config_changed'/);
    expect(src).toMatch(/includeCouple:\s*false/);
  });

  it('planning.createTask prévient le couple rattaché', () => {
    const src = convexSrc('planning.ts');
    expect(src).toMatch(/type:\s*'planning_task'/);
    expect(src).toMatch(/includeOwner:\s*false/);
  });

  it('updateRsvpConfig applique la décision d’autorité pure et refuse si non autorisé', () => {
    const src = convexSrc('events.ts');
    expect(src).toMatch(/decideRsvpConfigWrite\(/);
    expect(src).toMatch(/if \(!decision\.allowed\) throw new Error\('FORBIDDEN'\)/);
  });
});
