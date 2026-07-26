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
  const t = await getTranslations({ locale, namespace: 'Metadata.legalPrivacy' });
  return {
    title: t('title'),
    description: t('description'),
    alternates: { canonical: '/legal/privacy' },
    openGraph: {
      type: 'article',
      title: t('title'),
      description: t('description'),
      url: '/legal/privacy',
      siteName: 'Wedillybird',
      locale: toOgLocale(locale),
      images: [...OG_DEFAULT_IMAGES],
    },
  };
}

export default async function PrivacyPage() {
  const t = await getTranslations('Legal.privacy');
  const tm = await getTranslations('Marketing.legal');
  return (
    <EditorialPage eyebrow={tm('eyebrow')} title={t('title')} lastUpdated={t('lastUpdated')}>
      <EditorialSection title={t('controllerTitle')} body={t('controllerBody')} />
      <EditorialSection title={t('dataCollectedTitle')} body={t('dataCollectedBody')} />
      <EditorialSection title={t('purposesTitle')} body={t('purposesBody')} />
      <EditorialSection title={t('legalBasisTitle')} body={t('legalBasisBody')} />
      <EditorialSection title={t('retentionTitle')} body={t('retentionBody')} />
      <EditorialSection title={t('subprocessorsTitle')} body={t('subprocessorsBody')} />
      <EditorialSection title={t('biometricsTitle')} body={t('biometricsBody')} />
      <EditorialSection title={t('rightsTitle')} body={t('rightsBody')} />
      <EditorialSection title={t('contactTitle')} body={t('contactBody')} />
    </EditorialPage>
  );
}
