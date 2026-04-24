import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import { redirect } from '@/i18n/navigation';
import { getSession } from '@/lib/auth/session';
import { convexApi, getConvexServerClient } from '@/lib/auth/convex-server';
import { OnboardingWizard } from '@/components/onboarding/onboarding-wizard';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Onboarding' });
  return { title: t('stepProfile') };
}

export default async function OnboardingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await getSession();
  if (!session) {
    redirect({ href: '/sign-in', locale });
  }

  const convex = getConvexServerClient();
  const user = await convex.query(convexApi.currentUser, { userId: session!.userId });

  if (user?.fullName && user.role && user.role !== 'guest') {
    redirect({ href: '/dashboard', locale });
  }

  return (
    <main className="container-page flex flex-1 items-center justify-center py-10">
      <div className="w-full max-w-md">
        <OnboardingWizard />
      </div>
    </main>
  );
}
