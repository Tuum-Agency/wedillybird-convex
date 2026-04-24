import { expect, test } from '@playwright/test';

test.describe('Check-in — unauthenticated', () => {
  test('unauthenticated /events/:id/check-in redirects to /sign-in', async ({ page }) => {
    await page.goto('/events/evt_anything/check-in');
    await page.waitForURL((url) => url.pathname.endsWith('/sign-in'));
  });
});

test.describe('Check-in — manifest', () => {
  test('manifest.webmanifest is served with JSON content and Wedillybird name', async ({
    request,
  }) => {
    const response = await request.get('/manifest.webmanifest');
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.name).toBe('Wedillybird');
    expect(body.display).toBe('standalone');
    expect(Array.isArray(body.icons)).toBe(true);
  });
});
