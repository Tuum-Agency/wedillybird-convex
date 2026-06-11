import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { Plug, Zap, Code2, Workflow, ArrowDownToLine } from 'lucide-react';
import { requireProContext } from '@/lib/pro/require-pro-context';
import { convexApi, getConvexServerClient } from '@/lib/auth/convex-server';
import { ProSidebarShell } from '@/components/pro/pro-sidebar-shell';
import { ModulePlaceholder } from '@/components/pro/module-placeholder';
import { CsvImport } from '@/components/pro/integrations/csv-import';
import { tierHasFeature } from '@/lib/payments/entitlements';

export const metadata: Metadata = { title: 'Intégrations — Wedillybird Pro' };

const CONNECTORS: ReadonlyArray<{ name: string; desc: string; Icon: typeof Zap }> = [
  {
    name: 'HoneyBook',
    desc: 'Synchronisation entrante de vos projets (lecture seule).',
    Icon: ArrowDownToLine,
  },
  { name: 'Zapier / Make', desc: 'Automatisez vos flux avec 6 000+ applications.', Icon: Workflow },
  {
    name: 'API & Webhooks',
    desc: 'Clé API, événements sortants, payloads signés HMAC.',
    Icon: Code2,
  },
];

export default async function ProIntegrationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { session, org, user } = await requireProContext(locale);
  const tier = org.subscriptionTier ?? null;
  const canImport = tierHasFeature(tier, 'crmPipeline'); // Business+
  const shellOrg = { name: org.name, primaryColor: org.primaryColor, tier, role: org.myRole };

  if (!canImport) {
    return (
      <ProSidebarShell current="integrations" org={shellOrg} user={{ name: user?.fullName }}>
        <ModulePlaceholder
          eyebrow="Pilotage"
          title="Intégrations CRM"
          Icon={Plug}
          description="Gardez le CRM que vous utilisez déjà. Wedillybird gère l’exécution du mariage et se synchronise avec votre outil."
          capabilities={[
            'Import CSV de clients avec mapping de colonnes et doublons',
            'Connecteurs HoneyBook, Zapier / Make, API & Webhooks',
            'Synchronisation entrante (votre CRM → Wedillybird, lecture seule)',
            'Mode « j’utilise mon propre CRM » qui masque le pipeline natif',
            'Journal de synchronisation idempotent avec relance des échecs',
          ]}
          lockedUntil="business"
        />
      </ProSidebarShell>
    );
  }

  const convex = getConvexServerClient();
  const clients = await convex.query(convexApi.clientsListByOrg, {
    organizationId: org._id,
    requesterId: session.userId,
  });
  const existingNames = clients.map((c) => c.partnerA);

  return (
    <ProSidebarShell current="integrations" org={shellOrg} user={{ name: user?.fullName }}>
      <div className="container-page flex flex-col gap-6 py-8 sm:py-10">
        <header className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] tracking-[0.32em] text-[color:var(--color-muted-foreground)] uppercase">
            Pilotage · Intégrations
          </span>
          <h1
            className="font-display italic"
            style={{
              fontSize: 'clamp(1.9rem, 4vw, 2.75rem)',
              lineHeight: 1.05,
              letterSpacing: '-0.022em',
              color: 'var(--color-foreground)',
            }}
          >
            Intégrations
          </h1>
        </header>

        <CsvImport existingNames={existingNames} />

        {/* Connecteurs (roadmap — nécessitent des identifiants externes) */}
        <section className="flex flex-col gap-3">
          <h2 className="font-mono text-[10px] tracking-[0.16em] text-[color:var(--color-muted-foreground)] uppercase">
            Connecteurs
          </h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {CONNECTORS.map((c) => (
              <div
                key={c.name}
                className="flex flex-col gap-2 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4"
              >
                <span className="flex items-center justify-between">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[color:var(--color-surface-elevated)] text-[color:var(--color-blush-300)]">
                    <c.Icon className="h-[18px] w-[18px]" strokeWidth={1.8} aria-hidden />
                  </span>
                  <span className="rounded-full border border-[color:var(--color-border)] px-2 py-0.5 font-mono text-[9px] tracking-[0.14em] text-[color:var(--color-muted-foreground)] uppercase">
                    Bientôt
                  </span>
                </span>
                <span className="font-medium text-[color:var(--color-foreground)]">{c.name}</span>
                <span className="text-xs text-[color:var(--color-muted-foreground)]">{c.desc}</span>
              </div>
            ))}
          </div>
          <p className="font-mono text-[10px] text-[color:var(--color-muted-foreground)]">
            Les connecteurs externes arrivent ; l’import CSV est disponible dès maintenant.
          </p>
        </section>
      </div>
    </ProSidebarShell>
  );
}
