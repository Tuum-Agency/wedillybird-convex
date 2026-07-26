/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { setFaceSearchEnabled } from '../../../convex/events';

/**
 * `events.setFaceSearchEnabled` — opt-in reco-faciale (Lane T3, F7).
 *
 * On invoque directement `_handler(ctx, args)` avec un ctx mocké minimal,
 * même patron que `photos-remove-faces.test.ts` / `webhook-secret-gate.test.ts`.
 * Couvre les trois comportements demandés par le Lane :
 *  (a) refuse l'activation pour IL/TX/WA
 *  (b) persiste `faceSearchConsent` (horodatage + version notice + user)
 *  (c) désactivation toujours autorisée, garde l'historique de consentement
 * + les gardes d'accès (owner/collaborateur) et de forfait (Essentiel exclu).
 */

type AnyFn = { _handler: (ctx: any, args: any) => Promise<any> };
const setFaceSearchEnabledFn = setFaceSearchEnabled as unknown as AnyFn;

interface MockEvent {
  _id: string;
  ownerId: string;
  planTier?: 'essential' | 'premium';
  organizationId?: string;
  weddingState?: string;
  faceSearchEnabled?: boolean;
}

function buildCtx(event: MockEvent, collaborator?: { role: string } | null) {
  let patched: any = null;
  const ctx = {
    db: {
      get: vi.fn(async (id: string) => (id === event._id ? event : null)),
      query: vi.fn((table: string) => {
        if (table !== 'eventCollaborators') throw new Error(`Unexpected query on table=${table}`);
        return {
          withIndex: (_indexName: string, _filter: unknown) => ({
            first: async () => collaborator ?? null,
          }),
        };
      }),
      patch: vi.fn(async (_id: string, patch: any) => {
        patched = patch;
      }),
    },
  };
  return { ctx, getPatched: () => patched };
}

