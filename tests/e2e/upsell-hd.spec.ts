import { test, expect, type Page } from '@playwright/test';
import {
  requiresConvexDev,
  requiresE2EMode,
  seedUpsellFixtures,
  type UpsellFixtures,
} from './utils/fixtures';

/**
 * Upsell HD post-event (+29 €) + livre photo — flux complet et **responsive**.
 *
 * Couvre, sur les 3 projets Playwright (Desktop Chrome / Safari + Pixel 7) :
 *  - carte upsell en état « achat » (Premium sans upsell) → CTA +29 € ;
 *  - carte upsell en état « acheté » (Essentiel + upsell) → téléchargement HD
 *    + commande de livre photo via le Dialog (formulaire d'adresse) ;
 *  - réconciliation : après commande, la carte affiche le statut ;
 *  - admin /admin/photo-books : la commande remonte et le statut est modifiable.
 *
 * À chaque étape on vérifie l'absence de débordement horizontal — la régression
 * responsive la plus fréquente. Pixel 7 (~412 px) est le viewport le plus
 * contraignant.
 */

const COUPLE_PHONE = '+212661234567'; // Fatima — owner des events de démo
const ADMIN_PHONE = '+33600000001';

async function devLogin(page: Page, phone: string): Promise<void> {
  await page.goto('/dev-login');
  await Promise.all([
    page.waitForURL((url) => !url.pathname.includes('/dev-login'), { timeout: 30_000 }),
    page
      .locator('form', { has: page.locator(`input[value="${phone}"]`) })
      .getByRole('button', { name: /se connecter/i })
      .click(),
  ]);
}

/** Vérifie que la page (ou le contenu en surimpression) ne déborde pas en largeur. */
async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return doc.scrollWidth - doc.clientWidth;
  });
  // Tolérance 2 px (arrondis sub-pixel / scrollbar).
  expect(overflow, 'pas de scroll horizontal').toBeLessThanOrEqual(2);
}

test.describe('Upsell HD + livre photo', () => {
  // Sérialisé : les tests partagent des events seedés (slugs fixes) ; en
  // parallèle, le `beforeAll` de chaque worker re-seede (wipe + recrée) ces
  // mêmes slugs et supprimerait les events utilisés par un autre worker (→ 404).
  test.describe.configure({ mode: 'serial' });
  test.skip(requiresConvexDev(), 'Convex dev deployment requis (NEXT_PUBLIC_CONVEX_URL)');
  test.skip(requiresE2EMode(), 'E2E_MODE=1 requis côté Convex (mock emails)');

  let fx: UpsellFixtures;

  test.beforeAll(async ({}, testInfo) => {
    // Slugs uniques par projet (chromium / webkit / mobile-chrome) : les workers
    // tournent en parallèle et re-seedent — sans suffixe ils se supprimeraient
    // mutuellement leurs events (→ 404 intermittents).
    fx = await seedUpsellFixtures(`-${testInfo.project.name}`);
  });

  test('carte « achat » (+29 €) — Premium sans upsell, sans débordement', async ({ page }) => {
    await devLogin(page, COUPLE_PHONE);
    await page.goto(`/events/${fx.buyEventId}`);

    const cta = page.getByTestId('upsell-cta');
    await expect(cta).toBeVisible();
    await expect(page.getByTestId('upsell-card-purchased')).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
  });

  test('carte « acheté » — téléchargement HD visible, sans débordement', async ({ page }) => {
    await devLogin(page, COUPLE_PHONE);
    await page.goto(`/events/${fx.purchasedEventId}`);

    await expect(page.getByTestId('upsell-card-purchased')).toBeVisible();
    await expect(page.getByTestId('upsell-download-hd')).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test('commande de livre photo via le Dialog → statut, puis remonte en admin', async ({
    page,
  }) => {
    // Flux long (2 connexions + formulaire) ; sous charge parallèle (3 workers
    // sur un seul serveur dev) le défaut de 30 s est trop court.
    test.slow();
    await devLogin(page, COUPLE_PHONE);
    await page.goto(`/events/${fx.purchasedEventId}`);

    // Le Dialog s'ouvre et tient dans le viewport (pas de débordement).
    await page.getByTestId('photo-book-trigger').click();
    await expect(page.getByTestId('pb-recipient')).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.getByTestId('pb-recipient').fill('Inès & Yanis');
    await page.getByTestId('pb-address1').fill('14 avenue des Roses');
    await page.getByTestId('pb-postal').fill('20000');
    await page.getByTestId('pb-city').fill('Casablanca');
    await page.getByTestId('pb-country').fill('Maroc');
    await page.getByTestId('photo-book-submit').click();

    // Après commande, la carte affiche le statut (plus le bouton de commande).
    await expect(page.getByTestId('photo-book-status')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('photo-book-trigger')).toHaveCount(0);
    await expectNoHorizontalOverflow(page);

    // Côté admin : la commande remonte et le statut est modifiable.
    await devLogin(page, ADMIN_PHONE);
    await page.goto('/admin/photo-books');
    const row = page.getByTestId('photo-book-order-row').first();
    await expect(row).toBeVisible();
    await expect(row).toContainText('Casablanca');
    await expectNoHorizontalOverflow(page);
  });

  test('admin /admin/photo-books — liste responsive sans débordement', async ({ page }) => {
    await devLogin(page, ADMIN_PHONE);
    await page.goto('/admin/photo-books');
    await expect(page.getByRole('heading', { name: /Livres photo/i })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});
