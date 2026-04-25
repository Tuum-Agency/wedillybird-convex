import type { S3Event } from 'aws-lambda';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { createHmac } from 'node:crypto';
import sharp from 'sharp';

const VARIANT_SIZES = {
  thumb: 320,
  medium: 800,
  full: 2000,
} as const;

type VariantName = keyof typeof VARIANT_SIZES;

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

function signPayload(secret: string, timestamp: string, body: string): string {
  return createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
}

/**
 * Derive a stable photoId-like prefix from the source key. The owner/guest upload
 * paths are `incoming/{eventId}/{uuid}.{ext}`; we use `{eventId}/{uuid}` so the
 * processed prefix mirrors the access tree.
 */
function processedKeyPrefix(sourceKey: string): string {
  // Strip the `incoming/` prefix and the trailing extension.
  const stripped = sourceKey.replace(/^incoming\//, '');
  const lastDot = stripped.lastIndexOf('.');
  return lastDot > 0 ? stripped.slice(0, lastDot) : stripped;
}

export async function generateVariants(source: Buffer): Promise<Record<VariantName, Buffer>> {
  const out: Partial<Record<VariantName, Buffer>> = {};
  for (const [name, size] of Object.entries(VARIANT_SIZES) as Array<[VariantName, number]>) {
    out[name] = await sharp(source)
      .rotate() // honour EXIF orientation
      .resize(size, size, { fit: 'cover', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
  }
  return out as Record<VariantName, Buffer>;
}

async function callbackConvex(payload: {
  s3Key: string;
  thumb: string;
  medium: string;
  full: string;
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
    throw new Error(`Convex callback failed: ${response.status} ${await response.text()}`);
  }
}

export const handler = async (event: S3Event): Promise<void> => {
  for (const record of event.Records) {
    const bucket = record.s3.bucket.name;
    const sourceKey = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));

    if (!sourceKey.startsWith('incoming/')) {
      console.log(`skip non-incoming key: ${sourceKey}`);
      continue;
    }

    console.log(`generating variants for s3://${bucket}/${sourceKey}`);
    const object = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: sourceKey }));
    if (!object.Body) {
      throw new Error(`s3 object body missing for ${sourceKey}`);
    }
    const sourceBuffer = await streamToBuffer(object.Body as NodeJS.ReadableStream);
    const variants = await generateVariants(sourceBuffer);

    const prefix = processedKeyPrefix(sourceKey);
    const keys = {
      thumb: `processed/${prefix}/thumb.webp`,
      medium: `processed/${prefix}/medium.webp`,
      full: `processed/${prefix}/full.webp`,
    };

    await Promise.all(
      (Object.keys(variants) as VariantName[]).map((name) =>
        s3.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: keys[name],
            Body: variants[name],
            ContentType: 'image/webp',
            CacheControl: 'public, max-age=31536000, immutable',
          }),
        ),
      ),
    );

    await callbackConvex({
      s3Key: sourceKey,
      thumb: keys.thumb,
      medium: keys.medium,
      full: keys.full,
    });
    console.log(`variants uploaded for ${sourceKey}`);
  }
};
