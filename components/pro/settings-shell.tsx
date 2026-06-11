'use client';

import { useState } from 'react';
import {
  Building2,
  Palette,
  Plug,
  CreditCard,
  UserCircle,
  ArrowUpRight,
  ArrowRight,
  TriangleAlert,
  Bell,
  ShieldCheck,
  MessageSquare,
  UsersRound,
  Lock,
  type LucideIcon,
} from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/cn';
import { BrandingForm } from '@/components/pro/branding-form';
import { WhiteLabelForm } from '@/components/pro/white-label-form';
import { DangerZone } from '@/components/pro/danger-zone';
import { NotificationsForm, SecurityPanel } from '@/components/pro/notifications-form';
import { MessagingForm } from '@/components/pro/messaging-form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { NotifPrefs } from '@/lib/pro/notifications';
import type { MessagingDefaults } from '@/lib/pro/messaging-defaults';

type Section =
  | 'profil'
  | 'branding'
  | 'integrations'
  | 'messaging'
  | 'notifications'
  | 'security'
  | 'danger';

interface MemberOpt {
  userId?: string;
  fullName?: string;
  email?: string;
  role: 'owner' | 'admin' | 'planner' | 'viewer';
  status: 'pending' | 'active' | 'revoked';
}

const TIER_LABEL: Record<'starter' | 'business' | 'agency', string> = {
  starter: 'Starter',
  business: 'Business',
  agency: 'Agency',
};
const ROLE_LABEL: Record<'owner' | 'admin' | 'planner' | 'viewer', string> = {
  owner: 'Propriétaire',
  admin: 'Admin',
  planner: 'Planner',
  viewer: 'Lecteur',
};

const SECTION_META: Record<Section, { title: string; sub: string }> = {
  profil: { title: 'Profil de l’organisation', sub: 'Identité, adresse publique et rôle.' },
  branding: { title: 'Marque blanche', sub: 'Personnalisez l’espace couple à vos couleurs.' },
  integrations: { title: 'Intégrations', sub: 'CRM, import de données et connecteurs.' },
  messaging: {
    title: 'Messagerie & templates',
    sub: 'Canaux, invitations et relances par défaut.',
  },
  notifications: { title: 'Notifications', sub: 'Choisissez ce qui vous alerte, et comment.' },
  security: { title: 'Sécurité', sub: 'Session, double authentification et journal.' },
  danger: { title: 'Zone de danger', sub: 'Export, transfert et suppression de l’organisation.' },
};

