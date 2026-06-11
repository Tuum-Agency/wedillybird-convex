import { test, expect } from '@playwright/test';
import { requiresConvexDev, loginAsPhone, seedTierFixtures } from './utils/fixtures';

/**
 * Équipe — rôles & accès. Membres en table, compteur de sièges, onglet matrice
 * de permissions, et ouverture du formulaire d'invitation.
 */
test.describe('Équipe — rôles & accès', () => {
  test.skip(requiresConvexDev(), 'Convex dev deployment required');

  test('Business : table membres, sièges, matrice de permissions', async ({ page }) => {
    const fx = await seedTierFixtures();
    await loginAsPhone(page, fx.business.ownerPhone);
    await page.goto('/pro/team');
    await expect(page.getByRole('heading', { name: 'Équipe', level: 1 })).toBeVisible();
    await expect(page.getByTestId('member-row').first()).toBeVisible();
    // bascule sur l'onglet matrice
    await page.getByRole('tab', { name: /Rôles & permissions/ }).click();
    await expect(page.getByText('Accès total')).toBeVisible(); // carte rôle Propriétaire
    // matrice des permissions en tableau (en-tête + compteur + lignes capacités)
    await expect(page.getByRole('heading', { name: 'Matrice des permissions' })).toBeVisible();
    await expect(page.getByText('7 capacités')).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Capacité' })).toBeVisible();
    await expect(page.getByText('Supprimer l’organisation')).toBeVisible();
  });

  test('Business : ouvrir le formulaire d’invitation (toggle e-mail/WhatsApp)', async ({
    page,
  }) => {
    const fx = await seedTierFixtures();
    await loginAsPhone(page, fx.business.ownerPhone);
    await page.goto('/pro/team');
    await page.getByTestId('open-invite').click();
    await expect(page.getByTestId('invite-form')).toBeVisible();
    await expect(page.getByLabel('E-mail')).toBeVisible();
    // bascule WhatsApp
    await page.getByRole('button', { name: 'WhatsApp' }).click();
    await expect(page.getByLabel('Numéro WhatsApp')).toBeVisible();
  });
});
