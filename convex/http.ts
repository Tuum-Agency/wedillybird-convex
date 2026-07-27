import { httpRouter } from 'convex/server';
import { httpAction } from './_generated/server';
import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';

const http = httpRouter();

const SIGNATURE_HEADER = 'x-wedillybird-signature';
const TIMESTAMP_HEADER = 'x-wedillybird-timestamp';
const MAX_TIMESTAMP_SKEW_MS = 5 * 60 * 1000;

async function verifySignature(
  rawBody: string,
  timestamp: string,
  signature: string,
): Promise<boolean> {
  const secret = process.env.LAMBDA_CALLBACK_SECRET;
  if (!secret) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const expected = await crypto.subtle.sign('HMAC', key, enc.encode(`${timestamp}.${rawBody}`));
  const expectedHex = Array.from(new Uint8Array(expected))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  if (expectedHex.length !== signature.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expectedHex.length; i++) {
    mismatch |= expectedHex.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return mismatch === 0;
}

const moderationCallback = httpAction(async (ctx, req) => {
  const rawBody = await req.text();
  const signature = req.headers.get(SIGNATURE_HEADER);
  const timestamp = req.headers.get(TIMESTAMP_HEADER);
  if (!signature || !timestamp) {
    return new Response('missing signature headers', { status: 400 });
  }
  const skew = Math.abs(Date.now() - Number(timestamp));
  if (!Number.isFinite(skew) || skew > MAX_TIMESTAMP_SKEW_MS) {
    return new Response('stale or invalid timestamp', { status: 400 });
  }
  if (!(await verifySignature(rawBody, timestamp, signature))) {
    return new Response('bad signature', { status: 401 });
  }

  let payload: {
    s3Key?: string;
    decision?: 'approved' | 'rejected' | 'manual_review';
    topLabel?: string;
    topConfidence?: number;
    labels?: Array<{ name: string; confidence: number }>;
    ocrText?: string;
    ocrFlaggedKeyword?: string;
    contentLabels?: string[];
    reviewReason?: string;
  };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response('invalid JSON', { status: 400 });
  }
  if (
    !payload.s3Key ||
    (payload.decision !== 'approved' &&
      payload.decision !== 'rejected' &&
      payload.decision !== 'manual_review')
  ) {
    return new Response('invalid payload', { status: 400 });
  }

  const result = await ctx.runMutation(internal.photos.internalMarkModerated, {
    s3Key: payload.s3Key,
    decision: payload.decision,
    topLabel: payload.topLabel,
    topConfidence: payload.topConfidence,
    labels: payload.labels,
    ocrText: payload.ocrText,
    ocrFlaggedKeyword: payload.ocrFlaggedKeyword,
    contentLabels: payload.contentLabels,
    reviewReason: payload.reviewReason,
  });
  return Response.json(result);
});

http.route({
  path: '/lambda/photo-moderation-callback',
  method: 'POST',
  handler: moderationCallback,
});

/**
 * Callback HMAC distinct du verdict modération : posté par le Lambda APRÈS
 * une modération `approved` réussie + IndexFaces sur la photo. Stocke les
 * visages détectés dans `photoFaces` pour permettre la recherche par selfie.
 *
 * Idempotent côté mutation interne (vérifie `photoId + faceId` avant insert).
 */
const facesCallback = httpAction(async (ctx, req) => {
  const rawBody = await req.text();
  const signature = req.headers.get(SIGNATURE_HEADER);
  const timestamp = req.headers.get(TIMESTAMP_HEADER);
  if (!signature || !timestamp) {
    return new Response('missing signature headers', { status: 400 });
  }
  const skew = Math.abs(Date.now() - Number(timestamp));
  if (!Number.isFinite(skew) || skew > MAX_TIMESTAMP_SKEW_MS) {
    return new Response('stale or invalid timestamp', { status: 400 });
  }
  if (!(await verifySignature(rawBody, timestamp, signature))) {
    return new Response('bad signature', { status: 401 });
  }

  let payload: {
    s3Key?: string;
    collectionId?: string;
    faces?: Array<{
      faceId?: string;
      boundingBox?: { width: number; height: number; left: number; top: number };
      confidence?: number;
    }>;
  };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response('invalid JSON', { status: 400 });
  }
  if (!payload.s3Key || !payload.collectionId || !Array.isArray(payload.faces)) {
    return new Response('invalid payload', { status: 400 });
  }

  const cleanFaces = payload.faces
    .filter(
      (
        f,
      ): f is {
        faceId: string;
        boundingBox?: { width: number; height: number; left: number; top: number };
        confidence?: number;
      } => typeof f.faceId === 'string' && f.faceId.length > 0,
    )
    .map((f) => ({
      faceId: f.faceId,
      boundingBox: f.boundingBox,
      confidence: f.confidence,
    }));

  const result = await ctx.runMutation(internal.photos.internalRegisterPhotoFaces, {
    s3Key: payload.s3Key,
    collectionId: payload.collectionId,
    faces: cleanFaces,
  });
  return Response.json(result);
});

