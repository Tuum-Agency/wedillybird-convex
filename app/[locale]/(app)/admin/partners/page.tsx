import { setRequestLocale } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { getSession } from '@/lib/auth/session';
import { convexApi, getConvexServerClient } from '@/lib/auth/convex-server';
import { AdminShell } from '@/components/admin/admin-shell';
import { AdminPartnersBoard } from '@/components/admin/admin-partners-board';
import { adminListPartnersAction } from '@/app/[locale]/(app)/admin/actions';

export default async function AdminPartnersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await getSession();
  if (!session) redirect({ href: '/sign-in', locale });

  const convex = getConvexServerClient();
  const [user, partners] = await Promise.all([
    convex.query(convexApi.currentUser, { userId: session!.userId }),
    adminListPartnersAction(),
  ]);

  return (
    <AdminShell current="partners" adminName={user?.fullName}>
      <div className="flex flex-col gap-6">
        <header>
          <h1
            className="font-display italic"
            style={{
              fontSize: 'clamp(1.5rem, 3vw, 2rem)',
              lineHeight: 1.1,
              letterSpacing: '-0.022em',
            }}
          >
            Partenaires &amp; affiliation
          </h1>
          <p className="mt-1 text-sm text-[color:var(--color-muted-foreground)]">
            Influenceuses partenaires : code promo pour leur communauté, commission sur chaque vente
            attribuée, et versement automatisé via Stripe.
          </p>
        </header>

        {partners.ok ? (
          <AdminPartnersBoard
            influencers={partners.influencers}
            commissions={partners.commissions}
          />
        ) : (
          <div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6 text-sm text-[color:var(--color-muted-foreground)]">
            Impossible de charger les partenaires ({partners.error}).
          </div>
        )}
      </div>
    </AdminShell>
  );
}
