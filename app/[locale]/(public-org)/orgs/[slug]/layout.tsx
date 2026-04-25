import type { CSSProperties, ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { convexApi, getConvexServerClient } from '@/lib/auth/convex-server';

export const dynamic = 'force-dynamic';

export default async function PublicOrgLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const convex = getConvexServerClient();
  const org = await convex.query(convexApi.getOrgBySlug, { slug });
  if (!org) notFound();

  const themeStyle = {
    '--color-primary': org.primaryColor ?? 'var(--color-primary)',
    '--color-accent': org.accentColor ?? 'var(--color-accent)',
  } as CSSProperties;

  return (
    <div style={themeStyle} className="flex min-h-screen flex-col">
      <header className="border-b border-[color:var(--color-border)] bg-[color:var(--color-surface)]">
        <div className="container-page flex items-center gap-4 py-4">
          {org.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={org.logoUrl}
              alt={org.name}
              className="h-12 w-auto object-contain"
              data-testid="org-logo"
            />
          ) : null}
          <span className="font-display text-lg font-semibold">{org.name}</span>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-[color:var(--color-border)] py-6 text-center text-xs text-[color:var(--color-muted)]">
        Propulsé par <span className="font-display font-semibold">Wedillybird</span>
      </footer>
    </div>
  );
}
