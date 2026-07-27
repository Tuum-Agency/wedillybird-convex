'use client';

import { useState, type ReactNode } from 'react';
import {
  LayoutDashboard,
  BarChart3,
  Megaphone,
  Users,
  CalendarDays,
  CreditCard,
  FileText,
  Building2,
  Ticket,
  Handshake,
  Shield,
  Mail,
  ScrollText,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { signOutAction } from '@/app/[locale]/(auth)/actions';
import { cn } from '@/lib/cn';
import { ThemeProvider } from '@/components/ui/theme-provider';

const NAV_ITEMS = [
  { key: 'overview', href: '/admin', icon: LayoutDashboard, labelKey: 'nav.overview' },
  { key: 'analytics', href: '/admin/analytics', icon: BarChart3, labelKey: 'nav.analytics' },
  { key: 'acquisition', href: '/admin/acquisition', icon: Megaphone, labelKey: 'nav.acquisition' },
  { key: 'users', href: '/admin/users', icon: Users, labelKey: 'nav.users' },
  { key: 'events', href: '/admin/events', icon: CalendarDays, labelKey: 'nav.events' },
  { key: 'payments', href: '/admin/payments', icon: CreditCard, labelKey: 'nav.payments' },
  { key: 'invoices', href: '/admin/invoices', icon: FileText, labelKey: 'nav.invoices' },
  {
    key: 'subscriptions',
    href: '/admin/subscriptions',
    icon: Building2,
    labelKey: 'nav.subscriptions',
  },
  { key: 'promotions', href: '/admin/promotions', icon: Ticket, labelKey: 'nav.promotions' },
  { key: 'partners', href: '/admin/partners', icon: Handshake, labelKey: 'nav.partners' },
  { key: 'moderation', href: '/admin/moderation', icon: Shield, labelKey: 'nav.moderation' },
  { key: 'newsletter', href: '/admin/newsletter', icon: Mail, labelKey: 'nav.newsletter' },
  { key: 'audit-log', href: '/admin/audit-log', icon: ScrollText, labelKey: 'nav.auditLog' },
] as const;

export type AdminSection = (typeof NAV_ITEMS)[number]['key'];

export interface AdminShellProps {
  children: ReactNode;
  current: AdminSection;
  adminName?: string;
}

/**
 * Shell du back-office admin (dark). Sidebar fixe ≥ md ; sur mobile elle devient
 * un tiroir (Radix Dialog latéral) déclenché depuis une barre supérieure — sinon
 * les 240px de rail écrasaient le contenu à ~135px sur téléphone.
 */
export function AdminShell({ children, current, adminName }: AdminShellProps) {
  const t = useTranslations('Admin');
  const [open, setOpen] = useState(false);

  const renderNav = (onNavigate?: () => void) => (
    <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-4">
      {NAV_ITEMS.map((item) => {
        const active = item.key === current;
        const Icon = item.icon;
        return (
          <Link
            key={item.key}
            href={item.href as never}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
              active
                ? 'bg-[color:var(--color-surface-elevated)] text-[color:var(--color-foreground)]'
                : 'text-[color:var(--color-muted-foreground)] hover:bg-[color:var(--color-surface-elevated)] hover:text-[color:var(--color-foreground)]',
            )}
          >
            <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
            {t(item.labelKey)}
          </Link>
        );
      })}
    </nav>
  );

  const renderBrand = () => (
    <div className="flex items-center gap-2 px-5 py-4">
      <span
        aria-hidden
        className="inline-block h-2 w-2 rounded-full"
        style={{ background: 'oklch(65% 0.15 22)' }}
      />
      <span className="font-display text-lg tracking-tight italic">{t('shell.brand')}</span>
    </div>
  );

  const renderFooter = () => (
    <div className="border-t border-[color:var(--color-border)] px-3 py-4">
      {adminName ? (
        <p className="mb-3 truncate px-3 font-mono text-[10px] tracking-[0.24em] text-[color:var(--color-muted-foreground)] uppercase">
          {adminName}
        </p>
      ) : null}
      <form action={signOutAction}>
        <button
          type="submit"
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-[color:var(--color-muted-foreground)] transition-colors hover:bg-[color:var(--color-surface-elevated)] hover:text-[color:var(--color-foreground)]"
        >
          <LogOut className="h-4 w-4 shrink-0" strokeWidth={1.75} />
          {t('shell.signOut')}
        </button>
      </form>
    </div>
  );

  return (
    <ThemeProvider theme="dark">
      <div
        data-theme="dark"
        className="flex min-h-screen bg-[color:var(--color-background)] text-[color:var(--color-foreground)]"
      >
        {/* Sidebar desktop */}
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-[color:var(--color-border)] bg-[color:var(--color-background)] md:flex">
          <div className="border-b border-[color:var(--color-border)]">{renderBrand()}</div>
          {renderNav()}
          {renderFooter()}
        </aside>

        {/* Colonne contenu */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Barre supérieure mobile + tiroir */}
          <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-[color:var(--color-border)] bg-[color:var(--color-background)]/95 px-4 py-3 backdrop-blur md:hidden">
            <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
              <DialogPrimitive.Trigger
                aria-label="Ouvrir le menu"
                className="focus-ring inline-flex h-11 w-11 items-center justify-center rounded-lg border border-[color:var(--color-border)] text-[color:var(--color-foreground)] transition-colors hover:bg-[color:var(--color-surface-elevated)]"
              >
                <Menu className="h-5 w-5" strokeWidth={1.75} aria-hidden />
              </DialogPrimitive.Trigger>
              <DialogPrimitive.Portal>
                <DialogPrimitive.Overlay className="animate-fade-in fixed inset-0 z-50 bg-black/55 backdrop-blur-sm" />
                <DialogPrimitive.Content
                  data-theme="dark"
                  className="animate-fade-in fixed inset-y-0 left-0 z-50 flex w-[82vw] max-w-xs flex-col border-r border-[color:var(--color-border)] bg-[color:var(--color-background)] text-[color:var(--color-foreground)] shadow-[var(--shadow-popover)] focus:outline-none"
                >
                  <DialogPrimitive.Title className="sr-only">
                    {t('shell.brand')}
                  </DialogPrimitive.Title>
                  <div className="flex items-center justify-between border-b border-[color:var(--color-border)] pr-2">
                    {renderBrand()}
                    <DialogPrimitive.Close
                      aria-label="Fermer le menu"
                      className="focus-ring inline-flex h-11 w-11 items-center justify-center rounded-lg text-[color:var(--color-muted-foreground)] transition-colors hover:bg-[color:var(--color-surface-elevated)] hover:text-[color:var(--color-foreground)]"
                    >
                      <X className="h-5 w-5" strokeWidth={2} aria-hidden />
                    </DialogPrimitive.Close>
                  </div>
                  {renderNav(() => setOpen(false))}
                  {renderFooter()}
                </DialogPrimitive.Content>
              </DialogPrimitive.Portal>
            </DialogPrimitive.Root>
            <span className="font-display text-base tracking-tight italic">{t('shell.brand')}</span>
          </header>

          <main className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-10 lg:py-8">{children}</div>
          </main>
        </div>
      </div>
    </ThemeProvider>
  );
}
