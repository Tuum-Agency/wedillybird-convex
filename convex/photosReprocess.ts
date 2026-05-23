'use node';

/**
 * Action de réparation one-shot pour le bug du 2026-05-23.
 *
 * Contexte : entre le 25-04 et le 23-05 2026, le Lambda Moderation avait sa
 * var d'env `CONVEX_SITE_URL` pointée sur le déploiement Convex **dev**
 * (`capable-crocodile-720`) au lieu de **prod** (`fearless-poodle-133`).
 * Toutes les photos uploadées pendant cette période ont été modérées par
 * Rekognition côté AWS, mais leur callback `internalMarkModerated` est
 * partie sur dev. Côté prod, ces photos restent en `status: pending` à
 * vie — invisibles pour l'invité (filtré par `listApprovedForGuest`) et
 * en attente de modération manuelle pour l'owner.
 *
 * Cette action re-déclenche la Lambda Moderation prod (qui a maintenant le
 * bon `CONVEX_SITE_URL`) en faisant un `CopyObject` S3 sur la key existante
 * pour chaque photo pending. Le `CopyObject` génère un événement
 * `s3:ObjectCreated:Copy`, capté par le trigger Lambda existant
 * (qui écoute tous les `s3:ObjectCreated:*` sur `incoming/`). Pas de
 * download/upload côté Convex — server-side copy, 0 bande passante.
 *
 * Idempotent : si une photo a déjà été re-modérée et patchée en `approved`
 * ou `rejected`, l'action skip (filter `status: pending`). Si un CopyObject
 * sur une photo déjà supprimée du bucket (S3 lifecycle 30 jours sur
 * `incoming/`) échoue, on log et on continue.
 *
 * Usage (depuis le shell racine après `pnpm convex:deploy`) :
 *   pnpx convex run --prod photosReprocess:reprocessStuckPending '{}'
 *     → dry-run par défaut, retourne le count des photos qui seraient
 *       reprocessées sans rien faire côté S3
 *   pnpx convex run --prod photosReprocess:reprocessStuckPending '{"dryRun":false,"limit":500}'
 *     → exécute le CopyObject sur jusqu'à 500 photos pending
 */

import { v } from 'convex/values';
import { internal } from './_generated/api';
import { internalAction } from './_generated/server';
import { S3Client, CopyObjectCommand } from '@aws-sdk/client-s3';

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

interface ReprocessResult {
  dryRun: boolean;
  scanned: number;
  retriggered: number;
  s3Missing: number;
  errors: number;
  sampleS3Keys: string[];
}

export const reprocessStuckPending = internalAction({
  args: {
    /**
     * Si true (défaut), retourne juste le count sans appeler S3. Permet de
     * vérifier le scope avant de lancer pour de bon.
     */
    dryRun: v.optional(v.boolean()),
    /**
     * Plafond du nombre de photos à traiter en une invocation. Défaut 100.
     * Convex actions ont un timeout de 10 minutes, et chaque CopyObject est
     * ~50ms, donc on peut monter à 500-1000 sans risque. Augmenter par
     * paliers si beaucoup de photos coincées.
     */
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { dryRun, limit }): Promise<ReprocessResult> => {
    const effectiveDryRun = dryRun ?? true;
    const effectiveLimit = limit ?? 100;

    const photos = await ctx.runQuery(internal.photos.listAllPendingForReprocess, {
      limit: effectiveLimit,
    });

    const result: ReprocessResult = {
      dryRun: effectiveDryRun,
      scanned: photos.length,
      retriggered: 0,
      s3Missing: 0,
      errors: 0,
      sampleS3Keys: photos.slice(0, 5).map((p) => p.s3Key ?? '<no-s3Key>'),
    };

    if (effectiveDryRun) return result;

    const bucket = requireEnv('S3_BUCKET');
    const s3 = getS3();

    for (const photo of photos) {
      if (!photo.s3Key) {
        result.errors += 1;
        continue;
      }
      try {
        await s3.send(
          new CopyObjectCommand({
            Bucket: bucket,
            CopySource: encodeURIComponent(`${bucket}/${photo.s3Key}`),
            Key: photo.s3Key,
            MetadataDirective: 'COPY',
          }),
        );
        result.retriggered += 1;
      } catch (err) {
        const name = err instanceof Error ? err.name : 'Unknown';
        if (name === 'NoSuchKey' || name === 'NotFound') {
          result.s3Missing += 1;
        } else {
           
          console.error(`reprocess failed for ${photo.s3Key}: ${String(err)}`);
          result.errors += 1;
        }
      }
    }

    return result;
  },
});
