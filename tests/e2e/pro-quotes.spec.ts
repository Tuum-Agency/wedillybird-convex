import { test, expect } from '@playwright/test';
import { requiresConvexDev, loginAsPhone, seedTierFixtures } from './utils/fixtures';

/**
 * Devis & Factures (module Finances) — back-office agence.
 *  - gating : Starter voit le module verrouillé (réservé Business+) ;
 *  - Business : liste + KPIs + bascule Devis/Factures + création via l'éditeur.
 */
test.describe('Devis & Factures', () => {
  test.skip(requiresConvexDev(), 'Convex dev deployment required');

  test('Starter : module verrouillé (réservé Business)', async ({ page }) => {
    await seedTierFixtures();
    await loginAsPhone(page, '+225071234567'); // Kwame — agence Starter
    await page.goto('/pro/quotes');
    await expect(page.getByText(/Inclus à partir du forfait Business/i)).toBeVisible();
  });

  test('Business : liste, KPIs et bascule Devis/Factures', async ({ page }) => {
    const fx = await seedTierFixtures();
    await loginAsPhone(page, fx.business.ownerPhone);
    await page.goto('/pro/quotes');
    await expect(page.getByRole('heading', { name: 'Devis & Factures', level: 1 })).toBeVisible();
    await expect(page.getByText('Encaissé ce mois')).toBeVisible();
    await expect(page.getByText('DEV-2026-014')).toBeVisible();
    // bascule vers les factures
    await page.getByRole('tab', { name: /Factures/ }).click();
    await expect(page.getByText('FAC-2026-031')).toBeVisible();
  });

  test('Business : encaisser une échéance de facture (suivi manuel, sans Wedillybird Pay)', async ({
    page,
  }) => {
    const fx = await seedTierFixtures();
    await loginAsPhone(page, fx.business.ownerPhone);
    await page.goto('/pro/quotes');
    // Crée une facture fraîche (l'éditeur pré-remplit un échéancier acompte + solde).
    await page.getByRole('tab', { name: /Factures/ }).click();
    await page.getByTestId('new-doc').click();
    await page.getByRole('button', { name: /^Envoyer/ }).click();
    await expect(page.getByRole('button', { name: /Retour à la liste/ })).toBeVisible();

    // La section d'encaissement manuel des échéances est présente + actionnable.
    await expect(page.getByText('Échéances · encaissement manuel')).toBeVisible();
    const mark = page.getByRole('button', { name: 'Marquer payé' });
    await expect(mark.first()).toBeVisible();
    const before = await mark.count();
    await mark.first().click();
    // Une échéance encaissée → badge « Encaissé » + un bouton « Marquer payé » de moins.
    await expect(page.getByText('Encaissé').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Marquer payé' })).toHaveCount(before - 1);
  });

  test('Business : création d’un devis via l’éditeur', async ({ page }) => {
    const fx = await seedTierFixtures();
    await loginAsPhone(page, fx.business.ownerPhone);
    await page.goto('/pro/quotes');
    await page.getByTestId('new-doc').click();
    await expect(page.getByText('Client & mariage')).toBeVisible();
    await page.getByRole('button', { name: /^Envoyer/ }).click();
    // après envoi, on bascule sur la vue détail du document créé
    await expect(page.getByRole('button', { name: /Retour à la liste/ })).toBeVisible();
  });
});
