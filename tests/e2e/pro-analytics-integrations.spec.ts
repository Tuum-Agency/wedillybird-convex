import { test, expect } from '@playwright/test';
import { requiresConvexDev, loginAsPhone, seedTierFixtures } from './utils/fixtures';

/**
 * Analytics — module Pilotage réservé au forfait Agency. Vérifie le gating
 * (Starter verrouillé) et l'accès Agency. Les Intégrations sont couvertes par
 * pro-integrations.spec.ts (page d'import CSV gatée Business).
 */
test.describe('Analytics (Agency)', () => {
  test.skip(requiresConvexDev(), 'Convex dev deployment required');

  test('Starter : Analytics verrouillé (réservé Agency)', async ({ page }) => {
    await seedTierFixtures();
    await loginAsPhone(page, '+225071234567'); // Kwame — Starter
    await page.goto('/pro/analytics');
    await expect(page.getByText(/Inclus à partir du forfait Agency/i)).toBeVisible();
  });

  test('Agency : Analytics consolidé accessible', async ({ page }) => {
    const fx = await seedTierFixtures();
    await loginAsPhone(page, fx.business.ownerPhone); // Studio Lumière — Agency
    await page.goto('/pro/analytics');
    await expect(page.getByRole('heading', { name: 'Analytics', level: 1 })).toBeVisible();
    await expect(page.getByText('Pipeline par étape')).toBeVisible();
    await expect(page.getByText('Conversion')).toBeVisible();
  });
});
