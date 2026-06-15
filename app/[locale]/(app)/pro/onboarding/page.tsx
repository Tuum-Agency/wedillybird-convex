import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { getSession } from '@/lib/auth/session';
import { convexApi, getConvexServerClient } from '@/lib/auth/convex-server';
import { ProShell } from '@/components/pro/pro-shell';
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
  const tp = await getTranslations('ProPages');

  return (
    <ProShell userName={user!.fullName}>
      <div className="container-page mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-8 py-16">
        <header className="flex flex-col items-center gap-3 text-center">
          <span className="font-mono text-[10px] tracking-[0.32em] text-[color:var(--color-blush-300)] uppercase">
            {tp('onboardingEyebrow')}
          </span>
          <h1
            className="font-display text-balance italic"
            style={{
              fontSize: 'clamp(1.875rem, 3.5vw, 2.5rem)',
              lineHeight: 1.05,
              letterSpacing: '-0.022em',
              color: 'var(--color-foreground)',
            }}
          >
            {t('onboardingTitle')}
          </h1>
          <p className="text-sm leading-relaxed text-[color:var(--color-muted-foreground)] sm:text-base">
            {t('onboardingSubtitle')}
          </p>
        </header>
        <OrgOnboardingForm />
      </div>
    </ProShell>
  );
}
