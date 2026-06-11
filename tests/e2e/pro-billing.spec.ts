import { test, expect } from '@playwright/test';
import { requiresConvexDev, loginAsPhone, seedTierFixtures } from './utils/fixtures';

/**
 * Facturation — dialogues de confirmation (design Claude) : changer de formule
 * (récap avant→après + quotas) et acheter un crédit PAYG. La confirmation
 * réelle part vers Stripe → on vérifie l'ouverture des dialogues, pas le submit.
 */
test.describe('Facturation — dialogues', () => {
  test.skip(requiresConvexDev(), 'Convex dev deployment required');

  test('Business : dialogue de changement de formule (récap + quotas)', async ({ page }) => {
    const fx = await seedTierFixtures();
    await loginAsPhone(page, fx.business.ownerPhone);
    await page.goto('/pro/billing');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    // clic d'un forfait non-courant (Business) → dialogue de changement
    await page.getByTestId('subscribe-business').click();
    await expect(page.getByTestId('confirm-change-plan')).toBeVisible();
    await expect(page.getByText(/Nouveau forfait ·/)).toBeVisible();
    // récap des quotas avant→après
    await expect(page.getByText(/Événements actifs/)).toBeVisible();
  });

  test('Business : dialogue d’achat de crédit PAYG', async ({ page }) => {
    const fx = await seedTierFixtures();
    await loginAsPhone(page, fx.business.ownerPhone);
    await page.goto('/pro/billing');
    await page.getByTestId('buy-payg').click();
    await expect(page.getByTestId('buy-payg-confirm')).toBeVisible();
    await expect(page.getByText('1 crédit événement')).toBeVisible();
  });

  test('Business : factures d’abonnement + export comptable CSV', async ({ page }) => {
    const fx = await seedTierFixtures();
    await loginAsPhone(page, fx.business.ownerPhone);
    await page.goto('/pro/billing');
    // section Factures (état vide tant que Stripe n'est pas branché) + export
    await expect(page.getByTestId('subscription-invoices')).toBeVisible();
    await expect(page.getByTestId('invoices-empty')).toBeVisible();
    await expect(page.getByTestId('accounting-export-btn')).toBeVisible();
    // le route handler renvoie un CSV valide (session via cookies de la page)
    const res = await page.request.get('/api/pro/billing-export?month=2026-06&format=csv');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('text/csv');
    expect(await res.text()).toContain('Date;Type;Référence;Montant;Devise;Statut');
  });
});
