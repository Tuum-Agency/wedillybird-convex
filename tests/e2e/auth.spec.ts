import { expect, test } from '@playwright/test';

test.describe('Auth — sign-in page', () => {
  test('renders the sign-in form with accessible labels', async ({ page }) => {
    await page.goto('/sign-in');

    await expect(page.getByRole('heading', { level: 1 })).toContainText(/Bienvenue|Connexion/i);
    await expect(page.getByLabel('Numéro WhatsApp')).toBeVisible();
    await expect(page.getByRole('button', { name: /envoyer le code/i })).toBeVisible();
  });

  test('shows an inline error for invalid phone on submit', async ({ page }) => {
    await page.goto('/sign-in');

    const phone = page.getByLabel('Numéro WhatsApp');
    await phone.fill('abc');
    await page.getByRole('button', { name: /envoyer le code/i }).click();

    await expect(page.locator('#auth-error')).toBeVisible();
    await expect(page.locator('#auth-error')).toContainText(/invalide/i);
  });
});

test.describe('Auth — sign-up alias', () => {
  test('redirects /sign-up → /sign-in', async ({ page }) => {
    await page.goto('/sign-up');
    await page.waitForURL((url) => url.pathname.endsWith('/sign-in'));
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/Bienvenue|Connexion/i);
  });
});

test.describe('Auth — verify page', () => {
  test('redirects to /sign-in when no phone in query', async ({ page }) => {
    await page.goto('/verify');
    await page.waitForURL((url) => url.pathname.endsWith('/sign-in'));
  });

  test('redirects to /sign-in when phone is not a valid E.164', async ({ page }) => {
    await page.goto('/verify?phone=abc');
    await page.waitForURL((url) => url.pathname.endsWith('/sign-in'));
  });

  test('renders the OTP form when given a valid phone', async ({ page }) => {
    await page.goto('/verify?phone=%2B33612345678');

    await expect(page.getByRole('heading', { level: 1 })).toContainText('Vérifiez');
    const cells = page.getByRole('textbox');
    await expect(cells).toHaveCount(6);
    await expect(page.getByRole('button', { name: /^vérifier/i })).toBeVisible();
  });

  test('allows pasting the code into the first cell', async ({ page }) => {
    await page.goto('/verify?phone=%2B33612345678');
    const cells = page.getByRole('textbox');
    await cells.first().focus();
    await page.keyboard.insertText('1');
    await expect(cells.nth(1)).toBeFocused();
  });
});

test.describe('Auth — protected routes', () => {
  test('unauthenticated /onboarding redirects to /sign-in', async ({ page }) => {
    await page.goto('/onboarding');
    await page.waitForURL((url) => url.pathname.endsWith('/sign-in'));
  });

  test('unauthenticated /dashboard redirects to /sign-in', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForURL((url) => url.pathname.endsWith('/sign-in'));
  });
});
