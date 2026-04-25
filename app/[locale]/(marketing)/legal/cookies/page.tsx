import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

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
    <article className="prose mx-auto flex max-w-2xl flex-col gap-4">
      <h1 className="font-display text-3xl font-semibold tracking-tight">{t('title')}</h1>
      <p className="text-sm text-[color:var(--color-muted)]">{t('lastUpdated')}</p>
      <Section title={t('whatTitle')} body={t('whatBody')} />
      <Section title={t('typesTitle')} body={t('typesBody')} />
      <Section title={t('controlTitle')} body={t('controlBody')} />
      <Section title={t('thirdPartiesTitle')} body={t('thirdPartiesBody')} />
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
