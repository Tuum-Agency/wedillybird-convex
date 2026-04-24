import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import { Link } from '@/i18n/navigation';
import { SignInForm } from '@/components/auth/sign-in-form';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Auth' });
  return { title: t('signInTitle') };
}

export default async function SignInPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Auth');
  const tCommon = await getTranslations('Common');

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-2 text-center">
        <h1 className="font-display text-3xl font-semibold tracking-tight">{t('signInTitle')}</h1>
        <p className="text-sm text-[color:var(--color-muted)]">{t('signInDescription')}</p>
      </header>

      <SignInForm />

      <p className="text-center text-sm text-[color:var(--color-muted)]">
        <Link href="/" className="underline-offset-4 hover:underline">
          {tCommon('back')}
        </Link>
      </p>
    </section>
  );
}
