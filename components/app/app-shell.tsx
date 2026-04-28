import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { LogOut } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { signOutAction } from '@/app/[locale]/(auth)/actions';

/**
 * AppShell V4 — header sticky réutilisable pour toutes les pages app
 * authenticated (dashboard, events/*, etc.).
 *
 * Pattern Linear / Mercury : brand gauche, nav éditoriale au centre (gérée
 * par les pages enfants via la prop nav), bouton sign-out discret droite.
 *
 * Server component pour préserver le SSR partout. Pas d'animations ici —
 * les pages enfants animent leur propre contenu.
 */
export interface AppShellProps {
  /** Contenu principal de la page. */
  children: ReactNode;
  /**
   * Nav optionnelle au centre du header (breadcrumb, tabs, etc.). Rendue
   * entre le brand et le user menu. Server-renderable.
   */
  nav?: ReactNode;
  /** Nom de l'utilisateur affiché en discret avant le bouton signOut. */
  userName?: string;
}

export function AppShell({ children, nav, userName }: AppShellProps) {
  const tCommon = useTranslations('Common');

  return (
    <div className="paper-grain flex min-h-screen flex-col bg-[color:var(--color-ivory-50)]">
      <header className="sticky top-0 z-30 border-b border-[color:var(--color-border)] bg-[color:var(--color-ivory-50)]/85 backdrop-blur supports-[backdrop-filter]:bg-[color:var(--color-ivory-50)]/65">
        <div className="container-page flex items-center justify-between gap-6 py-4">
          <div className="flex items-center gap-8">
            <Link
              href="/dashboard"
              className="font-display inline-flex items-center gap-2 text-xl tracking-tight text-[color:var(--color-ink-900)] italic"
            >
              <span
                aria-hidden
                className="inline-block h-2 w-2 rounded-full bg-[color:var(--color-gold-500)]"
              />
              {tCommon('appName')}
            </Link>
            {nav}
          </div>

          <div className="flex items-center gap-4">
            {userName ? (
              <span className="hidden font-mono text-[10px] tracking-[0.24em] text-[color:var(--color-ink-500)] uppercase sm:inline-block">
                {userName}
              </span>
            ) : null}
            <form action={signOutAction}>
              <button
                type="submit"
                className="focus-ring inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-[color:var(--color-ink-700)] transition-colors hover:bg-[color:var(--color-ivory-100)] hover:text-[color:var(--color-ink-900)]"
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
