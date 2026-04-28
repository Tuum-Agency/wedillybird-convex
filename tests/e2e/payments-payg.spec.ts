import { expect, test } from '@playwright/test';
import { requiresConvexDev } from './utils/fixtures';

/**
 * Vérifie l'UI de la carte Pay-as-you-go sur `/pro/billing` :
 *  - Carte visible avec bouton "Acheter un crédit".
 *  - Le banner "Achat Pay-as-you-go confirmé" apparaît au retour
 *    `?status=success&kind=payg` (idempotence côté UI — la mutation
 *    Convex est testée séparément dans `tests/unit/payments`).
 *
 * Le flow d'achat réel (redirect vers Stripe Checkout) n'est pas exercé ici
 * car il nécessite des creds Stripe TEST côté serveur. On vérifie la
 * navigation jusqu'au bouton seulement.
 */
test.describe('Payments — PAYG pro billing UI', () => {
  test('GET /pro/billing redirect /sign-in en non-authentifié', async ({ page }) => {
    await page.goto('/pro/billing');
    await page.waitForURL((url) => /\/(sign-in|login)/.test(url.pathname));
  });

  test.describe('connecté en pro avec organisation', () => {
    test.skip(requiresConvexDev(), 'Convex dev deployment required');
    test.skip(
      !process.env.E2E_PRO_PHONE,
      'E2E_PRO_PHONE required (numéro pro seedé avec organisation)',
    );

    test('affiche la carte PAYG avec bouton "Acheter un crédit"', async ({ page }) => {
      // skip: requires running dev server with seeded pro account + org
      const proPhone = process.env.E2E_PRO_PHONE!;

      await page.goto('/dev-login');
      await page
        .locator('form', { has: page.locator(`input[value="${proPhone}"]`) })
        .getByRole('button', { name: /se connecter/i })
        .click();
      await page.waitForURL((url) => /\/dashboard|\/pro/.test(url.pathname));

      await page.goto('/pro/billing');
      const paygCard = page.getByTestId('payg-card');
      await expect(paygCard).toBeVisible();
      await expect(paygCard.getByRole('heading', { name: /pay-as-you-go/i })).toBeVisible();
      await expect(paygCard.getByTestId('buy-payg')).toBeVisible();
      await expect(paygCard.getByTestId('buy-payg')).toContainText(/acheter un crédit/i);
    });

    test('affiche le banner de succès au retour ?status=success&kind=payg', async ({ page }) => {
      // skip: requires running dev server with seeded pro account
      const proPhone = process.env.E2E_PRO_PHONE!;

      await page.goto('/dev-login');
      await page
        .locator('form', { has: page.locator(`input[value="${proPhone}"]`) })
        .getByRole('button', { name: /se connecter/i })
        .click();
      await page.waitForURL((url) => /\/dashboard|\/pro/.test(url.pathname));

      await page.goto('/pro/billing?status=success&kind=payg');
      await expect(page.getByRole('status')).toContainText(/pay-as-you-go confirmé/i);
    });
  });
});
