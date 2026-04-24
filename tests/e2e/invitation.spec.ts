import { expect, test } from '@playwright/test';

test.describe('Invitation — public page (unauthenticated)', () => {
  test('renders 404 for unknown token', async ({ page }) => {
    const response = await page.goto('/i/UNKNOWN_TOKEN_123');
    expect(response?.status()).toBeGreaterThanOrEqual(400);
  });
});

test.describe('Invitation — with seeded token', () => {
  test.skip(
    !process.env.NEXT_PUBLIC_CONVEX_URL ||
      process.env.NEXT_PUBLIC_CONVEX_URL === 'https://invalid.convex.test' ||
      !process.env.E2E_INVITATION_TOKEN,
    'E2E_INVITATION_TOKEN + Convex dev deployment required',
  );

  test('renders invitation card and RSVP form', async ({ page }) => {
    const token = process.env.E2E_INVITATION_TOKEN!;
    await page.goto(`/i/${token}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByTestId('rsvp-form')).toBeVisible();
    await expect(page.getByTestId('rsvp-option-attending')).toBeVisible();
  });
});
