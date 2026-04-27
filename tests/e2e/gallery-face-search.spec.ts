import { expect, test } from '@playwright/test';
import { requiresConvexDev } from './utils/fixtures';

/**
 * Le flow face-search dépend de :
 *  - Convex dev (event payé avec `galleryExpiresAt > now`)
 *  - une server action qui appelle Rekognition + OpenAI Moderation
 *
 * Pour ne pas dépendre des AWS/OpenAI réels en CI, on se contente ici de
 * vérifier que l'UI de la modal s'ouvre bien depuis la galerie owner. Le
 * comportement de la modal (consent → capture → résultat) est couvert par
 * `tests/unit/components/face-search-modal.test.tsx` qui mock la search().
 *
 * Tant que ce test nécessite un event seedé avec galerie ouverte, il est
 * skippé sans `E2E_GALLERY_EVENT_ID`.
 */
test.describe('Gallery — face search modal (UI gate)', () => {
  test.skip(requiresConvexDev(), 'Convex dev deployment required');
  test.skip(
    !process.env.E2E_GALLERY_EVENT_ID,
    'E2E_GALLERY_EVENT_ID required (event seedé avec galerie payée)',
  );

  test('le bouton "Me retrouver" ouvre la modal avec consent obligatoire', async ({ page }) => {
    // skip: requires running dev server with seeded gallery event
    const eventId = process.env.E2E_GALLERY_EVENT_ID!;

    await page.goto('/dev-login');
    await page
      .locator('form', { has: page.locator('input[value="+33612931779"]') })
      .getByRole('button', { name: /se connecter/i })
      .click();
    await page.waitForURL((url) => /\/dashboard/.test(url.pathname));

    await page.goto(`/events/${eventId}/gallery`);
    const trigger = page.getByTestId('face-search-trigger');
    await expect(trigger).toBeVisible();
    await expect(trigger).toContainText(/me retrouver/i);

    await trigger.click();
    await expect(page.getByTestId('face-search-modal')).toBeVisible();
    // Consent obligatoire — submit disabled tant que la checkbox n'est pas tickée.
    await expect(page.getByTestId('face-search-consent-submit')).toBeDisabled();
    await page.getByTestId('face-search-consent-checkbox').check();
    await expect(page.getByTestId('face-search-consent-submit')).toBeEnabled();

    await page.getByTestId('face-search-consent-submit').click();

    // L'étape capture expose au minimum l'upload (input file caché + bouton).
    await expect(page.getByTestId('face-search-upload-btn')).toBeVisible();
    const fileInput = page.getByTestId('face-search-file-input');
    await expect(fileInput).toHaveAttribute('type', 'file');
    await expect(fileInput).toHaveAttribute('accept', /image/);
  });
});
