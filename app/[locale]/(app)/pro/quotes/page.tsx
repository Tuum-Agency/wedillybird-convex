import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { FileText } from 'lucide-react';
import { requireProContext } from '@/lib/pro/require-pro-context';
import { convexApi, getConvexServerClient } from '@/lib/auth/convex-server';
import { ProSidebarShell } from '@/components/pro/pro-sidebar-shell';
import { ModulePlaceholder } from '@/components/pro/module-placeholder';
import { QuotesBoard } from '@/components/pro/quotes/quotes-board';
import { tierHasFeature } from '@/lib/payments/entitlements';

export const metadata: Metadata = { title: 'Devis & Factures — Wedillybird Pro' };

export default async function ProQuotesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { session, org, user } = await requireProContext(locale);
  const tier = org.subscriptionTier ?? null;
  const locked = !tierHasFeature(tier, 'documentsEsign');

  const shellOrg = { name: org.name, primaryColor: org.primaryColor, tier, role: org.myRole };

  if (locked) {
    return (
      <ProSidebarShell current="quotes" org={shellOrg} user={{ name: user?.fullName }}>
        <ModulePlaceholder
          eyebrow="Finances"
          title="Devis & Factures"
          Icon={FileText}
          description="Émettez des devis et des factures à vos couples, suivez les acomptes et soldes, relancez en un clic — le tout depuis le back-office."
          capabilities={[
            'Devis et factures numérotés (DEV-/FAC-), PDF de marque',
            'Lignes, remises, TVA optionnelle, totaux automatiques',
            'Échéancier acompte + solde, suivi payé / restant',
            'Conversion d’un devis accepté en facture',
            'Statuts (envoyé, accepté, payé, en retard) et relances',
            'Historique d’activité par document',
          ]}
          lockedUntil="business"
        />
      </ProSidebarShell>
    );
  }

  const convex = getConvexServerClient();
  const [data, connect] = await Promise.all([
    convex.query(convexApi.quotesListByOrg, {
      organizationId: org._id,
      requesterId: session.userId,
    }),
    convex.query(convexApi.orgConnectStatus, {
      organizationId: org._id,
      requesterId: session.userId,
    }),
  ]);

  const canWrite = org.myRole !== 'viewer';
  const connected = connect.accountId != null;

  return (
    <ProSidebarShell current="quotes" org={shellOrg} user={{ name: user?.fullName }}>
      <QuotesBoard
        initialDocs={data.docs}
        clients={data.clients}
        weddings={data.weddings}
        organizationId={org._id}
        canWrite={canWrite}
        connected={connected}
      />
    </ProSidebarShell>
  );
}
