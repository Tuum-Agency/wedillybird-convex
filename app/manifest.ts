import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Wedillybird',
    short_name: 'Wedillybird',
    description:
      "Invitations WhatsApp, RSVP en temps réel, check-in, galerie partagée. Wedillybird simplifie l'organisation de votre mariage.",
    start_url: '/',
    display: 'standalone',
    background_color: '#fdfaf6',
    theme_color: '#2c1a11',
    orientation: 'portrait',
    lang: 'fr',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
