import { test, expect, type Locator, type Page } from '@playwright/test';
import { requiresConvexDev, seedTierFixtures, type TierFixtures } from './utils/fixtures';

/**
 * Plan de table (seating) — vérifie en dev browser :
 *  - ESSENTIEL → accès bloqué, upsell Premium affiché (pas de board).
 *  - PREMIUM → board drag-and-drop : invités confirmés listés, ajout de table,
 *    et glisser-déposer d'un invité vers une table (assignation persistée).
 *
 * Le seed `seedTierFixtures` crée l'event Premium avec 4 invités confirmés.
 */

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

/**
 * Drag-and-drop compatible @dnd-kit (PointerSensor + distance d'activation).
 * On descend la souris, on dépasse le seuil par petits pas, puis on relâche
 * au centre de la cible — un simple dragTo ne déclenche pas les sensors.
 */
async function dndDrag(page: Page, source: Locator, target: Locator): Promise<void> {
  const s = await source.boundingBox();
  const t = await target.boundingBox();
  if (!s || !t) throw new Error('bounding box introuvable');
  const sx = s.x + s.width / 2;
  const sy = s.y + s.height / 2;
  const tx = t.x + t.width / 2;
  const ty = t.y + t.height / 2;
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  await page.mouse.move(sx + 12, sy + 12, { steps: 5 }); // dépasse la distance d'activation
  await page.mouse.move(tx, ty, { steps: 12 });
  await page.mouse.move(tx, ty + 4, { steps: 3 }); // stabilise la collision
  await page.mouse.up();
}

test.describe('Plan de table (seating)', () => {
  test.skip(requiresConvexDev(), 'Convex dev deployment required');

  let fixtures: TierFixtures;

  test.beforeAll(async () => {
    fixtures = await seedTierFixtures();
  });

  test('Essentiel : accès bloqué (upsell Premium, pas de board)', async ({ page }) => {
    await devLogin(page, fixtures.essential.ownerPhone);
    await page.goto(`/events/${fixtures.essential.eventId}/seating`);
    // Le board (bouton "ajouter une table") ne doit pas être rendu.
    await expect(page.getByTestId('add-table')).toHaveCount(0);
    // L'upsell mentionne Premium.
    await expect(page.getByText(/Premium/i).first()).toBeVisible();
  });

  test('Premium : board, ajout de table et glisser un invité', async ({ page }) => {
    await devLogin(page, fixtures.premium.ownerPhone);
    await page.goto(`/events/${fixtures.premium.eventId}/seating`);

    const addTable = page.getByTestId('add-table');
    await expect(addTable).toBeVisible();

    // Les invités confirmés seedés apparaissent dans la colonne non-placés.
    const chips = page.getByTestId('guest-chip');
    await expect(chips.first()).toBeVisible();
    const initialCount = await chips.count();
    expect(initialCount).toBeGreaterThan(0);

    // Ajoute une table.
    await addTable.click();
    const tableCard = page.getByTestId('table-card');
    await expect(tableCard).toHaveCount(1);

    // Glisse le premier invité non-placé vers la table.
    await dndDrag(page, page.getByTestId('guest-chip').first(), tableCard.first());

    // La table contient désormais un invité.
    await expect(tableCard.first().getByTestId('guest-chip')).toHaveCount(1, { timeout: 10_000 });
  });
});
