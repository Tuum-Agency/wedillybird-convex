import { test, expect } from '@playwright/test';
import { requiresConvexDev, loginAsPhone, seedTierFixtures } from './utils/fixtures';

/**
 * Prestataires — annuaire agence (tous tiers ; Starter ≤ 25 fiches).
 * Vérifie la liste, l'ajout et la recherche.
 */
test.describe('Prestataires', () => {
  test.skip(requiresConvexDev(), 'Convex dev deployment required');

  test('Business : annuaire peuplé + ajout', async ({ page }) => {
    const fx = await seedTierFixtures();
    await loginAsPhone(page, fx.business.ownerPhone);
    await page.goto('/pro/vendors');
    await expect(page.getByRole('heading', { name: 'Prestataires', level: 1 })).toBeVisible();
    await expect(page.getByText('Domaine de Bellevue')).toBeVisible();

    const tag = Date.now().toString(36);
    await page.getByTestId('new-vendor').click();
    await page.getByLabel(/Nom/).fill(`Atelier ${tag}`);
    await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
    await expect(page.getByText(`Atelier ${tag}`)).toBeVisible();
  });

  test('Business : recherche filtre l’annuaire', async ({ page }) => {
    const fx = await seedTierFixtures();
    await loginAsPhone(page, fx.business.ownerPhone);
    await page.goto('/pro/vendors');
    await page.getByLabel('Rechercher').fill('Diop');
    await expect(page.getByText('Maison Diop')).toBeVisible();
    await expect(page.getByText('Domaine de Bellevue')).toHaveCount(0);
  });

  test('Business : formulaire prestataire — téléphone à indicatif + WhatsApp = même numéro', async ({
    page,
  }) => {
    const fx = await seedTierFixtures();
    await loginAsPhone(page, fx.business.ownerPhone);
    await page.goto('/pro/vendors');
    await page.getByTestId('new-vendor').click();

    // Le téléphone est un PhoneInput (input[type=tel] + sélecteur d'indicatif).
    await expect(page.locator('input[type="tel"]')).toHaveCount(1);

    // « WhatsApp = même numéro » est coché par défaut (pas de second champ).
    const sameToggle = page.getByRole('checkbox', { name: /WhatsApp = même numéro/ });
    await expect(sameToggle).toBeChecked();

    // Décocher révèle un second PhoneInput dédié au WhatsApp.
    await sameToggle.uncheck();
    await expect(page.locator('input[type="tel"]')).toHaveCount(2);
  });

  test('Business : onglet « Par mariage » + dialogue de rattachement', async ({ page }) => {
    const fx = await seedTierFixtures();
    await loginAsPhone(page, fx.business.ownerPhone);
    await page.goto('/pro/vendors');
    await page.getByRole('tab', { name: 'Par mariage' }).click();
    await expect(page.getByText('Budget rattaché')).toBeVisible();
    await expect(page.getByText(/rattaché.* à ce mariage/)).toBeVisible();
    await page.getByTestId('attach-vendor').click();
    await expect(page.getByText('Créer la ligne budget correspondante')).toBeVisible();
  });
});
