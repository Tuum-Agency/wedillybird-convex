/**
 * Slug du déploiement Convex **prod** (T2-1, health-check indépendant du
 * money-path). Sert à détecter la dérive exacte qui a déjà coupé un pan de
 * la prod le 2026-05-23 (`CONVEX_SITE_URL` pointait dev alors que le process
 * tournait en prod, cf. `lib/health/lambda-callback-misconfigured` — bug
 * invisible pendant des semaines).
 *
 * Dupliqué volontairement depuis `infra/lib/convex-url.ts` (`PROD_CONVEX_SLUG`) :
 * `infra/` est un projet TypeScript séparé (son propre `package.json` /
 * `tsconfig.json`, exclu du tsconfig racine — cf. CLAUDE.md) et ne peut pas
 * être importé depuis `app/`/`lib/`. **Garder les deux constantes
 * synchronisées** : le jour où le déploiement prod change, mettre à jour
 * CETTE valeur ET celle d'`infra/` dans la même PR.
 */
export const PROD_CONVEX_DEPLOYMENT_SLUG = 'fearless-poodle-133';

/**
 * Vrai si `url` (typiquement `NEXT_PUBLIC_CONVEX_URL`) pointe vers le
 * déploiement Convex prod attendu. `undefined`/vide → toujours faux (une env
 * absente n'est jamais silencieusement "correcte").
 */
export function isExpectedProdConvexUrl(url: string | undefined): boolean {
  if (!url) return false;
  return url.includes(PROD_CONVEX_DEPLOYMENT_SLUG);
}
