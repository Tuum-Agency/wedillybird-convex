'use node';

import { v } from 'convex/values';
import { internal } from './_generated/api';
import { action } from './_generated/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'node:crypto';

const ALLOWED_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'] as const;
type AllowedContentType = (typeof ALLOWED_CONTENT_TYPES)[number];

const EXTENSION: Record<AllowedContentType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
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

export const createOrgLogoUploadUrl = action({
  args: {
    organizationId: v.id('organizations'),
    requesterId: v.id('users'),
    contentType: v.string(),
  },
  handler: async (
    ctx,
    { organizationId, requesterId, contentType },
  ): Promise<{ uploadUrl: string; s3Key: string }> => {
    if (!isAllowedContentType(contentType)) throw new Error('INVALID_CONTENT_TYPE');
    // Re-use an internal query to assert the requester can manage the org.
    await ctx.runQuery(internal.organizationsAuth.assertCanManageOrg, {
      organizationId,
      requesterId,
    });

    const s3Key = `branding/${organizationId}/logo-${randomUUID()}.${EXTENSION[contentType]}`;
    const command = new PutObjectCommand({
      Bucket: bucketName(),
      Key: s3Key,
      ContentType: contentType,
    });
    const uploadUrl = await getSignedUrl(getS3(), command, { expiresIn: 300 });
    return { uploadUrl, s3Key };
  },
});
