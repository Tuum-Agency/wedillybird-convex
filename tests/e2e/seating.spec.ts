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

/** Glisse un élément d'un delta (dx, dy) — pour repositionner un nœud table. */
async function dndDragBy(page: Page, locator: Locator, dx: number, dy: number): Promise<void> {
  const b = await locator.boundingBox();
  if (!b) throw new Error('bounding box introuvable');
  const cx = b.x + b.width / 2;
  const cy = b.y + b.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 10, cy + 10, { steps: 4 });
  await page.mouse.move(cx + dx, cy + dy, { steps: 12 });
  await page.mouse.move(cx + dx, cy + dy + 3, { steps: 2 });
  await page.mouse.up();
}

test.describe('Plan de table (seating)', () => {
  test.skip(requiresConvexDev(), 'Convex dev deployment required');

  let fixtures: TierFixtures;

  // Re-seed avant CHAQUE test : les tests de plan de table mutent l'event
  // Premium (tables, assignations), on repart donc d'un état propre (4 invités
  // confirmés non placés, 0 table) à chaque fois.
  test.beforeEach(async () => {
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

  test('Premium : board, ajout de table et glisser un invité', async ({ page, isMobile }) => {
    // Le helper dndDrag est basé sur page.mouse ; sur mobile (hasTouch) le board
    // utilise le TouchSensor dnd-kit (delay 200ms) que la souris ne déclenche pas.
    // L'app supporte bien le tactile (TouchSensor configuré) — c'est le helper e2e
    // qui doit évoluer vers une simulation tactile. Couvert sur desktop.
    test.skip(isMobile, 'dnd souris incompatible TouchSensor mobile (helper à faire évoluer)');
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

  test('Premium : placement automatique place tous les invités', async ({ page }) => {
    await devLogin(page, fixtures.premium.ownerPhone);
    await page.goto(`/events/${fixtures.premium.eventId}/seating`);

    const unassigned = page.getByTestId('unassigned-column').getByTestId('guest-chip');
    await expect(unassigned.first()).toBeVisible();

    await page.getByTestId('auto-place').click();

    // Après placement auto : plus aucun invité non placé + au moins une table créée.
    await expect(unassigned).toHaveCount(0, { timeout: 15_000 });
    await expect(page.getByTestId('table-card').first()).toBeVisible();
  });

  test('Premium : un accompagnant se place indépendamment de son invité', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'dnd souris incompatible TouchSensor mobile (helper à faire évoluer)');
    await devLogin(page, fixtures.premium.ownerPhone);
    await page.goto(`/events/${fixtures.premium.eventId}/seating`);

    await page.getByTestId('add-table').click();
    const tableCard = page.getByTestId('table-card');
    await expect(tableCard).toHaveCount(1);

    // Un chip « accompagnant » (data-member-index >= 1) existe dans les non-placés.
    const plusOne = page
      .getByTestId('unassigned-column')
      .locator('[data-testid="guest-chip"][data-member-index="1"]')
      .first();
    await expect(plusOne).toBeVisible();

    // Glisse uniquement l'accompagnant vers la table.
    await dndDrag(page, plusOne, tableCard.first());

    // La table contient exactement 1 personne, et c'est bien l'accompagnant.
    await expect(tableCard.first().getByTestId('guest-chip')).toHaveCount(1, { timeout: 10_000 });
    await expect(
      tableCard.first().locator('[data-testid="guest-chip"][data-member-index="1"]'),
    ).toHaveCount(1);
  });

  test('Premium : vue Plan, repositionner une table', async ({ page, isMobile }) => {
    test.skip(isMobile, 'dnd souris incompatible TouchSensor mobile (helper à faire évoluer)');
    await devLogin(page, fixtures.premium.ownerPhone);
    await page.goto(`/events/${fixtures.premium.eventId}/seating`);

    // Crée une table puis bascule sur la vue Plan.
    await page.getByTestId('add-table').click();
    await expect(page.getByTestId('table-card')).toHaveCount(1);
    await page.getByTestId('view-plan').click();

    const node = page.getByTestId('table-node').first();
    await expect(node).toBeVisible();
    const before = await node.boundingBox();
    if (!before) throw new Error('table-node sans bounding box');

    // Glisse le nœud (par sa poignée) de +180px en X.
    await dndDragBy(page, page.getByTestId('table-node-handle').first(), 180, 70);

    await expect
      .poll(async () => (await node.boundingBox())?.x ?? 0, { timeout: 10_000 })
      .toBeGreaterThan(before.x + 60);
  });
});
