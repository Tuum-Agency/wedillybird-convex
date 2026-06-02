import { test, expect, type Page } from '@playwright/test';
import { requiresConvexDev, seedTierFixtures, type TierFixtures } from './utils/fixtures';

/**
 * Login dev par numéro, sans présumer de la page d'atterrissage. Un couple
 * qui possède déjà un event est redirigé depuis /dashboard vers /events/{id} ;
 * un pro reste sur /dashboard. On attend donc simplement de quitter
 * /dev-login (le cookie de session est posé par la réponse 303), puis chaque
 * test navigue explicitement vers sa cible.
 */
async function devLogin(page: Page, phone: string): Promise<void> {
  await page.goto('/dev-login');
  await Promise.all([
    page.waitForURL((url) => !url.pathname.includes('/dev-login'), { timeout: 30_000 }),
    page
      .locator('form', { has: page.locator(`input[value="${phone}"]`) })
      .getByRole('button', { name: /se connecter/i })
      .click(),
  ]);
}

/**
 * Vérifie en dev browser que les blocages de features par formule
 * fonctionnent totalement, via des comptes bypass (/dev-login) seedés par
 * `seed:seedTierFixtures` :
 *
 *  - ESSENTIEL → recherche par visage (faceSearch) BLOQUÉE : le gate
 *    `_resolveSearchAccess` renvoie `FEATURE_NOT_IN_PLAN` avant tout appel
 *    Rekognition, et le modal affiche le message « Réservé à la formule
 *    Premium » (et non l'erreur générique).
 *  - PREMIUM → faceSearch AUTORISÉE : le gate passe ; faute d'indexation
 *    l'action retombe sur `NO_COLLECTION_YET` (message « indexation… »),
 *    déterministe et sans dépendance AWS. Le point clé : ce n'est PAS le
 *    message Premium-only → le blocage formule ne s'applique pas.
 *  - PRO au quota (Starter, 5 events actifs) → publication d'un 6e event
 *    BLOQUÉE : bouton « Publier » pré-désactivé + hint quota.
 *
 * Prérequis : Convex dev configuré (`NEXT_PUBLIC_CONVEX_URL`). Skip sinon.
 */

// 1×1 JPEG valide — suffit à produire un dataURL côté modal. Le contenu n'a
// aucune importance : les deux gates testés répondent AVANT toute détection de
// visage (FEATURE_NOT_IN_PLAN / NO_COLLECTION_YET).
const TINY_JPEG_BASE64 =
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAAA//EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AfwH/2Q==';

async function openFaceSearchAndUploadSelfie(page: Page, eventId: string): Promise<void> {
  await page.goto(`/events/${eventId}/gallery`);

  const trigger = page.getByTestId('face-search-trigger');
  await expect(trigger).toBeVisible();
  await trigger.click();

  await expect(page.getByTestId('face-search-modal')).toBeVisible();
  await page.getByTestId('face-search-consent-checkbox').check();
  await page.getByTestId('face-search-consent-submit').click();

  await page.getByTestId('face-search-file-input').setInputFiles({
    name: 'selfie.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.from(TINY_JPEG_BASE64, 'base64'),
  });
}

test.describe('Feature gating par formule', () => {
  test.skip(requiresConvexDev(), 'Convex dev deployment required');

  let fixtures: TierFixtures;

  test.beforeAll(async () => {
    fixtures = await seedTierFixtures();
  });

  test('Essentiel : faceSearch bloquée (message Premium-only, pas générique)', async ({ page }) => {
    await devLogin(page, fixtures.essential.ownerPhone);
    await openFaceSearchAndUploadSelfie(page, fixtures.essential.eventId);

    const err = page.getByTestId('face-search-result-error');
    await expect(err).toBeVisible({ timeout: 15_000 });
    // Message dédié au gating formule, pas l'erreur fourre-tout.
    await expect(err).toContainText(/Premium/i);
    await expect(err).not.toContainText(/Une erreur est survenue/i);
  });

  test('Premium : faceSearch autorisée (gate passé)', async ({ page }) => {
    await devLogin(page, fixtures.premium.ownerPhone);
    await openFaceSearchAndUploadSelfie(page, fixtures.premium.eventId);

    const err = page.getByTestId('face-search-result-error');
    await expect(err).toBeVisible({ timeout: 15_000 });
    // Gate passé → NO_COLLECTION_YET (indexation pas finie), et surtout PAS le
    // blocage formule : le message Premium-only ne doit pas apparaître.
    await expect(err).toContainText(/indexation/i);
    await expect(err).not.toContainText(/Réservé à la formule Premium/i);
  });

  test('Essentiel : téléchargement ZIP de la galerie masqué (Premium-only)', async ({ page }) => {
    await devLogin(page, fixtures.essential.ownerPhone);
    await page.goto(`/events/${fixtures.essential.eventId}/gallery`);
    // Galerie ouverte (le trigger faceSearch est rendu).
    await expect(page.getByTestId('face-search-trigger')).toBeVisible();
    // Ni le lien ni la variante désactivée ne doivent apparaître pour Essentiel.
    await expect(page.getByTestId('download-all')).toHaveCount(0);
    await expect(page.getByTestId('download-all-disabled')).toHaveCount(0);
  });

  test('Premium : téléchargement ZIP de la galerie présent', async ({ page }) => {
    await devLogin(page, fixtures.premium.ownerPhone);
    await page.goto(`/events/${fixtures.premium.eventId}/gallery`);
    // Aucune photo approuvée seedée → variante désactivée, mais PRÉSENTE
    // (le bouton existe pour Premium, contrairement à Essentiel).
    await expect(page.getByTestId('download-all-disabled')).toBeVisible();
  });

  test('Pro au quota : bouton Publier désactivé + hint quota', async ({ page }) => {
    await devLogin(page, fixtures.pro.ownerPhone);
    await page.goto(`/events/${fixtures.pro.draftEventId}`);

    const publishBtn = page.getByRole('button', { name: /publier/i });
    await expect(publishBtn).toBeVisible();
    await expect(publishBtn).toBeDisabled();
    await expect(page.getByText(/quota d.+vénements actifs atteint/i)).toBeVisible();
  });
});
