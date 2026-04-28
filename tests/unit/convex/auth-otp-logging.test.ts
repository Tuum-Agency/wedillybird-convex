import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Fix sécurité F-04 (audit avril 2026) — `convex/auth.ts` ne doit JAMAIS
 * logger un OTP en clair hors `E2E_MODE === '1'` strict.
 *
 * Avant le fix, le `console.info` se déclenchait aussi quand les credentials
 * Meta étaient absents (`!accessToken || !phoneNumberId`), ce qui exposait
 * les OTP dans les logs Convex en prod. Ce test fait un grep AST-light pour
 * vérifier la régression.
 */
describe('convex/auth.ts — OTP logging gated by E2E_MODE (F-04)', () => {
  const authSrc = readFileSync(resolve(__dirname, '..', '..', '..', 'convex', 'auth.ts'), 'utf-8');

  it('le `console.info("[whatsapp:mock] OTP …")` est précédé d\'un check E2E_MODE strict', () => {
    // On veut vérifier qu'il n'y a plus de version qui inclut `!accessToken || !phoneNumberId`
    // dans la condition autour du log mock.
    const lines = authSrc.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? '';
      if (line.includes('console.info(`[whatsapp:mock]')) {
        // Cherche le `if` qui gate ce log dans les 4 lignes précédentes.
        const context = lines.slice(Math.max(0, i - 4), i).join('\n');
        expect(context).toMatch(/E2E_MODE\s*===\s*['"]1['"]/);
        // Régression : pas de fallback `|| !accessToken` dans cette condition.
        expect(context).not.toMatch(/E2E_MODE.*\|\|\s*!accessToken/);
      }
    }
  });

  it('throw `WHATSAPP_NOT_CONFIGURED` quand credentials absents hors E2E', () => {
    expect(authSrc).toContain('WHATSAPP_NOT_CONFIGURED');
  });

  it('le log mock LINK est gated de la même façon', () => {
    const lines = authSrc.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? '';
      if (line.includes('console.info(`[whatsapp:mock] LINK')) {
        const context = lines.slice(Math.max(0, i - 4), i).join('\n');
        expect(context).toMatch(/E2E_MODE\s*===\s*['"]1['"]/);
        expect(context).not.toMatch(/E2E_MODE.*\|\|\s*!accessToken/);
      }
    }
  });
});
