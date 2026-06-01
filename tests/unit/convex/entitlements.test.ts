import { describe, expect, it } from 'vitest';
import { eventHasFeature, type GatedFeature } from '../../../convex/lib/entitlements';

const GATED: readonly GatedFeature[] = [
  'faceSearch',
  'galleryZipDownload',
  'pdfAlbumFinal',
  'cinematicInvitation',
];

describe('eventHasFeature — gating par formule', () => {
  it('Premium (particulier) a toutes les features gated', () => {
    for (const f of GATED) {
      expect(eventHasFeature({ planTier: 'premium' }, f)).toBe(true);
    }
  });

  it("Essentiel (particulier) n'a AUCUNE feature gated", () => {
    for (const f of GATED) {
      expect(eventHasFeature({ planTier: 'essential' }, f)).toBe(false);
    }
  });

  it('event Pro (orga abonnée) a toutes les features Premium', () => {
    for (const f of GATED) {
      expect(eventHasFeature({ organizationId: 'org_1' }, f)).toBe(true);
    }
  });

  it('event non payé (ni plan ni orga) a 0 feature gated', () => {
    for (const f of GATED) {
      expect(eventHasFeature({}, f)).toBe(false);
    }
  });

  it('précédence planTier > orga : Essentiel + orga reste bloqué (cohérent publish gate)', () => {
    expect(eventHasFeature({ planTier: 'essential', organizationId: 'org_1' }, 'faceSearch')).toBe(
      false,
    );
  });
});
