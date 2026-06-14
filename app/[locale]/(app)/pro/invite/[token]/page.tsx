import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Mail } from 'lucide-react';
import { Link, redirect } from '@/i18n/navigation';
import { getSession } from '@/lib/auth/session';
import { ProShell } from '@/components/pro/pro-shell';
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
  const tp = await getTranslations('ProPages');

  return (
    <ProShell>
      <div className="container-page mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-8 py-16">
        <span
          className="flex h-14 w-14 items-center justify-center rounded-full bg-[color:var(--color-surface-elevated)] text-[color:var(--color-blush-300)] shadow-[var(--shadow-soft)]"
          aria-hidden
        >
          <Mail className="h-6 w-6" strokeWidth={1.75} />
        </span>
        <header className="flex flex-col items-center gap-3 text-center">
          <span className="font-mono text-[10px] tracking-[0.32em] text-[color:var(--color-blush-300)] uppercase">
            {tp('inviteEyebrow')}
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
            {t('acceptTitle')}
          </h1>
          <p className="text-sm leading-relaxed text-[color:var(--color-muted-foreground)] sm:text-base">
            {t('acceptSubtitle')}
          </p>
        </header>
        <div className="w-full rounded-3xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-7 shadow-[var(--shadow-soft)]">
          <AcceptInviteForm token={token} />
        </div>
        <Link
          href="/dashboard"
          className="font-mono text-[10px] tracking-[0.32em] text-[color:var(--color-muted-foreground)] uppercase transition-colors hover:text-[color:var(--color-foreground)]"
        >
          {t('declineInvite')}
        </Link>
      </div>
    </ProShell>
  );
}
