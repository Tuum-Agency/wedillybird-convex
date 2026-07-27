import { describe, expect, it } from 'vitest';
import {
  BIOMETRIC_BANNED_STATES,
  FACE_SEARCH_NOTICE_VERSION,
  decideFaceSearchOptIn,
} from '../../../convex/lib/biometricConsent';

/**
 * Geofence biométrique (Lane T3, F7) — décision pure testée indépendamment
 * de Convex. `events.setFaceSearchEnabled` (tests d'intégration dans
 * `events-face-search.test.ts`) délègue cette même fonction.
 */
describe('decideFaceSearchOptIn — geofence IL/TX/WA', () => {
  it('refuse l’Illinois', () => {
    expect(decideFaceSearchOptIn('IL')).toEqual({ ok: false, error: 'STATE_BANNED' });
  });

  it('refuse le Texas', () => {
    expect(decideFaceSearchOptIn('TX')).toEqual({ ok: false, error: 'STATE_BANNED' });
  });

  it('refuse Washington', () => {
    expect(decideFaceSearchOptIn('WA')).toEqual({ ok: false, error: 'STATE_BANNED' });
  });

  it('autorise un autre État US (ex. New York)', () => {
    expect(decideFaceSearchOptIn('NY')).toEqual({ ok: true });
  });

  it('autorise une province canadienne', () => {
    expect(decideFaceSearchOptIn('CA-QC')).toEqual({ ok: true });
  });

  it('refuse une juridiction non déclarée (fail-closed) : undefined, vide, espaces', () => {
    // Sinon un mariage réellement en Illinois échapperait au geofence en
    // laissant simplement le champ vide (le défaut de l'UI).
    expect(decideFaceSearchOptIn(undefined)).toEqual({ ok: false, error: 'STATE_REQUIRED' });
    expect(decideFaceSearchOptIn('')).toEqual({ ok: false, error: 'STATE_REQUIRED' });
    expect(decideFaceSearchOptIn('   ')).toEqual({ ok: false, error: 'STATE_REQUIRED' });
  });

  it('autorise un mariage explicitement hors US/Canada (sentinelle NONE persistée)', () => {
    expect(decideFaceSearchOptIn('NONE')).toEqual({ ok: true });
  });

  it('la Californie (code US "CA") n’est pas confondue avec le préfixe canadien', () => {
    // "CA" (Californie) doit être traité comme un État US normal (autorisé),
    // distinct de "CA-XX" (province canadienne) — pas de collision de préfixe.
    expect(decideFaceSearchOptIn('CA')).toEqual({ ok: true });
  });

  it('BIOMETRIC_BANNED_STATES contient exactement IL/TX/WA', () => {
    expect([...BIOMETRIC_BANNED_STATES].sort()).toEqual(['IL', 'TX', 'WA']);
  });

  it('FACE_SEARCH_NOTICE_VERSION est une date ISO non vide', () => {
    expect(FACE_SEARCH_NOTICE_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
