import { describe, expect, it, vi } from 'vitest';
import {
  buildSearchResponse,
  decodeSelfie,
  mapSearchAccessToError,
  runSearchFacesByImage,
  type ResolveSearchAccess,
  type SearchByImageResult,
} from '../../../convex/photosFaceSearch';

describe('decodeSelfie', () => {
  it('decodes a raw base64 string into bytes', () => {
    const b64 = Buffer.from('hello').toString('base64');
    const bytes = decodeSelfie(b64);
    expect(Buffer.from(bytes).toString('utf-8')).toBe('hello');
  });

  it('decodes a data URL prefix', () => {
    const b64 = Buffer.from('jpeg-bytes').toString('base64');
    const dataUrl = `data:image/jpeg;base64,${b64}`;
    const bytes = decodeSelfie(dataUrl);
    expect(Buffer.from(bytes).toString('utf-8')).toBe('jpeg-bytes');
  });

  it('handles whitespace around the input', () => {
    const b64 = Buffer.from('trimmed').toString('base64');
    const bytes = decodeSelfie(`  \n${b64}  `);
    expect(Buffer.from(bytes).toString('utf-8')).toBe('trimmed');
  });

  it('returns empty bytes for an empty input', () => {
    expect(decodeSelfie('').byteLength).toBe(0);
  });
});

describe('runSearchFacesByImage — Rekognition wrapper', () => {
  const validBase64 = Buffer.from('fake-image-bytes').toString('base64');

  it('returns matches with deduplicated FaceIds when Rekognition responds with FaceMatches', async () => {
    const send = vi.fn().mockResolvedValue({
      FaceMatches: [
        { Face: { FaceId: 'face-1', Confidence: 95 }, Similarity: 92 },
        { Face: { FaceId: 'face-2', Confidence: 90 }, Similarity: 88 },
        { Face: { FaceId: 'face-3', Confidence: 85 }, Similarity: 81 },
      ],
    });
    const result = await runSearchFacesByImage(send, {
      collectionId: 'wb-event-foo',
      selfieBase64: validBase64,
    });
    expect(result.status).toBe('matches');
    if (result.status === 'matches') {
      expect(result.faceIds).toEqual(['face-1', 'face-2', 'face-3']);
    }
    expect(send).toHaveBeenCalledOnce();
  });

  it('returns no_match when FaceMatches is empty (visage détecté mais aucun match)', async () => {
    const send = vi.fn().mockResolvedValue({ FaceMatches: [] });
    const result = await runSearchFacesByImage(send, {
      collectionId: 'wb-event-foo',
      selfieBase64: validBase64,
    });
    expect(result.status).toBe('no_match');
  });

  it('returns no_face_in_selfie on InvalidParameterException', async () => {
    const err = Object.assign(new Error('There are no faces in the image'), {
      name: 'InvalidParameterException',
    });
    const send = vi.fn().mockRejectedValue(err);
    const result = await runSearchFacesByImage(send, {
      collectionId: 'wb-event-foo',
      selfieBase64: validBase64,
    });
    expect(result.status).toBe('no_face_in_selfie');
  });

  it('returns no_face_in_selfie on empty input bytes', async () => {
    const send = vi.fn();
    const result = await runSearchFacesByImage(send, {
      collectionId: 'wb-event-foo',
      selfieBase64: '',
    });
    expect(result.status).toBe('no_face_in_selfie');
    expect(send).not.toHaveBeenCalled();
  });

  it('treats ResourceNotFoundException defensively as no_match', async () => {
    const err = Object.assign(new Error('Collection does not exist'), {
      name: 'ResourceNotFoundException',
    });
    const send = vi.fn().mockRejectedValue(err);
    const result = await runSearchFacesByImage(send, {
      collectionId: 'wb-event-missing',
      selfieBase64: validBase64,
    });
    expect(result.status).toBe('no_match');
  });

  it('rethrows unknown errors so the caller can map to UNKNOWN', async () => {
    const err = Object.assign(new Error('throttled'), { name: 'ThrottlingException' });
    const send = vi.fn().mockRejectedValue(err);
    await expect(
      runSearchFacesByImage(send, {
        collectionId: 'wb-event-foo',
        selfieBase64: validBase64,
      }),
    ).rejects.toThrow('throttled');
  });

  it('filters out face matches without FaceId', async () => {
    const send = vi.fn().mockResolvedValue({
      FaceMatches: [
        { Face: { FaceId: 'face-1' } },
        { Face: {} },
        { Face: { FaceId: 'face-2' } },
      ],
    });
    const result = await runSearchFacesByImage(send, {
      collectionId: 'wb-event-foo',
      selfieBase64: validBase64,
    });
    expect(result.status).toBe('matches');
    if (result.status === 'matches') {
      expect(result.faceIds).toEqual(['face-1', 'face-2']);
    }
  });
});

