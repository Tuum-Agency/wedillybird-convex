/**
 * Pure reconciliation logic for events whose paid plan is recorded on a
 * `payments` row but whose denormalised fields (`planTier`, `paidAt`,
 * `galleryExpiresAt`) on the `events` document are missing or divergent.
 *
 * Used by `convex/payments.ts:markSucceeded` (to be self-healing on retry of
 * an already-succeeded payment) and by the one-shot repair mutation
 * `_repairOrphanedEventGalleries`.
 *
 * Constants are duplicated from `convex/payments.ts` because the root
 * `tsconfig.json` excludes `convex/` (and `convex/tsconfig.json` is its own
 * project) — we cannot import across that boundary in either direction. The
 * Convex side keeps an inline copy of `computeEventReconciliation` with a
 * matching `// keep in sync with lib/payments/reconcile.ts` comment.
 */

export const GALLERY_RETENTION_DAYS: Record<'essential' | 'premium', number> = {
  essential: 30,
  premium: 180,
};

export const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface ReconciliationInput {
  event: {
    planTier?: 'essential' | 'premium';
    paidAt?: number;
    galleryExpiresAt?: number;
    eventDate: number;
  };
  payment: {
    plan: 'essential' | 'premium';
  };
  now: number;
}

export interface ReconciliationPatch {
  planTier: 'essential' | 'premium';
  paidAt: number;
  galleryExpiresAt: number;
}

/**
 * Returns `null` if the event already has the expected `planTier`, `paidAt`
 * and `galleryExpiresAt` for the given `payment.plan`. Otherwise returns the
 * full patch the caller must apply.
 *
 * Rules :
 *  - `paidAt` is preserved if already set (avoids rewriting history when only
 *    `galleryExpiresAt` was missing). Falls back to `now` when absent.
 *  - `galleryExpiresAt` is always recomputed from `eventDate` + plan-based
 *    retention. The patch overrides whatever was stored before, including
 *    legacy values from previous retention windows.
 *  - If `event.planTier` diverges from `payment.plan` (downgrade or upgrade
 *    that was never propagated), we trust the payment as the source of truth.
 */
export function computeEventReconciliation(input: ReconciliationInput): ReconciliationPatch | null {
  const { event, payment, now } = input;
  const expectedExpiresAt = event.eventDate + GALLERY_RETENTION_DAYS[payment.plan] * MS_PER_DAY;

  const needsUpdate =
    event.planTier !== payment.plan ||
    event.paidAt === undefined ||
    event.galleryExpiresAt !== expectedExpiresAt;

  if (!needsUpdate) return null;

  return {
    planTier: payment.plan,
    paidAt: event.paidAt ?? now,
    galleryExpiresAt: expectedExpiresAt,
  };
}
