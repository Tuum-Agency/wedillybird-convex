import type { MetadataRoute } from 'next';

/**
 * robots.txt — Next.js 16 file-based.
 *
 * Disallow toutes les routes authentifiées et personnelles (tokens
 * d'invitation, sous-domaines orga, API). Le sitemap canonique est
 * `https://wedillybird.com/sitemap.xml`.
 */
export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://wedillybird.com';

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/dashboard',
          '/pro/',
          '/sign-in',
          '/sign-up',
          '/verify',
          '/onboarding',
          '/i/',
          '/orgs/',
          '/api/',
          '/dev-login',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
