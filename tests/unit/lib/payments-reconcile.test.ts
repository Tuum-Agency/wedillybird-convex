import { describe, expect, it } from 'vitest';
import {
  GALLERY_RETENTION_DAYS,
  MS_PER_DAY,
  computeEventReconciliation,
} from '@/lib/payments/reconcile';

const NOW = Date.parse('2026-04-27T10:00:00Z');
const EVENT_DATE = Date.parse('2026-06-15T12:00:00Z');
const ESSENTIAL_EXPIRES = EVENT_DATE + GALLERY_RETENTION_DAYS.essential * MS_PER_DAY;
const PREMIUM_EXPIRES = EVENT_DATE + GALLERY_RETENTION_DAYS.premium * MS_PER_DAY;

describe('computeEventReconciliation', () => {
  it('returns the full patch when the event has no planTier yet', () => {
    const patch = computeEventReconciliation({
      event: { eventDate: EVENT_DATE },
      payment: { plan: 'essential' },
      now: NOW,
    });
    expect(patch).toEqual({
      planTier: 'essential',
      paidAt: NOW,
      galleryExpiresAt: ESSENTIAL_EXPIRES,
    });
  });

  it('repairs the bug case: planTier=essential but paidAt + galleryExpiresAt are undefined', () => {
    // Reproduces the real production state observed on dev event
    // j976etx4y2d17jrsws0v9vsjp185gayh : tier was set on event creation but
    // the markSucceeded guard short-circuited before the date fields landed.
    const patch = computeEventReconciliation({
      event: { planTier: 'essential', eventDate: EVENT_DATE },
      payment: { plan: 'essential' },
      now: NOW,
    });
    expect(patch).toEqual({
      planTier: 'essential',
      paidAt: NOW,
      galleryExpiresAt: ESSENTIAL_EXPIRES,
    });
  });

  it('returns null when essential event is already fully consistent', () => {
    const patch = computeEventReconciliation({
      event: {
        planTier: 'essential',
        paidAt: NOW - 1_000,
        galleryExpiresAt: ESSENTIAL_EXPIRES,
        eventDate: EVENT_DATE,
      },
      payment: { plan: 'essential' },
      now: NOW,
    });
    expect(patch).toBeNull();
  });

  it('rewrites galleryExpiresAt when the stored value diverges from the canonical retention', () => {
    // Simulates a legacy event whose galleryExpiresAt was computed under an
    // older retention window (e.g. 7 days). The reconciliation must trust
    // the current GALLERY_RETENTION_DAYS table, not the stored value.
    const legacyExpires = EVENT_DATE + 7 * MS_PER_DAY;
    const paidAt = NOW - 5 * MS_PER_DAY;
    const patch = computeEventReconciliation({
      event: {
        planTier: 'essential',
        paidAt,
        galleryExpiresAt: legacyExpires,
        eventDate: EVENT_DATE,
      },
      payment: { plan: 'essential' },
      now: NOW,
    });
    expect(patch).toEqual({
      planTier: 'essential',
      paidAt,
      galleryExpiresAt: ESSENTIAL_EXPIRES,
    });
  });

  it('downgrades planTier when the event holds premium but the payment is essential', () => {
    // Defensive case — should not occur, but if it ever does, the payment row
    // is the source of truth so the event must follow.
    const patch = computeEventReconciliation({
      event: {
        planTier: 'premium',
        paidAt: NOW - 10_000,
        galleryExpiresAt: PREMIUM_EXPIRES,
        eventDate: EVENT_DATE,
      },
      payment: { plan: 'essential' },
      now: NOW,
    });
    expect(patch).toEqual({
      planTier: 'essential',
      paidAt: NOW - 10_000,
      galleryExpiresAt: ESSENTIAL_EXPIRES,
    });
  });

  it('preserves an existing paidAt instead of overwriting it with now', () => {
    const t0 = NOW - 7 * MS_PER_DAY;
    const patch = computeEventReconciliation({
      event: {
        planTier: 'essential',
        paidAt: t0,
        // galleryExpiresAt missing → forces a patch
        eventDate: EVENT_DATE,
      },
      payment: { plan: 'essential' },
      now: NOW,
    });
    expect(patch).not.toBeNull();
    expect(patch?.paidAt).toBe(t0);
    expect(patch?.galleryExpiresAt).toBe(ESSENTIAL_EXPIRES);
  });

  it('computes Essentiel = eventDate + 30j and Premium = eventDate + 180j', () => {
    const essentialPatch = computeEventReconciliation({
      event: { eventDate: EVENT_DATE },
      payment: { plan: 'essential' },
      now: NOW,
    });
    expect(essentialPatch?.galleryExpiresAt).toBe(EVENT_DATE + 30 * MS_PER_DAY);

    const premiumPatch = computeEventReconciliation({
      event: { eventDate: EVENT_DATE },
      payment: { plan: 'premium' },
      now: NOW,
    });
    expect(premiumPatch?.galleryExpiresAt).toBe(EVENT_DATE + 180 * MS_PER_DAY);
  });

  it('returns null when premium event is already fully consistent', () => {
    const patch = computeEventReconciliation({
      event: {
        planTier: 'premium',
        paidAt: NOW - 60_000,
        galleryExpiresAt: PREMIUM_EXPIRES,
        eventDate: EVENT_DATE,
      },
      payment: { plan: 'premium' },
      now: NOW,
    });
    expect(patch).toBeNull();
  });
});
