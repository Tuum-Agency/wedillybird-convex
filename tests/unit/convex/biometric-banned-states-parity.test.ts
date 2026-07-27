import { describe, it, expect } from 'vitest';
import { BIOMETRIC_BANNED_STATES } from '../../../convex/lib/biometricConsent';
import { BIOMETRIC_BANNED_STATE_CODES } from '../../../lib/geo/regions';

/**
 * Les États à loi biométrique stricte (IL / TX / WA) sont listés à DEUX endroits :
 * côté Convex (`biometricConsent.ts`, le gate serveur fail-closed) et côté app
 * (`regions.ts`, le sélecteur d'État de l'écran couple) — duplication assumée car
 * le bundler Convex ne suit pas les imports app-side.
 *
 * Ce test échoue si l'une dérive sans l'autre. Une divergence ouvrirait un trou de
 * conformité : soit l'UI propose un État que le serveur bloque (le couple croit
 * activer, ça ne marche jamais), soit — bien pire — l'UI laisse activer un État
 * que le serveur ne bloque plus (indexation biométrique dans une juridiction à
 * risque BIPA/CUBI). C'est le mode d'échec biométrique du premortem, transformé
 * en garde-fou automatique.
 */
describe('parité des listes d’États à biométrie bannie (Convex ⇄ app)', () => {
  it('BIOMETRIC_BANNED_STATES (Convex) === BIOMETRIC_BANNED_STATE_CODES (app)', () => {
    const convex = [...BIOMETRIC_BANNED_STATES].sort();
    const app = [...BIOMETRIC_BANNED_STATE_CODES].sort();
    expect(convex).toEqual(app);
  });

  it('contient au moins IL, TX, WA des deux côtés', () => {
    for (const state of ['IL', 'TX', 'WA']) {
      expect(BIOMETRIC_BANNED_STATES.has(state)).toBe(true);
      expect(BIOMETRIC_BANNED_STATE_CODES.has(state)).toBe(true);
    }
  });
});
