import { expect, test } from '@playwright/test';

/**
 * E2E — proxy multi-tenant `<orgSlug>.wedillybird.com/...`
 *
 * En dev local on n'a pas de DNS wildcard, donc le proxy lit le query
 * param `?orgPreview=<slug>` (uniquement actif sur localhost) et fait
 * comme s'il avait reçu une requête sous le sous-domaine de l'orga. Ce
 * mécanisme permet de tester la chaîne sans setup DNS.
 *
 * Les tests qui dépendent d'une orga seedée (slug `tuum`) sont skip si
 * `E2E_ORG_SLUG` n'est pas défini — la suite reste verte sur un
 * deployment Convex vide.
 */

test.describe('Wildcard subdomain — proxy rewrite', () => {
  test('home par défaut sur localhost sans param → marketing Wedillybird', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Wedillybird/);
    // La home marketing affiche le hero éditorial — pas le layout (public-org).
    const hero = page.getByRole('heading', { level: 1 });
    await expect(hero).toBeVisible();
  });

  test('?orgPreview=ghost-slug-inconnu → 404 dans le layout (public-org)', async ({ page }) => {
    test.skip(
      !process.env.NEXT_PUBLIC_CONVEX_URL ||
        process.env.NEXT_PUBLIC_CONVEX_URL === 'https://invalid.convex.test',
      'Convex dev deployment requis pour résoudre findOrgBySlug',
    );
    const response = await page.goto('/event/foo?orgPreview=ghost-org-doesnt-exist');
    expect(response?.status()).toBeGreaterThanOrEqual(400);
  });

  test('?orgPreview=<slug> seedé → page event publique avec branding orga', async ({ page }) => {
    const orgSlug = process.env.E2E_ORG_SLUG;
    const eventSlug = process.env.E2E_ORG_EVENT_SLUG;
    test.skip(
      !orgSlug || !eventSlug,
      'E2E_ORG_SLUG + E2E_ORG_EVENT_SLUG requis (orga + event seedés)',
    );

    await page.goto(`/event/${eventSlug}?orgPreview=${orgSlug}`);
    // Le layout (public-org) injecte data-org-theme=<slug> sur le wrapper.
    const wrapper = page.locator(`[data-org-theme="${orgSlug}"]`);
    await expect(wrapper).toBeVisible();
    // Le footer "Propulsé par Wedillybird" doit apparaître.
    await expect(page.getByText(/propulsé par/i)).toBeVisible();
    // Le titre h1 (couple names) doit être présent.
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });
});
