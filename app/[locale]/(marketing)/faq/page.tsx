import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { LegalFooter } from '@/components/layout/legal-footer';
import { EditorialPage } from '@/components/marketing/editorial-page';
import { FaqList } from '@/components/marketing/faq-list';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Faq' });
  return { title: t('title') };
}

/**
 * FAQ V4 — page publique éditoriale, pattern Aesop / Atelier Isabey.
 * Server component qui rend le titre + délègue l'accordion au client.
 */
export default async function FaqPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Faq');

  return (
    <>
      <main id="main-content" className="container-page flex-1 py-20" tabIndex={-1}>
        <EditorialPage eyebrow="VOS QUESTIONS" title={t('title')}>
          <p className="-mt-4 max-w-xl text-base leading-relaxed text-[color:var(--color-ink-500)] sm:text-lg">
            {t('subtitle')}
          </p>
          <FaqList />
        </EditorialPage>
      </main>
      <LegalFooter />
    </>
  );
}
