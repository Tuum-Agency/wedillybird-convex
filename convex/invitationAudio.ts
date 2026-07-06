'use node';

import { v } from 'convex/values';
import { internal } from './_generated/api';
import { action } from './_generated/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'node:crypto';

/**
 * Upload de la musique personnalisée de l'invitation (couple/agence).
 *
 * Presigned PUT S3 sous le préfixe `audio/{eventId}/…` — DISTINCT de
 * `incoming/` : le Lambda de modération Rekognition (images) ne se déclenche
 * pas sur ce préfixe. Le fichier est ensuite servi publiquement via
 * CloudFront (`invitationMusic.s3Key` → `musicForClient`).
 *
 * Taille max contrôlée côté client (10 Mo) — un presigned PUT ne peut pas
 * l'imposer strictement ; le préfixe par event et l'expiration courte (300 s)
 * bornent l'abus.
 */
const ALLOWED_AUDIO_TYPES: Record<string, string> = {
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/aac': 'aac',
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

export const createInvitationMusicUploadUrl = action({
  args: {
    eventId: v.id('events'),
    requesterId: v.id('users'),
    contentType: v.string(),
  },
  handler: async (
    ctx,
    { eventId, requesterId, contentType },
  ): Promise<{ uploadUrl: string; s3Key: string }> => {
    await ctx.runQuery(internal.coupleSpace.assertOwnerCanUploadMusic, { eventId, requesterId });
    const ext = ALLOWED_AUDIO_TYPES[contentType];
    if (!ext) throw new Error('INVALID_CONTENT_TYPE');
    const s3Key = `audio/${eventId}/${randomUUID()}.${ext}`;
    const command = new PutObjectCommand({
      Bucket: requireEnv('S3_BUCKET'),
      Key: s3Key,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable',
    });
    const uploadUrl = await getSignedUrl(getS3(), command, { expiresIn: 300 });
    return { uploadUrl, s3Key };
  },
});
