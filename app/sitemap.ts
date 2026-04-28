import type { MetadataRoute } from 'next';

/**
 * Sitemap public — Next.js 16 file-based pattern.
 *
 * Couvre uniquement les routes publiques indexables : landing, forfaits pros,
 * contact, FAQ, mentions légales. Les routes authentifiées (`/dashboard`,
 * `/pro/*`, `/onboarding`) et les routes personnelles à token (`/i/[token]`,
 * `/orgs/[slug]/event/*`) sont exclues — voir `app/robots.ts`.
 *
 * `baseUrl` est calé sur `NEXT_PUBLIC_APP_URL` avec fallback canonique.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://wedillybird.com';
  const lastModified = new Date();

  return [
    {
      url: `${baseUrl}/`,
      lastModified,
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/forfaits-pros`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/contact`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/faq`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/legal/terms`,
      lastModified,
      changeFrequency: 'yearly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/legal/privacy`,
      lastModified,
      changeFrequency: 'yearly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/legal/cookies`,
      lastModified,
      changeFrequency: 'yearly',
      priority: 0.5,
    },
  ];
}
