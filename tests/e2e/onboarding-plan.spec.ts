import { expect, test } from '@playwright/test';
import { loginAsDevUser, requiresConvexDev } from './utils/fixtures';

/**
 * Couvre le golden path "création event particulier → étape 5 (forfait)".
 *
 * Le wizard n'a 5 étapes que pour `userRole === 'couple'`. On vérifie que :
 *  - le bouton "Créer" reste désactivé tant qu'aucun forfait n'est choisi ;
 *  - sélectionner Essentiel rend le bouton actif (preuve que `pendingPlanTier`
 *    a basculé côté state, sans avoir besoin de soumettre).
 *
 * On évite le `submit()` final (qui crée vraiment l'event en DB) pour ne pas
 * polluer le seed dev — la couverture vitest sur `event-create-wizard.test.tsx`
 * teste déjà la soumission FormData complète.
 */
test.describe('Onboarding — étape forfait (couple)', () => {
  test.skip(requiresConvexDev(), 'Convex dev deployment required for authenticated flow');

  test("le bouton Créer reste disabled tant qu'aucun forfait n'est sélectionné", async ({
    page,
  }) => {
    await loginAsDevUser(page);

    await page.goto('/events/new');
    // NB: /events/new rend 2 <h1> "Créer votre mariage" (hero + header sticky) — défaut a11y
    // mineur signalé séparément. On scope au premier pour éviter la violation strict-mode.
    await expect(page.getByRole('heading', { level: 1 }).first()).toContainText(/créer/i);

    // Step 0 — couple
    await page.getByLabel(/titre de l'événement/i).fill('Mariage F & A');
    await page.getByLabel(/partenaire 1/i).fill('Fatou');
    await page.getByLabel(/partenaire 2/i).fill('Amadou');
    await page.getByRole('button', { name: /^suivant$/i }).click();

    // Step 1 — date (input datetime-local)
    const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const pad = (n: number) => String(n).padStart(2, '0');
    const value = `${future.getFullYear()}-${pad(future.getMonth() + 1)}-${pad(
      future.getDate(),
    )}T${pad(future.getHours())}:${pad(future.getMinutes())}`;
    await page.getByLabel(/date et heure/i).fill(value);
    await page.getByRole('button', { name: /^suivant$/i }).click();

    // Step 2 — venue (skip)
    await page.getByRole('button', { name: /^suivant$/i }).click();

    // Step 3 — theme (skip avec defaults)
    await page.getByRole('button', { name: /^suivant$/i }).click();

    // Step 4 — plan : on doit voir les deux radios et le submit doit être disabled
    await expect(page.getByRole('heading', { name: /forfait|formule|choisir/i })).toBeVisible();
    await expect(page.getByTestId('plan-option-essential')).toBeVisible();
    await expect(page.getByTestId('plan-option-premium')).toBeVisible();

    const submit = page.getByRole('button', { name: /créer/i });
    await expect(submit).toBeDisabled();

    // Sélectionne Essentiel → activé
    await page.getByTestId('plan-option-essential').click();
    await expect(page.getByTestId('plan-option-essential')).toHaveAttribute('aria-checked', 'true');
    await expect(submit).toBeEnabled();
  });
});
