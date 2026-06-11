import { describe, expect, it } from 'vitest';
import { NOTIF_TYPES, DEFAULT_NOTIF_PREFS, mergeNotifPrefs } from '../../../lib/pro/notifications';

describe('mergeNotifPrefs', () => {
  it('retourne les défauts quand rien n’est stocké', () => {
    expect(mergeNotifPrefs(null)).toEqual(DEFAULT_NOTIF_PREFS);
    expect(mergeNotifPrefs(undefined)).toEqual(DEFAULT_NOTIF_PREFS);
  });

  it('couvre les 5 types de notification', () => {
    const merged = mergeNotifPrefs({});
    expect(Object.keys(merged).sort()).toEqual([...NOTIF_TYPES.map((t) => t.key)].sort());
  });

  it('respecte les valeurs stockées et complète le reste par défaut', () => {
    const merged = mergeNotifPrefs({ rsvp: { email: false, app: false } });
    expect(merged.rsvp).toEqual({ email: false, app: false });
    // weeklyDigest non fourni → défaut conservé.
    expect(merged.weeklyDigest).toEqual(DEFAULT_NOTIF_PREFS.weeklyDigest);
  });

  it('complète un canal partiellement fourni', () => {
    const merged = mergeNotifPrefs({
      payment: { email: false } as { email: boolean; app: boolean },
    });
    expect(merged.payment.email).toBe(false);
    expect(merged.payment.app).toBe(DEFAULT_NOTIF_PREFS.payment.app);
  });
});
