import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import { Link } from '@/i18n/navigation';
import { AuthCard } from '@/components/auth/auth-card';
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

/**
 * Sign-in V4 — server component qui délègue à AuthCard (animation Motion
 * niveau B sobre) + SignInForm (logique client OTP request).
 *
 * Eyebrow "ÉTAPE 01 — IDENTITÉ" pour ancrer l'esthétique éditoriale et
 * signaler à l'utilisateur que c'est le premier pas d'un parcours guidé.
 */
export default async function SignInPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Auth');
  const tCommon = await getTranslations('Common');

  return (
    <AuthCard
      eyebrow="ÉTAPE 01 — IDENTITÉ"
      title={t('signInTitle')}
      description={t('signInDescription')}
      footer={
        <p className="text-center font-mono text-[10px] tracking-[0.24em] text-[color:var(--color-ink-500)] uppercase">
          <Link href="/" className="transition-colors hover:text-[color:var(--color-blush-700)]">
            ← {tCommon('back')}
          </Link>
        </p>
      }
    >
      <SignInForm />
    </AuthCard>
  );
}
