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
  const t = await getTranslations({ locale, namespace: 'Metadata.legalCookies' });
  return {
    title: t('title'),
    description: t('description'),
    alternates: { canonical: '/legal/cookies' },
    openGraph: {
      type: 'article',
      title: t('title'),
      description: t('description'),
      url: '/legal/cookies',
      siteName: 'Wedillybird',
      locale: toOgLocale(locale),
      images: [...OG_DEFAULT_IMAGES],
    },
  };
}

export default async function CookiesPage() {
  const t = await getTranslations('Legal.cookies');
  return (
    <EditorialPage eyebrow="DOCUMENT JURIDIQUE" title={t('title')} lastUpdated={t('lastUpdated')}>
      <EditorialSection title={t('whatTitle')} body={t('whatBody')} />
      <EditorialSection title={t('typesTitle')} body={t('typesBody')} />
      <EditorialSection title={t('controlTitle')} body={t('controlBody')} />
      <EditorialSection title={t('thirdPartiesTitle')} body={t('thirdPartiesBody')} />
    </EditorialPage>
  );
}
