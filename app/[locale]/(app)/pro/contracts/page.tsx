import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { FileSignature } from 'lucide-react';
import { requireProContext } from '@/lib/pro/require-pro-context';
import { convexApi, getConvexServerClient } from '@/lib/auth/convex-server';
import { ProSidebarShell } from '@/components/pro/pro-sidebar-shell';
import { ModulePlaceholder } from '@/components/pro/module-placeholder';
import { ContractsBoard } from '@/components/pro/contracts/contracts-board';
import { tierHasFeature } from '@/lib/payments/entitlements';

export const metadata: Metadata = { title: 'Contrats — Wedillybird Pro' };

export default async function ProContractsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { session, org, user } = await requireProContext(locale);
  const tier = org.subscriptionTier ?? null;
  const locked = !tierHasFeature(tier, 'documentsEsign');
  const shellOrg = { name: org.name, primaryColor: org.primaryColor, tier, role: org.myRole };

  if (locked) {
    return (
      <ProSidebarShell current="contracts" org={shellOrg} user={{ name: user?.fullName }}>
        <ModulePlaceholder
          eyebrow="Finances"
          title="Contrats"
          Icon={FileSignature}
          description="Modèles de contrats, signature électronique et suivi du cycle de vie — du devis accepté au contrat signé."
          capabilities={[
            'Modèles de contrats réutilisables',
            'Signature électronique du couple',
            'Suivi des statuts (envoyé, signé, contre-signé, actif)',
            'Rattachement au mariage et au devis',
            'Journal d’audit horodaté',
          ]}
          lockedUntil="business"
        />
      </ProSidebarShell>
    );
  }

  const convex = getConvexServerClient();
  const data = await convex.query(convexApi.contractsListByOrg, {
    organizationId: org._id,
    requesterId: session.userId,
  });
  const canWrite = org.myRole !== 'viewer';

  return (
    <ProSidebarShell current="contracts" org={shellOrg} user={{ name: user?.fullName }}>
      <ContractsBoard
        initialContracts={data.contracts}
        clients={data.clients}
        weddings={data.weddings}
        organizationId={org._id}
        orgName={org.name}
        plannerName={user?.fullName ?? org.name}
        brandColor={org.primaryColor ?? 'oklch(48% 0.085 22)'}
        canWrite={canWrite}
      />
    </ProSidebarShell>
  );
}
