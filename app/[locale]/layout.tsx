import type { Metadata } from 'next';
import { Fraunces, Geist, Geist_Mono } from 'next/font/google';
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

// Display — Fraunces Italic comme proxy de Migra Italic (Pangram Pangram, payante).
// Une seule weight (italic uniquement) = bundle minimal. C'est la signature
// éditoriale du brand : hero landing, page invitation, noms du couple.
//
// Migration future possible vers Migra : remplacer ce font + bumper la variable
// --font-display dans globals.css. Le reste des composants n'a rien à changer.
const fraunces = Fraunces({
  variable: '--font-display',
  weight: ['400', '500'],
  style: ['italic'],
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: "Wedillybird — L'organisation de mariage simplifiée",
    template: '%s · Wedillybird',
  },
  description:
    "Invitations WhatsApp, RSVP en temps réel, check-in, galerie partagée. Wedillybird simplifie l'organisation de votre mariage.",
  metadataBase: new URL('https://wedillybird.com'),
  appleWebApp: {
    title: 'Wedillybird',
    capable: true,
    statusBarStyle: 'default',
  },
};

export const viewport = {
  themeColor: '#2c1a11',
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

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
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="bg-background text-foreground flex min-h-full flex-col font-sans">
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
