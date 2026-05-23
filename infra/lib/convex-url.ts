/**
 * Le stack `WedillybirdMediaStack` ne déploie qu'en prod. Il a un seul
 * Convex backend cible (le déploiement prod). Pourtant le script CDK
 * lit `NEXT_PUBLIC_CONVEX_SITE_URL` depuis `process.env`, qui est aussi
 * la var d'env que Next.js utilise côté client et que `.env.local`
 * définit pour le développement local sur `capable-crocodile-720`.
 *
 * Conséquence si on ne valide pas : lancer `cdk deploy` depuis un shell
 * où `.env.local` a été source-é embarque l'URL dev dans le Lambda
 * Moderation prod. Les callbacks `internalMarkModerated` partent alors
 * sur le mauvais endpoint, et les photos prod restent en `pending` à
 * vie — bug observé le 2026-05-23, fixé manuellement via l'AWS Console.
 *
 * Ce module force l'URL Convex à matcher le slug prod hard-codé avant
 * tout `cdk synth` / `cdk deploy`. Si la valeur résolue ne matche pas
 * (par exemple slug dev `capable-crocodile-720`), on throw avec un
 * message d'erreur qui dit exactement comment fixer.
 *
 * Le slug prod est hard-codé volontairement : c'est une config niveau
 * stack, pas niveau env. Le jour où on change de Convex prod, on
 * update cette constante consciemment dans la même PR que le rebrand.
 */
export const PROD_CONVEX_SLUG = 'fearless-poodle-133';

const CONVEX_SITE_URL_PATTERN = /^https:\/\/([a-z0-9-]+)\.convex\.site\/?$/;

export interface ConvexSiteUrlInputs {
  nextPublic: string | undefined;
  raw: string | undefined;
}

/**
 * Lit `NEXT_PUBLIC_CONVEX_SITE_URL` (priorité) puis `CONVEX_SITE_URL`
 * depuis les inputs. Retourne `undefined` si les deux sont vides — le
 * stack tolère ce cas (`media-stack.ts` skip alors le déploiement de
 * la Lambda Moderation, cf. `if (props.convexSiteUrl && props.lambdaCallbackSecret)`).
 *
 * Si une valeur est fournie mais ne matche pas le slug prod, on throw.
 */
export function resolveProdConvexSiteUrl(inputs: ConvexSiteUrlInputs): string | undefined {
  const raw = inputs.nextPublic || inputs.raw;
  if (!raw) return undefined;

  const match = raw.match(CONVEX_SITE_URL_PATTERN);
  if (!match) {
    throw new Error(
      `Invalid CONVEX_SITE_URL "${raw}". Expected format: https://<slug>.convex.site`,
    );
  }

  const slug = match[1];
  if (slug !== PROD_CONVEX_SLUG) {
    throw new Error(
      `Refusing to deploy WedillybirdMediaStack with non-prod CONVEX_SITE_URL "${raw}".\n` +
        `Expected slug "${PROD_CONVEX_SLUG}" (prod), got "${slug}".\n\n` +
        `Likely cause: \`.env.local\` was sourced into the shell before \`cdk deploy\`, ` +
        `leaking the dev Convex URL into the prod stack.\n\n` +
        `Fix:\n` +
        `  unset CONVEX_DEPLOYMENT CONVEX_URL CONVEX_SITE_URL NEXT_PUBLIC_CONVEX_URL NEXT_PUBLIC_CONVEX_SITE_URL\n` +
        `  export CONVEX_SITE_URL="https://${PROD_CONVEX_SLUG}.convex.site"\n` +
        `  pnpm cdk deploy WedillybirdMediaStack`,
    );
  }

  return raw;
}
