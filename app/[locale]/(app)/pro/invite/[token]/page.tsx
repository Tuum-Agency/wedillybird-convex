import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link, redirect } from '@/i18n/navigation';
import { getSession } from '@/lib/auth/session';
import { AcceptInviteForm } from '@/components/pro/accept-invite-form';

export default async function AcceptInvitePage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}) {
  const { locale, token } = await params;
  setRequestLocale(locale);

  const session = await getSession();
  if (!session) {
    redirect({
      href: `/sign-in?next=${encodeURIComponent(`/pro/invite/${token}`)}`,
      locale,
    });
  }

  const t = await getTranslations('Pro');

  return (
    <main className="container-page flex flex-1 flex-col items-center justify-center gap-6 py-16">
      <div className="flex w-full max-w-md flex-col gap-6 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6">
        <header className="flex flex-col gap-2 text-center">
          <h1 className="font-display text-2xl font-semibold tracking-tight">{t('acceptTitle')}</h1>
          <p className="text-sm text-[color:var(--color-muted)]">{t('acceptSubtitle')}</p>
        </header>
        <AcceptInviteForm token={token} />
        <Link
          href="/dashboard"
          className="text-center text-xs text-[color:var(--color-muted)] hover:underline"
        >
          {t('declineInvite')}
        </Link>
      </div>
    </main>
  );
}
