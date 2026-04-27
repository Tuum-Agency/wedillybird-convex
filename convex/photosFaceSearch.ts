'use node';

/**
 * Recherche de photos par visage (Rekognition `SearchFacesByImage`).
 *
 * Module isolé en `'use node'` parce que `@aws-sdk/client-rekognition` exige
 * le runtime Node Convex (pas le runtime V8 par défaut). L'action publique
 * cohabite dans `photos.ts` (non-Node) et trampoline ici via `runAction`.
 *
 * IMPORTANT — privacy : le selfie envoyé par l'invité n'est JAMAIS persisté.
 * Il transite uniquement en mémoire vers Rekognition (`Image.Bytes`) puis est
 * libéré. Aucune écriture S3 / DB / log du contenu.
 */

import { v } from 'convex/values';
import { internalAction } from './_generated/server';
import {
  RekognitionClient,
  SearchFacesByImageCommand,
  type FaceMatch,
} from '@aws-sdk/client-rekognition';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var ${name} on Convex deployment`);
  return value;
}

let cached: RekognitionClient | null = null;
function getRekognition(): RekognitionClient {
  cached ??= new RekognitionClient({
    region: process.env.REKOGNITION_REGION ?? 'eu-west-1',
    credentials: {
      accessKeyId: requireEnv('AWS_ACCESS_KEY_ID'),
      secretAccessKey: requireEnv('AWS_SECRET_ACCESS_KEY'),
    },
  });
  return cached;
}

/**
 * Décode un selfie base64 (avec ou sans prefix data URL) en bytes.
 * Exporté pour les tests unitaires.
 */
export function decodeSelfie(selfieBase64: string): Uint8Array {
  const trimmed = selfieBase64.trim();
  const commaIdx = trimmed.indexOf(',');
  const b64 = trimmed.startsWith('data:') && commaIdx >= 0 ? trimmed.slice(commaIdx + 1) : trimmed;
  return Uint8Array.from(Buffer.from(b64, 'base64'));
}

export type SearchByImageResult =
  | { status: 'matches'; faceIds: string[] }
  | { status: 'no_face_in_selfie' }
  | { status: 'no_match' };

/**
 * Cœur métier de la recherche de visages, isolé du runtime Convex pour
 * pouvoir le tester sans l'environnement de l'action Convex. Accepte une
 * fonction `send` injectable qui simule l'appel Rekognition `send()`.
 *
 * Distingue les trois cas critiques :
 *  - `no_face_in_selfie`  : InvalidParameterException — pas de visage dans le selfie
 *  - `no_match`           : visage détecté mais aucun match dans la collection
 *  - `matches`            : un ou plusieurs visages correspondent
 */
export async function runSearchFacesByImage(
  send: (command: SearchFacesByImageCommand) => Promise<{ FaceMatches?: FaceMatch[] }>,
  args: {
    collectionId: string;
    selfieBase64: string;
    threshold?: number;
    maxFaces?: number;
  },
): Promise<SearchByImageResult> {
  const bytes = decodeSelfie(args.selfieBase64);
  if (bytes.byteLength === 0) {
    return { status: 'no_face_in_selfie' as const };
  }

  try {
    const result = await send(
      new SearchFacesByImageCommand({
        CollectionId: args.collectionId,
        Image: { Bytes: bytes },
        FaceMatchThreshold: args.threshold ?? 80,
        MaxFaces: args.maxFaces ?? 100,
        QualityFilter: 'AUTO',
      }),
    );
    const matches: FaceMatch[] = result.FaceMatches ?? [];
    if (matches.length === 0) {
      // Un visage a bien été identifié dans le selfie (sinon Rekognition
      // throw InvalidParameterException catchée plus bas) mais aucun match.
      return { status: 'no_match' as const };
    }
    const faceIds = matches
      .map((m) => m.Face?.FaceId)
      .filter((id): id is string => typeof id === 'string' && id.length > 0);
    return { status: 'matches' as const, faceIds };
  } catch (err) {
    const name = (err as { name?: string }).name;
    // InvalidParameterException : pas de visage dans l'image source. Le
    // message Rekognition contient typiquement "There are no faces in the
    // image" — on traite ce cas comme NO_FACE_DETECTED.
    if (name === 'InvalidParameterException') {
      return { status: 'no_face_in_selfie' as const };
    }
    // ResourceNotFoundException : la collection n'existe pas encore. On
    // remonte ça comme `no_match` parce que sémantiquement il n'y a rien
    // à matcher (le caller checkera `faceCollectionId` undefined avant
    // d'appeler — ce branch est défensif).
    if (name === 'ResourceNotFoundException') {
      return { status: 'no_match' as const };
    }
    throw err;
  }
}

/**
 * Wrapper interne autour de `SearchFacesByImage`. Délègue à la fonction pure
 * `runSearchFacesByImage` avec le client Rekognition réel.
 */
export const searchByImage = internalAction({
  args: {
    collectionId: v.string(),
    selfieBase64: v.string(),
    threshold: v.optional(v.number()),
    maxFaces: v.optional(v.number()),
  },
  handler: async (_ctx, args): Promise<SearchByImageResult> => {
    const client = getRekognition();
    return runSearchFacesByImage((cmd) => client.send(cmd) as Promise<{ FaceMatches?: FaceMatch[] }>, args);
  },
});

/**
 * Mapper pure : transforme un résultat de `runSearchFacesByImage` + un
 * accès résolu en réponse publique de `searchPhotosByFace`. Exporté pour les
 * tests unitaires.
 */
export type ResolveSearchAccess =
  | { ok: true; faceCollectionId?: string }
  | { ok: false; error: 'EVENT_NOT_FOUND' | 'FORBIDDEN' | 'INVALID_TOKEN' };

export type SearchPhotosByFaceResult =
  | { ok: true; photoIds: string[]; matchCount: number }
  | {
      ok: false;
      error: 'NO_FACE_DETECTED' | 'NO_COLLECTION_YET' | 'FORBIDDEN' | 'INVALID_TOKEN' | 'UNKNOWN';
    };

export function mapSearchAccessToError(
  access: ResolveSearchAccess,
): { ok: false; error: 'FORBIDDEN' | 'INVALID_TOKEN' } | { ok: true; faceCollectionId?: string } {
  if (access.ok) return { ok: true, faceCollectionId: access.faceCollectionId };
  if (access.error === 'EVENT_NOT_FOUND' || access.error === 'FORBIDDEN') {
    return { ok: false, error: 'FORBIDDEN' };
  }
  return { ok: false, error: 'INVALID_TOKEN' };
}

export function buildSearchResponse(
  access: ResolveSearchAccess,
  searchResult: SearchByImageResult | null,
  resolvedPhotoIds: string[],
): SearchPhotosByFaceResult {
  const accessMapped = mapSearchAccessToError(access);
  if (!accessMapped.ok) return accessMapped;
  if (!accessMapped.faceCollectionId) {
    return { ok: false as const, error: 'NO_COLLECTION_YET' as const };
  }
  if (!searchResult) return { ok: false as const, error: 'UNKNOWN' as const };
  if (searchResult.status === 'no_face_in_selfie') {
    return { ok: false as const, error: 'NO_FACE_DETECTED' as const };
  }
  if (searchResult.status === 'no_match') {
    return { ok: true as const, photoIds: [], matchCount: 0 };
  }
  return {
    ok: true as const,
    photoIds: resolvedPhotoIds,
    matchCount: resolvedPhotoIds.length,
  };
}

/**
 * Supprime une Face Collection Rekognition. Best-effort : un échec ne doit
 * pas empêcher la suppression métier de l'event en amont. Appelé par les
 * cleanup workflows (à câbler à `events:remove` quand cette mutation existera
 * — cf. BACKLOG).
 */
export const deleteFaceCollection = internalAction({
  args: { collectionId: v.string() },
  handler: async (_ctx, { collectionId }): Promise<{ ok: boolean; error?: string }> => {
    try {
      const { DeleteCollectionCommand } = await import('@aws-sdk/client-rekognition');
      await getRekognition().send(new DeleteCollectionCommand({ CollectionId: collectionId }));
      return { ok: true as const };
    } catch (err) {
      const name = (err as { name?: string }).name;
      if (name === 'ResourceNotFoundException') {
        return { ok: true as const };
      }
      return {
        ok: false as const,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
});
