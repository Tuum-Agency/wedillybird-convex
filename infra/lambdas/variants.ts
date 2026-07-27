import type { S3Event, S3EventRecord, SNSEvent } from 'aws-lambda';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { createHmac } from 'node:crypto';
import sharp from 'sharp';

/* -------------------------------------------------------------------------- */
/*  Génération de variantes WebP                                               */
/* -------------------------------------------------------------------------- */
/* Déclenché en parallèle du Lambda modération sur S3 OBJECT_CREATED          */
/* prefix `incoming/`. Génère 3 tailles WebP responsives :                     */
/*  - thumb  : max 256 px, quality 75 (galerie masonry, ~12 KB / image)        */
/*  - medium : max 1024 px, quality 80 (lightbox, ~80 KB / image)              */
/*  - large  : max 2048 px, quality 82 (download / ZIP, ~250 KB / image)       */
/* Stocke sous `processed/{eventId}/{photoId}/{size}.webp` puis POST callback */
/* HMAC vers Convex pour patcher `photos.variants`.                            */
/*                                                                            */
/* Idempotent : un même upload qui re-trigger le Lambda écrase les keys       */
/* déterministes — le résultat reste correct.                                 */
/* -------------------------------------------------------------------------- */

interface VariantConfig {
  name: 'thumb' | 'medium' | 'large';
  maxDimension: number;
  quality: number;
}

const VARIANTS: ReadonlyArray<VariantConfig> = [
  { name: 'thumb', maxDimension: 256, quality: 75 },
  { name: 'medium', maxDimension: 1024, quality: 80 },
  { name: 'large', maxDimension: 2048, quality: 82 },
];

const s3 = new S3Client({});

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    if (Buffer.isBuffer(chunk)) chunks.push(chunk);
    else if (typeof chunk === 'string') chunks.push(Buffer.from(chunk));
    else chunks.push(Buffer.from(chunk as Uint8Array));
  }
  return Buffer.concat(chunks);
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var ${name}`);
  return value;
}

interface IncomingKeyParts {
  eventId: string;
  photoId: string;
}

/**
 * Extrait `eventId` + `photoId` depuis la convention de nommage S3
 * `incoming/{eventId}/{photoId}.{ext}` (cf. `convex/photosActions.ts`).
 * Retourne `null` pour tout ce qui ne match pas (logs + skip).
 */
function parseIncomingKey(s3Key: string): IncomingKeyParts | null {
  const parts = s3Key.split('/');
  if (parts.length !== 3 || parts[0] !== 'incoming') return null;
  const eventId = parts[1];
  const filename = parts[2];
  if (!eventId || !filename) return null;
  const dot = filename.lastIndexOf('.');
  const photoId = dot > 0 ? filename.slice(0, dot) : filename;
  if (!photoId) return null;
  return { eventId, photoId };
}

interface VariantOutput {
  name: VariantConfig['name'];
  s3Key: string;
}

async function generateVariant(
  bytes: Buffer,
  bucket: string,
  basePrefix: string,
  config: VariantConfig,
): Promise<VariantOutput> {
  const buffer = await sharp(bytes, { failOn: 'error' })
    .rotate() // respecte EXIF orientation pour ne pas livrer une thumb à l'envers
    .resize({
      width: config.maxDimension,
      height: config.maxDimension,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: config.quality, effort: 4 })
    .toBuffer();
  const key = `${basePrefix}/${config.name}.webp`;
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: 'image/webp',
      // Cache long côté CloudFront — les keys sont immutables (un nouvel
      // upload écrase, mais un même photoId garde toujours le même contenu).
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  );
  return { name: config.name, s3Key: key };
}

function signPayload(secret: string, timestamp: string, body: string): string {
  return createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
}

async function callbackConvex(payload: {
  s3Key: string;
  variants: { thumb?: string; medium?: string; large?: string };
}): Promise<void> {
  const url = `${requireEnv('CONVEX_SITE_URL')}/lambda/photo-variants-callback`;
  const secret = requireEnv('LAMBDA_CALLBACK_SECRET');
  const body = JSON.stringify(payload);
  const timestamp = String(Date.now());
  const signature = signPayload(secret, timestamp, body);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-wedillybird-signature': signature,
      'x-wedillybird-timestamp': timestamp,
    },
    body,
  });
  if (!response.ok) {
    throw new Error(`Convex variants callback failed: ${response.status} ${await response.text()}`);
  }
}

/**
 * Fan-out S3 → SNS → Lambda : l'event reçu est un SNSEvent qui enveloppe
 * l'event S3 (un topic SNS permet modération ET variants sur le même préfixe
 * `incoming/`, ce que la notification S3 directe interdit). On déballe chaque
 * message SNS (JSON de l'event S3) en records S3. Compat si un event S3 direct
 * arrive (ancien câblage).
 */
function extractS3Records(event: SNSEvent | S3Event): S3EventRecord[] {
  const records = (event as { Records?: unknown[] }).Records ?? [];
  if (records.length > 0 && (records[0] as { Sns?: unknown }).Sns) {
    return (event as SNSEvent).Records.flatMap((r) => {
      try {
        return (JSON.parse(r.Sns.Message) as S3Event).Records ?? [];
      } catch {
        return [];
      }
    });
  }
  return (event as S3Event).Records ?? [];
}

export const handler = async (event: SNSEvent | S3Event): Promise<void> => {
  for (const record of extractS3Records(event)) {
    const bucket = record.s3.bucket.name;
    const s3Key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));

    if (!s3Key.startsWith('incoming/')) {
      console.log(`skip non-incoming key: ${s3Key}`);
      continue;
    }
    const parsed = parseIncomingKey(s3Key);
    if (!parsed) {
      console.warn(`[variants] cannot parse incoming key=${s3Key}, skipping`);
      continue;
    }

    console.log(`generating variants for s3://${bucket}/${s3Key}`);
    const object = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: s3Key }));
    if (!object.Body) {
      throw new Error(`s3 object body missing for ${s3Key}`);
    }
    const bytes = await streamToBuffer(object.Body as NodeJS.ReadableStream);

    const basePrefix = `processed/${parsed.eventId}/${parsed.photoId}`;
    // Sérialisé pour limiter la pression mémoire — Sharp décompresse
    // l'image en RAM, et un mariage = potentiellement 2 000 photos uploadées
    // en parallèle. À 512 MB / Lambda, mieux vaut 3 passes séquentielles.
    const generated: VariantOutput[] = [];
    for (const config of VARIANTS) {
      try {
        const variant = await generateVariant(bytes, bucket, basePrefix, config);
        generated.push(variant);
      } catch (err) {
        console.warn(
          `[variants] generation failed for ${config.name} on ${s3Key}: ${
            err instanceof Error ? err.message : err
          }`,
        );
      }
    }

    if (generated.length === 0) {
      console.warn(`[variants] no variant generated for ${s3Key}`);
      continue;
    }

    const variants: { thumb?: string; medium?: string; large?: string } = {};
    for (const v of generated) variants[v.name] = v.s3Key;

    await callbackConvex({ s3Key, variants });
    console.log(`[variants] done ${s3Key} → ${generated.map((v) => v.name).join(',')}`);
  }
};
