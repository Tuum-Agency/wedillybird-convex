import { describe, expect, it, vi, beforeEach } from 'vitest';
import { remove } from '../../../convex/photos';
import { TEST_SESSION_TOKEN, mockAuthSessionsQuery } from './helpers/auth-session';

/**
 * Helper : matche un schedule call par la forme de ses args plutôt que par
 * référence. Le proxy `internal.foo.bar` génère un nouvel objet à chaque
 * accès, donc on ne peut pas comparer `c.ref === internal.foo.bar`.
 */
function findScheduleByArgs<T extends Record<string, unknown>>(
  scheduleCalls: Array<{ ref: unknown; args: unknown }>,
  predicate: (args: T) => boolean,
): { ref: unknown; args: T } | undefined {
  return scheduleCalls.find((c) => predicate(c.args as T)) as { ref: unknown; args: T } | undefined;
}

/**
 * Tests du cleanup `photoFaces` lors de la suppression d'une photo individuelle.
 *
 * On invoque directement `remove._handler(ctx, args)` (Convex expose
 * `_handler` sur les mutations enregistrées) avec un ctx mocké minimal.
 *
 * Cible vérifiée :
 *  1. Toutes les rows `photoFaces` associées à la photo sont supprimées (db.delete)
 *  2. L'action `internal.photosFaceSearch.deleteFacesFromCollection` est
 *     schedulée avec les Face IDs collectés, IFF event.faceCollectionId existe
 *  3. Si event.faceCollectionId est undefined → pas de schedule (skip silencieux)
 *  4. Si aucun photoFace → pas de schedule
 *  5. La photo + son objet S3 sont supprimés (comportement existant préservé)
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyMutation = { _handler: (ctx: any, args: any) => Promise<any> };
const removeFn = remove as unknown as AnyMutation;

interface MockPhoto {
  _id: string;
  eventId: string;
  s3Key?: string;
  storageId?: string;
}

interface MockEvent {
  _id: string;
  ownerId: string;
  faceCollectionId?: string;
}

interface MockPhotoFace {
  _id: string;
  photoId: string;
  faceId: string;
}

function buildCtx(opts: {
  photo: MockPhoto | null;
  event: MockEvent | null;
  photoFaces: MockPhotoFace[];
  /**
   * Identité résolue depuis le `sessionToken` : c'est désormais Convex qui la
   * détermine (table `authSessions`), plus l'appelant via un argument.
   */
  sessionUserId?: string;
}) {
  const deleteCalls: string[] = [];
  const scheduleCalls: Array<{ ref: unknown; args: unknown }> = [];
  const storageDeleteCalls: string[] = [];

  const ctx = {
    db: {
      get: vi.fn(async (id: string) => {
        if (opts.photo && id === opts.photo._id) return opts.photo;
        if (opts.event && id === opts.event._id) return opts.event;
        return null;
      }),
      query: vi.fn((table: string) => {
        if (table === 'authSessions') {
          return mockAuthSessionsQuery(opts.sessionUserId ?? 'user_1');
        }
        if (table === 'photoFaces') {
          return {
            withIndex: (_indexName: string, _filter: unknown) => ({
              collect: async () => opts.photoFaces,
            }),
          };
        }
        throw new Error(`Unexpected query on table=${table}`);
      }),
      delete: vi.fn(async (id: string) => {
        deleteCalls.push(id);
      }),
    },
    scheduler: {
      runAfter: vi.fn(async (_delay: number, ref: unknown, args: unknown) => {
        scheduleCalls.push({ ref, args });
      }),
    },
    storage: {
      delete: vi.fn(async (id: string) => {
        storageDeleteCalls.push(id);
      }),
    },
  };

  return { ctx, deleteCalls, scheduleCalls, storageDeleteCalls };
}

