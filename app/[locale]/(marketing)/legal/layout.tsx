import type { ReactNode } from 'react';
import { setRequestLocale } from 'next-intl/server';
import { LegalFooter } from '@/components/layout/legal-footer';

export default async function LegalLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <>
      <main
        id="main-content"
        className="container-page flex flex-1 flex-col gap-8 py-12"
        tabIndex={-1}
      >
        {children}
      </main>
      <LegalFooter />
    </>
  );
}
