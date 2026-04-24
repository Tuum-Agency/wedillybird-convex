import type { ReactNode } from 'react';
import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-[color:var(--color-background)]">
      <AuthHeader />
      <main className="container-page flex flex-1 items-center justify-center py-10">
        <div className="w-full max-w-md">{children}</div>
      </main>
      <AuthFooter />
    </div>
  );
}

function AuthHeader() {
  const t = useTranslations('Common');
  return (
    <header className="container-page flex h-16 items-center justify-between">
      <Link
        href="/"
        className="font-display text-xl font-semibold tracking-tight text-[color:var(--color-foreground)]"
      >
        {t('appName')}
      </Link>
    </header>
  );
}

function AuthFooter() {
  const t = useTranslations('Auth');
  return (
    <footer className="container-page flex h-14 items-center justify-center text-xs text-[color:var(--color-muted)]">
      {t('privacy')}
    </footer>
  );
}
