import { setRequestLocale } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { getSession } from '@/lib/auth/session';
import { convexApi, getConvexServerClient, sessionTokenArg } from '@/lib/auth/convex-server';
import { AdminShell } from '@/components/admin/admin-shell';
import { AdminNewsletterTable } from '@/components/admin/admin-newsletter-table';
import { AdminNewsletterComposer } from '@/components/admin/admin-newsletter-composer';
import { adminListNewsletterCampaignsAction } from '@/app/[locale]/(app)/admin/actions';

export default async function AdminNewsletterPage({
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
  const [user, subscribers, campaignsResult] = await Promise.all([
    convex.query(convexApi.currentUser, { sessionToken }),
    convex.query(convexApi.adminListNewsletterSubscribers, { sessionToken }),
    adminListNewsletterCampaignsAction(),
  ]);

  const active = subscribers.filter((s) => s.status === 'active').length;
  const campaigns = campaignsResult.ok ? campaignsResult.campaigns : [];

  return (
    <AdminShell current="newsletter" adminName={user?.fullName}>
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
            Newsletter
          </h1>
          <p className="mt-1 text-sm text-[color:var(--color-muted-foreground)]">
            {active} abonnés actifs sur {subscribers.length} total
          </p>
        </header>
        <AdminNewsletterComposer activeCount={active} campaigns={campaigns} />
        <AdminNewsletterTable subscribers={subscribers} />
      </div>
    </AdminShell>
  );
}
