/**
 * Resolve a CloudFront URL for a stored photo, picking the right size variant.
 *
 * If the photo has been processed by the variants Lambda we return a webp
 * variant; otherwise we fall back to the original `url` (CloudFront signed of
 * the source S3 key) returned by Convex queries.
 */

export type PhotoVariant = 'thumb' | 'medium' | 'full';

export interface PhotoWithVariants {
  /** CloudFront URL for the original (already resolved server-side). */
  url: string | null;
  /** S3 keys (NOT URLs) for sharp-generated webp variants. */
  variants?: {
    thumb: string;
    medium: string;
    full: string;
  } | null;
}

function cloudfrontDomain(): string | null {
  // Public env var on the Next.js side (Vercel injects it at build time).
  return process.env.NEXT_PUBLIC_MEDIA_CDN_DOMAIN ?? null;
}

export function getPhotoUrl(
  photo: PhotoWithVariants,
  variant: PhotoVariant = 'medium',
): string | null {
  if (photo.variants) {
    const domain = cloudfrontDomain();
    if (domain) {
      const key = photo.variants[variant];
      return `https://${domain}/${key}`;
    }
    // No CDN domain configured: fall back to the original URL.
  }
  return photo.url;
}

/**
 * Variant picker matching the gallery layout:
 *   - grid       → thumb
 *   - lightbox   → medium
 *   - download   → full
 */
export function getPhotoUrlForUsage(
  photo: PhotoWithVariants,
  usage: 'grid' | 'lightbox' | 'download',
): string | null {
  switch (usage) {
    case 'grid':
      return getPhotoUrl(photo, 'thumb');
    case 'lightbox':
      return getPhotoUrl(photo, 'medium');
    case 'download':
      return getPhotoUrl(photo, 'full');
  }
}

/**
 * Compute the `processed/{prefix}` key root from an `incoming/{eventId}/{uuid}.{ext}`
 * source key. Mirrors the helper used inside the variants Lambda.
 *
 * Exposed here so the Next.js side and the Lambda agree on the layout.
 */
export function processedKeyPrefix(sourceKey: string): string {
  const stripped = sourceKey.replace(/^incoming\//, '');
  const lastDot = stripped.lastIndexOf('.');
  return lastDot > 0 ? stripped.slice(0, lastDot) : stripped;
}

export const VARIANT_SIZES = {
  thumb: 320,
  medium: 800,
  full: 2000,
} as const;
