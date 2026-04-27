import type { Page } from '@playwright/test';

/**
 * Helpers réutilisables pour les specs Playwright.
 *
 * Convex en dev est requis pour la majorité des flows authentifiés
 * (`/dev-login` est la porte d'entrée). On expose ici :
 *  - `requiresConvexDev()`   — guard à utiliser dans `test.skip(...)`.
 *  - `loginAsDevUser(page)`  — passe par `/dev-login` et garantit qu'on
 *    arrive sur `/dashboard` (utilisateur particulier seedé par défaut).
 *  - `gotoFirstEvent(page)`  — clic sur la première carte event si présente,
 *    skip le test sinon (n'utilise pas de seed dur côté DB).
 */

const FALLBACK_CONVEX = 'https://invalid.convex.test';

/**
 * Renvoie `true` quand le test doit être skippé faute de deployment Convex
 * dev configuré. À utiliser ainsi :
 *
 * ```ts
 * test.skip(requiresConvexDev(), 'Convex dev deployment required');
 * ```
 */
export function requiresConvexDev(): boolean {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  return !url || url === FALLBACK_CONVEX;
}

/**
 * Connecte l'utilisateur particulier seedé (numéro `+33612931779`) via
 * `/dev-login`. Retourne une promesse qui résout quand on est sur
 * `/dashboard`. À utiliser uniquement quand `requiresConvexDev()` est faux.
 */
export async function loginAsDevUser(page: Page): Promise<void> {
  await page.goto('/dev-login');
  await page
    .locator('form', { has: page.locator('input[value="+33612931779"]') })
    .getByRole('button', { name: /se connecter/i })
    .click();
  await page.waitForURL((url) => /\/dashboard/.test(url.pathname));
}

/**
 * Clic sur la première carte event du dashboard. Si aucun event n'est seedé,
 * la fonction renvoie `null` — l'appelant peut alors `test.skip(...)`.
 */
export async function gotoFirstEvent(page: Page): Promise<string | null> {
  const firstEvent = page.locator('ul li a').first();
  if ((await firstEvent.count()) === 0) return null;
  await firstEvent.click();
  await page.waitForURL((url) => /\/events\/[^/]+$/.test(url.pathname));
  const url = new URL(page.url());
  return url.pathname.replace(/.*\/events\//, '').replace(/\/.*$/, '');
}
