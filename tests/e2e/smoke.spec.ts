import { test, expect } from '@playwright/test';

test('la home répond en 200', async ({ page }) => {
  const response = await page.goto('/');
  expect(response?.status()).toBe(200);
});

test('la 404 fonctionne pour une route inconnue', async ({ page }) => {
  const response = await page.goto('/route-qui-n-existe-pas');
  expect(response?.status()).toBe(404);
});
