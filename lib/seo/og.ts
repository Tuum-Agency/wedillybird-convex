/**
 * Helpers de metadata Open Graph / Twitter Cards.
 *
 * Les fichiers `app/opengraph-image.tsx` et `app/twitter-image.tsx`
 * (convention Next.js 16) génèrent l'image 1200×630 dynamiquement.
 * Mais Next.js ne fallback PAS automatiquement vers ces fichiers quand
 * une page définit son propre `openGraph: {...}` SANS clé `images`.
 *
 * Pour éviter d'oublier l'image dans chaque `generateMetadata`, on
 * exporte ici un objet `OG_DEFAULT_IMAGES` que chaque page injecte
 * explicitement dans son metadata.
 *
 * `metadataBase` est posé au layout racine, donc l'URL relative
 * `/opengraph-image` se résout en absolue côté HTML rendu.
 */
export const OG_DEFAULT_IMAGES = [
  {
    url: '/opengraph-image',
    width: 1200,
    height: 630,
    alt: 'Wedillybird — Invitations mariage par WhatsApp, RSVP, check-in',
  },
] as const;

export const TWITTER_DEFAULT_IMAGES = [
  {
    url: '/twitter-image',
    alt: 'Wedillybird — Invitations mariage par WhatsApp, RSVP, check-in',
  },
] as const;
