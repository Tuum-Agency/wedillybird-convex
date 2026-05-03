import type { ReactNode } from 'react';
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  CreditCard,
  Building2,
  Shield,
  Mail,
  ScrollText,
  LogOut,
} from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { signOutAction } from '@/app/[locale]/(auth)/actions';
import { cn } from '@/lib/cn';

const NAV_ITEMS = [
  { key: 'overview', href: '/admin', icon: LayoutDashboard, label: 'Vue d’ensemble' },
  { key: 'users', href: '/admin/users', icon: Users, label: 'Utilisateurs' },
  { key: 'events', href: '/admin/events', icon: CalendarDays, label: 'Événements' },
  { key: 'payments', href: '/admin/payments', icon: CreditCard, label: 'Paiements' },
  { key: 'subscriptions', href: '/admin/subscriptions', icon: Building2, label: 'Abonnements' },
  { key: 'moderation', href: '/admin/moderation', icon: Shield, label: 'Modération' },
  { key: 'newsletter', href: '/admin/newsletter', icon: Mail, label: 'Newsletter' },
  { key: 'audit-log', href: '/admin/audit-log', icon: ScrollText, label: 'Journal d’audit' },
] as const;

export type AdminSection = (typeof NAV_ITEMS)[number]['key'];

export interface AdminShellProps {
  children: ReactNode;
  current: AdminSection;
  adminName?: string;
}

export function AdminShell({ children, current, adminName }: AdminShellProps) {
  return (
    <div
      data-theme="dark"
      className="flex min-h-screen bg-[color:var(--color-background)] text-[color:var(--color-foreground)]"
    >
      <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-[color:var(--color-border)] bg-[color:var(--color-background)]">
        <div className="flex items-center gap-2 border-b border-[color:var(--color-border)] px-5 py-4">
          <span
            aria-hidden
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: 'oklch(65% 0.15 22)' }}
          />
          <span className="font-display text-lg tracking-tight italic">Admin</span>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-4">
          {NAV_ITEMS.map((item) => {
            const active = item.key === current;
            const Icon = item.icon;
            return (
              <Link
                key={item.key}
                href={item.href as never}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-[color:var(--color-surface-elevated)] text-[color:var(--color-foreground)]'
                    : 'text-[color:var(--color-muted-foreground)] hover:bg-[color:var(--color-surface-elevated)] hover:text-[color:var(--color-foreground)]',
                )}
              >
                <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-[color:var(--color-border)] px-3 py-4">
          {adminName ? (
            <p className="mb-3 truncate px-3 font-mono text-[10px] tracking-[0.24em] text-[color:var(--color-muted-foreground)] uppercase">
              {adminName}
            </p>
          ) : null}
          <form action={signOutAction}>
            <button
              type="submit"
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-[color:var(--color-muted-foreground)] transition-colors hover:bg-[color:var(--color-surface-elevated)] hover:text-[color:var(--color-foreground)]"
            >
              <LogOut className="h-4 w-4 shrink-0" strokeWidth={1.75} />
              Déconnexion
            </button>
          </form>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl px-6 py-8 lg:px-10">{children}</div>
      </main>
    </div>
  );
}
