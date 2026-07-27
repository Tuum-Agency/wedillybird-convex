/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi } from 'vitest';
import { _resolveSearchAccess, _isFaceSearchEnabled } from '../../../convex/photos';

/**
 * Gate `event.faceSearchEnabled` sur la recherche par visage (Lane T3, F7,
 * point (c) demandé : « searchPhotosByFace refuse quand faceSearchEnabled
 * est faux »). `_resolveSearchAccess` est le point d'entrée réel utilisé par
 * l'action publique `searchPhotosByFace` (photos.ts) — testé directement ici
 * plutôt que via les helpers `photosFaceSearch.ts` (dérive constatée : ces
 * helpers ne sont plus appelés par le runtime, cf. `face-search.test.ts`).
 *
 * `_isFaceSearchEnabled` est l'internalQuery exposée au Lambda de modération
 * via l'endpoint HTTP signé `/lambda/face-search-enabled`.
 */

type AnyFn = { _handler: (ctx: any, args: any) => Promise<any> };
const resolveFn = _resolveSearchAccess as unknown as AnyFn;
const isEnabledFn = _isFaceSearchEnabled as unknown as AnyFn;

interface MockEvent {
  _id: string;
  ownerId: string;
  planTier?: 'essential' | 'premium';
  organizationId?: string;
  faceSearchEnabled?: boolean;
  faceCollectionId?: string;
}

function buildCtx(event: MockEvent | null, guest?: { eventId: string } | null) {
  const ctx = {
    db: {
      get: vi.fn(async (id: string) => (event && id === event._id ? event : null)),
      query: vi.fn((table: string) => {
        if (table === 'eventCollaborators') {
          return { withIndex: () => ({ first: async () => null }) };
        }
        if (table === 'guests') {
          return { withIndex: () => ({ first: async () => guest ?? null }) };
        }
        throw new Error(`Unexpected query on table=${table}`);
      }),
    },
  };
  return ctx;
}

describe('_resolveSearchAccess — gate faceSearchEnabled (owner)', () => {
  it('FACE_SEARCH_DISABLED quand le forfait couvre la feature mais que l’event n’a pas opt-in', async () => {
    const event: MockEvent = {
      _id: 'evt_1',
      ownerId: 'user_1',
      planTier: 'premium',
      faceSearchEnabled: false,
    };
    const res = await resolveFn._handler(buildCtx(event), {
      eventId: 'evt_1',
      requesterId: 'user_1',
    });
    expect(res).toEqual({ ok: false, error: 'FACE_SEARCH_DISABLED' });
  });

  it('FACE_SEARCH_DISABLED quand faceSearchEnabled est absent (défaut OFF)', async () => {
    const event: MockEvent = { _id: 'evt_2', ownerId: 'user_1', planTier: 'premium' };
    const res = await resolveFn._handler(buildCtx(event), {
      eventId: 'evt_2',
      requesterId: 'user_1',
    });
    expect(res).toEqual({ ok: false, error: 'FACE_SEARCH_DISABLED' });
  });

  it('autorise (ok: true) quand le forfait couvre la feature ET que l’event a opt-in', async () => {
    const event: MockEvent = {
      _id: 'evt_3',
      ownerId: 'user_1',
      planTier: 'premium',
      faceSearchEnabled: true,
      faceCollectionId: 'wb-event-evt_3',
    };
    const res = await resolveFn._handler(buildCtx(event), {
      eventId: 'evt_3',
      requesterId: 'user_1',
    });
    expect(res).toEqual({ ok: true, faceCollectionId: 'wb-event-evt_3' });
  });

  it('FEATURE_NOT_IN_PLAN prime sur FACE_SEARCH_DISABLED pour un event Essentiel', async () => {
    const event: MockEvent = {
      _id: 'evt_4',
      ownerId: 'user_1',
      planTier: 'essential',
      faceSearchEnabled: true, // ne devrait jamais arriver (mutation le bloque), gate défensif quand même
    };
    const res = await resolveFn._handler(buildCtx(event), {
      eventId: 'evt_4',
      requesterId: 'user_1',
    });
    expect(res).toEqual({ ok: false, error: 'FEATURE_NOT_IN_PLAN' });
  });
});

describe('_resolveSearchAccess — gate faceSearchEnabled (invité via token)', () => {
  it('FACE_SEARCH_DISABLED pour un invité d’un event pro non opt-in', async () => {
    const event: MockEvent = {
      _id: 'evt_5',
      ownerId: 'agency_owner',
      organizationId: 'org_1',
      faceSearchEnabled: false,
    };
    const res = await resolveFn._handler(buildCtx(event, { eventId: 'evt_5' }), {
      eventId: 'evt_5',
      guestToken: 'tok_abc',
    });
    expect(res).toEqual({ ok: false, error: 'FACE_SEARCH_DISABLED' });
  });

  it('autorise l’invité quand l’event pro a opt-in', async () => {
    const event: MockEvent = {
      _id: 'evt_6',
      ownerId: 'agency_owner',
      organizationId: 'org_1',
      faceSearchEnabled: true,
      faceCollectionId: 'wb-event-evt_6',
    };
    const res = await resolveFn._handler(buildCtx(event, { eventId: 'evt_6' }), {
      eventId: 'evt_6',
      guestToken: 'tok_abc',
    });
    expect(res).toEqual({ ok: true, faceCollectionId: 'wb-event-evt_6' });
  });
});

describe('_isFaceSearchEnabled — lecture exposée au Lambda (/lambda/face-search-enabled)', () => {
  it('renvoie { enabled: true } quand l’event a opt-in', async () => {
    const event: MockEvent = { _id: 'evt_7', ownerId: 'user_1', faceSearchEnabled: true };
    const res = await isEnabledFn._handler(buildCtx(event), { eventId: 'evt_7' });
    expect(res).toEqual({ enabled: true });
  });

  it('renvoie { enabled: false } quand l’event n’a pas opt-in', async () => {
    const event: MockEvent = { _id: 'evt_8', ownerId: 'user_1', faceSearchEnabled: false };
    const res = await isEnabledFn._handler(buildCtx(event), { eventId: 'evt_8' });
    expect(res).toEqual({ enabled: false });
  });

  it('fail-closed : renvoie { enabled: false } quand l’event n’existe plus', async () => {
    const res = await isEnabledFn._handler(buildCtx(null), { eventId: 'evt_missing' });
    expect(res).toEqual({ enabled: false });
  });
});
