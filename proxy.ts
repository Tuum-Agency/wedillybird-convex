import createIntlMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { routing } from './i18n/routing';
import { extractOrgSlug } from './lib/subdomain/extract-org-slug';

/**
 * Proxy Next 16 — gère deux responsabilités côté edge :
 *
 *  1. Rewrite multi-tenant : `<slug>.wedillybird.com/<path>` →
 *     `/orgs/<slug>/<path>` (transparent pour l'utilisateur, l'URL
 *     affichée reste le sous-domaine).
 *  2. Routing next-intl (locale `fr` only, prefix `as-needed`).
 *
 * En dev local (où on n'a pas de DNS wildcard), le param de querystring
 * `?orgPreview=<slug>` simule le sous-domaine — utile pour Playwright et
 * pour un test rapide en navigateur.
 *
 * Les sous-domaines système (`www`, `api`, `media`, `app`, `admin`) sont
 * whitelistés dans `lib/subdomain/extract-org-slug.ts` et ne sont jamais
 * rewrités. Les domaines preview Vercel (`*.vercel.app`) non plus.
 */

const intlMiddleware = createIntlMiddleware(routing);

const SLUG_PREVIEW_PARAM = 'orgPreview';
const SLUG_PREVIEW_RE = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/i;

function isAlreadyOrgPath(pathname: string): boolean {
  // Évite la double-réécriture si une requête arrive déjà sur `/orgs/<slug>`
  // (pas censé arriver depuis l'extérieur, mais ceinture-bretelles).
  return /^\/(?:[a-z]{2}\/)?orgs\//.test(pathname);
}

function buildRewriteUrl(req: NextRequest, slug: string): URL {
  const url = req.nextUrl.clone();
  // Préserve le préfixe locale s'il est explicite (ex: `/fr/event/...`).
  // next-intl est en `as-needed` avec `fr` par défaut, donc la plupart
  // des URLs n'auront pas de préfixe de locale.
  const localeMatch = url.pathname.match(/^\/([a-z]{2})(\/|$)/);
  const matchedLocale = localeMatch?.[1];
  const localePrefix =
    matchedLocale && (routing.locales as readonly string[]).includes(matchedLocale)
      ? `/${matchedLocale}`
      : '';
  const rest = url.pathname.slice(localePrefix.length) || '/';
  url.pathname = `${localePrefix}/orgs/${slug}${rest === '/' ? '' : rest}`;
  return url;
}

function resolveOrgSlug(req: NextRequest): string | null {
  // 1. Sous-domaine prod : `<slug>.wedillybird.com`.
  const host = req.headers.get('host');
  const fromHost = extractOrgSlug(host);
  if (fromHost) return fromHost;

  // 2. Override dev / E2E : `?orgPreview=<slug>` (uniquement sur localhost).
  const normalizedHost = (host ?? '').toLowerCase();
  const isLocal =
    normalizedHost.startsWith('localhost') ||
    normalizedHost.startsWith('127.0.0.1') ||
    normalizedHost.endsWith('.localhost');
  if (!isLocal) return null;
  const preview = req.nextUrl.searchParams.get(SLUG_PREVIEW_PARAM);
  if (!preview) return null;
  if (!SLUG_PREVIEW_RE.test(preview)) return null;
  return preview.toLowerCase();
}

export default function proxy(request: NextRequest) {
  const slug = resolveOrgSlug(request);
  if (slug && !isAlreadyOrgPath(request.nextUrl.pathname)) {
    const rewriteUrl = buildRewriteUrl(request, slug);
    const response = NextResponse.rewrite(rewriteUrl);
    response.headers.set('x-org-slug', slug);
    return response;
  }
  return intlMiddleware(request);
}

export const config = {
  // Exclut `opengraph-image` / `twitter-image` qui sont des routes Next.js
  // file convention (next/og). Sans ça, le middleware next-intl les redirige
  // vers /fr/opengraph-image qui n'existe pas → 404.
  matcher: [
    '/((?!api|trpc|_next|_vercel|convex|opengraph-image|twitter-image|sitemap\\.xml|robots\\.txt|.*\\..*).*)',
  ],
};
