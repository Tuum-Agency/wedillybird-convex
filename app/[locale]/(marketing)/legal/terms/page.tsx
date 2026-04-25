import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

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
    <article className="prose mx-auto flex max-w-2xl flex-col gap-4">
      <h1 className="font-display text-3xl font-semibold tracking-tight">{t('title')}</h1>
      <p className="text-sm text-[color:var(--color-muted)]">{t('lastUpdated')}</p>
      <Section title={t('article1Title')} body={t('article1Body')} />
      <Section title={t('article2Title')} body={t('article2Body')} />
      <Section title={t('article3Title')} body={t('article3Body')} />
      <Section title={t('article4Title')} body={t('article4Body')} />
      <Section title={t('article5Title')} body={t('article5Body')} />
      <Section title={t('article6Title')} body={t('article6Body')} />
      <Section title={t('article7Title')} body={t('article7Body')} />
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
