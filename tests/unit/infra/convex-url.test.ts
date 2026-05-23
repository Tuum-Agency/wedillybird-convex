import { describe, it, expect } from 'vitest';
import { PROD_CONVEX_SLUG, resolveProdConvexSiteUrl } from '../../../infra/lib/convex-url';

describe('resolveProdConvexSiteUrl', () => {
  const prodUrl = `https://${PROD_CONVEX_SLUG}.convex.site`;

  it('retourne undefined si aucune var n est définie', () => {
    expect(resolveProdConvexSiteUrl({ nextPublic: undefined, raw: undefined })).toBeUndefined();
  });

  it('retourne undefined sur strings vides', () => {
    expect(resolveProdConvexSiteUrl({ nextPublic: '', raw: '' })).toBeUndefined();
  });

  it('accepte le slug prod en NEXT_PUBLIC_CONVEX_SITE_URL', () => {
    expect(resolveProdConvexSiteUrl({ nextPublic: prodUrl, raw: undefined })).toBe(prodUrl);
  });

  it('accepte le slug prod en CONVEX_SITE_URL fallback', () => {
    expect(resolveProdConvexSiteUrl({ nextPublic: undefined, raw: prodUrl })).toBe(prodUrl);
  });

  it('fallback sur CONVEX_SITE_URL quand NEXT_PUBLIC est vide', () => {
    expect(resolveProdConvexSiteUrl({ nextPublic: '', raw: prodUrl })).toBe(prodUrl);
  });

  it('NEXT_PUBLIC_CONVEX_SITE_URL prioritaire sur CONVEX_SITE_URL', () => {
    expect(
      resolveProdConvexSiteUrl({ nextPublic: prodUrl, raw: 'https://other-slug.convex.site' }),
    ).toBe(prodUrl);
  });

  it('throw sur slug dev (régression observée 2026-05-23)', () => {
    expect(() =>
      resolveProdConvexSiteUrl({
        nextPublic: 'https://capable-crocodile-720.convex.site',
        raw: undefined,
      }),
    ).toThrow(/Refusing to deploy.*capable-crocodile-720/);
  });

  it('le message d erreur inclut les commandes de fix', () => {
    expect(() =>
      resolveProdConvexSiteUrl({
        nextPublic: 'https://capable-crocodile-720.convex.site',
        raw: undefined,
      }),
    ).toThrow(/unset CONVEX_DEPLOYMENT/);

    expect(() =>
      resolveProdConvexSiteUrl({
        nextPublic: 'https://capable-crocodile-720.convex.site',
        raw: undefined,
      }),
    ).toThrow(new RegExp(`https://${PROD_CONVEX_SLUG}\\.convex\\.site`));
  });

  it('throw sur format invalide (pas une URL convex.site)', () => {
    expect(() =>
      resolveProdConvexSiteUrl({ nextPublic: 'https://example.com', raw: undefined }),
    ).toThrow(/Invalid CONVEX_SITE_URL/);
  });

  it('throw sur scheme http (force https)', () => {
    expect(() =>
      resolveProdConvexSiteUrl({
        nextPublic: `http://${PROD_CONVEX_SLUG}.convex.site`,
        raw: undefined,
      }),
    ).toThrow(/Invalid CONVEX_SITE_URL/);
  });

  it('accepte un trailing slash', () => {
    expect(resolveProdConvexSiteUrl({ nextPublic: `${prodUrl}/`, raw: undefined })).toBe(
      `${prodUrl}/`,
    );
  });
});
