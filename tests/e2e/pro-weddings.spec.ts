import { test, expect } from '@playwright/test';
import { requiresConvexDev, loginAsPhone, seedTierFixtures } from './utils/fixtures';

/**
 * Hub mariage (back-office agence) — page de détail d'un mariage, distincte de la
 * vue couple. Vérifie l'en-tête, l'onglet Aperçu et les onglets opérationnels
 * rendus DANS le hub (univers dark), sans navigation vers les pages couple.
 */
test.describe('Hub mariage', () => {
  test.skip(requiresConvexDev(), 'Convex dev deployment required');

  test('Agency : aperçu du mariage + onglets', async ({ page }) => {
    const fx = await seedTierFixtures();
    await loginAsPhone(page, fx.business.ownerPhone);
    await page.goto(`/pro/weddings/${fx.business.eventId}`);
    await expect(page.getByRole('heading', { name: /Awa.*Karim/, level: 1 })).toBeVisible();
    await expect(page.getByText('Réponses RSVP')).toBeVisible();
    await expect(page.getByText('Actions rapides')).toBeVisible();
    // Onglets opérationnels présents (boutons à état, rendus dans le hub).
    await expect(page.getByRole('tab', { name: 'Invités' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Plan de table' })).toBeVisible();
  });

  test('Agency : les onglets opérationnels se rendent dans le hub', async ({ page }) => {
    const fx = await seedTierFixtures();
    await loginAsPhone(page, fx.business.ownerPhone);
    await page.goto(`/pro/weddings/${fx.business.eventId}`);
    const hubUrl = new RegExp(`/pro/weddings/${fx.business.eventId}$`);

    // Invités : panneau interne (pas de navigation vers /events/.../guests).
    await page.getByRole('tab', { name: 'Invités' }).click();
    await expect(page.getByRole('link', { name: /Gérer les invités/i })).toBeVisible();
    await expect(page).toHaveURL(hubUrl);

    // Check-in : panneau interne avec le scanner simulé.
    await page.getByRole('tab', { name: 'Check-in' }).click();
    await expect(page.getByRole('button', { name: /Simuler un scan QR/i })).toBeVisible();
    await expect(page).toHaveURL(hubUrl);

    // Facture : registre de facturation de l'événement.
    await page.getByRole('tab', { name: 'Facture' }).click();
    await expect(page.getByText('Facturation de l’événement')).toBeVisible();
    await expect(page).toHaveURL(hubUrl);
  });

  test('Agency : la liste des mariages ouvre le hub', async ({ page }) => {
    const fx = await seedTierFixtures();
    await loginAsPhone(page, fx.business.ownerPhone);
    await page.goto('/pro/weddings');
    await page.locator('ul li a').first().click();
    await expect(page).toHaveURL(/\/pro\/weddings\/[^/]+$/);
  });
});
