import { test, expect } from '@playwright/test';
import { ConvexHttpClient } from 'convex/browser';
import { makeFunctionReference } from 'convex/server';
import { requiresConvexDev, loginAsPhone } from './utils/fixtures';

/**
 * Dashboard super admin (/admin) — smoke E2E end-to-end.
 *
 * Objectifs :
 *  1. valider que chaque section rend (200, pas d'erreur serveur) ;
 *  2. valider que le namespace i18n `Admin` est complet — aucune clé brute
 *     (`nav.x`, `MISSING_MESSAGE`) ne fuit dans le rendu ;
 *  3. valider la nouvelle section Analytics (funnel, abandon).
 *
 * Auth : passe par `/dev-login` (bypass WhatsApp/AWS) avec le fixture admin
 * seedé par `seed:seedAdminUser`. Requiert un deployment Convex dev
 * (`NEXT_PUBLIC_CONVEX_URL`).
 */

const ADMIN_PHONE = '+33600000001';

const seedAdminRef = makeFunctionReference<'mutation', Record<string, never>, { userId: string }>(
  'seed:seedAdminUser',
);

const SECTIONS: { path: string; heading: string }[] = [
  { path: '/admin', heading: "Vue d'ensemble" },
  { path: '/admin/analytics', heading: 'Analytics' },
  { path: '/admin/payments', heading: 'Paiements' },
  { path: '/admin/invoices', heading: 'Factures' },
  { path: '/admin/subscriptions', heading: 'Abonnements' },
  { path: '/admin/promotions', heading: 'Promotions & remises' },
  { path: '/admin/users', heading: 'Utilisateurs' },
  { path: '/admin/events', heading: 'Événements' },
  { path: '/admin/moderation', heading: 'Modération' },
  { path: '/admin/newsletter', heading: 'Newsletter' },
  { path: '/admin/audit-log', heading: "Journal d'audit" },
];

test.describe('Dashboard super admin', () => {
  test.skip(requiresConvexDev(), 'Convex dev deployment requis (NEXT_PUBLIC_CONVEX_URL)');
  // En dev, Next compile chaque route à la première visite (lent). On tourne en
  // série et avec des timeouts larges pour absorber ces compilations à froid.
  test.describe.configure({ mode: 'serial', timeout: 180_000 });

  test.beforeAll(async () => {
    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
    await convex.mutation(seedAdminRef, {});
  });

  test.beforeEach(async ({ page }) => {
    page.setDefaultTimeout(120_000);
    page.setDefaultNavigationTimeout(120_000);
    await loginAsPhone(page, ADMIN_PHONE);
  });

  test('chaque section rend sans clé i18n manquante', async ({ page }) => {
    for (const { path, heading } of SECTIONS) {
      const res = await page.goto(path);
      expect(res?.status(), `${path} doit répondre 200`).toBeLessThan(400);

      // La sidebar (shell) doit afficher les libellés traduits, pas les clés.
      await expect(page.getByRole('link', { name: 'Analytics' })).toBeVisible();

      // Aucune clé brute / message manquant ne doit fuir dans le rendu.
      const body = (await page.locator('body').innerText()).toLowerCase();
      expect(body, `${path}: clé i18n manquante`).not.toContain('missing_message');
      expect(body, `${path}: clé brute nav.* visible`).not.toMatch(/\bnav\.[a-z]/);

      // Titre de section attendu présent.
      await expect(
        page.getByRole('heading', { name: heading }).first(),
        `${path}: titre « ${heading} »`,
      ).toBeVisible();
    }
  });

  test('la section Analytics affiche funnel, abandon et saisonnalité', async ({ page }) => {
    await page.goto('/admin/analytics');
    await expect(page.getByText('Funnel de conversion (particuliers)')).toBeVisible();
    await expect(page.getByText('Abandon de checkout')).toBeVisible();
    await expect(page.getByText('Comptes couple')).toBeVisible();
    // Tendance 30 j + rush à venir.
    await expect(page.getByText('Rush à venir')).toBeVisible();
  });

  test('la section Promotions affiche coupons, codes promo + remise abonnement', async ({
    page,
  }) => {
    await page.goto('/admin/promotions');
    await expect(page.getByRole('heading', { name: 'Coupons' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Codes promo' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Créer un coupon' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Remise sur un abonnement' })).toBeVisible();
  });

  test('la section Newsletter affiche le composer + historique (sans envoyer)', async ({
    page,
  }) => {
    await page.goto('/admin/newsletter');
    await expect(page.getByRole('heading', { name: 'Composer une newsletter' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Campagnes envoyées' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Envoyer à tous/ })).toBeVisible();
    // On ne clique JAMAIS « Envoyer à tous » dans les tests (email réel).
  });

  test('un non-admin ne peut pas accéder à /admin', async ({ page }) => {
    // Le fixture couple par défaut est redirigé hors de /admin.
    await loginAsPhone(page, '+33612931779');
    await page.goto('/admin');
    await expect(page).not.toHaveURL(/\/admin(\/|$)/);
  });
});
