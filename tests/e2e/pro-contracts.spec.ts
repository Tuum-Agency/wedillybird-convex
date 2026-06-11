import { test, expect } from '@playwright/test';
import { requiresConvexDev, loginAsPhone, seedTierFixtures } from './utils/fixtures';

/**
 * Contrats (module Finances) — board redessiné (design Claude) : liste +
 * smart-file (dossier de réservation), éditeur avec assistant IA country-aware
 * + signature électronique (eIDAS / ESIGN-UETA), détail + piste d'audit.
 *  - gating Starter → verrouillé ;
 *  - Business : smart-file + contrat de démo ; création via modèle + IA + envoi ;
 *    détail avec audit e-signature.
 */
test.describe('Contrats', () => {
  test.skip(requiresConvexDev(), 'Convex dev deployment required');

  test('Starter : module verrouillé (réservé Business)', async ({ page }) => {
    await seedTierFixtures();
    await loginAsPhone(page, '+225071234567'); // Kwame — Starter
    await page.goto('/pro/contracts');
    await expect(page.getByText(/Inclus à partir du forfait Business/i)).toBeVisible();
  });

  test('Business : smart-file + contrat de démo en liste', async ({ page }) => {
    const fx = await seedTierFixtures();
    await loginAsPhone(page, fx.business.ownerPhone);
    await page.goto('/pro/contracts');
    await expect(page.getByRole('heading', { name: 'Contrats', level: 1 })).toBeVisible();
    await expect(page.getByText('Dossier de réservation')).toBeVisible(); // smart-file
    await expect(page.getByText('CON-2026-007').first()).toBeVisible(); // contrat seedé (smart-file + ligne tableau)
    await expect(page.getByRole('button', { name: 'Modèles' })).toBeVisible();
  });

  test('Business : créer via modèle, assistant IA, puis envoyer', async ({ page }) => {
    const fx = await seedTierFixtures();
    await loginAsPhone(page, fx.business.ownerPhone);
    await page.goto('/pro/contracts');
    // vue Modèles → choisir « Coordination jour J »
    await page.getByRole('button', { name: 'Modèles' }).click();
    await page.getByRole('button', { name: /Coordination jour J/ }).click();
    // drawer de création
    await page.getByLabel(/Montant total/).fill('2500');
    await page.getByRole('button', { name: /Créer le contrat/ }).click();
    // éditeur : assistant IA présent
    await expect(page.getByText('Assistant contrats')).toBeVisible();
    await page.getByRole('button', { name: /Générer les clauses/ }).click();
    // envoyer pour signature → retour liste avec statut « Envoyé »
    await page.getByRole('button', { name: /Envoyer pour signature/ }).click();
    await expect(page.getByText('Envoyé').first()).toBeVisible();
  });

  test('Business : détail contrat avec piste d’audit e-signature', async ({ page }) => {
    const fx = await seedTierFixtures();
    await loginAsPhone(page, fx.business.ownerPhone);
    await page.goto('/pro/contracts');
    await page.locator('tr', { hasText: 'CON-2026-007' }).first().click(); // 1re ligne (dev partagé : plusieurs contrats seedés possibles)
    await expect(page.getByText('Piste d’audit', { exact: true })).toBeVisible();
    await expect(page.getByText('eIDAS').first()).toBeVisible();
    await expect(page.getByText('Contrat créé')).toBeVisible(); // entrée d'audit
  });
});
