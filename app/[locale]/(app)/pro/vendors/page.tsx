import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { requireProContext } from '@/lib/pro/require-pro-context';
import { convexApi, getConvexServerClient } from '@/lib/auth/convex-server';
import { ProSidebarShell } from '@/components/pro/pro-sidebar-shell';
import { VendorsBoard } from '@/components/pro/vendors/vendors-board';
import { PlanRequiredBanner } from '@/components/pro/plan-required-banner';
import { PRO_TIER_LIMITS, orgHasActiveAccess } from '@/lib/payments/entitlements';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('ProPages');
  return { title: t('vendorsMetaTitle') };
}

export default async function ProVendorsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { sessionToken, org, user } = await requireProContext(locale);
  const tier = org.subscriptionTier ?? null;
  const cap = tier ? PRO_TIER_LIMITS[tier].vendorDirectoryCap : 25;
  const hasAccess = orgHasActiveAccess(org);

  const convex = getConvexServerClient();
  const [vendors, orgEvents, engagements] = await Promise.all([
    convex.query(convexApi.vendorsListByOrg, {
      organizationId: org._id,
      sessionToken,
    }),
    convex.query(convexApi.listOrgEvents, { organizationId: org._id, sessionToken }),
    convex.query(convexApi.vendorListEngagementsByOrg, {
      organizationId: org._id,
      sessionToken,
    }),
  ]);

  const events = orgEvents.map((e) => ({
    _id: e._id,
    label: `${e.coupleNames.partnerA}${e.coupleNames.partnerB ? ` & ${e.coupleNames.partnerB}` : ''}`,
  }));

  return (
    <ProSidebarShell
      current="vendors"
      org={{ name: org.name, primaryColor: org.primaryColor, tier, role: org.myRole }}
      user={{ name: user?.fullName }}
    >
      {!hasAccess ? (
        <div className="container-page pt-8">
          <PlanRequiredBanner feature="l’annuaire prestataires" />
        </div>
      ) : null}
      <VendorsBoard
        vendors={vendors}
        canWrite={org.myRole !== 'viewer'}
        cap={cap}
        events={events}
        engagements={engagements}
      />
    </ProSidebarShell>
  );
}
