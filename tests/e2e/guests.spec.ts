import { expect, test } from '@playwright/test';

test.describe('Guests — unauthenticated', () => {
  test('unauthenticated /events/:id/guests redirects to /sign-in', async ({ page }) => {
    await page.goto('/events/evt_anything/guests');
    await page.waitForURL((url) => url.pathname.endsWith('/sign-in'));
  });
});

test.describe('Guests — authenticated list page', () => {
  test.skip(
    !process.env.NEXT_PUBLIC_CONVEX_URL ||
      process.env.NEXT_PUBLIC_CONVEX_URL === 'https://invalid.convex.test',
    'Convex dev deployment required for authenticated flow',
  );

  test('owner can open guests page from event detail', async ({ page }) => {
    await page.goto('/dev-login');
    await page
      .locator('form', { has: page.locator('input[value="+33612931779"]') })
      .getByRole('button', { name: /se connecter/i })
      .click();
    await page.waitForURL((url) => /\/dashboard/.test(url.pathname));

    const firstEvent = page.locator('ul li a').first();
    if ((await firstEvent.count()) === 0) {
      test.skip(true, 'No event present in dev account');
    }
    await firstEvent.click();
    await page.waitForURL((url) => /\/events\/[^/]+$/.test(url.pathname));

    await page.getByRole('link', { name: /gérer les invités/i }).click();
    await page.waitForURL((url) => url.pathname.endsWith('/guests'));

    await expect(page.getByRole('heading', { level: 1 })).toContainText(/invités/i);
  });
});
