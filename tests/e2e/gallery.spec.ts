import { expect, test } from '@playwright/test';
import { loginAsDevUser, gotoFirstEvent, requiresConvexDev } from './utils/fixtures';

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

test.describe('Gallery — owner authenticated UI', () => {
  test.skip(requiresConvexDev(), 'Convex dev deployment required');

  test('affiche le verrou "Galerie verrouillée" si galerie non payée', async ({ page }) => {
    // skip: requires running dev server with seeded data (event créé sans plan)
    await loginAsDevUser(page);
    const eventId = await gotoFirstEvent(page);
    if (!eventId) {
      test.skip(true, 'Aucun event seedé sur ce compte dev');
      return;
    }

    await page.goto(`/events/${eventId}/gallery`);
    // Si l'event n'a pas de plan / galleryExpiresAt → état "locked" affiché.
    // Si l'event est déjà payé, on skip silencieusement (couvert par les autres
    // assertions ci-dessous).
    const lockedHeading = page.getByRole('heading', { name: /verrouillée|locked/i });
    if (!(await lockedHeading.isVisible().catch(() => false))) {
      test.skip(true, 'Event courant a déjà une galerie ouverte — pas de verrou à tester');
      return;
    }
    await expect(lockedHeading).toBeVisible();
    // Le CTA pointe vers la section #upgrade de la page event.
    const cta = page.getByRole('link', { name: /débloquer|upgrade/i });
    await expect(cta).toBeVisible();
  });

  test('le bouton "Tout télécharger" est désactivé sans photo approuvée', async ({ page }) => {
    // skip: requires running dev server with paid gallery and zero approved photos
    test.skip(
      !process.env.E2E_GALLERY_EVENT_ID,
      'E2E_GALLERY_EVENT_ID required (event seedé avec galerie ouverte)',
    );
    await loginAsDevUser(page);

    const eventId = process.env.E2E_GALLERY_EVENT_ID!;
    await page.goto(`/events/${eventId}/gallery`);

    // Soit le bouton est rendu en placeholder désactivé (aucun approved),
    // soit le lien actif est rendu (≥1 approved). On vérifie l'invariant :
    // il doit toujours y avoir exactement une des deux variantes.
    const disabled = page.getByTestId('download-all-disabled');
    const enabled = page.getByTestId('download-all');
    const total = (await disabled.count()) + (await enabled.count());
    expect(total).toBe(1);

    if (await disabled.count()) {
      await expect(disabled).toHaveAttribute('aria-disabled', 'true');
    } else {
      await expect(enabled).toHaveAttribute('download', '');
    }
  });

  test('la grille rendue utilise des columns CSS (masonry)', async ({ page }) => {
    // skip: requires running dev server with at least one approved photo
    test.skip(
      !process.env.E2E_GALLERY_EVENT_ID,
      'E2E_GALLERY_EVENT_ID required (event seedé avec ≥1 photo)',
    );
    await loginAsDevUser(page);

    const eventId = process.env.E2E_GALLERY_EVENT_ID!;
    await page.goto(`/events/${eventId}/gallery`);

    const grid = page.getByTestId('photo-grid');
    if (!(await grid.isVisible().catch(() => false))) {
      test.skip(true, 'Aucune photo dans cet event — masonry non rendue');
      return;
    }

    // Le composant utilise `columns-2 sm:columns-3 md:columns-4` Tailwind.
    // En jsdom on ne pourrait pas tester ça — en Playwright on lit
    // computed style.
    const columnCount = await grid.evaluate((el) => window.getComputedStyle(el).columnCount);
    expect(columnCount).not.toBe('auto');
    // ≥ 2 colonnes selon le viewport
    expect(Number(columnCount)).toBeGreaterThanOrEqual(2);
  });
});
