import { describe, expect, it } from 'vitest';

/**
 * Fix sécurité F-03 (audit avril 2026) — `next.config.ts` doit exposer une
 * fonction async `headers()` qui retourne 6 headers HTTP de sécurité (HSTS,
 * X-Frame-Options, X-Content-Type-Options, Referrer-Policy,
 * Permissions-Policy, CSP) sur toutes les routes.
 *
 * Ce test importe la config ainsi que ses méta. Comme le module est wrappé
 * par `next-intl/plugin`, on importe directement la config via require pour
 * ne pas se heurter au `withNextIntl(...)`. À défaut, on extrait les headers
 * en parsant le source TS (fallback robuste).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('next.config.ts — security headers (F-03)', () => {
  const configSrc = readFileSync(resolve(__dirname, '..', '..', 'next.config.ts'), 'utf-8');

  it('définit une fonction async `headers()`', () => {
    expect(configSrc).toMatch(/async headers\s*\(\s*\)/);
  });

  it('applique les headers à toutes les routes via `source: "/:path*"`', () => {
    expect(configSrc).toMatch(/source:\s*['"]\/:path\*['"]/);
  });

  const expectedHeaders = [
    'Strict-Transport-Security',
    'X-Frame-Options',
    'X-Content-Type-Options',
    'Referrer-Policy',
    'Permissions-Policy',
    'Content-Security-Policy',
  ];

  for (const header of expectedHeaders) {
    it(`déclare le header \`${header}\``, () => {
      expect(configSrc).toContain(header);
    });
  }

  it('HSTS = 2 ans, includeSubDomains, preload', () => {
    expect(configSrc).toMatch(/max-age=63072000/);
    expect(configSrc).toMatch(/includeSubDomains/);
    expect(configSrc).toMatch(/preload/);
  });

  it('X-Frame-Options = DENY (anti-clickjacking strict)', () => {
    // On vérifie que dans la même paire key/value, DENY apparaît.
    expect(configSrc).toMatch(/X-Frame-Options[\s\S]{0,80}DENY/);
  });

  it('CSP autorise Stripe (script + frame), Convex (connect), CloudFront (img)', () => {
    expect(configSrc).toMatch(/js\.stripe\.com/);
    expect(configSrc).toMatch(/checkout\.stripe\.com/);
    expect(configSrc).toMatch(/\*\.convex\.cloud/);
    expect(configSrc).toMatch(/\*\.cloudfront\.net/);
  });

  it('Referrer-Policy = strict-origin-when-cross-origin', () => {
    expect(configSrc).toMatch(/strict-origin-when-cross-origin/);
  });

  it('Permissions-Policy refuse microphone et geolocation', () => {
    expect(configSrc).toMatch(/microphone=\(\)/);
    expect(configSrc).toMatch(/geolocation=\(\)/);
  });
});
