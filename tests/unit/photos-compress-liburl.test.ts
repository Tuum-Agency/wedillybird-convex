import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Régression CSP — `browser-image-compression` charge par défaut son
 * runtime worker depuis `cdn.jsdelivr.net`, ce qui est bloqué par
 * `script-src 'self'`. On self-host le bundle dans `public/scripts/`
 * et on force `libURL` à pointer dessus.
 */
describe('lib/photos/compress.ts — libURL self-hosted', () => {
  it("passe `libURL: '/scripts/browser-image-compression.js'`", () => {
    const src = readFileSync(
      resolve(__dirname, '..', '..', 'lib', 'photos', 'compress.ts'),
      'utf-8',
    );
    expect(src).toMatch(/libURL:\s*['"]\/scripts\/browser-image-compression\.js['"]/);
  });

  it('le fichier statique self-hosted est présent dans public/scripts/', () => {
    const stat = readFileSync(
      resolve(__dirname, '..', '..', 'public', 'scripts', 'browser-image-compression.js'),
    );
    expect(stat.byteLength).toBeGreaterThan(1024);
  });
});
