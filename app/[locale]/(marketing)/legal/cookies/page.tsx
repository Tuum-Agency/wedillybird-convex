import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { EditorialPage, EditorialSection } from '@/components/marketing/editorial-page';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Legal' });
  return { title: t('cookies.title') };
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
