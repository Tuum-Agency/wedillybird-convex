import type { Page } from '@playwright/test';
import { ConvexHttpClient } from 'convex/browser';
import { makeFunctionReference } from 'convex/server';

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
 *  - `requiresE2EMode()`     — guard supplémentaire pour les tests qui
 *    nécessitent que `E2E_MODE=1` soit posé côté env Convex (mock forcé).
 *  - `seedEmailOnlyUser(...)`/`getMockOtpCode(...)` — helpers Convex pour les
 *    specs auth-linking (cf. `tests/e2e/auth-linking.spec.ts`).
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
 * Renvoie `true` quand le test doit être skippé parce que `E2E_MODE` n'est
 * pas activé côté env Convex. Utilisé par les tests qui dépendent du
 * court-circuit WhatsApp/SES + des actions internes E2E.
 *
 * Pour activer : `pnpx convex env set E2E_MODE 1` puis relancer la suite.
 */
export function requiresE2EMode(): boolean {
  // Vue côté Next.js, on lit la même env var. Côté Convex c'est posé
  // séparément (cf. README / playwright.config.ts).
  return process.env.E2E_MODE !== '1';
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
  // Après login, l'app route selon l'état de l'utilisateur : /dashboard
  // (défaut), /events/{id} (couple possédant déjà un event), /onboarding
  // (nouvel utilisateur) ou /pro. On attend une destination authentifiée,
  // pas spécifiquement /dashboard (sinon timeout pour les owners d'event).
  await page.waitForURL((url) => /\/(dashboard|events|onboarding|pro)(\/|$)/.test(url.pathname));
}

/**
 * Connecte un user test précis (par numéro E.164) via /dev-login.
 */
export async function loginAsPhone(page: Page, phone: string): Promise<void> {
  await page.goto('/dev-login');
  await page
    .locator('form', { has: page.locator(`input[value="${phone}"]`) })
    .getByRole('button', { name: /se connecter/i })
    .click();
  // Après login, l'app route selon l'état de l'utilisateur : /dashboard
  // (défaut), /events/{id} (couple possédant déjà un event), /onboarding
  // (nouvel utilisateur) ou /pro. On attend une destination authentifiée,
  // pas spécifiquement /dashboard (sinon timeout pour les owners d'event).
  await page.waitForURL((url) => /\/(dashboard|events|onboarding|pro)(\/|$)/.test(url.pathname));
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

/* -------------------------------------------------------------------------- */
/*  Helpers Convex pour les specs auth-linking                                */
/* -------------------------------------------------------------------------- */

let cachedConvex: ConvexHttpClient | null = null;
function convex(): ConvexHttpClient {
  if (cachedConvex) return cachedConvex;
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) {
    throw new Error('NEXT_PUBLIC_CONVEX_URL must be set to run E2E auth-linking tests');
  }
  cachedConvex = new ConvexHttpClient(url);
  return cachedConvex;
}

const seedEmailOnlyUserRef = makeFunctionReference<
  'mutation',
  { email: string },
  { userId: string; created: boolean }
>('seed:seedEmailOnlyUser');

const e2eIssueLinkPhoneCodeRef = makeFunctionReference<
  'action',
  { userId: string; phone: string },
  { phone: string; code: string }
>('auth:_e2eIssueLinkPhoneCode');

const e2eIssueLinkEmailCodeRef = makeFunctionReference<
  'action',
  { userId: string; email: string },
  { email: string; code: string }
>('auth:_e2eIssueLinkEmailCode');

/**
 * Crée (ou réutilise) un user "email-only" pour les tests de linking phone.
 */
export async function seedEmailOnlyUser(email: string): Promise<{ userId: string }> {
  const result = await convex().mutation(seedEmailOnlyUserRef, { email });
  return { userId: result.userId };
}

/**
 * Récupère un code OTP de linking phone côté Convex en mode E2E_MODE.
 *
 * Côté Convex, l'action `auth:_e2eIssueLinkPhoneCode` (E2E-only) génère
 * directement une row `linkVerifications` valide et renvoie le code en
 * clair, sans appeler Meta. Le test peut ensuite l'envoyer via l'UI ou
 * directement via `verifyLinkPhone`.
 */
export async function issueMockLinkPhoneCode(input: {
  userId: string;
  phone: string;
}): Promise<string> {
  const result = await convex().action(e2eIssueLinkPhoneCodeRef, input);
  return result.code;
}

/**
 * Variante email du helper précédent.
 */
export async function issueMockLinkEmailCode(input: {
  userId: string;
  email: string;
}): Promise<string> {
  const result = await convex().action(e2eIssueLinkEmailCodeRef, input);
  return result.code;
}

/* -------------------------------------------------------------------------- */
/*  Helpers Convex pour les specs de feature-gating par formule               */
/* -------------------------------------------------------------------------- */

const seedTestUsersRef = makeFunctionReference<
  'mutation',
  Record<string, never>,
  Array<{ phone: string; userId: string; created: boolean }>
>('seed:seedTestUsers');

export interface TierFixtures {
  essential: { ownerPhone: string; eventId: string; slug: string };
  premium: { ownerPhone: string; eventId: string; slug: string };
  business: {
    ownerPhone: string;
    organizationId: string;
    slug: string;
    eventId: string;
    clientCount: number;
    budgetLineCount: number;
  };
  pro: {
    ownerPhone: string;
    organizationId: string;
    activeEvents: number;
    quota: number;
    draftEventId: string;
    draftSlug: string;
  };
}

const seedTierFixturesRef = makeFunctionReference<'mutation', Record<string, never>, TierFixtures>(
  'seed:seedTierFixtures',
);

/**
 * Seed (idempotent) les comptes bypass + events par formule utilisés par
 * `feature-gating.spec.ts`. Garantit d'abord la présence des users test, puis
 * crée les fixtures Essentiel / Premium / Pro-au-quota et renvoie leurs IDs.
 */
export async function seedTierFixtures(): Promise<TierFixtures> {
  await convex().mutation(seedTestUsersRef, {});
  return convex().mutation(seedTierFixturesRef, {});
}
