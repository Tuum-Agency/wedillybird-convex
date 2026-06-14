import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { OG_DEFAULT_IMAGES } from '@/lib/seo/og';
import { toOgLocale } from '@/lib/i18n/locale-tags';
import { EditorialPage, EditorialSection } from '@/components/marketing/editorial-page';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Metadata.legalTerms' });
  return {
    title: t('title'),
    description: t('description'),
    alternates: { canonical: '/legal/terms' },
    openGraph: {
      type: 'article',
      title: t('title'),
      description: t('description'),
      url: '/legal/terms',
      siteName: 'Wedillybird',
      locale: toOgLocale(locale),
      images: [...OG_DEFAULT_IMAGES],
    },
  };
}

export default async function TermsPage() {
  const t = await getTranslations('Legal.terms');
  const tm = await getTranslations('Marketing.legal');
  return (
    <EditorialPage eyebrow={tm('eyebrow')} title={t('title')} lastUpdated={t('lastUpdated')}>
      <EditorialSection title={t('article1Title')} body={t('article1Body')} />
      <EditorialSection title={t('article2Title')} body={t('article2Body')} />
      <EditorialSection title={t('article3Title')} body={t('article3Body')} />
      <EditorialSection title={t('article4Title')} body={t('article4Body')} />
      <EditorialSection title={t('article5Title')} body={t('article5Body')} />
      <EditorialSection title={t('article6Title')} body={t('article6Body')} />
      <EditorialSection title={t('article7Title')} body={t('article7Body')} />
    </EditorialPage>
  );
}
