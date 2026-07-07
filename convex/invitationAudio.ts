'use node';

import { v } from 'convex/values';
import { internal } from './_generated/api';
import { action } from './_generated/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'node:crypto';

/**
 * Upload des médias personnalisés de l'invitation (couple/agence) :
 * musique ET photo du couple.
 *
 * Presigned PUT S3 sous les préfixes `audio/{eventId}/…` (musique) et
 * `invitation/{eventId}/…` (photo) — DISTINCTS de `incoming/` : le Lambda de
 * modération Rekognition ne se déclenche pas sur ces préfixes (la photo est
 * celle du couple lui-même, pas un contenu invité à modérer). Les fichiers
 * sont servis publiquement via CloudFront (`musicForClient`/`photoForClient`).
 *
 * Taille max contrôlée côté client — un presigned PUT ne peut pas l'imposer
 * strictement ; le préfixe par event et l'expiration courte (300 s) bornent
 * l'abus.
 */
const ALLOWED_AUDIO_TYPES: Record<string, string> = {
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/aac': 'aac',
};

const ALLOWED_IMAGE_TYPES: Record<string, string> = {
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
    await ctx.runQuery(internal.coupleSpace.assertOwnerCanCustomizeInvitation, {
      eventId,
      requesterId,
    });
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

/**
 * Presigned PUT S3 pour la photo du couple (invitation). Mêmes gardes que la
 * musique : propriétaire + feature `cinematicInvitation`, préfixe
 * `invitation/{eventId}/`, JPEG/PNG/WebP. Le fichier est compressé côté client
 * (≤ 2 Mo, ≤ 2000 px) avant l'envoi.
 */
export const createInvitationPhotoUploadUrl = action({
  args: {
    eventId: v.id('events'),
    requesterId: v.id('users'),
    contentType: v.string(),
  },
  handler: async (
    ctx,
    { eventId, requesterId, contentType },
  ): Promise<{ uploadUrl: string; s3Key: string }> => {
    await ctx.runQuery(internal.coupleSpace.assertOwnerCanCustomizeInvitation, {
      eventId,
      requesterId,
    });
    const ext = ALLOWED_IMAGE_TYPES[contentType];
    if (!ext) throw new Error('INVALID_CONTENT_TYPE');
    const s3Key = `invitation/${eventId}/${randomUUID()}.${ext}`;
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
