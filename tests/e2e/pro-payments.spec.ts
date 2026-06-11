import { test, expect } from '@playwright/test';
import { requiresConvexDev, loginAsPhone, seedTierFixtures } from './utils/fixtures';

/**
 * Paiements (module Finances) — modèle **BYOP** : l'agence connecte SON propre
 * compte Stripe (OAuth Standard, charge directe, 0 commission, Wedillybird jamais
 * dans le flux). Couvre :
 *  - gating Starter → verrouillé (Business+) ;
 *  - Business : board (hero, sous-onglets, transactions), carte « Se connecter
 *    avec Stripe », échéancier « marquer payé », réglages byop/manuel ;
 *  - le **bouton de connexion** produit la bonne URL d'autorisation OAuth Stripe ;
 *  - le **callback OAuth** rejette un `state` invalide (anti-CSRF) et le refus agence.
 */
test.describe('Paiements — connexion Stripe (BYOP)', () => {
  test.skip(requiresConvexDev(), 'Convex dev deployment required');

  test('Starter : module verrouillé (réservé Business)', async ({ page }) => {
    await seedTierFixtures();
    await loginAsPhone(page, '+225071234567'); // Pro Starter au quota
    await page.goto('/pro/payments');
    await expect(page.getByText(/Inclus à partir du forfait Business/i)).toBeVisible();
  });

  test('Business : carte « Se connecter avec Stripe » + board', async ({ page }) => {
    const fx = await seedTierFixtures();
    await loginAsPhone(page, fx.business.ownerPhone);
    await page.goto('/pro/payments');
    // Carte de connexion BYOP en tête de page.
    await expect(page.getByRole('heading', { name: 'Paiements en ligne' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Se connecter avec Stripe/i })).toBeVisible();
    // Board : titre + hero + sous-onglets.
    await expect(page.getByRole('heading', { name: 'Paiements', level: 1 })).toBeVisible();
    await expect(page.getByText(/Encaissé/).first()).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Tableau de bord' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Échéancier' })).toBeVisible();
    // Non connecté → bannière d'incitation (BYOP), pas de mention commission.
    await expect(
      page.getByText('Connectez votre compte Stripe pour encaisser en ligne', { exact: true }),
    ).toBeVisible();
    await expect(page.getByText('Transactions', { exact: true })).toBeVisible();
  });

  test('Business : le bouton de connexion redirige vers l’URL OAuth Stripe correcte', async ({
    page,
  }) => {
    const fx = await seedTierFixtures();
    await loginAsPhone(page, fx.business.ownerPhone);

    // On intercepte la navigation vers Stripe pour capturer l'URL SANS charger
    // la page Stripe (anti-bot / réseau). Prouve que NOTRE côté du handshake est
    // correct : client_id + scope + state signé + redirect_uri.
    let authUrl: string | null = null;
    await page.route(/connect\.stripe\.com\/oauth\/authorize/, (route) => {
      authUrl = route.request().url();
      return route.abort();
    });

    await page.goto('/pro/payments');
    await page.getByRole('button', { name: /Se connecter avec Stripe/i }).click();

    await expect.poll(() => authUrl, { timeout: 12_000 }).not.toBeNull();
    const u = new URL(authUrl!);
    expect(u.host).toBe('connect.stripe.com');
    expect(u.pathname).toBe('/oauth/authorize');
    expect(u.searchParams.get('response_type')).toBe('code');
    expect(u.searchParams.get('scope')).toBe('read_write');
    expect(u.searchParams.get('client_id')).toBeTruthy();
    expect(u.searchParams.get('state')).toBeTruthy();
    expect(u.searchParams.get('redirect_uri')).toContain('/api/stripe/oauth/callback');
  });

  test('Callback OAuth : state invalide → redirige connect=error (anti-CSRF)', async ({ page }) => {
    const res = await page.request.get('/api/stripe/oauth/callback?code=abc&state=tampered', {
      maxRedirects: 0,
    });
    expect(res.status()).toBe(307);
    expect(res.headers()['location']).toContain('/pro/payments?connect=error');
  });

  test('Callback OAuth : refus de l’agence (error param) → connect=denied', async ({ page }) => {
    const res = await page.request.get('/api/stripe/oauth/callback?error=access_denied', {
      maxRedirects: 0,
    });
    expect(res.status()).toBe(307);
    expect(res.headers()['location']).toContain('connect=denied');
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
    await expect(page.getByText(/directement chez vous/i)).toBeVisible();
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
});
