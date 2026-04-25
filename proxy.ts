import { NextResponse, type NextRequest } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';
import { getRootDomains, matchOrgSubdomain } from './lib/middleware/subdomain';

const intlMiddleware = createMiddleware(routing);

export default function middleware(req: NextRequest) {
  const host = req.headers.get('host');
  const match = matchOrgSubdomain(host, getRootDomains());

  if (match) {
    // Rewrite <slug>.wedillybird.com/<path> -> /orgs/<slug>/<path> internally.
    // The user keeps seeing the subdomain; the App Router serves the
    // (public-org)/orgs/[slug] route group.
    const url = req.nextUrl.clone();
    if (!url.pathname.startsWith('/orgs/')) {
      url.pathname = `/orgs/${match.slug}${url.pathname === '/' ? '' : url.pathname}`;
      return NextResponse.rewrite(url);
    }
  }

  return intlMiddleware(req);
}

export const config = {
  matcher: ['/((?!api|trpc|_next|_vercel|convex|.*\\..*).*)'],
};
