'use node';

import { v } from 'convex/values';
import { internal } from './_generated/api';
import { internalAction, action } from './_generated/server';
import { S3Client, DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'node:crypto';
import { requireUserIdFromAction } from './lib/verifiedSession';

const ALLOWED_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
type AllowedContentType = (typeof ALLOWED_CONTENT_TYPES)[number];

const EXTENSION: Record<AllowedContentType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var ${name} on Convex deployment`);
  return value;
}

let cachedClient: S3Client | null = null;
function getS3(): S3Client {
  cachedClient ??= new S3Client({
    region: requireEnv('AWS_REGION'),
    credentials: {
      accessKeyId: requireEnv('AWS_ACCESS_KEY_ID'),
      secretAccessKey: requireEnv('AWS_SECRET_ACCESS_KEY'),
    },
  });
  return cachedClient;
}

function bucketName(): string {
  return requireEnv('S3_BUCKET');
}

function isAllowedContentType(value: string): value is AllowedContentType {
  return (ALLOWED_CONTENT_TYPES as readonly string[]).includes(value);
}

async function makeUploadUrl(
  eventId: string,
  contentType: string,
): Promise<{
  uploadUrl: string;
  s3Key: string;
}> {
  if (!isAllowedContentType(contentType)) throw new Error('INVALID_CONTENT_TYPE');
  const s3Key = `incoming/${eventId}/${randomUUID()}.${EXTENSION[contentType]}`;
  const command = new PutObjectCommand({
    Bucket: bucketName(),
    Key: s3Key,
    ContentType: contentType,
  });
  const uploadUrl = await getSignedUrl(getS3(), command, { expiresIn: 300 });
  return { uploadUrl, s3Key };
}

export const createOwnerS3UploadUrl = action({
  args: {
    eventId: v.id('events'),
    sessionToken: v.string(),
    contentType: v.string(),
  },
  handler: async (
    ctx,
    { eventId, sessionToken, contentType },
  ): Promise<{
    uploadUrl: string;
    s3Key: string;
  }> => {
    const requesterId = await requireUserIdFromAction(ctx, sessionToken);
    await ctx.runQuery(internal.photos.assertOwnerCanUpload, { eventId, requesterId });
    return await makeUploadUrl(eventId, contentType);
  },
});

export const createGuestS3UploadUrl = action({
  args: {
    token: v.string(),
    contentType: v.string(),
  },
  handler: async (
    ctx,
    { token, contentType },
  ): Promise<{
    uploadUrl: string;
    s3Key: string;
  }> => {
    const { eventId } = await ctx.runQuery(internal.photos.assertGuestCanUpload, { token });
    return await makeUploadUrl(eventId, contentType);
  },
});

export const deleteS3Object = internalAction({
  args: { s3Key: v.string() },
  handler: async (_ctx, { s3Key }) => {
    await getS3().send(
      new DeleteObjectCommand({
        Bucket: bucketName(),
        Key: s3Key,
      }),
    );
    return { ok: true as const };
  },
});
