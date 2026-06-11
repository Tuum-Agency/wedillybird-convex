import { test, expect } from '@playwright/test';
import { requiresConvexDev, loginAsPhone, seedTierFixtures } from './utils/fixtures';

/**
 * Intégrations — import CSV de clients (réutilise les mutations CRM).
 *  - Starter : module verrouillé (Business+) ;
 *  - Business : coller un CSV → mapping auto → import → résultat.
 */
test.describe('Intégrations', () => {
  test.skip(requiresConvexDev(), 'Convex dev deployment required');

  test('Starter : intégrations verrouillées (réservé Business)', async ({ page }) => {
    await seedTierFixtures();
    await loginAsPhone(page, '+225071234567'); // Kwame — Starter
    await page.goto('/pro/integrations');
    await expect(page.getByText(/Inclus à partir du forfait Business/i)).toBeVisible();
  });

  test('Business : import CSV crée des clients', async ({ page }) => {
    const fx = await seedTierFixtures();
    await loginAsPhone(page, fx.business.ownerPhone);
    await page.goto('/pro/integrations');
    await expect(page.getByText('Import CSV de clients')).toBeVisible();
    const tag = Date.now().toString(36);
    await page
      .getByTestId('csv-paste')
      .fill(`Partenaire A,Partenaire B,Email\nNoa-${tag},Sami,noa${tag}@m.fr`);
    await page.getByTestId('csv-parse').click();
    await expect(page.getByTestId('csv-import')).toBeVisible();
    await page.getByTestId('csv-import').click();
    await expect(page.getByText(/client.* importé/)).toBeVisible();
  });
});