export function SettingsShell({
  org,
  user,
  branding,
  whiteLabel,
  notifPrefs = null,
  messagingDefaults = null,
  members = [],
}: {
  org: {
    name: string;
    slug: string;
    tier: 'starter' | 'business' | 'agency' | null;
    role: 'owner' | 'admin' | 'planner' | 'viewer';
  };
  user: { name?: string | null; email?: string | null };
  branding: { logoUrl: string | null; primaryColor: string; accentColor: string };
  whiteLabel: { customDomain: string; senderEmail: string; whiteLabelFull: boolean };
  notifPrefs?: Partial<NotifPrefs> | null;
  messagingDefaults?: Partial<MessagingDefaults> | null;
  members?: MemberOpt[];
}) {
  const [section, setSection] = useState<Section>('profil');
  const isOwner = org.role === 'owner';
  const canManage = org.role === 'owner' || org.role === 'admin';
  const meta = SECTION_META[section];

  const subnav: {
    grp: string;
    items: {
      k: Section;
      label: string;
      Icon: LucideIcon;
      danger?: boolean;
      agencyLock?: boolean;
    }[];
  }[] = [
    {
      grp: 'Organisation',
      items: [
        { k: 'profil', label: 'Profil', Icon: Building2 },
        {
          k: 'branding',
          label: 'Marque blanche',
          Icon: Palette,
          agencyLock: org.tier !== 'agency',
        },
        { k: 'integrations', label: 'Intégrations', Icon: Plug },
      ],
    },
    {
      grp: 'Communication',
      items: [
        { k: 'messaging', label: 'Messagerie', Icon: MessageSquare },
        { k: 'notifications', label: 'Notifications', Icon: Bell },
      ],
    },
    {
      grp: 'Compte',
      items: [
        { k: 'security', label: 'Sécurité', Icon: ShieldCheck },
        ...(isOwner
          ? [{ k: 'danger' as const, label: 'Zone de danger', Icon: TriangleAlert, danger: true }]
          : []),
      ],
    },
  ];
  const allItems = subnav.flatMap((g) => g.items);

  return (
    <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
      {/* Sous-nav desktop (groupée) + Modules liés */}
      <nav aria-label="Sections des réglages" className="hidden flex-col gap-1 lg:flex">
        {subnav.map((g) => (
          <div key={g.grp} className="mb-2 flex flex-col gap-0.5">
            <p className="mb-1 px-2 font-mono text-[9px] tracking-[0.2em] text-[color:var(--color-muted-foreground)] uppercase">
              {g.grp}
            </p>
            {g.items.map((n) => (
              <button
                key={n.k}
                type="button"
                onClick={() => setSection(n.k)}
                aria-current={section === n.k ? 'page' : undefined}
                className={cn(
                  'focus-ring flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors',
                  section === n.k
                    ? n.danger
                      ? 'bg-[color:var(--color-danger)]/12 font-medium text-[color:var(--color-danger)]'
                      : 'bg-[color:var(--color-surface-elevated)] font-medium text-[color:var(--color-foreground)]'
                    : n.danger
                      ? 'text-[color:var(--color-danger)]/80 hover:text-[color:var(--color-danger)]'
                      : 'text-[color:var(--color-muted-foreground)] hover:text-[color:var(--color-foreground)]',
                )}
              >
                <n.Icon className="h-4 w-4 flex-shrink-0" strokeWidth={1.85} aria-hidden />
                <span className="flex-1 text-left">{n.label}</span>
                {n.agencyLock ? (
                  <Lock
                    className="h-3 w-3 flex-shrink-0 text-[color:var(--color-muted-foreground)]"
                    strokeWidth={1.9}
                    aria-label="Options Agency"
                  />
                ) : null}
              </button>
            ))}
          </div>
        ))}
        <p className="mt-1 mb-1 px-2 font-mono text-[9px] tracking-[0.2em] text-[color:var(--color-muted-foreground)] uppercase">
          Modules liés
        </p>
        <Link
          href="/pro/team"
          className="focus-ring flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-[color:var(--color-muted-foreground)] transition-colors hover:text-[color:var(--color-foreground)]"
        >
          <UsersRound className="h-4 w-4 flex-shrink-0" strokeWidth={1.85} aria-hidden />
          <span className="flex-1 text-left">Équipe &amp; rôles</span>
          <ArrowUpRight
            className="h-3.5 w-3.5 flex-shrink-0 opacity-60"
            strokeWidth={1.9}
            aria-hidden
          />
        </Link>
        <Link
          href="/pro/billing"
          className="focus-ring flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-[color:var(--color-muted-foreground)] transition-colors hover:text-[color:var(--color-foreground)]"
        >
          <CreditCard className="h-4 w-4 flex-shrink-0" strokeWidth={1.85} aria-hidden />
          <span className="flex-1 text-left">Facturation &amp; plan</span>
          <ArrowUpRight
            className="h-3.5 w-3.5 flex-shrink-0 opacity-60"
            strokeWidth={1.9}
            aria-hidden
          />
        </Link>
      </nav>

      <div className="min-w-0">
        {/* Select mobile */}
        <label className="mb-4 block lg:hidden">
          <span className="sr-only">Section des réglages</span>
          <Select value={section} onValueChange={(v) => setSection(v as Section)}>
            <SelectTrigger className="focus-ring h-10 w-full rounded-lg border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface-elevated)] px-3 text-sm text-[color:var(--color-foreground)]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {allItems.map((n) => (
                <SelectItem key={n.k} value={n.k}>
                  {n.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>

        {/* Panel head (eyebrow + titre + sous-titre) */}
        <div className="mb-5 flex flex-col gap-1">
          <span className="font-mono text-[10px] tracking-[0.2em] text-[color:var(--color-muted-foreground)] uppercase">
            Réglages · {org.name}
          </span>
          <h2
            className="font-display text-xl text-[color:var(--color-foreground)] italic"
            style={{ letterSpacing: '-0.018em' }}
          >
            {meta.title}
          </h2>
          <p className="text-sm text-[color:var(--color-muted-foreground)]">{meta.sub}</p>
        </div>

        {/* Bannière lecture seule (planner / viewer) hors zone de danger */}
        {!canManage && section !== 'danger' ? (
          <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface-elevated)] px-4 py-3">
            <Lock
              className="mt-0.5 h-4 w-4 flex-shrink-0 text-[color:var(--color-muted-foreground)]"
              strokeWidth={1.8}
              aria-hidden
            />
            <p className="text-[13px] leading-relaxed text-[color:var(--color-ink-700)]">
              Vous consultez les réglages en{' '}
              <b className="text-[color:var(--color-foreground)]">lecture seule</b>. Demandez un
              rôle Admin ou Propriétaire pour modifier.
            </p>
          </div>
        ) : null}

        {section === 'profil' ? (
          <ProfilPanel
            name={org.name}
            slug={org.slug}
            tierLabel={org.tier ? TIER_LABEL[org.tier] : 'Sans abonnement'}
            roleLabel={ROLE_LABEL[org.role]}
            userName={user.name ?? '—'}
            userEmail={user.email ?? '—'}
          />
        ) : section === 'branding' ? (
          <div className="flex flex-col gap-6">
            <BrandingForm
              initialLogoUrl={branding.logoUrl}
              initialPrimaryColor={branding.primaryColor}
              initialAccentColor={branding.accentColor}
            />
            <WhiteLabelForm
              slug={org.slug}
              initialCustomDomain={whiteLabel.customDomain}
              initialSenderEmail={whiteLabel.senderEmail}
              initialWhiteLabelFull={whiteLabel.whiteLabelFull}
              isAgency={org.tier === 'agency'}
            />
          </div>
        ) : section === 'integrations' ? (
          <IntegrationsPanel />
        ) : section === 'messaging' ? (
          <MessagingForm
            orgName={org.name}
            initialDefaults={messagingDefaults}
            canWrite={canManage}
          />
        ) : section === 'notifications' ? (
          <NotificationsForm initialPrefs={notifPrefs} canWrite={canManage} />
        ) : section === 'security' ? (
          <SecurityPanel deviceLabel="Navigateur web" />
        ) : (
          <DangerZone orgName={org.name} isOwner={isOwner} members={members} />
        )}
      </div>
    </div>
  );
}

