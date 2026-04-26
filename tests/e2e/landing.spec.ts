import { test, expect } from '@playwright/test';

test.describe('Landing page', () => {
  test('rend le hero FR avec titre éditorial et CTA principal', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Wedillybird/);

    const hero = page.getByRole('heading', { level: 1 });
    await expect(hero).toBeVisible();
    // Le titre v2 est "Le grand jour mérite mieux qu'un PDF.".
    await expect(hero).toContainText(/grand jour/i);

    // CTA primary v2 = "Préparer mon mariage".
    await expect(page.getByRole('link', { name: /préparer mon mariage/i })).toBeVisible();
  });

  test('la section features affiche les quatre piliers', async ({ page }) => {
    await page.goto('/');
    const features = page.locator('#features');
    await expect(features).toBeVisible();

    await expect(features.getByRole('heading', { name: /invitations whatsapp/i })).toBeVisible();
    await expect(features.getByRole('heading', { name: /rsvp temps réel/i })).toBeVisible();
    await expect(features.getByRole('heading', { name: /check-in/i })).toBeVisible();
    await expect(features.getByRole('heading', { name: /galerie partagée/i })).toBeVisible();
  });

  test('la grille de pricing affiche les deux plans Essentiel et Premium', async ({ page }) => {
    await page.goto('/');
    const pricing = page.locator('#pricing');
    await expect(pricing).toBeVisible();

    await expect(pricing.getByRole('heading', { name: /essentiel/i })).toBeVisible();
    await expect(pricing.getByRole('heading', { name: /^premium$/i })).toBeVisible();
    // L'ancien tier 'free' (Gratuit) ne doit plus apparaître.
    await expect(pricing.getByText(/gratuit/i)).toHaveCount(0);
    // Le bandeau d'upsell post-mariage doit être affiché.
    await expect(pricing.getByTestId('upsell-note')).toBeVisible();
  });

  test('les liens header vers sign-in et sign-up sont présents', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: /se connecter/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /créer un compte/i })).toBeVisible();
  });

  test('lang html vaut fr', async ({ page }) => {
    await page.goto('/');
    const lang = await page.locator('html').getAttribute('lang');
    expect(lang).toBe('fr');
  });

  test('clic sur CTA secondaire descend à la section pricing', async ({ page }) => {
    await page.goto('/');
    // CTA secondaire v2 = "Voir les tarifs" qui pointe vers #pricing.
    await page
      .getByRole('link', { name: /voir les tarifs/i })
      .first()
      .click();
    await expect(page).toHaveURL(/#pricing$/);
  });
});

test.describe('Accessibilité basique', () => {
  test('un seul h1 sur la landing', async ({ page }) => {
    await page.goto('/');
    const h1s = page.getByRole('heading', { level: 1 });
    await expect(h1s).toHaveCount(1);
  });

  test('le logo/brand est un lien vers la racine', async ({ page }) => {
    await page.goto('/');
    const brand = page.getByRole('link', { name: 'Wedillybird' }).first();
    await expect(brand).toHaveAttribute('href', '/');
  });
});
