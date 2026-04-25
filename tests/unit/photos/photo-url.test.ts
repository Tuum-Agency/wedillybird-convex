import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  VARIANT_SIZES,
  getPhotoUrl,
  getPhotoUrlForUsage,
  processedKeyPrefix,
} from '@/lib/photos/url';

const ORIGINAL_ENV = process.env.NEXT_PUBLIC_MEDIA_CDN_DOMAIN;

beforeEach(() => {
  process.env.NEXT_PUBLIC_MEDIA_CDN_DOMAIN = 'media.wedillybird.com';
});

afterEach(() => {
  process.env.NEXT_PUBLIC_MEDIA_CDN_DOMAIN = ORIGINAL_ENV;
});

describe('getPhotoUrl', () => {
  it('returns CloudFront URL for the requested variant when variants are set', () => {
    const photo = {
      url: 'https://media.wedillybird.com/incoming/evt/abc.jpg',
      variants: {
        thumb: 'processed/evt/abc/thumb.webp',
        medium: 'processed/evt/abc/medium.webp',
        full: 'processed/evt/abc/full.webp',
      },
    };
    expect(getPhotoUrl(photo, 'thumb')).toBe(
      'https://media.wedillybird.com/processed/evt/abc/thumb.webp',
    );
    expect(getPhotoUrl(photo, 'full')).toBe(
      'https://media.wedillybird.com/processed/evt/abc/full.webp',
    );
  });

  it('defaults to the medium variant', () => {
    const photo = {
      url: null,
      variants: {
        thumb: 'processed/x/thumb.webp',
        medium: 'processed/x/medium.webp',
        full: 'processed/x/full.webp',
      },
    };
    expect(getPhotoUrl(photo)).toBe('https://media.wedillybird.com/processed/x/medium.webp');
  });

  it('falls back to the original url when variants are not set', () => {
    const photo = {
      url: 'https://media.wedillybird.com/incoming/evt/abc.jpg',
    };
    expect(getPhotoUrl(photo, 'thumb')).toBe('https://media.wedillybird.com/incoming/evt/abc.jpg');
  });

  it('falls back to original url when CDN domain is not configured', () => {
    process.env.NEXT_PUBLIC_MEDIA_CDN_DOMAIN = '';
    const photo = {
      url: 'https://fallback/x.jpg',
      variants: {
        thumb: 'processed/x/thumb.webp',
        medium: 'processed/x/medium.webp',
        full: 'processed/x/full.webp',
      },
    };
    expect(getPhotoUrl(photo, 'thumb')).toBe('https://fallback/x.jpg');
  });
});

describe('getPhotoUrlForUsage', () => {
  it('maps each usage to the right variant', () => {
    const photo = {
      url: null,
      variants: {
        thumb: 'processed/x/thumb.webp',
        medium: 'processed/x/medium.webp',
        full: 'processed/x/full.webp',
      },
    };
    expect(getPhotoUrlForUsage(photo, 'grid')).toContain('thumb.webp');
    expect(getPhotoUrlForUsage(photo, 'lightbox')).toContain('medium.webp');
    expect(getPhotoUrlForUsage(photo, 'download')).toContain('full.webp');
  });
});

describe('processedKeyPrefix', () => {
  it('strips the incoming/ prefix and the file extension', () => {
    expect(processedKeyPrefix('incoming/evt_a/abc-123.jpg')).toBe('evt_a/abc-123');
    expect(processedKeyPrefix('incoming/evt_a/abc-123.webp')).toBe('evt_a/abc-123');
  });

  it('keeps the key as-is when there is no incoming/ prefix', () => {
    expect(processedKeyPrefix('evt_a/abc.jpg')).toBe('evt_a/abc');
  });

  it('keeps the key as-is when there is no extension', () => {
    expect(processedKeyPrefix('incoming/evt_a/abc')).toBe('evt_a/abc');
  });
});

describe('VARIANT_SIZES', () => {
  it('exposes the canonical thumb/medium/full sizes', () => {
    expect(VARIANT_SIZES.thumb).toBe(320);
    expect(VARIANT_SIZES.medium).toBe(800);
    expect(VARIANT_SIZES.full).toBe(2000);
  });
});
