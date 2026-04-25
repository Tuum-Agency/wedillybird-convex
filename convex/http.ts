import { httpRouter } from 'convex/server';
import { httpAction } from './_generated/server';
import { internal } from './_generated/api';

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
    decision?: 'approved' | 'rejected';
    topLabel?: string;
    topConfidence?: number;
    labels?: Array<{ name: string; confidence: number }>;
  };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response('invalid JSON', { status: 400 });
  }
  if (!payload.s3Key || (payload.decision !== 'approved' && payload.decision !== 'rejected')) {
    return new Response('invalid payload', { status: 400 });
  }

  const result = await ctx.runMutation(internal.photos.internalMarkModerated, {
    s3Key: payload.s3Key,
    decision: payload.decision,
    topLabel: payload.topLabel,
    topConfidence: payload.topConfidence,
    labels: payload.labels,
  });
  return Response.json(result);
});

http.route({
  path: '/lambda/photo-moderation-callback',
  method: 'POST',
  handler: moderationCallback,
});

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

  let payload: { s3Key?: string; thumb?: string; medium?: string; full?: string };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response('invalid JSON', { status: 400 });
  }
  if (!payload.s3Key || !payload.thumb || !payload.medium || !payload.full) {
    return new Response('invalid payload', { status: 400 });
  }

  const result = await ctx.runMutation(internal.photos.setVariants, {
    s3Key: payload.s3Key,
    thumb: payload.thumb,
    medium: payload.medium,
    full: payload.full,
  });
  return Response.json(result);
});

http.route({
  path: '/lambda/photo-variants-callback',
  method: 'POST',
  handler: variantsCallback,
});

export default http;
