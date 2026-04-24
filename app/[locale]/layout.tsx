import type { Metadata } from 'next';
import { Cormorant_Garamond, Inter } from 'next/font/google';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { ConvexClientProvider } from '@/components/providers/convex-client-provider';
import '../globals.css';

const inter = Inter({
  variable: '--font-sans',
  subsets: ['latin'],
  display: 'swap',
});

const cormorant = Cormorant_Garamond({
  variable: '--font-serif',
  weight: ['400', '500', '600', '700'],
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
    <html lang={locale} className={`${inter.variable} ${cormorant.variable} h-full antialiased`}>
      <body className="bg-background text-foreground flex min-h-full flex-col font-sans">
        <NextIntlClientProvider>
          <ConvexClientProvider convexUrl={process.env.NEXT_PUBLIC_CONVEX_URL}>
            {children}
          </ConvexClientProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
