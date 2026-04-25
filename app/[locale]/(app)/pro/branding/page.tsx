import { setRequestLocale } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { getSession } from '@/lib/auth/session';
import { convexApi, getConvexServerClient } from '@/lib/auth/convex-server';
import { BrandingForm } from '@/components/pro/branding-form';

export const dynamic = 'force-dynamic';

export default async function ProBrandingPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string; code?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await getSession();
  if (!session) redirect({ href: '/sign-in', locale });

  const convex = getConvexServerClient();
  const org = await convex.query(convexApi.myOrganization, { userId: session!.userId });
  if (!org) redirect({ href: '/pro/onboarding', locale });

  const sp = await searchParams;
  const banner =
    sp.status === 'saved'
      ? { kind: 'success' as const, text: 'Branding enregistré.' }
      : sp.status === 'error'
        ? { kind: 'error' as const, text: `Erreur: ${sp.code ?? 'unknown'}.` }
        : null;

  return (
    <main className="container-page flex flex-1 flex-col gap-8 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Branding</h1>
        <p className="text-sm text-[color:var(--color-muted)]">
          Personnalisez les couleurs et le logo affichés aux invités sur les pages publiques de{' '}
          <strong>{org!.name}</strong>.
        </p>
      </header>

      {banner ? (
        <div
          role="status"
          className={
            banner.kind === 'success'
              ? 'rounded-xl border border-[color:var(--color-accent)] bg-[color:var(--color-accent)]/10 px-4 py-3 text-sm'
              : 'rounded-xl border border-[color:var(--color-destructive)] bg-[color:var(--color-destructive)]/10 px-4 py-3 text-sm'
          }
        >
          {banner.text}
        </div>
      ) : null}

      <BrandingForm
        initialPrimary={org!.primaryColor}
        initialAccent={org!.accentColor}
        initialLogoUrl={org!.logoUrl}
        organizationName={org!.name}
      />
    </main>
  );
}
