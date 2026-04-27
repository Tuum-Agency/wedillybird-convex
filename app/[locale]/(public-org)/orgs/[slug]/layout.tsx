import type { CSSProperties, ReactNode } from 'react';
import Image from 'next/image';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { convexApi, getConvexServerClient } from '@/lib/auth/convex-server';

export const dynamic = 'force-dynamic';

/**
 * Layout multi-tenant — appliqué automatiquement à toutes les routes
 * `app/[locale]/(public-org)/orgs/[slug]/...`. Le proxy `proxy.ts`
 * rewrite `<slug>.wedillybird.com/<path>` vers `/orgs/<slug>/<path>` en
 * gardant l'URL utilisateur côté navigateur — donc le visiteur voit
 * toujours `<slug>.wedillybird.com` pendant que Next sert ce layout.
 *
 * Branding orga :
 *  - Le logo orga est rendu dans le header. Si absent, on bascule sur le
 *    wordmark Wedillybird textuel.
 *  - `primaryColor` / `accentColor` sont injectés en CSS custom
 *    properties (`--brand-primary`, `--brand-accent`) sur le `<div
 *    data-org-theme>`. Les composants enfants peuvent les utiliser via
 *    `color: var(--brand-primary, var(--color-primary))` pour rester
 *    fonctionnels même si l'orga n'override aucune couleur.
 *  - Footer rappelle systématiquement "Propulsé par Wedillybird".
 */
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
  const org = await convex.query(convexApi.findOrgBySlug, { slug });
  if (!org) notFound();

  const t = await getTranslations('OrgPublic');

  // Variables CSS — fallback sur les tokens Wedillybird par défaut quand
  // l'orga ne définit pas ses couleurs. Les composants enfants peuvent
  // y accéder via `var(--brand-primary, var(--color-primary))`.
  const themeStyle: CSSProperties = {};
  if (org.primaryColor) {
    (themeStyle as Record<string, string>)['--brand-primary'] = org.primaryColor;
  }
  if (org.accentColor) {
    (themeStyle as Record<string, string>)['--brand-accent'] = org.accentColor;
  }

  return (
    <div
      data-org-theme={org.slug}
      data-org-name={org.name}
      className="flex min-h-screen flex-col bg-[color:var(--color-background)] text-[color:var(--color-foreground)]"
      style={themeStyle}
    >
      <header className="border-b border-[color:var(--color-border)] bg-[color:var(--color-surface)]/80 backdrop-blur-md">
        <div className="container-page flex h-16 items-center justify-between gap-6">
          <Link
            href="/"
            className="focus-ring flex items-center gap-3 rounded-lg"
            aria-label={org.name}
          >
            {org.logoUrl ? (
              <Image
                src={org.logoUrl}
                alt={org.name}
                width={40}
                height={40}
                className="h-10 w-10 rounded-md object-cover"
                unoptimized
              />
            ) : (
              <span
                className="font-display text-xl italic"
                style={{ color: 'var(--brand-primary, var(--color-primary))' }}
              >
                {org.name}
              </span>
            )}
            <span className="font-display text-base text-[color:var(--color-ink-700)] italic">
              {org.name}
            </span>
          </Link>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-[color:var(--color-border)] bg-[color:var(--color-surface)]/60 py-6">
        <div className="container-page text-center">
          <p className="font-mono text-[10px] tracking-[0.32em] text-[color:var(--color-ink-500)] uppercase">
            {t('poweredBy')} ·{' '}
            <Link
              href="/"
              className="font-display normal-case italic underline-offset-4 hover:underline"
              style={{ letterSpacing: 0 }}
            >
              Wedillybird
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
