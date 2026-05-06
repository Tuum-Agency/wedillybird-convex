import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { LogOut } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { signOutAction } from '@/app/[locale]/(auth)/actions';
import { LocaleSwitcher } from '@/components/layout/locale-switcher';
import { WedillybirdLogo } from '@/components/brand/wedillybird-logo';

/**
 * ProShell V4 — header sticky dark Linear-grade pour la zone pro.
 *
 * Pattern Linear / Mercury / Cron : bordure subtile, density élevée, accents
 * gold pour la signature de marque, branding agence si défini en prop.
 *
 * Le wrapper racine applique `data-theme="dark"` qui override les tokens
 * sémantiques de globals.css (background charbon, foreground ivoire, etc.).
 *
 * Server component pour préserver le SSR partout. Pas d'animations ici — les
 * pages enfants animent leur propre contenu (animations niveau B sobre).
 */
export interface ProShellProps {
  children: ReactNode;
  /** Nav éditoriale au centre (tabs entre dashboard/team/billing). */
  nav?: ReactNode;
  /** Nom de l'organisation (affiché en place du brand Wedillybird). */
  orgName?: string;
  /** Couleur primaire de l'org pour la pastille brand. */
  orgPrimaryColor?: string;
  /** Nom de l'utilisateur connecté affiché avant le sign-out. */
  userName?: string;
}

export function ProShell({ children, nav, orgName, orgPrimaryColor, userName }: ProShellProps) {
  const tCommon = useTranslations('Common');
  const dotColor = orgPrimaryColor ?? 'var(--color-gold-500)';

  return (
    <div
      data-theme="dark"
      className="flex min-h-screen flex-col bg-[color:var(--color-background)] text-[color:var(--color-foreground)]"
    >
      <header className="sticky top-0 z-30 border-b border-[color:var(--color-border)] bg-[color:var(--color-background)]/85 backdrop-blur supports-[backdrop-filter]:bg-[color:var(--color-background)]/65">
        <div className="container-page flex items-center justify-between gap-6 py-4">
          <div className="flex items-center gap-8">
            {orgName ? (
              <Link
                href="/pro/dashboard"
                className="font-display inline-flex items-center gap-2 text-xl tracking-tight text-[color:var(--color-foreground)] italic"
              >
                <span
                  aria-hidden
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: dotColor }}
                />
                {orgName}
              </Link>
            ) : (
              <Link
                href="/pro/dashboard"
                className="focus-ring inline-flex items-center [filter:brightness(0)_invert(1)]"
                aria-label={tCommon('appName')}
              >
                <WedillybirdLogo />
              </Link>
            )}
            {nav}
          </div>

          <div className="flex items-center gap-3">
            {userName ? (
              <span className="hidden font-mono text-[10px] tracking-[0.24em] text-[color:var(--color-muted-foreground)] uppercase sm:inline-block">
                {userName}
              </span>
            ) : null}
            <LocaleSwitcher />
            <span aria-hidden className="hidden h-5 w-px bg-[color:var(--color-border)] sm:block" />
            <form action={signOutAction}>
              <button
                type="submit"
                className="focus-ring inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-[color:var(--color-muted-foreground)] transition-colors hover:bg-[color:var(--color-surface-elevated)] hover:text-[color:var(--color-foreground)]"
                aria-label={tCommon('signOut')}
              >
                <LogOut className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                <span className="hidden sm:inline">{tCommon('signOut')}</span>
              </button>
            </form>
          </div>
        </div>
      </header>

      <main id="main-content" className="flex-1" tabIndex={-1}>
        {children}
      </main>
    </div>
  );
}

/**
 * ProNav — tabs éditoriales pour la nav du header pro. À passer en `nav` prop
 * de ProShell. Active state via comparaison du pathname côté serveur.
 */
export interface ProNavProps {
  current: 'dashboard' | 'team' | 'billing' | 'settings';
}

export function ProNav({ current }: ProNavProps) {
  const t = useTranslations('Pro');
  const tabs: Array<{
    key: ProNavProps['current'];
    href: '/pro/dashboard' | '/pro/team' | '/pro/billing' | '/pro/settings';
    label: string;
  }> = [
    { key: 'dashboard', href: '/pro/dashboard', label: t('nav.dashboard') },
    { key: 'team', href: '/pro/team', label: t('nav.team') },
    { key: 'billing', href: '/pro/billing', label: t('nav.billing') },
    { key: 'settings', href: '/pro/settings', label: t('nav.settings') },
  ];
  return (
    <nav aria-label="Navigation pro" className="hidden items-center gap-7 md:flex">
      {tabs.map((tab) => {
        const active = tab.key === current;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            className={
              active
                ? 'font-mono text-[10px] tracking-[0.24em] text-[color:var(--color-foreground)] uppercase'
                : 'font-mono text-[10px] tracking-[0.24em] text-[color:var(--color-muted-foreground)] uppercase transition-colors hover:text-[color:var(--color-foreground)]'
            }
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
