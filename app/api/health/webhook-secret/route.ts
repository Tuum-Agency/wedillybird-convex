import { NextResponse } from 'next/server';
import { convexApi, getConvexServerClient } from '@/lib/auth/convex-server';
import { isExpectedProdConvexUrl } from '@/lib/convex-deployment';

/**
 * Health-check post-déploiement indépendant du money-path (T2-1).
 *
 * Le webhook de paiement et le filet de la success-page partagent le même
 * `getConvexServerClient()` + `CONVEX_WEBHOOK_SECRET` — une dérive de config
 * casse les deux identiquement, en silence (précédent exact : `CONVEX_SITE_URL`
 * pointait dev en prod pendant des semaines, cf. Lambda Moderation
 * 2026-05-23). Cette route vérifie SÉPARÉMENT :
 *   1. `NEXT_PUBLIC_CONVEX_URL` pointe le déploiement prod attendu (en prod
 *      uniquement — pas de contrainte en preview/dev).
 *   2. `CONVEX_WEBHOOK_SECRET` fait un aller-retour réussi jusqu'à Convex
 *      (`health.verifyWebhookSecret`, une query, aucune écriture).
 *
 * GET /api/health/webhook-secret → 200 si tout va bien, 500 sinon (avec
 * `reason` explicite). À appeler après chaque déploiement prod — voir le
 * handoff fondateur (aucun hook Vercel automatique n'est câblé par ce lot,
 * cf. rapport de la lane T2).
 */

export const runtime = 'nodejs';

type HealthReason =
  | 'URL_MISMATCH'
  | 'SECRET_NOT_CONFIGURED'
  | 'NOT_CONFIGURED'
  | 'MISMATCH'
  | 'CONVEX_UNREACHABLE';

function unhealthy(reason: HealthReason, extra?: Record<string, unknown>): Response {
  return NextResponse.json({ ok: false, reason, ...extra }, { status: 500 });
}

export async function GET(): Promise<Response> {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  const isProdEnv = process.env.VERCEL_ENV === 'production';

  if (isProdEnv && !isExpectedProdConvexUrl(convexUrl)) {
    return unhealthy('URL_MISMATCH', { convexUrl: convexUrl ?? null });
  }

  const secret = process.env.CONVEX_WEBHOOK_SECRET;
  if (!secret) {
    return unhealthy('SECRET_NOT_CONFIGURED');
  }

  try {
    const convex = getConvexServerClient();
    const result = await convex.query(convexApi.verifyWebhookSecretHealth, { secret });
    if (!result.ok) {
      return unhealthy(result.reason);
    }
  } catch {
    return unhealthy('CONVEX_UNREACHABLE');
  }

  return NextResponse.json({ ok: true, convexUrl: convexUrl ?? null });
}
