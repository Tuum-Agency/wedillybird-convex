/**
 * Aiguillage post-connexion — **source de vérité unique** du « bon dashboard ».
 *
 * À la connexion (et à la fin de l'onboarding), on doit envoyer chaque personne
 * vers la bonne surface selon qu'elle est **agence** (abonnement pro) ou
 * **particulier** (couple) :
 *
 *  - Pas encore onboardée (rôle `guest`, ou pas de nom) → `/onboarding`.
 *  - Admin plateforme (rôle `admin`) → `/admin` (console d'administration),
 *    directement, sans dépendre d'une organisation agence.
 *  - Agence (rôle `pro`) :
 *      - membre actif d'une organisation → `/pro/dashboard` (le back-office) ;
 *      - sinon → `/pro/onboarding` (créer/rejoindre l'organisation d'abord).
 *  - Particulier (rôle `couple`) → `/dashboard`.
 *
 * Le signal « abonnement » d'une agence vit sur l'**organisation**
 * (`organizations.subscriptionTier/Status`), pas sur le user : on route donc
 * sur l'appartenance à une organisation active. L'état d'abonnement lui-même
 * (actif / past_due / aucun) est géré *dans* le back-office (cockpit, billing),
 * pas au niveau du routage — une agence sans abonnement actif doit quand même
 * atterrir sur `/pro/dashboard` pour pouvoir s'abonner.
 *
 * Fonction **pure** (aucune dépendance serveur) pour être trivialement testable
 * et réutilisable côté pages comme côté server actions.
 */

export type PostAuthRole = 'couple' | 'pro' | 'guest' | 'admin';

export interface PostAuthUser {
  fullName?: string | null;
  role?: PostAuthRole | null;
}

export type PostAuthDestination =
  | '/onboarding'
  | '/pro/onboarding'
  | '/pro/dashboard'
  | '/dashboard'
  | '/admin';

/** Rôles considérés comme « agence » (back-office pro). */
export function isAgencyRole(role: PostAuthRole | null | undefined): boolean {
  return role === 'pro' || role === 'admin';
}

/**
 * Résout la destination post-auth.
 *
 * @param user          Le user courant (ou null si pas encore résolu).
 * @param hasActiveOrg  L'user est-il membre **actif** d'une organisation ?
 *                      (pertinent uniquement pour les rôles agence).
 */
export function resolvePostAuthDestination(
  user: PostAuthUser | null | undefined,
  hasActiveOrg: boolean,
): PostAuthDestination {
  // Onboarding non terminé : pas de nom, pas de rôle, ou rôle invité.
  if (!user || !user.fullName || !user.role || user.role === 'guest') {
    return '/onboarding';
  }

  // Admin plateforme → console d'administration, quel que soit l'état
  // d'organisation (le back-office pro n'est pas sa surface par défaut).
  if (user.role === 'admin') {
    return '/admin';
  }

  if (isAgencyRole(user.role)) {
    return hasActiveOrg ? '/pro/dashboard' : '/pro/onboarding';
  }

  // Particulier (couple).
  return '/dashboard';
}
