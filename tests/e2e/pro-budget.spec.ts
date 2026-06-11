import { test, expect } from '@playwright/test';
import { requiresConvexDev, loginAsPhone, seedTierFixtures } from './utils/fixtures';

/**
 * Budget mariage — back-office agence.
 *
 * Lecture pour tous les tiers, édition réservée à Business+. On vérifie :
 *  - Business : budget peuplé + ajout d'une ligne ;
 *  - Starter : lecture seule (pas de bouton d'ajout, note de gating).
 */
test.describe('Budget mariage', () => {
  test.skip(requiresConvexDev(), 'Convex dev deployment required');

  test('Business : budget accessible, lignes visibles, ajout possible', async ({ page }) => {
    const fx = await seedTierFixtures();
    await loginAsPhone(page, fx.business.ownerPhone);
    await page.goto('/pro/budget');
    await expect(page.getByRole('heading', { name: 'Budget', level: 1 })).toBeVisible();
    await expect(page.getByText('Menu 150 couverts')).toBeVisible();

    const tag = Date.now().toString(36);
    await page.getByTestId('new-budget-line').click();
    await page.getByLabel(/Libellé/).fill(`Fleurs ${tag}`);
    await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
    await expect(page.getByText(`Fleurs ${tag}`)).toBeVisible();
  });

  test('Business : enveloppe, barre de santé et graphiques', async ({ page }) => {
    const fx = await seedTierFixtures();
    await loginAsPhone(page, fx.business.ownerPhone);
    await page.goto('/pro/budget');
    await expect(page.getByText('Enveloppe', { exact: true })).toBeVisible(); // KPI dédié
    await expect(page.getByText('Avancement des paiements')).toBeVisible(); // barre de santé
    await expect(page.getByText('Répartition du prévu')).toBeVisible(); // donut
    await expect(page.getByText('Prévu vs payé par poste')).toBeVisible(); // barres
    await expect(
      page.getByText(/Sous l.enveloppe|Proche de l.enveloppe|Dépassement de l.enveloppe/),
    ).toBeVisible();
  });

  test('Starter : budget en lecture seule', async ({ page }) => {
    await seedTierFixtures();
    await loginAsPhone(page, '+225071234567'); // Kwame — Starter
    await page.goto('/pro/budget');
    await expect(
      page.getByText(/Édition des lignes disponible à partir du forfait Business/i),
    ).toBeVisible();
    await expect(page.getByTestId('new-budget-line')).toHaveCount(0);
  });
});
