import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { getSession } from '@/lib/auth/session';
import { convexApi, getConvexServerClient } from '@/lib/auth/convex-server';
import { OrgOnboardingForm } from '@/components/pro/org-onboarding-form';

export default async function ProOnboardingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await getSession();
  if (!session) redirect({ href: '/sign-in', locale });

  const convex = getConvexServerClient();
  const existing = await convex.query(convexApi.myOrganization, {
    userId: session!.userId,
  });
  if (existing) redirect({ href: '/pro/dashboard', locale });

  const user = await convex.query(convexApi.currentUser, { userId: session!.userId });
  if (!user || (user.role !== 'pro' && user.role !== 'admin')) {
    redirect({ href: '/dashboard', locale });
  }

  const t = await getTranslations('Pro');

  return (
    <main className="container-page flex flex-1 flex-col items-center justify-center gap-6 py-16">
      <div className="flex w-full max-w-md flex-col gap-6">
        <header className="flex flex-col gap-2 text-center">
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            {t('onboardingTitle')}
          </h1>
          <p className="text-sm text-[color:var(--color-muted)]">{t('onboardingSubtitle')}</p>
        </header>
        <OrgOnboardingForm />
      </div>
    </main>
  );
}
