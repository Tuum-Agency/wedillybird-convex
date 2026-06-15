import { setRequestLocale } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { getSession } from '@/lib/auth/session';
import { convexApi, getConvexServerClient } from '@/lib/auth/convex-server';
import { AdminShell } from '@/components/admin/admin-shell';
import { AdminPromotionsBoard } from '@/components/admin/admin-promotions-board';
import { adminListPromotionsAction } from '@/app/[locale]/(app)/admin/actions';

export default async function AdminPromotionsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await getSession();
  if (!session) redirect({ href: '/sign-in', locale });

  const convex = getConvexServerClient();
  const [user, promos, orgs] = await Promise.all([
    convex.query(convexApi.currentUser, { userId: session!.userId }),
    adminListPromotionsAction(),
    convex.query(convexApi.adminListAllOrganizations, { adminId: session!.userId }),
  ]);

  // Seules les orgs avec un abonnement Stripe peuvent recevoir une remise directe.
  const subscribedOrgs = orgs
    .filter((o) => o.hasStripeSubscription)
    .map((o) => ({
      _id: o._id,
      name: o.name,
      subscriptionTier: o.subscriptionTier,
      subscriptionStatus: o.subscriptionStatus,
    }));

  return (
    <AdminShell current="promotions" adminName={user?.fullName}>
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
            Promotions &amp; remises
          </h1>
          <p className="mt-1 text-sm text-[color:var(--color-muted-foreground)]">
            Coupons, codes promo et gestes commerciaux — pour les forfaits couples comme pour les
            abonnements pros.
          </p>
        </header>

        {promos.ok ? (
          <AdminPromotionsBoard
            coupons={promos.coupons}
            promoCodes={promos.promoCodes}
            subscribedOrgs={subscribedOrgs}
          />
        ) : (
          <div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6 text-sm text-[color:var(--color-muted-foreground)]">
            Impossible de charger les promotions Stripe ({promos.error}). Vérifie que
            <code className="mx-1 font-mono">STRIPE_SECRET_KEY</code> est configurée.
          </div>
        )}
      </div>
    </AdminShell>
  );
}
