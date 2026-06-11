import { test, expect } from '@playwright/test';
import { requiresConvexDev, loginAsPhone, seedTierFixtures } from './utils/fixtures';

/**
 * Réglages (Pilotage) — shell redessiné (design Claude) : sous-nav groupée
 * (Organisation / Communication / Compte) + Modules liés, panel-head eyebrow,
 * bascule de section.
 */
test.describe('Réglages', () => {
  test.skip(requiresConvexDev(), 'Convex dev deployment required');

  test('Business : sous-nav groupée + panneau Profil par défaut', async ({ page }) => {
    const fx = await seedTierFixtures();
    await loginAsPhone(page, fx.business.ownerPhone);
    await page.goto('/pro/settings');
    await expect(page.getByRole('heading', { name: 'Réglages', level: 1 })).toBeVisible();
    // groupes uniques à la sous-nav réglages
    await expect(page.getByText('Communication', { exact: true })).toBeVisible();
    await expect(page.getByText('Modules liés')).toBeVisible();
    // panel-head + carte Profil
    await expect(page.getByText(/Réglages · /)).toBeVisible();
    await expect(page.getByText('Identité de l’organisation')).toBeVisible();
    // modules liés → liens vers Équipe & Facturation
    await expect(page.getByRole('link', { name: /Équipe & rôles/ })).toBeVisible();
  });

  test('Business : bascule Marque blanche puis Notifications', async ({ page }) => {
    const fx = await seedTierFixtures();
    await loginAsPhone(page, fx.business.ownerPhone);
    await page.goto('/pro/settings');
    await page.getByRole('button', { name: 'Marque blanche' }).click();
    // titre du panel-head exact (le WhiteLabelForm a « Domaine & marque blanche »)
    await expect(page.getByRole('heading', { name: 'Marque blanche', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Notifications' }).click();
    await expect(page.getByRole('heading', { name: 'Notifications', exact: true })).toBeVisible();
  });
});
