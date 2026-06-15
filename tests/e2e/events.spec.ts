import { expect, test } from '@playwright/test';

test.describe('Events — create flow (unauthenticated)', () => {
  test('unauthenticated /events/new redirects to /sign-in', async ({ page }) => {
    await page.goto('/events/new');
    await page.waitForURL((url) => url.pathname.endsWith('/sign-in'));
  });
});

test.describe('Events — dev login + wizard (authenticated)', () => {
  test.skip(
    !process.env.NEXT_PUBLIC_CONVEX_URL ||
      process.env.NEXT_PUBLIC_CONVEX_URL === 'https://invalid.convex.test',
    'Convex dev deployment required for authenticated flow',
  );

  test('renders 4-step wizard and fills the couple step', async ({ page }) => {
    await page.goto('/dev-login');
    await page
      .locator('form', { has: page.locator('input[value="+33612931779"]') })
      .getByRole('button', { name: /se connecter/i })
      .click();
    // Destination authentifiée variable selon l'état user (dashboard / events / onboarding / pro).
    await page.waitForURL((url) => /\/(dashboard|events|onboarding|pro)(\/|$)/.test(url.pathname));

    // Navigation directe vers le wizard. Le user dev peut déjà posséder un event
    // (état Convex dev partagé → redirigé sur /events/{id} au lieu du dashboard),
    // donc on ne dépend pas de la présence du lien "Créer un événement".
    await page.goto('/events/new');
    await page.waitForURL((url) => url.pathname.endsWith('/events/new'));

    await expect(page.getByRole('heading', { level: 1 })).toContainText('Créer');
    await page.getByLabel(/titre de l'événement/i).fill('Mariage F & A');
    await page.getByLabel(/partenaire 1/i).fill('Fatou');
    await page.getByLabel(/partenaire 2/i).fill('Amadou');
    await expect(page.getByRole('button', { name: /^suivant$/i })).toBeEnabled();
  });
});
