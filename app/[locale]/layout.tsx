import type { Metadata } from 'next';
import { Bodoni_Moda, Geist, Geist_Mono } from 'next/font/google';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { ConvexClientProvider } from '@/components/providers/convex-client-provider';
import { SkipLink } from '@/components/layout/skip-link';
import { Toaster } from '@/components/ui/toast';
import '../globals.css';

// Body / UI — Geist Sans (Vercel, OFL). Successeur d'Inter recommandé en 2025+.
const geistSans = Geist({
  variable: '--font-sans',
  subsets: ['latin'],
  display: 'swap',
});

// Mono — Geist Mono pour QR tokens, IDs, timestamps, IBAN factures.
const geistMono = Geist_Mono({
  variable: '--font-mono',
  subsets: ['latin'],
  display: 'swap',
});

// Display — Bodoni Moda Italic (Google Fonts, OFL).
// Didone moderne variable, signature éditoriale "magazine de mode" italienne.
// Sortie de Fraunces (sur-utilisée par tous les SaaS premium 2024-2026) pour
// une typographie plus rare, plus tranchante, plus haute en contraste —
// l'ADN visuel de Vogue Italia, Atelier Isabey, des éditoriaux luxe.
//
// Variable axes : weight 400-900 + optical sizing automatique.
// Fallback Iowan Old Style Italic / Georgia gérés dans globals.css.
const bodoniModa = Bodoni_Moda({
  variable: '--font-display',
  weight: ['400', '500', '600'],
  style: ['italic'],
  subsets: ['latin'],
  display: 'swap',
});

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://wedillybird.com';

export const metadata: Metadata = {
  title: {
    default: "Wedillybird — L'organisation de mariage simplifiée",
    template: '%s · Wedillybird',
  },
  description:
    "Invitations WhatsApp, RSVP en temps réel, check-in, galerie partagée. Wedillybird simplifie l'organisation de votre mariage.",
  metadataBase: new URL(BASE_URL),
  appleWebApp: {
    title: 'Wedillybird',
    capable: true,
    statusBarStyle: 'default',
  },
};

export const viewport = {
  // Ivoire chaud (token --color-ivory-50). Cohérent avec la palette mariage
  // claire — la barre de status mobile se fond avec le fond du site.
  themeColor: '#fbf6ee',
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

/**
 * JSON-LD Organization injecté en `<body>` — schema.org pour permettre à
 * Google de présenter Wedillybird comme entité (knowledge panel, sitelinks).
 */
const ORGANIZATION_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Wedillybird',
  url: BASE_URL,
  logo: `${BASE_URL}/wedillybird-logo.png`,
  description:
    "Plateforme SaaS d'organisation de mariage WhatsApp-first : invitations, RSVP, check-in, galerie partagée. France et Afrique de l'Ouest francophone.",
  sameAs: [],
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} ${bodoniModa.variable} h-full antialiased`}
    >
      <body className="bg-background text-foreground flex min-h-full flex-col font-sans">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ORGANIZATION_JSON_LD) }}
        />
        <NextIntlClientProvider>
          <ConvexClientProvider convexUrl={process.env.NEXT_PUBLIC_CONVEX_URL}>
            <SkipLink />
            {children}
            <Toaster />
          </ConvexClientProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
