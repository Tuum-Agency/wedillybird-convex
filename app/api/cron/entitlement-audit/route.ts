import { NextResponse } from 'next/server';
import { convexApi, getConvexServerClient } from '@/lib/auth/convex-server';
import { captureServer, EVENTS } from '@/lib/analytics/posthog-server';

/**
 * Audit hebdo « entitlement sans paiement » (T2-8).
 *
 * *Pourquoi (F3)* : signe cité au premortem — un event avec un `planTier`
 * actif mais aucun paiement `succeeded` associé serait la preuve d'un
 * contournement du money-path (ou d'une dérive de données). Ce cron ne
 * MODIFIE rien : `convex/payments.ts:scanOrphanedEntitlements` est une query
 * lecture seule, volontairement distincte de la mutation de repair
 * `_repairOrphanedEventGalleries` (qui, elle, reste un geste manuel
 * one-shot déclenché via `pnpx convex run`).
 *
 * Vercel Cron (voir `vercel.json`) invoque cette route en GET avec un header
 * `Authorization: Bearer $CRON_SECRET`.
 */

export const runtime = 'nodejs';
export const maxDuration = 30;

function isAuthorizedCronRequest(req: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  return req.headers.get('authorization') === `Bearer ${expected}`;
}

export async function GET(req: Request): Promise<Response> {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const webhookSecret = process.env.CONVEX_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: 'WEBHOOK_SECRET_NOT_CONFIGURED' }, { status: 500 });
  }

  try {
    const convex = getConvexServerClient();
    const { scanned, offenders } = await convex.query(convexApi.scanOrphanedEntitlements, {
      webhookSecret,
    });

    if (offenders.length > 0) {
      // Un seul event récapitulatif (plutôt que N) : plus simple à câbler en
      // alerte PostHog (seuil ">0"), la liste des events fautifs reste dans
      // les properties pour l'investigation.
      await captureServer({
        distinctId: 'system:entitlement-audit-cron',
        event: EVENTS.entitlementWithoutPayment,
        properties: {
          count: offenders.length,
          event_ids: offenders.map((o) => o.eventId),
          offenders,
        },
      });
    }

    return NextResponse.json({ ok: true, scanned, offendersCount: offenders.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'UNKNOWN';
    await captureServer({
      distinctId: 'system:entitlement-audit-cron',
      event: EVENTS.webhookProcessingFailed,
      properties: { source: 'entitlement_audit_cron', message },
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
