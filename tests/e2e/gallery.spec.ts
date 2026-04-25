import { expect, test } from '@playwright/test';

test.describe('Gallery — unauthenticated', () => {
  test('owner gallery redirects unauthenticated users to /sign-in', async ({ page }) => {
    await page.goto('/events/evt_anything/gallery');
    await page.waitForURL((url) => url.pathname.endsWith('/sign-in'));
  });

  test('public guest gallery 404s for unknown token', async ({ page }) => {
    const response = await page.goto('/i/UNKNOWN_TOKEN_999/gallery');
    expect(response?.status()).toBeGreaterThanOrEqual(400);
  });
});
