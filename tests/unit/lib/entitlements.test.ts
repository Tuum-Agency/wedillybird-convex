import { describe, expect, it } from 'vitest';
import {
  BYTES_PER_GO,
  PRO_TIER_LIMITS,
  buildQuotaGauges,
  canAddSeat,
  quotaStatus,
  tierAtLeast,
  tierHasFeature,
  type ProFeature,
} from '../../../lib/payments/entitlements';

describe('PRO_TIER_LIMITS — grille v3 (source de vérité)', () => {
  it('events actifs : 5 / 20 / 50', () => {
    expect(PRO_TIER_LIMITS.starter.activeEvents).toBe(5);
    expect(PRO_TIER_LIMITS.business.activeEvents).toBe(20);
    expect(PRO_TIER_LIMITS.agency.activeEvents).toBe(50);
  });

  it('cap invités/event = 150 pour tous les tiers', () => {
    expect(PRO_TIER_LIMITS.starter.guestsPerEvent).toBe(150);
    expect(PRO_TIER_LIMITS.business.guestsPerEvent).toBe(150);
    expect(PRO_TIER_LIMITS.agency.guestsPerEvent).toBe(150);
  });

  it('messages/mois : 3 000 / 10 000 / 25 000', () => {
    expect(PRO_TIER_LIMITS.starter.whatsappMessagesPerMonth).toBe(3000);
    expect(PRO_TIER_LIMITS.business.whatsappMessagesPerMonth).toBe(10000);
    expect(PRO_TIER_LIMITS.agency.whatsappMessagesPerMonth).toBe(25000);
  });

  it('stockage : 50 / 200 / 500 Go', () => {
    expect(PRO_TIER_LIMITS.starter.storageBytes).toBe(50 * BYTES_PER_GO);
    expect(PRO_TIER_LIMITS.business.storageBytes).toBe(200 * BYTES_PER_GO);
    expect(PRO_TIER_LIMITS.agency.storageBytes).toBe(500 * BYTES_PER_GO);
  });

  it('sièges : 2 / 8 / illimité (null)', () => {
    expect(PRO_TIER_LIMITS.starter.seats).toBe(2);
    expect(PRO_TIER_LIMITS.business.seats).toBe(8);
    expect(PRO_TIER_LIMITS.agency.seats).toBeNull();
  });

  it('annuaire prestataires : ≤25 (Starter) puis illimité', () => {
    expect(PRO_TIER_LIMITS.starter.vendorDirectoryCap).toBe(25);
    expect(PRO_TIER_LIMITS.business.vendorDirectoryCap).toBeNull();
    expect(PRO_TIER_LIMITS.agency.vendorDirectoryCap).toBeNull();
  });
});

describe('tierHasFeature — gating par palier', () => {
  it('CRM pipeline / budget édition / portail couple = Business+', () => {
    const businessPlus: ProFeature[] = [
      'crmPipeline',
      'budgetEditing',
      'documentsEsign',
      'vendorAttach',
      'couplePortal',
    ];
    for (const f of businessPlus) {
      expect(tierHasFeature('starter', f)).toBe(false);
      expect(tierHasFeature('business', f)).toBe(true);
      expect(tierHasFeature('agency', f)).toBe(true);
    }
  });

  it('intégrations / analytics multi / white-label total = Agency uniquement', () => {
    const agencyOnly: ProFeature[] = ['integrations', 'analyticsMulti', 'whiteLabelTotal'];
    for (const f of agencyOnly) {
      expect(tierHasFeature('starter', f)).toBe(false);
      expect(tierHasFeature('business', f)).toBe(false);
      expect(tierHasFeature('agency', f)).toBe(true);
    }
  });

  it('tier nul/absent → aucune feature', () => {
    expect(tierHasFeature(null, 'crmPipeline')).toBe(false);
    expect(tierHasFeature(undefined, 'integrations')).toBe(false);
  });
});

describe('tierAtLeast', () => {
  it('compare correctement les paliers', () => {
    expect(tierAtLeast('agency', 'business')).toBe(true);
    expect(tierAtLeast('business', 'business')).toBe(true);
    expect(tierAtLeast('starter', 'business')).toBe(false);
    expect(tierAtLeast(null, 'starter')).toBe(false);
  });
});

describe('quotaStatus', () => {
  it('usage normal (< 80 %) → ok', () => {
    const s = quotaStatus(7, 20);
    expect(s.level).toBe('ok');
    expect(s.remaining).toBe(13);
    expect(s.overage).toBe(0);
    expect(s.unlimited).toBe(false);
  });

  it('usage ≥ 80 % → warning', () => {
    expect(quotaStatus(8000, 10000).level).toBe('warning');
    expect(quotaStatus(9200, 10000).level).toBe('warning');
  });

  it('usage ≥ 100 % → danger + overage calculé', () => {
    const s = quotaStatus(10500, 10000);
    expect(s.level).toBe('danger');
    expect(s.overage).toBe(500);
    expect(s.remaining).toBe(0);
  });

  it('quota illimité (null) → jamais en alerte', () => {
    const s = quotaStatus(99999, null);
    expect(s.unlimited).toBe(true);
    expect(s.level).toBe('ok');
    expect(s.remaining).toBeNull();
    expect(s.overage).toBe(0);
  });

  it('usage négatif/NaN traité comme 0', () => {
    expect(quotaStatus(-5, 10).used).toBe(0);
    expect(quotaStatus(Number.NaN, 10).used).toBe(0);
  });
});

describe('buildQuotaGauges', () => {
  it('compose les 4 jauges depuis tier + usage', () => {
    const g = buildQuotaGauges('business', {
      activeEvents: 7,
      storageBytes: 84 * BYTES_PER_GO,
      whatsappMessagesThisMonth: 6200,
      seatsUsed: 3,
    });
    expect(g.events.included).toBe(20);
    expect(g.events.used).toBe(7);
    expect(g.storage.included).toBe(200 * BYTES_PER_GO);
    expect(g.messages.used).toBe(6200);
    expect(g.seats.included).toBe(8);
    expect(g.seats.remaining).toBe(5);
  });

  it('Agency : sièges illimités', () => {
    const g = buildQuotaGauges('agency', {
      activeEvents: 12,
      storageBytes: 0,
      whatsappMessagesThisMonth: 0,
      seatsUsed: 30,
    });
    expect(g.seats.unlimited).toBe(true);
    expect(g.seats.level).toBe('ok');
  });
});

describe('canAddSeat — limite dure sur les invitations équipe', () => {
  it('Starter : 2 sièges max', () => {
    expect(canAddSeat('starter', 1)).toBe(true);
    expect(canAddSeat('starter', 2)).toBe(false);
  });
  it('Business : 8 sièges max', () => {
    expect(canAddSeat('business', 7)).toBe(true);
    expect(canAddSeat('business', 8)).toBe(false);
  });
  it('Agency : illimité', () => {
    expect(canAddSeat('agency', 999)).toBe(true);
  });
});