function ProfilPanel({
  name,
  slug,
  tierLabel,
  roleLabel,
  userName,
  userEmail,
}: {
  name: string;
  slug: string;
  tierLabel: string;
  roleLabel: string;
  userName: string;
  userEmail: string;
}) {
  return (
    <div className="flex flex-col gap-6">
      <SetCard
        Icon={Building2}
        title="Identité de l’organisation"
        sub="Visible par votre équipe et sur les documents."
      >
        <Kv label="Nom de l’agence" value={name} />
        <Kv label="Adresse publique" value={`${slug}.wedillybird.fr`} mono />
        <Kv label="Forfait" value={tierLabel} />
        <Kv label="Votre rôle" value={roleLabel} />
        <p className="pt-1 text-xs text-[color:var(--color-muted-foreground)]">
          Logo, couleurs et domaine sur mesure se configurent dans l’onglet{' '}
          <b className="text-[color:var(--color-foreground)]">Marque blanche</b>.
        </p>
      </SetCard>
      <SetCard Icon={UserCircle} title="Votre compte" sub="Vos informations personnelles.">
        <Kv label="Nom" value={userName} />
        <Kv label="Email" value={userEmail} mono />
        <Kv label="Rôle" value={roleLabel} />
      </SetCard>
    </div>
  );
}

function IntegrationsPanel() {
  return (
    <SetCard
      Icon={Plug}
      title="Intégrations & import"
      sub="Importez vos clients et branchez vos outils."
    >
      <p className="text-sm leading-relaxed text-[color:var(--color-ink-700)]">
        Import CSV de vos clients, et bientôt des connecteurs CRM, agenda et paiement. La
        configuration complète se fait depuis le module dédié.
      </p>
      <Link
        href="/pro/integrations"
        className="focus-ring mt-1 inline-flex items-center gap-1.5 self-start rounded-lg border border-[color:var(--color-border-strong)] px-3.5 py-2 text-sm text-[color:var(--color-foreground)] transition-colors hover:border-[color:var(--color-blush-400)]"
      >
        Ouvrir les intégrations
        <ArrowRight className="h-4 w-4" strokeWidth={1.85} aria-hidden />
      </Link>
    </SetCard>
  );
}

function SetCard({
  Icon,
  title,
  sub,
  children,
}: {
  Icon: LucideIcon;
  title: string;
  sub: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6">
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg bg-[color:var(--color-surface-elevated)] text-[color:var(--color-blush-300)]">
          <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} aria-hidden />
        </span>
        <span className="flex flex-col">
          <span className="text-sm font-medium text-[color:var(--color-foreground)]">{title}</span>
          <span className="text-xs text-[color:var(--color-muted-foreground)]">{sub}</span>
        </span>
      </div>
      <div className="flex flex-col gap-3 border-t border-[color:var(--color-border)] pt-4">
        {children}
      </div>
    </section>
  );
}

function Kv({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-[color:var(--color-muted-foreground)]">{label}</span>
      <span
        className={cn(
          'truncate text-right text-[color:var(--color-foreground)]',
          mono && 'font-mono text-xs',
        )}
      >
        {value}
      </span>
    </div>
  );
}
