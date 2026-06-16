import { describe, expect, it } from 'vitest';
import { canDownloadGalleryZip } from '@/lib/gallery/zip-access';

describe('canDownloadGalleryZip', () => {
  it('autorise Premium', () => {
    expect(canDownloadGalleryZip({ planTier: 'premium' })).toBe(true);
  });

  it('refuse Essentiel seul', () => {
    expect(canDownloadGalleryZip({ planTier: 'essential' })).toBe(false);
  });

  it('autorise un event rattaché à une organisation (Pro)', () => {
    expect(canDownloadGalleryZip({ planTier: 'essential', organizationId: 'org_1' })).toBe(true);
  });

  it('autorise un Essentiel ayant acheté l_upsell HD', () => {
    expect(
      canDownloadGalleryZip({ planTier: 'essential', hdUpsellPurchasedAt: 1_700_000_000_000 }),
    ).toBe(true);
  });

  it('refuse un event non payé sans upsell', () => {
    expect(canDownloadGalleryZip({})).toBe(false);
  });
});
