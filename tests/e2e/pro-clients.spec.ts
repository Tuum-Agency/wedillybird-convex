import { test, expect } from '@playwright/test';
import { requiresConvexDev, loginAsPhone, seedTierFixtures } from './utils/fixtures';

/**
 * CRM Clients — back-office agence.
 *
 * Couvre :
 *  - le gating par forfait : une agence Starter voit le module verrouillé ;
 *  - le pipeline complet d'une agence Business : liste, création, bascule de vue.
 *
 * Dépend du deployment Convex dev (`/dev-login` + fixtures seedées).
 */
test.describe('CRM Clients', () => {
  test.skip(requiresConvexDev(), 'Convex dev deployment required');

  test('Starter : module Clients verrouillé (réservé Business)', async ({ page }) => {
    await seedTierFixtures();
    await loginAsPhone(page, '+225071234567'); // Kwame — agence Starter
    await page.goto('/pro/clients');
    await expect(page.getByText(/Inclus à partir du forfait Business/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /Voir les forfaits/i })).toBeVisible();
  });

  test('Business : pipeline accessible, liste les clients de démo', async ({ page }) => {
    const fx = await seedTierFixtures();
    await loginAsPhone(page, fx.business.ownerPhone); // Camille — agence Business
    await page.goto('/pro/clients');
    await expect(page.getByRole('heading', { name: 'Clients', level: 1 })).toBeVisible();
    await expect(page.getByText('Awa & Karim')).toBeVisible();
    await expect(page.getByText('Léa & Tom')).toBeVisible();
  });

  test('Business : création d’un client via le drawer', async ({ page }) => {
    const fx = await seedTierFixtures();
    await loginAsPhone(page, fx.business.ownerPhone);
    await page.goto('/pro/clients');
    const tag = Date.now().toString(36);
    await page.getByTestId('new-client').click();
    await page.getByLabel(/Partenaire A/).fill(`Inès-${tag}`);
    await page.getByLabel(/Partenaire B/).fill('Yassine');
    await page.getByRole('button', { name: /Créer le client/i }).click();
    // La fiche du nouveau client s'ouvre automatiquement.
    await expect(page.getByRole('dialog', { name: new RegExp(`Inès-${tag}`) })).toBeVisible();
  });

  test('Business : fiche client (coordonnées, budget, ajout de note)', async ({ page }) => {
    const fx = await seedTierFixtures();
    await loginAsPhone(page, fx.business.ownerPhone);
    await page.goto('/pro/clients');
    await page.getByText('Awa & Karim').click();
    const sheet = page.getByRole('dialog', { name: /Awa.*Karim/ });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByText('Coordonnées')).toBeVisible();
    await expect(sheet.getByText('Budget')).toBeVisible();
    const tag = Date.now().toString(36);
    await sheet.getByLabel('Ajouter une note').fill(`Note ${tag}`);
    await sheet.getByLabel('Enregistrer la note').click();
    await expect(sheet.getByText(`Note ${tag}`)).toBeVisible();
  });

  test('Business : bascule vue Pipeline (kanban)', async ({ page }) => {
    const fx = await seedTierFixtures();
    await loginAsPhone(page, fx.business.ownerPhone);
    await page.goto('/pro/clients');
    const pipelineBtn = page.getByRole('button', { name: 'Pipeline' });
    await pipelineBtn.click();
    await expect(pipelineBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText('Awa & Karim')).toBeVisible();
    // Colonnes kanban = régions nommées par leur libellé pluriel.
    await expect(page.getByRole('region', { name: 'Réservés' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Livrés' })).toBeVisible();
  });

  test('Business : kanban — glisser une carte change l’étape', async ({ page }) => {
    const fx = await seedTierFixtures();
    // Viewport large : les 6 colonnes tiennent côte à côte sans scroll
    // horizontal, donc les boundingBox restent dans le viewport.
    await page.setViewportSize({ width: 2200, height: 900 });
    await loginAsPhone(page, fx.business.ownerPhone);
    await page.goto('/pro/clients');
    await page.getByRole('button', { name: 'Pipeline' }).click();
    // Saisir la carte par son corps complet (role=button) → centre fiable.
    const card = page.getByRole('button', { name: /^Sofia & Mehdi/ });
    const target = page.getByRole('region', { name: 'Réservés' });
    await card.scrollIntoViewIfNeeded();
    await expect(card).toBeVisible();
    await page.waitForTimeout(300); // laisse dnd-kit se monter

    // Drag avec réessai : sous charge (serveur dev partagé entre workers), un
    // dépôt dnd-kit peut ne pas se déclencher. On retente la séquence souris
    // jusqu'à ce que la carte atterrisse réellement dans « Réservés ».
    await expect(async () => {
      const cb = await card.boundingBox();
      const tb = await target.boundingBox();
      if (!cb || !tb) throw new Error('bounding box introuvable');
      const cx = cb.x + cb.width / 2;
      const cy = cb.y + cb.height / 2;
      const tx = tb.x + tb.width / 2;
      const ty = tb.y + tb.height / 2;
      await page.mouse.move(cx, cy);
      await page.mouse.down();
      await page.waitForTimeout(60);
      await page.mouse.move(cx + 12, cy, { steps: 3 }); // dépasse l'activation (6px)
      await page.mouse.move(tx, ty, { steps: 20 });
      await page.waitForTimeout(120);
      await page.mouse.up();
      // La carte « Sofia & Mehdi » est désormais dans la colonne « Réservés ».
      await expect(target.getByText('Sofia & Mehdi')).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 20000 });
  });
});
