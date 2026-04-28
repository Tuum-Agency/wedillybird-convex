import { expect, test } from '@playwright/test';

test.describe('Landing pricing', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Scroll into section to trigger whileInView Motion animations
    await page.locator('#pricing').scrollIntoViewIfNeeded();
  });

  test('section visible avec eyebrow chapitre 06 et titre', async ({ page }) => {
    const section = page.locator('#pricing');
    await expect(section).toBeVisible();
    await expect(section.getByText(/CHAPITRE 06 — LES FORMULES/i)).toBeVisible();
    await expect(
      section.getByRole('heading', { name: /un prix juste pour le plus beau jour/i }),
    ).toBeVisible();
  });

  test('card Essentiel affiche le nom, un prix numérique et le symbole €', async ({ page }) => {
    const section = page.locator('#pricing');
    // Scope au h3 pour éviter la violation strict-mode (le mot "Essentiel" apparaît
    // aussi dans "Tout l'Essentiel inclus" et dans la description)
    await expect(section.getByRole('heading', { name: /^Essentiel$/i, level: 3 })).toBeVisible();
    const priceEl = section.getByTestId('price-essential');
    await expect(priceEl).toBeVisible();
    // fr-FR formate avec espace insécable : "19,00 €" (Africa) ou "39,00 €" (Europe).
    // On vérifie la présence d'un montant numérique et du symbole devise.
    await expect(priceEl).toContainText(/\d+/);
    await expect(priceEl).toContainText(/€/);
  });

  test('card Premium affiche le nom, un prix numérique, le symbole € et le badge Recommandé', async ({
    page,
  }) => {
    const section = page.locator('#pricing');
    await expect(section.getByRole('heading', { name: /^Premium$/i, level: 3 })).toBeVisible();
    const priceEl = section.getByTestId('price-premium');
    await expect(priceEl).toBeVisible();
    // "49,00 €" (Africa) ou "89,00 €" (Europe)
    await expect(priceEl).toContainText(/\d+/);
    await expect(priceEl).toContainText(/€/);
    await expect(section.getByText(/Recommandé/i)).toBeVisible();
  });

  test('card Premium affiche "Tout l\'Essentiel inclus" comme première feature', async ({
    page,
  }) => {
    const section = page.locator('#pricing');
    await expect(section.getByText(/Tout l'Essentiel inclus/i)).toBeVisible();
  });

  test('card Premium contient les features-clés de la refonte', async ({ page }) => {
    const section = page.locator('#pricing');
    await expect(section.getByText(/Modération automatique/i)).toBeVisible();
    await expect(section.getByText(/Recherche par visage/i)).toBeVisible();
    await expect(section.getByText(/Cinématique/i)).toBeVisible();
  });

  test('section upsell présente avec mention "5 ans" et un prix €', async ({ page }) => {
    const upsell = page.getByTestId('upsell-note');
    await upsell.scrollIntoViewIfNeeded();
    await expect(upsell).toBeVisible();
    await expect(upsell).toContainText(/5 ans/i);
    // "29,00 €" (Africa) ou "59,00 €" (Europe) — on vérifie la présence du symbole
    await expect(upsell).toContainText(/€/);
  });
});

test.describe('Landing pricing pros', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.locator('#pricing-pros').scrollIntoViewIfNeeded();
  });

  test('section visible avec un titre matchant wedding planner', async ({ page }) => {
    const section = page.locator('#pricing-pros');
    await expect(section).toBeVisible();
    await expect(
      section.getByRole('heading', { name: /wedding planner|forfait pro/i }),
    ).toBeVisible();
  });

  test('toggle Mensuel/Annuel présent', async ({ page }) => {
    const section = page.locator('#pricing-pros');
    const group = section.getByRole('radiogroup');
    await expect(group).toBeVisible();
    await expect(section.getByRole('radio', { name: /mensuel/i })).toBeVisible();
    await expect(section.getByRole('radio', { name: /annuel/i })).toBeVisible();
  });

  test('3 cards Starter, Business, Agency visibles', async ({ page }) => {
    const section = page.locator('#pricing-pros');
    await expect(section.getByRole('heading', { name: /^Starter$/i, level: 3 })).toBeVisible();
    await expect(section.getByRole('heading', { name: /^Business$/i, level: 3 })).toBeVisible();
    await expect(section.getByRole('heading', { name: /^Agency$/i, level: 3 })).toBeVisible();
  });

  test('prix mensuels par défaut : 89, 179, 349 avec suffixe / mois', async ({ page }) => {
    const section = page.locator('#pricing-pros');
    // fr-FR formate en "89,00 €" — on cherche uniquement le nombre
    await expect(section.getByText(/\b89\b/).first()).toBeVisible();
    await expect(section.getByText(/\b179\b/).first()).toBeVisible();
    await expect(section.getByText(/\b349\b/).first()).toBeVisible();
    await expect(section.getByText(/\/\s*mois/i).first()).toBeVisible();
  });

  test('card Business porte le badge "Le plus choisi"', async ({ page }) => {
    const section = page.locator('#pricing-pros');
    await expect(section.getByText(/Le plus choisi/i)).toBeVisible();
  });

  test('toggle annuel : prix équivalents mensuels et badge économies apparaissent', async ({
    page,
  }) => {
    const section = page.locator('#pricing-pros');
    const annualBtn = section.getByRole('radio', { name: /annuel/i });
    await annualBtn.click();

    // Starter annuel : 85 500 / 12 = 7 125 centimes = 71,25 €
    // fr-FR formate en "71,25 €" — on cherche "71,25" ou "71"
    await expect(section.getByText(/71[,.]25/)).toBeVisible();
    // Badge économies (aria-live, animé)
    await expect(section.getByText(/économisez\s*20\s*%/i)).toBeVisible();
  });

  test('card PAYG visible avec 69 € et Pay-as-you-go', async ({ page }) => {
    const section = page.locator('#pricing-pros');
    // fr-FR formate 69 € en "69,00 €"
    await expect(section.getByText(/\b69\b/).first()).toBeVisible();
    await expect(section.getByText(/Pay-as-you-go/i)).toBeVisible();
  });

  test('note de dépassement contient 0,06 et 0,03', async ({ page }) => {
    const section = page.locator('#pricing-pros');
    await expect(section.getByText(/0,06/)).toBeVisible();
    await expect(section.getByText(/0,03/)).toBeVisible();
  });
});
