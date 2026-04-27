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

test.describe('FAQ section (sur la landing)', () => {
  test('la section #faq de la landing liste au moins 7 questions', async ({ page }) => {
    await page.goto('/#faq');
    // V4 : la FAQ vit en section ancrée sur la landing (id='faq').
    // Plus de page /faq dédiée — accordion Motion <button aria-expanded>.
    const faqSection = page.locator('#faq');
    await expect(faqSection).toBeVisible();
    const buttons = faqSection
      .getByRole('button', { expanded: false })
      .or(faqSection.getByRole('button', { expanded: true }));
    expect(await buttons.count()).toBeGreaterThanOrEqual(7);
  });

  test('FAQ accordion bascule la réponse au clic', async ({ page }) => {
    await page.goto('/#faq');
    // La première question est ouverte par défaut (V4 ergonomie). On ouvre la
    // deuxième pour vérifier le toggle.
    const faqSection = page.locator('#faq');
    const buttons = faqSection.getByRole('button', { name: /\?$/ });
    const second = buttons.nth(1);
    await expect(second).toHaveAttribute('aria-expanded', 'false');
    await second.click();
    await expect(second).toHaveAttribute('aria-expanded', 'true');
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
