import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import { Link, redirect } from '@/i18n/navigation';
import { VerifyForm } from '@/components/auth/verify-form';
import { isValidE164 } from '@/lib/phone';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Auth' });
  return { title: t('verifyTitle') };
}

export default async function VerifyPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const sp = await searchParams;
  const rawPhone = sp.phone;
  const phone = Array.isArray(rawPhone) ? rawPhone[0] : rawPhone;

  if (!phone || !isValidE164(phone)) {
    redirect({ href: '/sign-in', locale });
  }

  const t = await getTranslations('Auth');

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-2 text-center">
        <h1 className="font-display text-3xl font-semibold tracking-tight">{t('verifyTitle')}</h1>
      </header>

      <VerifyForm phone={phone!} />

      <p className="text-center text-sm text-[color:var(--color-muted)]">
        <Link href="/sign-in" className="underline-offset-4 hover:underline">
          {t('changeNumber')}
        </Link>
      </p>
    </section>
  );
}
