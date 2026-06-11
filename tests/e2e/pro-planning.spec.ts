import { test, expect } from '@playwright/test';
import { requiresConvexDev, loginAsPhone, seedTierFixtures } from './utils/fixtures';

/**
 * Rétroplanning — back-office agence (tous tiers).
 * Vérifie l'application d'un modèle et la création/cochage d'une tâche.
 */
test.describe('Rétroplanning', () => {
  test.skip(requiresConvexDev(), 'Convex dev deployment required');

  test('Business : applique un modèle puis voit les tâches', async ({ page }) => {
    const fx = await seedTierFixtures();
    // Le seed étant non destructif, le rétroplanning peut déjà contenir des
    // tâches → un confirm() apparaît à l'application du modèle ; on l'accepte.
    page.on('dialog', (d) => d.accept());
    await loginAsPhone(page, fx.business.ownerPhone);
    await page.goto('/pro/planning');
    await expect(page.getByRole('heading', { name: 'Rétroplanning', level: 1 })).toBeVisible();
    await page.getByTestId('apply-classic').click();
    // Le bouton ouvre désormais un dialogue d'aperçu → on confirme.
    await page.getByTestId('confirm-template').click();
    // Le modèle peut avoir été appliqué lors d'un run précédent (seed non
    // destructif) → on tolère les doublons avec .first().
    await expect(page.getByText('Choisir et réserver le lieu').first()).toBeVisible();
    await expect(page.getByText('Envoyer les faire-part').first()).toBeVisible();
  });

  test('Business : marquer une tâche faite via la pastille de statut (À faire→En cours→Fait)', async ({
    page,
  }) => {
    const fx = await seedTierFixtures();
    await loginAsPhone(page, fx.business.ownerPhone);
    await page.goto('/pro/planning');
    await expect(page.getByRole('heading', { name: 'Rétroplanning', level: 1 })).toBeVisible();
    // La pastille de statut est un bouton « Statut : … — changer » qui cycle.
    const doneBefore = await page.getByRole('button', { name: /Statut : Fait/ }).count();
    // Cliquer une tâche « En cours » la passe à « Fait » → +1 fait.
    await page
      .getByRole('button', { name: /Statut : En cours/ })
      .first()
      .click();
    await expect(page.getByRole('button', { name: /Statut : Fait/ })).toHaveCount(doneBefore + 1);
  });

  test('Business : ajoute une tâche via le drawer', async ({ page }) => {
    const fx = await seedTierFixtures();
    await loginAsPhone(page, fx.business.ownerPhone);
    await page.goto('/pro/planning');
    const tag = Date.now().toString(36);
    await page.getByTestId('new-task').click();
    await page.getByLabel(/Tâche/).fill(`Goûter ${tag}`);
    await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
    await expect(page.getByText(`Goûter ${tag}`)).toBeVisible();
  });

  test('Business : modifie une tâche via le drawer (titre cliquable)', async ({ page }) => {
    const fx = await seedTierFixtures();
    await loginAsPhone(page, fx.business.ownerPhone);
    await page.goto('/pro/planning');
    const tag = Date.now().toString(36);
    // Crée une tâche, puis la rouvre en édition par clic sur son titre.
    await page.getByTestId('new-task').click();
    await page.getByLabel(/Tâche/).fill(`Brunch ${tag}`);
    await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
    await page.getByRole('button', { name: `Brunch ${tag}`, exact: true }).click();
    await expect(page.getByText('Modifier la tâche')).toBeVisible();
    await page.getByLabel(/Tâche/).fill(`Brunch ${tag} (final)`);
    await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    await expect(page.getByText(`Brunch ${tag} (final)`)).toBeVisible();
  });

  test('Business : enregistre le rétroplanning comme modèle maison puis le retrouve', async ({
    page,
  }) => {
    const fx = await seedTierFixtures();
    page.on('dialog', (d) => d.accept());
    await loginAsPhone(page, fx.business.ownerPhone);
    await page.goto('/pro/planning');
    await expect(page.getByRole('heading', { name: 'Rétroplanning', level: 1 })).toBeVisible();
    // S'assure qu'il y a des tâches (sinon pas de bouton « Enregistrer comme modèle »).
    await page.getByTestId('apply-classic').click();
    await page.getByTestId('confirm-template').click();
    await expect(page.getByText('Choisir et réserver le lieu').first()).toBeVisible();

    // Enregistre le planning courant comme modèle nommé.
    const name = `Modèle ${Date.now().toString(36)}`;
    await page.getByTestId('save-template').click();
    await page.getByLabel('Nom du modèle').fill(name);
    await page.getByTestId('confirm-save-template').click();

    // Le modèle maison apparaît dans le dialogue d'application.
    await page.getByTestId('apply-classic').click();
    await expect(page.getByRole('button', { name: new RegExp(name) })).toBeVisible();
    await expect(page.getByRole('button', { name: `Supprimer le modèle ${name}` })).toBeVisible();
  });

  test('Business : bascule sur la vue Tableau (kanban tri-état)', async ({ page }) => {
    const fx = await seedTierFixtures();
    page.on('dialog', (d) => d.accept());
    await loginAsPhone(page, fx.business.ownerPhone);
    await page.goto('/pro/planning');
    // S'assure qu'il y a des tâches (modèle non destructif) via le dialogue.
    await page.getByTestId('apply-classic').click();
    await page.getByTestId('confirm-template').click();
    await expect(page.getByText('Choisir et réserver le lieu').first()).toBeVisible();
    // Bascule sur la vue Tableau → les trois colonnes de statut apparaissent
    // (on cible les en-têtes de colonne `span.font-medium`, pas les <option> du filtre).
    await page.getByRole('tab', { name: 'Tableau' }).click();
    await expect(
      page.locator('span.font-medium').filter({ hasText: 'À faire' }).first(),
    ).toBeVisible();
    await expect(
      page.locator('span.font-medium').filter({ hasText: 'En cours' }).first(),
    ).toBeVisible();
    await expect(
      page.locator('span.font-medium').filter({ hasText: 'Fait' }).first(),
    ).toBeVisible();
  });
});