describe('mapSearchAccessToError', () => {
  it('passes through ok responses', () => {
    const access: ResolveSearchAccess = { ok: true, faceCollectionId: 'wb-event-foo' };
    expect(mapSearchAccessToError(access)).toEqual({ ok: true, faceCollectionId: 'wb-event-foo' });
  });

  it('maps EVENT_NOT_FOUND → FORBIDDEN (don’t leak existence)', () => {
    const access: ResolveSearchAccess = { ok: false, error: 'EVENT_NOT_FOUND' };
    expect(mapSearchAccessToError(access)).toEqual({ ok: false, error: 'FORBIDDEN' });
  });

  it('maps FORBIDDEN as-is', () => {
    const access: ResolveSearchAccess = { ok: false, error: 'FORBIDDEN' };
    expect(mapSearchAccessToError(access)).toEqual({ ok: false, error: 'FORBIDDEN' });
  });

  it('maps INVALID_TOKEN as-is', () => {
    const access: ResolveSearchAccess = { ok: false, error: 'INVALID_TOKEN' };
    expect(mapSearchAccessToError(access)).toEqual({ ok: false, error: 'INVALID_TOKEN' });
  });
});

describe('buildSearchResponse — public API of searchPhotosByFace', () => {
  it('returns NO_COLLECTION_YET when access is ok but no collection has been created', () => {
    const access: ResolveSearchAccess = { ok: true };
    const result = buildSearchResponse(access, { status: 'no_match' }, []);
    expect(result).toEqual({ ok: false, error: 'NO_COLLECTION_YET' });
  });

  it('returns NO_FACE_DETECTED when search wrapper says no_face_in_selfie', () => {
    const access: ResolveSearchAccess = { ok: true, faceCollectionId: 'wb-event-foo' };
    const search: SearchByImageResult = { status: 'no_face_in_selfie' };
    const result = buildSearchResponse(access, search, []);
    expect(result).toEqual({ ok: false, error: 'NO_FACE_DETECTED' });
  });

  it('returns ok with empty photoIds when no_match', () => {
    const access: ResolveSearchAccess = { ok: true, faceCollectionId: 'wb-event-foo' };
    const search: SearchByImageResult = { status: 'no_match' };
    const result = buildSearchResponse(access, search, []);
    expect(result).toEqual({ ok: true, photoIds: [], matchCount: 0 });
  });

  it('returns ok with 3 photoIds when matches resolve to 3 approved photos', () => {
    const access: ResolveSearchAccess = { ok: true, faceCollectionId: 'wb-event-foo' };
    const search: SearchByImageResult = {
      status: 'matches',
      faceIds: ['face-1', 'face-2', 'face-3'],
    };
    const photoIds = ['photo-1', 'photo-2', 'photo-3'];
    const result = buildSearchResponse(access, search, photoIds);
    expect(result).toEqual({ ok: true, photoIds, matchCount: 3 });
  });

  it('returns FORBIDDEN when access is denied (event not found OR not owner/collab)', () => {
    const access: ResolveSearchAccess = { ok: false, error: 'FORBIDDEN' };
    const result = buildSearchResponse(access, null, []);
    expect(result).toEqual({ ok: false, error: 'FORBIDDEN' });
  });

  it('returns FORBIDDEN when event does not exist (does not leak existence)', () => {
    const access: ResolveSearchAccess = { ok: false, error: 'EVENT_NOT_FOUND' };
    const result = buildSearchResponse(access, null, []);
    expect(result).toEqual({ ok: false, error: 'FORBIDDEN' });
  });

  it('returns INVALID_TOKEN when guest token is invalid', () => {
    const access: ResolveSearchAccess = { ok: false, error: 'INVALID_TOKEN' };
    const result = buildSearchResponse(access, null, []);
    expect(result).toEqual({ ok: false, error: 'INVALID_TOKEN' });
  });

  it('returns UNKNOWN when search result is null (Rekognition threw an unhandled error)', () => {
    const access: ResolveSearchAccess = { ok: true, faceCollectionId: 'wb-event-foo' };
    const result = buildSearchResponse(access, null, []);
    expect(result).toEqual({ ok: false, error: 'UNKNOWN' });
  });
});
