import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Legal' });
  return { title: t('privacy.title') };
}

export default async function PrivacyPage() {
  const t = await getTranslations('Legal.privacy');
  return (
    <article className="prose mx-auto flex max-w-2xl flex-col gap-4">
      <h1 className="font-display text-3xl font-semibold tracking-tight">{t('title')}</h1>
      <p className="text-sm text-[color:var(--color-muted)]">{t('lastUpdated')}</p>
      <Section title={t('controllerTitle')} body={t('controllerBody')} />
      <Section title={t('dataCollectedTitle')} body={t('dataCollectedBody')} />
      <Section title={t('purposesTitle')} body={t('purposesBody')} />
      <Section title={t('legalBasisTitle')} body={t('legalBasisBody')} />
      <Section title={t('retentionTitle')} body={t('retentionBody')} />
      <Section title={t('subprocessorsTitle')} body={t('subprocessorsBody')} />
      <Section title={t('rightsTitle')} body={t('rightsBody')} />
      <Section title={t('contactTitle')} body={t('contactBody')} />
    </article>
  );
}

function Section({ title, body }: { title: string; body: string }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-display text-xl font-semibold">{title}</h2>
      <p className="text-sm leading-relaxed whitespace-pre-line">{body}</p>
    </section>
  );
}
