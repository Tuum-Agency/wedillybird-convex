import { setRequestLocale } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { getSession } from '@/lib/auth/session';
import { convexApi, getConvexServerClient, sessionTokenArg } from '@/lib/auth/convex-server';
import { AdminShell } from '@/components/admin/admin-shell';
import { AdminPhotoBooksTable } from '@/components/admin/admin-photo-books-table';

export default async function AdminPhotoBooksPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await getSession();
  if (!session) redirect({ href: '/sign-in', locale });

  const sessionToken = await sessionTokenArg();
  const convex = getConvexServerClient();
  const [user, orders] = await Promise.all([
    convex.query(convexApi.currentUser, { sessionToken }),
    convex.query(convexApi.adminListPhotoBookOrders, { sessionToken }),
  ]);

  const pending = orders.filter((o) => o.status === 'requested' || o.status === 'in_production');

  return (
    <AdminShell current="photo-books" adminName={user?.fullName}>
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
            Livres photo
          </h1>
          <p className="mt-1 text-sm text-[color:var(--color-muted-foreground)]">
            {orders.length} commande{orders.length > 1 ? 's' : ''} · {pending.length} à traiter.
            Fabrication et expédition manuelles — faites évoluer le statut au fil de la commande.
          </p>
        </header>
        <AdminPhotoBooksTable orders={orders} />
      </div>
    </AdminShell>
  );
}
