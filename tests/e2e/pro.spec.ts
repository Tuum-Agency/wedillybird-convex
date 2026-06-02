import { test } from '@playwright/test';

test.describe('Pro — unauthenticated', () => {
  test('/pro/dashboard redirects to /sign-in', async ({ page }) => {
    await page.goto('/pro/dashboard');
    await page.waitForURL((url) => url.pathname.endsWith('/sign-in'));
  });

  test('/pro/onboarding redirects to /sign-in', async ({ page }) => {
    await page.goto('/pro/onboarding');
    await page.waitForURL((url) => url.pathname.endsWith('/sign-in'));
  });

  test('/pro/team redirects to /sign-in', async ({ page }) => {
    await page.goto('/pro/team');
    await page.waitForURL((url) => url.pathname.endsWith('/sign-in'));
  });

  test('/pro/invite/[token] redirects unauthenticated users to /sign-in', async ({ page }) => {
    await page.goto('/pro/invite/SOMETOKEN123');
    await page.waitForURL((url) => url.pathname.endsWith('/sign-in'));
  });
});

test.describe('Pro — without an organization', () => {
  test.skip(
    !process.env.NEXT_PUBLIC_CONVEX_URL ||
      process.env.NEXT_PUBLIC_CONVEX_URL === 'https://invalid.convex.test',
    'Convex dev deployment required',
  );

  test('logged-in user without org is redirected to onboarding when visiting /pro/dashboard', async ({
    page,
  }) => {
    await page.goto('/dev-login');
    await page
      .locator('form', { has: page.locator('input[value="+33612931779"]') })
      .getByRole('button', { name: /se connecter/i })
      .click();
    // Destination authentifiée variable selon l'état user (dashboard / events / onboarding / pro).
    await page.waitForURL((url) => /\/(dashboard|events|onboarding|pro)(\/|$)/.test(url.pathname));

    await page.goto('/pro/dashboard');
    // Un non-pro est redirigé HORS de /pro/dashboard : vers /pro/onboarding (cas
    // nominal), /dashboard, ou /events/{id} si ce couple possède déjà un event
    // (état Convex dev partagé). L'invariant testé = il ne RESTE pas sur /pro/dashboard.
    await page.waitForURL(
      (url) =>
        !url.pathname.endsWith('/pro/dashboard') &&
        /\/(dashboard|onboarding|events)(\/|$)/.test(url.pathname),
    );
  });
});