http.route({
  path: '/lambda/photo-faces-callback',
  method: 'POST',
  handler: facesCallback,
});

/**
 * Callback HMAC posté par le Lambda Sharp après génération des variantes
 * (thumb/medium/large) en `processed/{eventId}/{photoId}/{size}.webp`.
 * Patche `photos.variants` avec les keys WebP.
 *
 * Best-effort : si la photo n'existe plus côté Convex (deleted entre l'upload
 * et le callback), on no-op proprement (200 ok). Les variantes orphelines
 * en S3 sont nettoyées via la lifecycle rule `archive-processed`.
 */
const variantsCallback = httpAction(async (ctx, req) => {
  const rawBody = await req.text();
  const signature = req.headers.get(SIGNATURE_HEADER);
  const timestamp = req.headers.get(TIMESTAMP_HEADER);
  if (!signature || !timestamp) {
    return new Response('missing signature headers', { status: 400 });
  }
  const skew = Math.abs(Date.now() - Number(timestamp));
  if (!Number.isFinite(skew) || skew > MAX_TIMESTAMP_SKEW_MS) {
    return new Response('stale or invalid timestamp', { status: 400 });
  }
  if (!(await verifySignature(rawBody, timestamp, signature))) {
    return new Response('bad signature', { status: 401 });
  }

  let payload: {
    s3Key?: string;
    variants?: { thumb?: string; medium?: string; large?: string };
  };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response('invalid JSON', { status: 400 });
  }
  if (!payload.s3Key || !payload.variants || typeof payload.variants !== 'object') {
    return new Response('invalid payload', { status: 400 });
  }

  const result = await ctx.runMutation(internal.photos.internalSetVariants, {
    s3Key: payload.s3Key,
    variants: {
      ...(payload.variants.thumb ? { thumb: payload.variants.thumb } : {}),
      ...(payload.variants.medium ? { medium: payload.variants.medium } : {}),
      ...(payload.variants.large ? { large: payload.variants.large } : {}),
    },
  });
  return Response.json(result);
});

http.route({
  path: '/lambda/photo-variants-callback',
  method: 'POST',
  handler: variantsCallback,
});

/**
 * Vrai gate d'INDEXATION biométrique (Lane T3, F7) : le Lambda de modération
 * (`infra/lambdas/moderation.ts`) appelle cet endpoint AVANT tout
 * `IndexFacesCommand` et skip l'indexation si `enabled: false`. Signé HMAC
 * comme les autres routes `/lambda/*`. Fail-closed côté Lambda : toute
 * erreur réseau/signature/parsing doit être traitée comme `enabled: false`
 * par l'appelant (jamais indexer par défaut en cas de doute).
 */
const faceSearchEnabledCallback = httpAction(async (ctx, req) => {
  const rawBody = await req.text();
  const signature = req.headers.get(SIGNATURE_HEADER);
  const timestamp = req.headers.get(TIMESTAMP_HEADER);
  if (!signature || !timestamp) {
    return new Response('missing signature headers', { status: 400 });
  }
  const skew = Math.abs(Date.now() - Number(timestamp));
  if (!Number.isFinite(skew) || skew > MAX_TIMESTAMP_SKEW_MS) {
    return new Response('stale or invalid timestamp', { status: 400 });
  }
  if (!(await verifySignature(rawBody, timestamp, signature))) {
    return new Response('bad signature', { status: 401 });
  }

  let payload: { eventId?: string };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response('invalid JSON', { status: 400 });
  }
  if (!payload.eventId || typeof payload.eventId !== 'string') {
    return new Response('invalid payload', { status: 400 });
  }

  const result = await ctx.runQuery(internal.photos._isFaceSearchEnabled, {
    eventId: payload.eventId as Id<'events'>,
  });
  return Response.json(result);
});

http.route({
  path: '/lambda/face-search-enabled',
  method: 'POST',
  handler: faceSearchEnabledCallback,
});

export default http;
