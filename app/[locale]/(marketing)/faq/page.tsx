import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { LegalFooter } from '@/components/layout/legal-footer';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Faq' });
  return { title: t('title') };
}

const KEYS = [
  'account',
  'invitations',
  'rsvp',
  'checkin',
  'gallery',
  'pricing',
  'support',
] as const;

export default async function FaqPage() {
  const t = await getTranslations('Faq');
  return (
    <>
      <main
        id="main-content"
        className="container-page flex flex-1 flex-col gap-6 py-12"
        tabIndex={-1}
      >
        <header className="flex flex-col gap-2">
          <h1 className="font-display text-3xl font-semibold tracking-tight">{t('title')}</h1>
          <p className="text-sm text-[color:var(--color-muted)]">{t('subtitle')}</p>
        </header>
        <ul className="mx-auto flex w-full max-w-2xl flex-col gap-4">
          {KEYS.map((k) => (
            <li
              key={k}
              className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5"
            >
              <details className="group flex flex-col gap-2">
                <summary className="font-display cursor-pointer text-lg font-semibold">
                  {t(`questions.${k}.q` as const)}
                </summary>
                <p className="mt-2 text-sm leading-relaxed text-[color:var(--color-muted)]">
                  {t(`questions.${k}.a` as const)}
                </p>
              </details>
            </li>
          ))}
        </ul>
      </main>
      <LegalFooter />
    </>
  );
}
