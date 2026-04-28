import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Fix sécurité F-04 (audit avril 2026) — `convex/auth.ts` ne doit JAMAIS
 * logger un OTP en clair hors `E2E_MODE === '1'` strict.
 *
 * Après refactor R2 (extraction `convex/lib/whatsappCloud.ts`), le check
 * `E2E_MODE === '1'` vit dans le helper. `convex/auth.ts` log uniquement
 * quand `result.mock === true`, et le helper ne pose `mock: true` que si
 * `E2E_MODE === '1'`. Hors E2E, le helper retourne
 * `{ ok: false, error: 'WHATSAPP_NOT_CONFIGURED' }` et `auth.ts` throw.
 *
 * Ce test garde la régression : aucun log mock ne doit être déclenché par
 * `!accessToken || !phoneNumberId` dans le helper.
 */
describe('convex/auth.ts — OTP logging gated by E2E_MODE (F-04)', () => {
  const authSrc = readFileSync(resolve(__dirname, '..', '..', '..', 'convex', 'auth.ts'), 'utf-8');
  const helperSrc = readFileSync(
    resolve(__dirname, '..', '..', '..', 'convex', 'lib', 'whatsappCloud.ts'),
    'utf-8',
  );

  it('le helper convex/lib/whatsappCloud.ts gate le mock UNIQUEMENT sur E2E_MODE === "1"', () => {
    // Le mock fallback ne doit PAS dépendre de `!accessToken || !phoneNumberId`.
    // Régression directe : pattern `E2E_MODE === '1' || !accessToken` interdit.
    expect(helperSrc).not.toMatch(/E2E_MODE\s*===\s*['"]1['"]\s*\|\|\s*!accessToken/);
    // Le helper doit avoir un check `E2E_MODE === '1'` strict.
    expect(helperSrc).toMatch(/E2E_MODE\s*===\s*['"]1['"]/);
    // En absence de credentials hors E2E, le helper retourne WHATSAPP_NOT_CONFIGURED.
    expect(helperSrc).toContain("'WHATSAPP_NOT_CONFIGURED'");
  });

  it('le log mock OTP dans auth.ts est gardé par result.mock (helper-driven)', () => {
    const lines = authSrc.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? '';
      if (line.includes('console.info(`[whatsapp:mock] OTP')) {
        // Cherche `if (result.mock)` dans les 3 lignes précédentes.
        const context = lines.slice(Math.max(0, i - 3), i).join('\n');
        expect(context).toMatch(/result\.mock/);
      }
    }
  });

  it('auth.ts throw `WHATSAPP_NOT_CONFIGURED` quand credentials absents hors E2E', () => {
    expect(authSrc).toContain('WHATSAPP_NOT_CONFIGURED');
  });

  it('le log mock LINK est gardé par result.mock aussi', () => {
    const lines = authSrc.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? '';
      if (line.includes('console.info(`[whatsapp:mock] LINK')) {
        const context = lines.slice(Math.max(0, i - 3), i).join('\n');
        expect(context).toMatch(/result\.mock/);
      }
    }
  });
});