describe('photos:remove — cleanup photoFaces + Rekognition DeleteFaces', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('supprime les rows photoFaces et schedule deleteFacesFromCollection quand faceCollectionId existe', async () => {
    const photo: MockPhoto = {
      _id: 'photo_1',
      eventId: 'event_1',
      s3Key: 'raw/event_1/photo_1.jpg',
    };
    const event: MockEvent = {
      _id: 'event_1',
      ownerId: 'user_1',
      faceCollectionId: 'wb-event-event_1',
    };
    const photoFaces: MockPhotoFace[] = [
      { _id: 'pf_1', photoId: 'photo_1', faceId: 'face-A' },
      { _id: 'pf_2', photoId: 'photo_1', faceId: 'face-B' },
    ];

    const { ctx, deleteCalls, scheduleCalls } = buildCtx({ photo, event, photoFaces });

    const result = await removeFn._handler(ctx, {
      photoId: 'photo_1',
      sessionToken: TEST_SESSION_TOKEN,
    });

    expect(result).toEqual({ ok: true });

    // Les 2 rows photoFaces sont supprimées + la photo elle-même.
    expect(deleteCalls).toContain('pf_1');
    expect(deleteCalls).toContain('pf_2');
    expect(deleteCalls).toContain('photo_1');

    // L'action DeleteFaces est schedulée avec les 2 Face IDs et la collection.
    const deleteFacesCall = findScheduleByArgs<{ collectionId: string; faceIds: string[] }>(
      scheduleCalls,
      (a) => Array.isArray(a?.faceIds) && typeof a?.collectionId === 'string',
    );
    expect(deleteFacesCall).toBeDefined();
    expect(deleteFacesCall?.args).toEqual({
      collectionId: 'wb-event-event_1',
      faceIds: ['face-A', 'face-B'],
    });

    // L'action S3 delete est aussi schedulée (comportement existant préservé).
    const s3DeleteCall = findScheduleByArgs<{ s3Key: string }>(
      scheduleCalls,
      (a) => typeof a?.s3Key === 'string',
    );
    expect(s3DeleteCall).toBeDefined();
    expect(s3DeleteCall?.args).toEqual({ s3Key: 'raw/event_1/photo_1.jpg' });
  });

  it('skip silencieux du DeleteFaces quand event.faceCollectionId est undefined', async () => {
    const photo: MockPhoto = {
      _id: 'photo_2',
      eventId: 'event_2',
      s3Key: 'raw/event_2/photo_2.jpg',
    };
    const event: MockEvent = {
      _id: 'event_2',
      ownerId: 'user_1',
      // Pas de faceCollectionId — event ancien sans indexation.
    };
    const photoFaces: MockPhotoFace[] = [
      { _id: 'pf_3', photoId: 'photo_2', faceId: 'face-orphan' },
    ];

    const { ctx, deleteCalls, scheduleCalls } = buildCtx({ photo, event, photoFaces });

    await removeFn._handler(ctx, { photoId: 'photo_2', sessionToken: TEST_SESSION_TOKEN });

    // Les rows DB sont quand même supprimées.
    expect(deleteCalls).toContain('pf_3');
    expect(deleteCalls).toContain('photo_2');

    // Pas de schedule DeleteFaces — rien à libérer côté Rekognition.
    const deleteFacesCall = findScheduleByArgs<{ collectionId: string; faceIds: string[] }>(
      scheduleCalls,
      (a) => Array.isArray(a?.faceIds) && typeof a?.collectionId === 'string',
    );
    expect(deleteFacesCall).toBeUndefined();
  });

  it("ne schedule pas DeleteFaces quand la photo n'a aucun row photoFaces", async () => {
    const photo: MockPhoto = {
      _id: 'photo_3',
      eventId: 'event_3',
      s3Key: 'raw/event_3/photo_3.jpg',
    };
    const event: MockEvent = {
      _id: 'event_3',
      ownerId: 'user_1',
      faceCollectionId: 'wb-event-event_3',
    };

    const { ctx, deleteCalls, scheduleCalls } = buildCtx({ photo, event, photoFaces: [] });

    await removeFn._handler(ctx, { photoId: 'photo_3', sessionToken: TEST_SESSION_TOKEN });

    // La photo est bien supprimée.
    expect(deleteCalls).toContain('photo_3');

    // Pas de schedule DeleteFaces — rien à libérer.
    const deleteFacesCall = findScheduleByArgs<{ collectionId: string; faceIds: string[] }>(
      scheduleCalls,
      (a) => Array.isArray(a?.faceIds) && typeof a?.collectionId === 'string',
    );
    expect(deleteFacesCall).toBeUndefined();
  });

  it('rejette PHOTO_NOT_FOUND si la photo n’existe pas', async () => {
    const { ctx } = buildCtx({ photo: null, event: null, photoFaces: [] });

    await expect(
      removeFn._handler(ctx, { photoId: 'photo_missing', sessionToken: TEST_SESSION_TOKEN }),
    ).rejects.toThrow('PHOTO_NOT_FOUND');
  });

  it('rejette FORBIDDEN quand le requester n’est pas le owner', async () => {
    const photo: MockPhoto = { _id: 'photo_4', eventId: 'event_4', s3Key: 'raw/x.jpg' };
    const event: MockEvent = { _id: 'event_4', ownerId: 'owner_other' };

    const { ctx } = buildCtx({ photo, event, photoFaces: [], sessionUserId: 'user_intruder' });

    await expect(
      removeFn._handler(ctx, { photoId: 'photo_4', sessionToken: TEST_SESSION_TOKEN }),
    ).rejects.toThrow('FORBIDDEN');
  });

  it('utilise ctx.storage.delete pour les photos legacy avec storageId au lieu de s3Key', async () => {
    const photo: MockPhoto = {
      _id: 'photo_5',
      eventId: 'event_5',
      storageId: 'storage_legacy',
    };
    const event: MockEvent = {
      _id: 'event_5',
      ownerId: 'user_1',
      faceCollectionId: 'wb-event-event_5',
    };
    const photoFaces: MockPhotoFace[] = [
      { _id: 'pf_5', photoId: 'photo_5', faceId: 'face-legacy' },
    ];

    const { ctx, scheduleCalls, storageDeleteCalls } = buildCtx({ photo, event, photoFaces });

    await removeFn._handler(ctx, { photoId: 'photo_5', sessionToken: TEST_SESSION_TOKEN });

    // Pas de schedule S3 (la photo est en Convex storage legacy).
    const s3DeleteCall = findScheduleByArgs<{ s3Key: string }>(
      scheduleCalls,
      (a) => typeof a?.s3Key === 'string',
    );
    expect(s3DeleteCall).toBeUndefined();
    // ctx.storage.delete a été appelé.
    expect(storageDeleteCalls).toContain('storage_legacy');
    // Le DeleteFaces est quand même schedulé.
    const deleteFacesCall = findScheduleByArgs<{ collectionId: string; faceIds: string[] }>(
      scheduleCalls,
      (a) => Array.isArray(a?.faceIds) && typeof a?.collectionId === 'string',
    );
    expect(deleteFacesCall).toBeDefined();
  });
});
