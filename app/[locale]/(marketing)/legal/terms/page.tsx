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
  return { title: t('terms.title') };
}

export default async function TermsPage() {
  const t = await getTranslations('Legal.terms');
  return (
    <EditorialPage eyebrow="DOCUMENT JURIDIQUE" title={t('title')} lastUpdated={t('lastUpdated')}>
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