describe('setFaceSearchEnabled — geofence + consentement', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-25T10:00:00Z'));
  });

  it('(a) refuse l’activation pour l’Illinois — pas de patch effectué', async () => {
    const event: MockEvent = {
      _id: 'evt_il',
      ownerId: 'user_1',
      planTier: 'premium',
      weddingState: 'IL',
    };
    const { ctx, getPatched } = buildCtx(event);

    await expect(
      setFaceSearchEnabledFn._handler(ctx, {
        eventId: 'evt_il',
        requesterId: 'user_1',
        enabled: true,
      }),
    ).rejects.toThrow('FACE_SEARCH_STATE_BANNED');
    expect(getPatched()).toBeNull();
  });

  it('(a) refuse l’activation pour le Texas et Washington', async () => {
    for (const state of ['TX', 'WA']) {
      const event: MockEvent = {
        _id: 'evt_x',
        ownerId: 'user_1',
        planTier: 'premium',
        weddingState: state,
      };
      const { ctx } = buildCtx(event);
      await expect(
        setFaceSearchEnabledFn._handler(ctx, {
          eventId: 'evt_x',
          requesterId: 'user_1',
          enabled: true,
        }),
      ).rejects.toThrow('FACE_SEARCH_STATE_BANNED');
    }
  });

  it('(a) refuse l’activation si le NOUVEL État soumis (pas l’ancien persisté) est banni — pas de race', async () => {
    // L'event a un weddingState existant "NY" (autorisé), mais la requête
    // soumet en même temps weddingState: "IL" — le geofence doit évaluer
    // la valeur qu'on est en train de choisir, pas l'ancienne.
    const event: MockEvent = {
      _id: 'evt_race',
      ownerId: 'user_1',
      planTier: 'premium',
      weddingState: 'NY',
    };
    const { ctx, getPatched } = buildCtx(event);

    await expect(
      setFaceSearchEnabledFn._handler(ctx, {
        eventId: 'evt_race',
        requesterId: 'user_1',
        enabled: true,
        weddingState: 'IL',
      }),
    ).rejects.toThrow('FACE_SEARCH_STATE_BANNED');
    expect(getPatched()).toBeNull();
  });

  it('(b) persiste faceSearchConsent (horodatage + version notice + user) à l’activation', async () => {
    const event: MockEvent = {
      _id: 'evt_ok',
      ownerId: 'user_1',
      planTier: 'premium',
      weddingState: 'NY',
    };
    const { ctx, getPatched } = buildCtx(event);

    const res = await setFaceSearchEnabledFn._handler(ctx, {
      eventId: 'evt_ok',
      requesterId: 'user_1',
      enabled: true,
    });

    expect(res).toMatchObject({ ok: true, enabled: true, weddingState: 'NY' });
    const patched = getPatched();
    expect(patched.faceSearchEnabled).toBe(true);
    expect(patched.faceSearchConsent).toEqual({
      enabledAt: Date.now(),
      noticeVersion: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      byUserId: 'user_1',
    });
  });

  it('(b) l’activation met aussi à jour weddingState quand fourni dans le même appel', async () => {
    const event: MockEvent = { _id: 'evt_ny', ownerId: 'user_1', planTier: 'premium' };
    const { ctx, getPatched } = buildCtx(event);

    const res = await setFaceSearchEnabledFn._handler(ctx, {
      eventId: 'evt_ny',
      requesterId: 'user_1',
      enabled: true,
      weddingState: 'ny', // minuscules → normalisé en majuscules
    });

    expect(res).toMatchObject({ ok: true, enabled: true, weddingState: 'NY' });
    expect(getPatched().weddingState).toBe('NY');
  });

  it('(c) la désactivation est toujours autorisée, même pour un État banni', async () => {
    const event: MockEvent = {
      _id: 'evt_il2',
      ownerId: 'user_1',
      planTier: 'premium',
      weddingState: 'IL',
      faceSearchEnabled: true,
    };
    const { ctx, getPatched } = buildCtx(event);

    const res = await setFaceSearchEnabledFn._handler(ctx, {
      eventId: 'evt_il2',
      requesterId: 'user_1',
      enabled: false,
    });

    expect(res).toMatchObject({ ok: true, enabled: false });
    const patched = getPatched();
    expect(patched.faceSearchEnabled).toBe(false);
    // Ne touche PAS l'historique de consentement — pas de clé faceSearchConsent
    // dans le patch de désactivation.
    expect(patched).not.toHaveProperty('faceSearchConsent');
  });

  it('(c) weddingState: "" efface le champ à la désactivation', async () => {
    const event: MockEvent = {
      _id: 'evt_clear',
      ownerId: 'user_1',
      planTier: 'premium',
      weddingState: 'NY',
      faceSearchEnabled: true,
    };
    const { ctx, getPatched } = buildCtx(event);

    const res = await setFaceSearchEnabledFn._handler(ctx, {
      eventId: 'evt_clear',
      requesterId: 'user_1',
      enabled: false,
      weddingState: '',
    });

    expect(res).toMatchObject({ ok: true, weddingState: undefined });
    expect(getPatched().weddingState).toBeUndefined();
  });

  it('refuse FEATURE_NOT_IN_PLAN pour un event Essentiel (défense en profondeur, hors geofence)', async () => {
    const event: MockEvent = {
      _id: 'evt_essential',
      ownerId: 'user_1',
      planTier: 'essential',
      weddingState: 'NY',
    };
    const { ctx, getPatched } = buildCtx(event);

    await expect(
      setFaceSearchEnabledFn._handler(ctx, {
        eventId: 'evt_essential',
        requesterId: 'user_1',
        enabled: true,
      }),
    ).rejects.toThrow('FEATURE_NOT_IN_PLAN');
    expect(getPatched()).toBeNull();
  });

  it('refuse FORBIDDEN pour un tiers sans lien avec l’event', async () => {
    const event: MockEvent = { _id: 'evt_forbidden', ownerId: 'user_1', planTier: 'premium' };
    const { ctx } = buildCtx(event, null);

    await expect(
      setFaceSearchEnabledFn._handler(ctx, {
        eventId: 'evt_forbidden',
        requesterId: 'user_intruder',
        enabled: true,
      }),
    ).rejects.toThrow('FORBIDDEN');
  });

  it('autorise un collaborateur rôle "couple" (mariage d’agence) à activer', async () => {
    const event: MockEvent = {
      _id: 'evt_agency',
      ownerId: 'agency_owner',
      organizationId: 'org_1',
      weddingState: 'NY',
    };
    const { ctx, getPatched } = buildCtx(event, { role: 'couple' });

    const res = await setFaceSearchEnabledFn._handler(ctx, {
      eventId: 'evt_agency',
      requesterId: 'couple_user',
      enabled: true,
    });

    expect(res).toMatchObject({ ok: true, enabled: true });
    expect(getPatched().faceSearchConsent.byUserId).toBe('couple_user');
  });

  it('refuse FORBIDDEN pour un collaborateur rôle "viewer" (lecture seule)', async () => {
    const event: MockEvent = {
      _id: 'evt_viewer',
      ownerId: 'agency_owner',
      organizationId: 'org_1',
      weddingState: 'NY',
    };
    const { ctx } = buildCtx(event, { role: 'viewer' });

    await expect(
      setFaceSearchEnabledFn._handler(ctx, {
        eventId: 'evt_viewer',
        requesterId: 'viewer_user',
        enabled: true,
      }),
    ).rejects.toThrow('FORBIDDEN');
  });
});
