import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { Users } from 'lucide-react';
import { requireProContext } from '@/lib/pro/require-pro-context';
import { convexApi, getConvexServerClient } from '@/lib/auth/convex-server';
import { ProSidebarShell } from '@/components/pro/pro-sidebar-shell';
import { ModulePlaceholder } from '@/components/pro/module-placeholder';
import { ClientsBoard } from '@/components/pro/clients/clients-board';
import { tierHasFeature } from '@/lib/payments/entitlements';
import { nowMs } from '@/lib/pro/format';

export const metadata: Metadata = { title: 'Clients — Wedillybird Pro' };

export default async function ProClientsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ new?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const { session, org, user } = await requireProContext(locale);
  const tier = org.subscriptionTier ?? null;
  const locked = !tierHasFeature(tier, 'crmPipeline');

  const shellOrg = {
    name: org.name,
    primaryColor: org.primaryColor,
    tier,
    role: org.myRole,
  };

  if (locked) {
    return (
      <ProSidebarShell current="clients" org={shellOrg} user={{ name: user?.fullName }}>
        <ModulePlaceholder
          eyebrow="CRM"
          title="Clients"
          Icon={Users}
          description="Votre pipeline commercial : suivez chaque couple du premier contact à la livraison du mariage, sans quitter le back-office."
          capabilities={[
            'Pipeline 6 étapes : Lead → Contacté → Devis → Réservé → En cours → Livré',
            'Vue kanban drag-drop + table dense filtrable et triable',
            'Conversion d’un lead en mariage en un clic',
            'Sources de lead et timeline d’activité par client',
            'Actions groupées (changer de statut, assigner, supprimer)',
            'Fiche client : coordonnées, budget, notes, documents',
          ]}
          lockedUntil="business"
        />
      </ProSidebarShell>
    );
  }

  const convex = getConvexServerClient();
  const [clients, members] = await Promise.all([
    convex.query(convexApi.clientsListByOrg, {
      organizationId: org._id,
      requesterId: session.userId,
    }),
    convex.query(convexApi.listOrgMembers, {
      organizationId: org._id,
      requesterId: session.userId,
    }),
  ]);

  const memberOptions = members
    .filter((m) => m.status === 'active' && m.userId && m.fullName)
    .map((m) => ({ _id: m.userId as string, name: m.fullName as string }));

  const canWrite = org.myRole !== 'viewer';

  return (
    <ProSidebarShell current="clients" org={shellOrg} user={{ name: user?.fullName }}>
      <ClientsBoard
        initialClients={clients}
        members={memberOptions}
        canWrite={canWrite}
        now={nowMs()}
        autoCreate={sp.new === '1'}
      />
    </ProSidebarShell>
  );
}
