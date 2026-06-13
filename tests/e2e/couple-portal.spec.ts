import { test, expect } from '@playwright/test';
import { requiresConvexDev, loginAsPhone, seedTierFixtures } from './utils/fixtures';

/**
 * Espace couple (mariages gérés par une agence) :
 *  - l'agence rattache le couple par téléphone (carte « Espace couple ») ;
 *  - le couple, connecté avec ce numéro, accède à /espace-couple : suivi, liste
 *    d'invités (composant partagé) et paiements ;
 *  - sécurité multi-tenant : le couple ne peut PAS ouvrir un AUTRE mariage.
 *
 * Couple test = Mamadou (+33612931779), présent dans /dev-login.
 */
const COUPLE_PHONE = '+33612931779';

test.describe('Espace couple (mariages d’agence)', () => {
  test.skip(requiresConvexDev(), 'Convex dev deployment required');

  test('l’agence rattache le couple → le couple accède à son espace (et pas aux autres)', async ({
    browser,
  }) => {
    const fx = await seedTierFixtures();

    // 1) Agence : invite le couple sur le mariage.
    const agencyCtx = await browser.newContext();
    const agency = await agencyCtx.newPage();
    await loginAsPhone(agency, fx.business.ownerPhone);
    await agency.goto(`/pro/weddings/${fx.business.eventId}`);
    await expect(agency.getByRole('heading', { name: 'Espace couple' })).toBeVisible();
    await agency.getByLabel('Téléphone du couple').fill(COUPLE_PHONE);
    await agency.getByRole('button', { name: /Inviter le couple/i }).click();
    // Le couple rattaché apparaît (invitation fraîche ou déjà rattaché sur re-run).
    await expect(agency.getByText(COUPLE_PHONE)).toBeVisible({ timeout: 15_000 });
    await agencyCtx.close();

    // 2) Couple : accède à SON espace (le mariage de l'agence).
    const coupleCtx = await browser.newContext();
    const couple = await coupleCtx.newPage();
    await loginAsPhone(couple, COUPLE_PHONE);
    await couple.goto('/espace-couple');
    await expect(couple).toHaveURL(/\/espace-couple\/.+/); // 1 mariage → ouverture directe
    await expect(couple.getByRole('heading', { name: /Votre liste/ })).toBeVisible();
    await expect(couple.getByRole('heading', { name: 'Paiements' })).toBeVisible();
    await expect(couple.getByRole('button', { name: /Ajouter une invitation/i })).toBeVisible();

    // 3) Sécurité : un AUTRE mariage (couple non rattaché) → inaccessible (404).
    await couple.goto(`/espace-couple/${fx.essential.eventId}`);
    await expect(couple.getByRole('heading', { name: /Votre liste/ })).toHaveCount(0);
    await coupleCtx.close();
  });
});
