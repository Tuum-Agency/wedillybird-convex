import { test, expect } from '@playwright/test';
import { requiresConvexDev, loginAsPhone, seedTierFixtures } from './utils/fixtures';

/**
 * Paiements (module Finances) — modèle **BYOP** : l'agence connecte SON propre
 * compte Stripe via l'onboarding hébergé Stripe (compte Standard, charge directe,
 * Wedillybird jamais dans le flux). Couvre :
 *  - gating Starter → verrouillé (Business+) ;
 *  - Business : board (hero, sous-onglets, transactions), carte de connexion,
 *    échéancier « marquer payé », réglages byop/manuel ;
 *  - les routes retour/refresh d'onboarding rejettent les accès non authentifiés.
 *  (Le flux d'onboarding live — création de compte + redirection Stripe — se
 *   vérifie au dev browser avec une clé test ; il fait un appel réseau Stripe.)
 */
test.describe('Paiements — connexion Stripe (BYOP)', () => {
  test.skip(requiresConvexDev(), 'Convex dev deployment required');

  test('Starter : module verrouillé (réservé Business)', async ({ page }) => {
    await seedTierFixtures();
    await loginAsPhone(page, '+225071234567'); // Pro Starter au quota
    await page.goto('/pro/payments');
    await expect(page.getByText(/Inclus à partir du forfait Business/i)).toBeVisible();
  });

  test('Business : carte de connexion Stripe + board', async ({ page }) => {
    const fx = await seedTierFixtures();
    await loginAsPhone(page, fx.business.ownerPhone);
    await page.goto('/pro/payments');
    // Carte de connexion BYOP en tête de page.
    await expect(page.getByRole('heading', { name: 'Paiements en ligne' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Connecter mon compte Stripe/i })).toBeVisible();
    // Board : titre + hero + sous-onglets.
    await expect(page.getByRole('heading', { name: 'Paiements', level: 1 })).toBeVisible();
    await expect(page.getByText(/Encaissé/).first()).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Tableau de bord' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Échéancier' })).toBeVisible();
    // Non connecté → bannière d'incitation (BYOP).
    await expect(
      page.getByText('Connectez votre compte Stripe pour encaisser en ligne', { exact: true }),
    ).toBeVisible();
    await expect(page.getByText('Transactions', { exact: true })).toBeVisible();
  });

  test('Route retour onboarding : accès non authentifié → connect=error', async ({ page }) => {
    const res = await page.request.get('/api/stripe/connect/return', { maxRedirects: 0 });
    expect(res.status()).toBe(307);
    expect(res.headers()['location']).toContain('/pro/payments?connect=error');
  });

  test('Route refresh onboarding : accès non authentifié → connect=error', async ({ page }) => {
    const res = await page.request.get('/api/stripe/connect/refresh', { maxRedirects: 0 });
    expect(res.status()).toBe(307);
    expect(res.headers()['location']).toContain('/pro/payments?connect=error');
  });

  test('Business : marquer un jalon payé sur l’échéancier', async ({ page }) => {
    const fx = await seedTierFixtures();
    await loginAsPhone(page, fx.business.ownerPhone);
    await page.goto('/pro/payments');
    await page.getByRole('tab', { name: 'Échéancier' }).click();
    await expect(page.getByText('Jalons de paiement')).toBeVisible();
    const markBtn = page.getByRole('button', { name: 'Marquer payé' }).first();
    await expect(markBtn).toBeVisible();
    await markBtn.click();
    await expect(page.getByText(/2 \/ 2 réglé/)).toBeVisible();
  });

  test('Business : réglages mode d’encaissement byop / manuel', async ({ page }) => {
    const fx = await seedTierFixtures();
    await loginAsPhone(page, fx.business.ownerPhone);
    await page.goto('/pro/payments');
    await page.getByRole('tab', { name: 'Réglages' }).click();
    await expect(page.getByText('Mode d’encaissement')).toBeVisible();
    // Modèle BYOP : « Mon compte Stripe » + « Suivi manuel » (plus de « managé »).
    await expect(page.getByRole('radio', { name: /Mon compte Stripe/i })).toBeVisible();
    await expect(page.getByRole('radio', { name: /Suivi manuel/i })).toBeVisible();
    // Sélection BYOP → conséquence propre au mode (encaissement direct).
    await page.getByRole('radio', { name: /Mon compte Stripe/i }).click();
    await expect(
      page.getByText(/les paiements arrivent directement sur votre compte/i),
    ).toBeVisible();
  });

  test('Business : bouton « Nouveau lien » + dialogue de lien libre', async ({ page }) => {
    const fx = await seedTierFixtures();
    await loginAsPhone(page, fx.business.ownerPhone);
    await page.goto('/pro/payments');
    await page.getByRole('button', { name: 'Nouveau lien' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Nouveau lien de paiement' })).toBeVisible();
    // Org non connectée → invite à connecter + CTA « Créer le lien » désactivée.
    await expect(page.getByText(/Connectez d.abord votre compte Stripe/i)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Créer le lien' })).toBeDisabled();
  });

  test('Échéancier : vrai lien de paiement proposé (plus de faux lien codé en dur)', async ({
    page,
  }) => {
    const fx = await seedTierFixtures();
    await loginAsPhone(page, fx.business.ownerPhone);
    await page.goto('/pro/payments');
    await page.getByRole('tab', { name: 'Échéancier' }).click();
    await expect(page.getByText('Jalons de paiement')).toBeVisible();
    // Org non connectée → l'affordance invite à connecter Stripe (vrai flux BYOP),
    // au lieu de l'ancien faux lien `pay.wedillybird.app`.
    await expect(
      page.getByText(/Connectez votre Stripe pour générer un lien/i).first(),
    ).toBeVisible();
  });

  test('Tableau de bord : section « Solde & versements » (Lot B)', async ({ page }) => {
    const fx = await seedTierFixtures();
    await loginAsPhone(page, fx.business.ownerPhone);
    await page.goto('/pro/payments');
    // Section solde/virements présente ; org non connectée → invite à connecter
    // (le solde réel est lu sur le compte Stripe une fois connecté).
    await expect(page.getByText('Solde & versements')).toBeVisible();
    await expect(
      page.getByText(/Connectez votre compte Stripe pour suivre votre solde/i),
    ).toBeVisible();
  });
});
