import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

/**
 * Headers HTTP de sécurité (fix F-03 — audit avril 2026).
 *
 * - **HSTS** : 2 ans avec subdomains et preload (compatible avec le
 *   wildcard `*.wedillybird.com`).
 * - **X-Frame-Options: DENY** : bloque le clickjacking. On ne s'iframe
 *   nulle part — le checkout Stripe vit dans `frame-src` côté CSP, pas
 *   l'inverse.
 * - **X-Content-Type-Options: nosniff** : désactive le MIME sniffing.
 * - **Referrer-Policy** : `strict-origin-when-cross-origin` pour éviter
 *   de leak les chemins privés (`/events/{id}/...`) vers des domaines
 *   externes.
 * - **Permissions-Policy** : caméra autorisée pour la PWA mariée
 *   (capture photo galerie), micro et geolocation refusés.
 * - **CSP** : démarre en mode permissif pour ne rien casser, à
 *   resserrer une fois la base stabilisée. Sources autorisées :
 *     - `self` partout
 *     - Stripe (`js.stripe.com` + `api.stripe.com` + iframe checkout)
 *     - Convex (`*.convex.cloud` + `*.convex.site` pour le websocket)
 *     - CloudFront (`*.cloudfront.net`) + domaine media custom
 *     - Unsplash pour le hero landing
 *     - CinetPay pour le checkout XOF
 *     - `data:` et `blob:` pour les uploads photo
 */
const securityHeaders = [
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(self), microphone=(), geolocation=()',
  },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "img-src 'self' https://*.cloudfront.net https://media.wedillybird.com https://images.unsplash.com https://plus.unsplash.com data: blob:",
      "script-src 'self' 'unsafe-inline' https://js.stripe.com",
      "connect-src 'self' https://*.convex.cloud https://*.convex.site wss://*.convex.cloud https://api.stripe.com https://api-checkout.cinetpay.com",
      'frame-src https://js.stripe.com https://checkout.stripe.com',
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self' data:",
    ].join('; '),
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  typedRoutes: true,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
  images: {
    remotePatterns: [
      // Unsplash — visuels mariage curatés (libre de droit, license CC0).
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'plus.unsplash.com' },
    ],
  },
};

export default withNextIntl(nextConfig);
