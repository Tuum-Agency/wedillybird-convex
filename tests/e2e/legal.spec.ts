import { expect, test } from '@playwright/test';

test.describe('Legal pages', () => {
  test('/legal/terms renders the CGU heading and articles', async ({ page }) => {
    await page.goto('/legal/terms');
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/CGU|Conditions/i);
    expect(await page.getByRole('heading', { level: 2 }).count()).toBeGreaterThanOrEqual(7);
  });

  test('/legal/privacy renders the privacy policy', async ({ page }) => {
    await page.goto('/legal/privacy');
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/confidentialité/i);
  });

  test('/legal/cookies renders the cookies policy', async ({ page }) => {
    await page.goto('/legal/cookies');
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/cookie/i);
  });

  test('legal pages expose contentinfo footer with terms link', async ({ page }) => {
    await page.goto('/legal/terms');
    const footer = page.getByRole('contentinfo');
    await expect(footer).toBeVisible();
    await expect(footer.getByRole('link', { name: /CGU/i })).toBeVisible();
  });
});

test.describe('FAQ', () => {
  test('/faq lists at least 7 questions inside details/summary', async ({ page }) => {
    await page.goto('/faq');
    const details = page.locator('details');
    expect(await details.count()).toBeGreaterThanOrEqual(7);
  });

  test('FAQ summary toggles answer on click', async ({ page }) => {
    await page.goto('/faq');
    const first = page.locator('details').first();
    await first.locator('summary').click();
    await expect(first).toHaveAttribute('open', '');
  });
});

test.describe('Skip link', () => {
  test('landing page exposes a skip-to-content link reachable by Tab', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: /aller au contenu/i });
    await expect(skip).toBeFocused();
  });
});
