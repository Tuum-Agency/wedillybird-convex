'use client';

/**
 * Onglets opérationnels du hub mariage (univers dark « Linear-grade »).
 *
 * Chaque onglet est un panneau rendu DANS le hub (pas une page couple
 * séparée) : Invités, Messaging, Check-in, Plan de table, Galerie, Facture.
 *
 * Données réelles quand elles existent (invités, RSVP, quota messages, tier).
 * Là où le backend est un bloqueur prod (diffusion WhatsApp = template Meta,
 * modération galerie = pipeline Rekognition, check-in offline = sync terrain),
 * l'interaction est simulée côté client — fidèle au bundle de design.
 */

import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  Camera,
  Check,
  CheckCheck,
  CircleCheck,
  Clock,
  CloudOff,
  Coins,
  CreditCard,
  Download,
  Globe,
  Images,
  Info,
  Megaphone,
  MessageCircle,
  RefreshCw,
  RotateCcw,
  ScanLine,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  ThumbsDown,
  ThumbsUp,
  UserCheck,
  Users,
  Wifi,
  WifiOff,
  X,
  ZoomIn,
  type LucideIcon,
} from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/cn';

/* -------------------------------------------------------------------------- */
/*  Types partagés                                                            */
/* -------------------------------------------------------------------------- */

export interface HubGuestRow {
  _id: string;
  fullName: string;
  phone?: string;
  email?: string;
  category?: string;
  plusOnesAllowed: number;
  rsvpStatus: 'pending' | 'attending' | 'declined' | 'maybe';
}

interface Rsvp {
  confirmed: number;
  declined: number;
  pending: number;
}

/* -------------------------------------------------------------------------- */
/*  Primitives partagées                                                      */
/* -------------------------------------------------------------------------- */

const hNum = (n: number) => n.toLocaleString('fr-FR').replace(/\s/g, ' ');

function hueFromName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return h;
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map((p) => p.charAt(0).toUpperCase()).join('') || '·';
}

function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  const h = hueFromName(name);
  return (
    <span
      aria-hidden
      className="inline-flex flex-shrink-0 items-center justify-center rounded-full font-mono font-medium"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.36),
        background: `oklch(32% 0.045 ${h})`,
        color: `oklch(84% 0.06 ${h})`,
      }}
    >
      {initialsOf(name)}
    </span>
  );
}

export function RsvpMini({ color, n, label }: { color: string; n: number; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} aria-hidden />
      <b className="text-[color:var(--color-foreground)] tabular-nums">{n}</b>
      <span className="text-[color:var(--color-muted-foreground)]">{label}</span>
    </span>
  );
}

const SAGE = 'oklch(72% 0.08 145)';
const RED = 'oklch(72% 0.09 20)';
const AMBER = 'oklch(78% 0.075 78)';

/** Carte « section » dark réutilisée par tous les onglets. */
function Panel({
  title,
  sub,
  action,
  children,
  className,
}: {
  title?: string;
  sub?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        'flex flex-col gap-4 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5 sm:p-6',
        className,
      )}
    >
      {title ? (
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-baseline gap-2.5">
            <h2 className="font-display text-lg text-[color:var(--color-foreground)] italic">
              {title}
            </h2>
            {sub ? (
              <span className="font-mono text-[10px] tracking-[0.14em] text-[color:var(--color-muted-foreground)] uppercase">
                {sub}
              </span>
            ) : null}
          </div>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/* ---- Toaster (transient, fond bottom-center) ---- */

interface ToastItem {
  id: number;
  Icon: LucideIcon;
  node: ReactNode;
}

function useToast() {
  const [items, setItems] = useState<ToastItem[]>([]);
  const idRef = useRef(0);
  const toast = useCallback((Icon: LucideIcon, node: ReactNode) => {
    const id = ++idRef.current;
    setItems((s) => [...s, { id, Icon, node }]);
    setTimeout(() => setItems((s) => s.filter((i) => i.id !== id)), 3000);
  }, []);
  return { items, toast };
}

function Toaster({ items }: { items: ToastItem[] }) {
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex flex-col items-center gap-2 px-4"
      aria-live="polite"
    >
      {items.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto flex items-center gap-2.5 rounded-xl border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface-elevated)] px-4 py-2.5 text-sm text-[color:var(--color-foreground)] shadow-[var(--shadow-lifted)]"
        >
          <t.Icon
            className="h-4 w-4 flex-shrink-0 text-[color:var(--color-blush-300)]"
            strokeWidth={1.9}
            aria-hidden
          />
          {t.node}
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  ONGLET · INVITÉS                                                          */
/* -------------------------------------------------------------------------- */

const RSVP_PILL: Record<HubGuestRow['rsvpStatus'], { label: string; bg: string; fg: string }> = {
  attending: { label: 'Présent', bg: 'oklch(26% 0.04 145)', fg: 'oklch(82% 0.07 145)' },
  declined: { label: 'Absent', bg: 'oklch(28% 0.04 25)', fg: 'oklch(82% 0.07 22)' },
  pending: { label: 'En attente', bg: 'oklch(28% 0.022 78)', fg: 'oklch(85% 0.04 78)' },
  maybe: {
    label: 'Peut-être',
    bg: 'var(--color-surface-elevated)',
    fg: 'var(--color-muted-foreground)',
  },
};

export function InvitesTab({
  guests,
  rsvp,
  guestCap,
  eventHref,
}: {
  guests: HubGuestRow[];
  rsvp: Rsvp;
  guestCap: number | null;
  eventHref: (sub: string) => string;
}) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | HubGuestRow['rsvpStatus']>('all');
  const total = guests.length;
  const counted = rsvp.confirmed + rsvp.declined + rsvp.pending;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return guests.filter((g) => {
      if (filter !== 'all' && g.rsvpStatus !== filter) return false;
      if (
        q &&
        !g.fullName.toLowerCase().includes(q) &&
        !(g.category ?? '').toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [guests, query, filter]);

  const FILTERS: ReadonlyArray<{ key: 'all' | HubGuestRow['rsvpStatus']; label: string }> = [
    { key: 'all', label: 'Tous' },
    { key: 'attending', label: 'Présents' },
    { key: 'pending', label: 'En attente' },
    { key: 'declined', label: 'Absents' },
  ];

  return (
    <div className="flex flex-col gap-5">
      {/* Synthèse RSVP */}
      <div className="flex flex-col gap-3 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] tracking-[0.16em] text-[color:var(--color-muted-foreground)] uppercase">
            {total} invité{total > 1 ? 's' : ''}
            {guestCap != null ? ` · cap ${guestCap}` : ''}
          </span>
          <Link
            href={eventHref('guests') as never}
            className="font-mono text-[10px] tracking-[0.12em] text-[color:var(--color-blush-300)] uppercase hover:text-[color:var(--color-foreground)]"
          >
            Gérer les invités →
          </Link>
        </div>
        <div className="flex h-2 w-full overflow-hidden rounded-full bg-[color:var(--color-surface-elevated)]">
          {counted > 0 ? (
            <>
              <span
                className="h-full"
                style={{ width: `${(rsvp.confirmed / counted) * 100}%`, background: SAGE }}
              />
              <span
                className="h-full"
                style={{ width: `${(rsvp.declined / counted) * 100}%`, background: RED }}
              />
              <span
                className="h-full"
                style={{ width: `${(rsvp.pending / counted) * 100}%`, background: AMBER }}
              />
            </>
          ) : null}
        </div>
        <div className="flex items-center gap-4 font-mono text-[11px]">
          <RsvpMini color={SAGE} n={rsvp.confirmed} label="présents" />
          <RsvpMini color={RED} n={rsvp.declined} label="absents" />
          <RsvpMini color={AMBER} n={rsvp.pending} label="en attente" />
        </div>
      </div>

      {total === 0 ? (
        <EmptyState
          icon={Users}
          title="Aucun invité pour l’instant"
          body="Importez votre liste ou ajoutez des invités pour suivre les réponses RSVP ici."
          cta={
            <Link
              href={eventHref('guests') as never}
              className="text-[color:var(--color-blush-300)] hover:underline"
            >
              Ajouter des invités
            </Link>
          }
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex flex-1 items-center gap-2 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2">
              <Search
                className="h-4 w-4 text-[color:var(--color-muted-foreground)]"
                strokeWidth={1.9}
                aria-hidden
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher un invité…"
                aria-label="Rechercher un invité"
                className="w-full bg-transparent text-sm text-[color:var(--color-foreground)] outline-none placeholder:text-[color:var(--color-muted-foreground)]"
              />
            </label>
            <div className="flex items-center gap-1 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-1">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFilter(f.key)}
                  className={cn(
                    'rounded-lg px-2.5 py-1.5 text-xs transition-colors',
                    filter === f.key
                      ? 'bg-[color:var(--color-surface-elevated)] font-medium text-[color:var(--color-foreground)]'
                      : 'text-[color:var(--color-muted-foreground)] hover:text-[color:var(--color-foreground)]',
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)]">
            <table className="w-full min-w-[560px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-[color:var(--color-border)] text-left font-mono text-[9px] tracking-[0.18em] text-[color:var(--color-muted-foreground)] uppercase">
                  <th className="px-4 py-3 font-medium">Invité</th>
                  <th className="px-4 py-3 font-medium">Catégorie</th>
                  <th className="px-4 py-3 font-medium">Accompagnants</th>
                  <th className="px-4 py-3 font-medium">RSVP</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((g) => (
                  <tr
                    key={g._id}
                    className="border-b border-[color:var(--color-border)] last:border-0 hover:bg-[color:var(--color-surface-elevated)]/40"
                  >
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-2.5">
                        <Avatar name={g.fullName} />
                        <span className="text-[color:var(--color-foreground)]">{g.fullName}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-[color:var(--color-muted-foreground)]">
                      {g.category ?? '—'}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-[color:var(--color-muted-foreground)] tabular-nums">
                      {g.plusOnesAllowed > 0 ? `+${g.plusOnesAllowed}` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <RsvpPill status={g.rsvpStatus} />
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-8 text-center text-sm text-[color:var(--color-muted-foreground)]"
                    >
                      Aucun invité ne correspond.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function RsvpPill({ status }: { status: HubGuestRow['rsvpStatus'] }) {
  const p = RSVP_PILL[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium"
      style={{ background: p.bg, color: p.fg }}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" aria-hidden />
      {p.label}
    </span>
  );
}

function EmptyState({
  icon: Icon,
  title,
  body,
  cta,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  cta?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[color:var(--color-border-strong)] bg-[color:var(--color-surface)]/40 px-8 py-12 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[color:var(--color-surface-elevated)] text-[color:var(--color-blush-300)]">
        <Icon className="h-6 w-6" strokeWidth={1.7} aria-hidden />
      </span>
      <h3 className="font-display text-lg text-[color:var(--color-foreground)] italic">{title}</h3>
      <p className="max-w-md text-sm text-[color:var(--color-muted-foreground)]">{body}</p>
      {cta ? <div className="mt-1 text-sm">{cta}</div> : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  ONGLET · MESSAGING (diffusion & relances WhatsApp)                        */
/* -------------------------------------------------------------------------- */

interface MsgTemplate {
  id: string;
  name: string;
  desc: string;
  swatch: [string, string];
  header: string;
  body: string;
  hasImage: boolean;
}

const MSG_TEMPLATES: ReadonlyArray<MsgTemplate> = [
  {
    id: 'classic',
    name: 'Classique',
    desc: 'Élégant et intemporel',
    swatch: ['oklch(34% 0.03 80)', 'oklch(78% 0.1 80)'],
    header: 'Vous êtes conviés',
    body: '{{prénom}}, c’est avec joie que nous vous invitons à célébrer notre mariage.',
    hasImage: false,
  },
  {
    id: 'photo',
    name: 'Photo',
    desc: 'Avec visuel du couple',
    swatch: ['oklch(34% 0.05 25)', 'oklch(76% 0.12 25)'],
    header: 'Save the date',
    body: '{{prénom}}, réservez la date ! Retrouvez tous les détails sur notre page d’invitation.',
    hasImage: true,
  },
  {
    id: 'modern',
    name: 'Moderne',
    desc: 'Épuré, typographique',
    swatch: ['oklch(34% 0.04 250)', 'oklch(76% 0.1 250)'],
    header: 'On se marie',
    body: '{{prénom}}, nous serions honorés de votre présence pour ce grand jour.',
    hasImage: false,
  },
  {
    id: 'festive',
    name: 'Festif',
    desc: 'Chaleureux et coloré',
    swatch: ['oklch(36% 0.06 330)', 'oklch(78% 0.12 330)'],
    header: 'La fête approche',
    body: '{{prénom}}, préparez vos plus beaux habits — la célébration arrive !',
    hasImage: true,
  },
  {
    id: 'sober',
    name: 'Sobre',
    desc: 'Formel, sans fioritures',
    swatch: ['oklch(32% 0.012 80)', 'oklch(72% 0.03 80)'],
    header: 'Faire-part',
    body: '{{prénom}}, nous avons l’honneur de vous convier à notre mariage.',
    hasImage: false,
  },
];

const PERSO_MAX = 60;

function WaPreview({
  template,
  perso,
  coupleA,
  coupleB,
}: {
  template: MsgTemplate;
  perso: string;
  coupleA: string;
  coupleB: string;
}) {
  const body = template.body.split(/(\{\{prénom\}\})/g);
  return (
    <aside
      className="flex flex-col gap-3 self-start rounded-3xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4"
      aria-label="Aperçu de l’invitation WhatsApp"
    >
      <div className="flex items-center gap-2.5 border-b border-[color:var(--color-border)] pb-3">
        <Avatar name={`${coupleA} ${coupleB}`} size={36} />
        <div className="flex flex-col">
          <b className="text-sm text-[color:var(--color-foreground)]">
            {coupleA} <span style={{ color: 'var(--color-gold-500)' }}>&amp;</span> {coupleB}
          </b>
          <span className="inline-flex items-center gap-1 font-mono text-[10px] text-[color:var(--color-muted-foreground)]">
            <ShieldCheck className="h-3 w-3" strokeWidth={2} aria-hidden /> Compte vérifié ·
            WhatsApp
          </span>
        </div>
      </div>
      <div className="rounded-2xl rounded-tl-sm bg-[color:var(--color-surface-elevated)] p-3.5">
        {template.hasImage ? (
          <div className="mb-2.5 flex h-24 items-center justify-center rounded-xl bg-[color:var(--color-surface)] text-[color:var(--color-muted-foreground)]">
            <Camera className="h-6 w-6" strokeWidth={1.5} aria-hidden />
          </div>
        ) : null}
        <div className="font-display mb-1 text-base text-[color:var(--color-foreground)] italic">
          {template.header}
        </div>
        <p className="text-sm leading-relaxed text-[color:var(--color-foreground)]/90">
          {body.map((p, i) =>
            p === '{{prénom}}' ? (
              <span
                key={i}
                className="rounded bg-[color:var(--color-blush-500)]/25 px-1 font-medium text-[color:var(--color-blush-300)]"
              >
                Prénom
              </span>
            ) : (
              <span key={i}>{p}</span>
            ),
          )}
        </p>
        {perso.trim() ? (
          <p className="mt-2 border-l-2 border-[color:var(--color-gold-500)]/50 pl-2 text-sm text-[color:var(--color-muted-foreground)] italic">
            « {perso.trim()} »
          </p>
        ) : null}
        <div className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[color:var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[color:var(--color-blush-300)]">
          <Globe className="h-3.5 w-3.5" strokeWidth={2} aria-hidden /> Voir l’invitation
        </div>
        <div className="mt-1.5 text-right font-mono text-[9px] text-[color:var(--color-muted-foreground)]">
          14:32
        </div>
      </div>
    </aside>
  );
}

const DELIVERY_ORDER = [
  'replied',
  'read',
  'read',
  'delivered',
  'read',
  'delivered',
  'replied',
  'read',
  'sent',
  'delivered',
  'read',
  'sent',
] as const;
const DELIVERY_STATUS: Record<string, { label: string; Icon: LucideIcon; color: string }> = {
  replied: { label: 'Répondu', Icon: CheckCheck, color: SAGE },
  read: { label: 'Lu', Icon: CheckCheck, color: 'oklch(72% 0.09 250)' },
  delivered: { label: 'Délivré', Icon: CheckCheck, color: 'var(--color-muted-foreground)' },
  sent: { label: 'Envoyé', Icon: Check, color: 'var(--color-muted-foreground)' },
};

export function MessagingTab({
  published,
  guests,
  rsvp,
  guestTotal,
  messageQuota,
  coupleA,
  coupleB,
}: {
  published: boolean;
  guests: HubGuestRow[];
  rsvp: Rsvp;
  guestTotal: number;
  messageQuota: [number, number];
  coupleA: string;
  coupleB: string;
}) {
  const { items, toast } = useToast();
  const [tplId, setTplId] = useState(MSG_TEMPLATES[0]!.id);
  const [perso, setPerso] = useState('');
  const [audience, setAudience] = useState<'all' | 'pending' | 'category'>('pending');
  const [cats, setCats] = useState<Set<string>>(() => new Set());
  const [confirm, setConfirm] = useState(false);
  const [sent, setSent] = useState(false);
  const [rem7, setRem7] = useState(true);
  const [rem1, setRem1] = useState(true);

  const template = MSG_TEMPLATES.find((t) => t.id === tplId) ?? MSG_TEMPLATES[0]!;
  const [used, cap] = messageQuota;

  const catCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const g of guests) {
      const k = g.category?.trim() || 'Autre';
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [guests]);

  const recipients = useMemo(() => {
    if (audience === 'all') return guestTotal;
    if (audience === 'pending') return rsvp.pending;
    return catCounts.filter(([k]) => cats.has(k)).reduce((s, [, n]) => s + n, 0);
  }, [audience, cats, catCounts, guestTotal, rsvp.pending]);

  const afterUse = used + recipients;
  const overQuota = afterUse > cap;

  if (!published) {
    return (
      <EmptyState
        icon={Megaphone}
        title="Publiez d’abord l’événement"
        body="La diffusion des invitations WhatsApp est disponible une fois l’événement publié. Repassez sur l’onglet Aperçu pour publier — vos invités recevront alors leur invitation."
      />
    );
  }

  const AUD: ReadonlyArray<{
    value: 'all' | 'pending' | 'category';
    title: string;
    sub: string;
    count: number;
  }> = [
    { value: 'all', title: 'Tous les invités', sub: 'Toute la liste', count: guestTotal },
    { value: 'pending', title: 'Non répondus', sub: 'En attente de réponse', count: rsvp.pending },
    {
      value: 'category',
      title: 'Par catégorie',
      sub: 'Cibler des groupes',
      count: catCounts.filter(([k]) => cats.has(k)).reduce((s, [, n]) => s + n, 0),
    },
  ];

  function doSend() {
    setConfirm(false);
    setSent(true);
    toast(
      Megaphone,
      <span>
        Diffusion lancée · <b>{recipients}</b> invité{recipients > 1 ? 's' : ''}
      </span>,
    );
  }

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
      <Toaster items={items} />
      <div className="flex flex-col gap-5">
        {/* note quota */}
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-3">
          <MessageCircle
            className="h-4 w-4 text-[color:var(--color-blush-300)]"
            strokeWidth={1.9}
            aria-hidden
          />
          <span className="text-sm text-[color:var(--color-muted-foreground)]">
            Messages ce mois{' '}
            <b className="font-mono text-[color:var(--color-foreground)] tabular-nums">
              {hNum(used)} / {hNum(cap)}
            </b>
          </span>
          <span className="flex h-1.5 min-w-[80px] flex-1 overflow-hidden rounded-full bg-[color:var(--color-surface-elevated)]">
            <span
              className="h-full rounded-full bg-[color:var(--color-blush-400)]"
              style={{ width: `${Math.min(100, (used / cap) * 100)}%` }}
            />
          </span>
          <Link
            href="/pro/billing"
            className="inline-flex items-center gap-0.5 font-mono text-[10px] tracking-[0.12em] text-[color:var(--color-blush-300)] uppercase hover:text-[color:var(--color-foreground)]"
          >
            Facturation <ArrowUpRight className="h-3 w-3" strokeWidth={2} aria-hidden />
          </Link>
        </div>

        {/* templates */}
        <Panel title="Style d’invitation" sub={`${MSG_TEMPLATES.length} modèles`}>
          <div
            className="grid grid-cols-2 gap-2.5 sm:grid-cols-3"
            role="radiogroup"
            aria-label="Style d’invitation"
          >
            {MSG_TEMPLATES.map((t) => {
              const on = t.id === tplId;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setTplId(t.id)}
                  className={cn(
                    'relative flex flex-col gap-2 rounded-xl border p-3 text-left transition-colors',
                    on
                      ? 'border-[color:var(--color-blush-400)] bg-[color:var(--color-surface-elevated)]'
                      : 'border-[color:var(--color-border)] hover:border-[color:var(--color-border-strong)]',
                  )}
                >
                  {on ? (
                    <span className="absolute top-2 right-2 flex h-4 w-4 items-center justify-center rounded-full bg-[color:var(--color-blush-400)] text-[color:var(--color-ink-700)]">
                      <Check className="h-2.5 w-2.5" strokeWidth={3.2} aria-hidden />
                    </span>
                  ) : null}
                  <span
                    className="flex h-8 items-center gap-1.5 rounded-md px-2"
                    style={{ background: t.swatch[0] }}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ background: t.swatch[1] }} />
                    <span
                      className="h-1 flex-1 rounded-full"
                      style={{ background: `color-mix(in oklab, ${t.swatch[1]} 55%, transparent)` }}
                    />
                  </span>
                  <span className="text-sm font-medium text-[color:var(--color-foreground)]">
                    {t.name}
                  </span>
                  <span className="text-[11px] text-[color:var(--color-muted-foreground)]">
                    {t.desc}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="m-perso" className="text-sm text-[color:var(--color-foreground)]">
                Message personnel{' '}
                <span className="text-[color:var(--color-muted-foreground)]">(optionnel)</span>
              </label>
              <span
                className={cn(
                  'font-mono text-[11px]',
                  perso.length > PERSO_MAX - 10
                    ? 'text-[color:var(--color-warning)]'
                    : 'text-[color:var(--color-muted-foreground)]',
                )}
              >
                {perso.length}/{PERSO_MAX}
              </span>
            </div>
            <textarea
              id="m-perso"
              maxLength={PERSO_MAX}
              value={perso}
              onChange={(e) => setPerso(e.target.value)}
              placeholder="Un mot des mariés, ajouté sous l’invitation…"
              rows={2}
              className="resize-none rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-elevated)] px-3 py-2.5 text-sm text-[color:var(--color-foreground)] outline-none placeholder:text-[color:var(--color-muted-foreground)] focus:border-[color:var(--color-blush-400)]"
            />
          </div>
        </Panel>

        {/* audience */}
        <Panel title="Destinataires" sub={`${recipients} invités`}>
          <div className="flex flex-col gap-2" role="radiogroup" aria-label="Audience">
            {AUD.map((a) => {
              const on = audience === a.value;
              return (
                <div key={a.value} className="flex flex-col gap-2.5">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setAudience(a.value)}
                    className={cn(
                      'flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors',
                      on
                        ? 'border-[color:var(--color-blush-400)] bg-[color:var(--color-surface-elevated)]'
                        : 'border-[color:var(--color-border)] hover:border-[color:var(--color-border-strong)]',
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border-2',
                        on
                          ? 'border-[color:var(--color-blush-400)]'
                          : 'border-[color:var(--color-border-strong)]',
                      )}
                    >
                      {on ? (
                        <span className="h-2 w-2 rounded-full bg-[color:var(--color-blush-400)]" />
                      ) : null}
                    </span>
                    <span className="flex flex-1 flex-col">
                      <b className="text-sm text-[color:var(--color-foreground)]">{a.title}</b>
                      <span className="text-xs text-[color:var(--color-muted-foreground)]">
                        {a.sub}
                      </span>
                    </span>
                    <span className="font-mono text-sm text-[color:var(--color-foreground)] tabular-nums">
                      {a.count}
                      <span className="ml-1 text-[10px] text-[color:var(--color-muted-foreground)]">
                        inv.
                      </span>
                    </span>
                  </button>
                  {a.value === 'category' && on ? (
                    <div className="flex flex-wrap gap-1.5 pl-1">
                      {catCounts.length === 0 ? (
                        <span className="text-xs text-[color:var(--color-muted-foreground)]">
                          Aucune catégorie renseignée sur les invités.
                        </span>
                      ) : (
                        catCounts.map(([k, n]) => {
                          const sel = cats.has(k);
                          return (
                            <button
                              key={k}
                              type="button"
                              onClick={() =>
                                setCats((s) => {
                                  const next = new Set(s);
                                  if (next.has(k)) next.delete(k);
                                  else next.add(k);
                                  return next;
                                })
                              }
                              className={cn(
                                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors',
                                sel
                                  ? 'border-[color:var(--color-blush-400)] bg-[color:var(--color-blush-500)]/15 text-[color:var(--color-foreground)]'
                                  : 'border-[color:var(--color-border)] text-[color:var(--color-muted-foreground)] hover:text-[color:var(--color-foreground)]',
                              )}
                            >
                              <span
                                className="h-1.5 w-1.5 rounded-full"
                                style={{ background: `oklch(72% 0.08 ${hueFromName(k)})` }}
                                aria-hidden
                              />
                              {k}
                              <span className="font-mono tabular-nums opacity-70">{n}</span>
                            </button>
                          );
                        })
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </Panel>

        {/* barre d'envoi */}
        <div className="flex flex-col gap-3 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col">
            <b className="text-sm text-[color:var(--color-foreground)]">
              <span className="font-mono tabular-nums">{recipients}</span> message
              {recipients > 1 ? 's' : ''} à envoyer
            </b>
            <span className="text-xs text-[color:var(--color-muted-foreground)]">
              Impact quota : {hNum(used)} → {hNum(afterUse)} / {hNum(cap)}
              {overQuota ? ' · dépassement' : ''}
            </span>
          </div>
          <button
            type="button"
            disabled={recipients === 0}
            onClick={() => setConfirm(true)}
            className="focus-ring inline-flex flex-shrink-0 items-center justify-center gap-2 rounded-lg bg-[color:var(--color-primary)] px-5 py-2.5 text-sm font-semibold text-[color:var(--color-primary-foreground)] transition-colors hover:bg-[color:var(--color-primary-hover)] disabled:opacity-50"
          >
            <Megaphone className="h-4 w-4" strokeWidth={1.9} aria-hidden /> Diffuser maintenant
          </button>
        </div>

        {/* table de livraison */}
        {sent ? (
          <Panel
            title="Statut de livraison"
            sub="Dernière diffusion · 14:32"
            className="p-0 sm:p-0"
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse text-sm">
                <thead>
                  <tr className="border-y border-[color:var(--color-border)] text-left font-mono text-[9px] tracking-[0.18em] text-[color:var(--color-muted-foreground)] uppercase">
                    <th className="px-5 py-3 font-medium">Invité</th>
                    <th className="px-5 py-3 font-medium">Canal</th>
                    <th className="px-5 py-3 font-medium">Statut</th>
                    <th className="px-5 py-3 font-medium">Horodatage</th>
                  </tr>
                </thead>
                <tbody>
                  {guests.slice(0, 12).map((g, i) => {
                    const key = DELIVERY_ORDER[i % DELIVERY_ORDER.length]!;
                    const d = DELIVERY_STATUS[key]!;
                    return (
                      <tr
                        key={g._id}
                        className="border-b border-[color:var(--color-border)] last:border-0"
                      >
                        <td className="px-5 py-3">
                          <span className="flex items-center gap-2.5">
                            <Avatar name={g.fullName} />
                            <span className="text-[color:var(--color-foreground)]">
                              {g.fullName}
                            </span>
                          </span>
                        </td>
                        <td className="px-5 py-3 text-xs text-[color:var(--color-muted-foreground)]">
                          <span className="inline-flex items-center gap-1.5">
                            <MessageCircle className="h-3.5 w-3.5" strokeWidth={1.9} aria-hidden />{' '}
                            WhatsApp
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className="inline-flex items-center gap-1.5 text-xs font-medium"
                            style={{ color: d.color }}
                          >
                            <d.Icon className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden />{' '}
                            {d.label}
                          </span>
                        </td>
                        <td className="px-5 py-3 font-mono text-xs text-[color:var(--color-muted-foreground)] tabular-nums">
                          14:3{i % 8}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>
        ) : null}

        {/* relances */}
        <Panel title="Relances automatiques">
          <div className="flex flex-col gap-2.5">
            <ReminderRow
              label="Relance J-7"
              on={rem7}
              setOn={setRem7}
              next="5 sept. 2026 · 10:00"
            />
            <ReminderRow
              label="Relance J-1"
              on={rem1}
              setOn={setRem1}
              next="11 sept. 2026 · 18:00"
            />
          </div>
          <p className="text-xs text-[color:var(--color-muted-foreground)]">
            Les relances ne sont envoyées qu’aux invités encore en attente de réponse.
          </p>
        </Panel>
      </div>

      {/* aperçu live */}
      <WaPreview template={template} perso={perso} coupleA={coupleA} coupleB={coupleB} />

      {confirm ? (
        <ConfirmDialog
          eyebrow="Diffusion WhatsApp"
          Icon={Megaphone}
          title="Diffuser les invitations ?"
          onClose={() => setConfirm(false)}
          confirmLabel={`Diffuser à ${recipients} invités`}
          confirmIcon={Send}
          onConfirm={doSend}
        >
          <p className="text-sm text-[color:var(--color-muted-foreground)]">
            Le style <b className="text-[color:var(--color-foreground)]">{template.name}</b> sera
            envoyé à <b className="text-[color:var(--color-foreground)]">{recipients} invités</b>.
            Cette action est immédiate.
          </p>
          <div className="flex flex-col gap-2 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-elevated)] p-3.5 text-sm">
            <Recap k="Destinataires" v={`${recipients} invités`} />
            <Recap k="Messages consommés" v={`${recipients}`} />
            <Recap k="Quota après envoi" v={`${hNum(afterUse)} / ${hNum(cap)}`} hl />
          </div>
          {overQuota ? (
            <p className="inline-flex items-center gap-1.5 text-xs text-[color:var(--color-warning)]">
              <AlertTriangle className="h-3.5 w-3.5" strokeWidth={2} aria-hidden /> Cet envoi
              dépasse votre quota mensuel — facturation au dépassement.
            </p>
          ) : (
            <p className="text-xs text-[color:var(--color-muted-foreground)]">
              Il vous restera {hNum(cap - afterUse)} messages ce mois.
            </p>
          )}
        </ConfirmDialog>
      ) : null}
    </div>
  );
}

function ReminderRow({
  label,
  on,
  setOn,
  next,
}: {
  label: string;
  on: boolean;
  setOn: (v: boolean) => void;
  next: string;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-xl border px-4 py-3',
        on
          ? 'border-[color:var(--color-border-strong)] bg-[color:var(--color-surface-elevated)]'
          : 'border-[color:var(--color-border)]',
      )}
    >
      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-[color:var(--color-surface)] text-[color:var(--color-blush-300)]">
        <Clock className="h-[18px] w-[18px]" strokeWidth={1.8} aria-hidden />
      </span>
      <div className="flex flex-1 flex-col">
        <b className="text-sm text-[color:var(--color-foreground)]">{label}</b>
        <span
          className={cn(
            'text-xs',
            on
              ? 'text-[color:var(--color-blush-300)]'
              : 'text-[color:var(--color-muted-foreground)]',
          )}
        >
          {on ? `Prochaine exécution : ${next}` : 'Désactivée'}
        </span>
      </div>
      <Switch on={on} onChange={setOn} label={label} />
    </div>
  );
}

function Switch({
  on,
  onChange,
  label,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={cn(
        'relative h-6 w-11 flex-shrink-0 rounded-full transition-colors',
        on ? 'bg-[color:var(--color-blush-700)]' : 'bg-[color:var(--color-surface-elevated)]',
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 h-5 w-5 rounded-full shadow-sm transition-all duration-200 ease-out',
          on ? 'left-[22px] bg-[color:var(--color-blush-400)]' : 'left-0.5 bg-white',
        )}
        aria-hidden
      />
    </button>
  );
}

function Recap({ k, v, hl }: { k: string; v: string; hl?: boolean }) {
  return (
    <div
      className={cn(
        'flex items-center justify-between',
        hl ? 'border-t border-[color:var(--color-border)] pt-2' : '',
      )}
    >
      <span
        className={
          hl
            ? 'font-medium text-[color:var(--color-foreground)]'
            : 'text-[color:var(--color-muted-foreground)]'
        }
      >
        {k}
      </span>
      <span className="font-mono text-[color:var(--color-foreground)] tabular-nums">{v}</span>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Dialog partagé                                                            */
/* -------------------------------------------------------------------------- */

function ConfirmDialog({
  eyebrow,
  Icon,
  title,
  children,
  onClose,
  onConfirm,
  confirmLabel,
  confirmIcon: ConfirmIcon,
  danger,
}: {
  eyebrow: string;
  Icon: LucideIcon;
  title: string;
  children: ReactNode;
  onClose: () => void;
  onConfirm: () => void;
  confirmLabel: string;
  confirmIcon?: LucideIcon;
  danger?: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        type="button"
        aria-label="Fermer"
        onClick={onClose}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
      />
      <div className="relative flex w-full max-w-md flex-col gap-4 rounded-2xl border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface)] p-6 shadow-[var(--shadow-popover)]">
        <div className="flex items-start gap-3">
          <span
            className={cn(
              'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl',
              danger
                ? 'bg-[color:var(--color-danger)]/15 text-[color:var(--color-danger)]'
                : 'bg-[color:var(--color-surface-elevated)] text-[color:var(--color-blush-300)]',
            )}
          >
            <Icon className="h-5 w-5" strokeWidth={1.85} aria-hidden />
          </span>
          <div className="flex flex-col gap-0.5">
            <span className="font-mono text-[10px] tracking-[0.16em] text-[color:var(--color-muted-foreground)] uppercase">
              {eyebrow}
            </span>
            <h3 className="font-display text-xl text-[color:var(--color-foreground)] italic">
              {title}
            </h3>
          </div>
        </div>
        {children}
        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-[color:var(--color-muted-foreground)] transition-colors hover:text-[color:var(--color-foreground)]"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={cn(
              'focus-ring inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors',
              danger
                ? 'bg-[color:var(--color-danger)] text-white hover:opacity-90'
                : 'bg-[color:var(--color-primary)] text-[color:var(--color-primary-foreground)] hover:bg-[color:var(--color-primary-hover)]',
            )}
          >
            {ConfirmIcon ? <ConfirmIcon className="h-4 w-4" strokeWidth={2} aria-hidden /> : null}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  ONGLET · CHECK-IN (jour J)                                                */
/* -------------------------------------------------------------------------- */

function ProgressRing({
  value,
  total,
  size = 96,
  stroke = 9,
}: {
  value: number;
  total: number;
  size?: number;
  stroke?: number;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = total ? value / total : 0;
  return (
    <div
      className="relative flex flex-shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${value} arrivés sur ${total}`}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ transform: 'rotate(-90deg)' }}
        aria-hidden
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-surface-elevated)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-sage-500)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${pct * c} ${c}`}
          style={{ transition: 'stroke-dasharray .5s var(--ease-out-quint)' }}
        />
      </svg>
      <span className="absolute flex flex-col items-center">
        <b className="font-mono text-xl font-medium text-[color:var(--color-foreground)] tabular-nums">
          {Math.round(pct * 100)}%
        </b>
        <span className="font-mono text-[9px] tracking-[0.16em] text-[color:var(--color-muted-foreground)] uppercase">
          arrivés
        </span>
      </span>
    </div>
  );
}

interface ArrivalFeed {
  id: string;
  name: string;
  time: string;
  by: string;
}

const CHECKIN_STAFF = ['Camille F.', 'Yann M.', 'Noé B.'];

export function CheckinTab({ guests, guestTotal }: { guests: HubGuestRow[]; guestTotal: number }) {
  const { items, toast } = useToast();
  const [checkedIn, setCheckedIn] = useState<Set<string>>(() => new Set());
  const [offline, setOffline] = useState(false);
  const [queue, setQueue] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [feed, setFeed] = useState<ArrivalFeed[]>([]);
  const [scanResult, setScanResult] = useState<{ name: string; plusOnes: number } | null>(null);

  // On ne suit le check-in que parmi les invités confirmés / en attente présents.
  const eligible = useMemo(() => guests.filter((g) => g.rsvpStatus !== 'declined'), [guests]);
  const total = Math.max(guestTotal, eligible.length);
  const arrived = checkedIn.size;

  const nowTime = () =>
    new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  const doCheckin = useCallback(
    (g: HubGuestRow, viaScan?: boolean) => {
      if (checkedIn.has(g._id)) return;
      setCheckedIn((s) => new Set(s).add(g._id));
      const time = nowTime();
      const by = CHECKIN_STAFF[(g.fullName.length + arrived) % CHECKIN_STAFF.length]!;
      setFeed((f) => [{ id: g._id, name: g.fullName, time, by }, ...f]);
      if (offline) setQueue((q) => [...q, g._id]);
      toast(
        CircleCheck,
        <span>
          <b>{g.fullName}</b> · arrivé{g.plusOnesAllowed ? ` +${g.plusOnesAllowed}` : ''}
          {offline ? ' (en file)' : ''}
        </span>,
      );
      if (viaScan) setScanResult({ name: g.fullName, plusOnes: g.plusOnesAllowed });
    },
    [checkedIn, offline, toast, arrived],
  );

  const undo = useCallback((id: string) => {
    setCheckedIn((s) => {
      const n = new Set(s);
      n.delete(id);
      return n;
    });
    setQueue((q) => q.filter((x) => x !== id));
    setFeed((f) => f.filter((x) => x.id !== id));
  }, []);

  const simulateScan = useCallback(() => {
    const next = eligible.find((g) => !checkedIn.has(g._id));
    if (!next) {
      toast(CircleCheck, <span>Tous les invités sont arrivés</span>);
      return;
    }
    doCheckin(next, true);
    setTimeout(() => setScanResult(null), 2400);
  }, [eligible, checkedIn, doCheckin, toast]);

  const toggleNet = useCallback(() => {
    if (offline) {
      const n = queue.length;
      setOffline(false);
      if (n) {
        setTimeout(() => {
          setQueue([]);
          toast(
            RefreshCw,
            <span>
              <b>{n}</b> arrivée{n > 1 ? 's' : ''} synchronisée{n > 1 ? 's' : ''}
            </span>,
          );
        }, 600);
      }
    } else {
      setOffline(true);
      toast(
        WifiOff,
        <span>
          Mode <b>hors-ligne</b> — synchro au retour du réseau
        </span>,
      );
    }
  }, [offline, queue.length, toast]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let g = eligible;
    if (q) g = g.filter((x) => x.fullName.toLowerCase().includes(q) || (x.phone ?? '').includes(q));
    return [...g].sort((a, b) => (checkedIn.has(a._id) ? 1 : 0) - (checkedIn.has(b._id) ? 1 : 0));
  }, [search, eligible, checkedIn]);

  if (eligible.length === 0) {
    return (
      <EmptyState
        icon={UserCheck}
        title="Aucun invité à accueillir"
        body="Le check-in jour J listera ici vos invités confirmés. Ajoutez des invités et publiez l’événement pour préparer l’accueil."
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <Toaster items={items} />
      {/* progression */}
      <div className="flex flex-col gap-5 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5 sm:flex-row sm:items-center">
        <ProgressRing value={arrived} total={total} />
        <div className="flex flex-1 flex-col gap-2">
          <h2 className="font-display text-xl text-[color:var(--color-foreground)] italic">
            <span className="font-mono not-italic tabular-nums">{arrived}</span> /{' '}
            <span className="font-mono not-italic tabular-nums">{total}</span> arrivés
          </h2>
          <p className="text-sm text-[color:var(--color-muted-foreground)]">
            {total - arrived} invités encore attendus ·{' '}
            {feed.length ? `dernière arrivée ${feed[0]!.time}` : 'aucune arrivée'}
          </p>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[color:var(--color-surface-elevated)]">
            <span
              className="block h-full rounded-full bg-[color:var(--color-sage-500)] transition-[width] duration-500"
              style={{ width: `${(arrived / total) * 100}%` }}
            />
          </div>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-mono text-[11px]"
            style={
              offline
                ? { background: 'oklch(28% 0.04 25)', color: 'oklch(82% 0.07 22)' }
                : { background: 'oklch(26% 0.04 145)', color: 'oklch(82% 0.07 145)' }
            }
            role="status"
          >
            {offline ? (
              <>
                <WifiOff className="h-3.5 w-3.5" strokeWidth={1.9} aria-hidden /> Hors-ligne —{' '}
                <b className="tabular-nums">{queue.length}</b> en attente
              </>
            ) : (
              <>
                <Wifi className="h-3.5 w-3.5" strokeWidth={1.9} aria-hidden /> En ligne ·
                synchronisé
              </>
            )}
          </span>
          <button
            type="button"
            onClick={toggleNet}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--color-border)] px-3 py-1.5 text-xs text-[color:var(--color-foreground)] transition-colors hover:border-[color:var(--color-border-strong)]"
          >
            {offline ? (
              <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.9} aria-hidden />
            ) : (
              <CloudOff className="h-3.5 w-3.5" strokeWidth={1.9} aria-hidden />
            )}
            {offline ? 'Repasser en ligne' : 'Simuler hors-ligne'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* scanner QR */}
        <Panel title="Scanner QR">
          <div
            className="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-ink-700)]"
            role="img"
            aria-label="Viseur du scanner QR"
          >
            <div className="relative h-2/3 w-2/3">
              <span className="absolute top-0 left-0 h-6 w-6 rounded-tl-lg border-t-2 border-l-2 border-[color:var(--color-blush-300)]" />
              <span className="absolute top-0 right-0 h-6 w-6 rounded-tr-lg border-t-2 border-r-2 border-[color:var(--color-blush-300)]" />
              <span className="absolute bottom-0 left-0 h-6 w-6 rounded-bl-lg border-b-2 border-l-2 border-[color:var(--color-blush-300)]" />
              <span className="absolute right-0 bottom-0 h-6 w-6 rounded-br-lg border-r-2 border-b-2 border-[color:var(--color-blush-300)]" />
              <span className="absolute inset-x-0 top-1/2 h-px bg-[color:var(--color-blush-300)]/70 shadow-[0_0_8px_var(--color-blush-300)]" />
            </div>
            {scanResult ? (
              <div
                className="absolute inset-x-3.5 bottom-3.5 flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 shadow-[var(--shadow-lifted)]"
                style={{ background: 'oklch(26% 0.04 145)' }}
                role="status"
              >
                <CircleCheck
                  className="h-[18px] w-[18px] text-[color:var(--color-sage-500)]"
                  strokeWidth={2}
                  aria-hidden
                />
                <span className="text-sm font-semibold text-[color:var(--color-foreground)]">
                  {scanResult.name}
                  {scanResult.plusOnes ? ` · +${scanResult.plusOnes}` : ''} — arrivé
                </span>
              </div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={simulateScan}
            className="focus-ring inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[color:var(--color-primary)] px-5 py-2.5 text-sm font-semibold text-[color:var(--color-primary-foreground)] transition-colors hover:bg-[color:var(--color-primary-hover)]"
          >
            <ScanLine className="h-4 w-4" strokeWidth={2} aria-hidden /> Simuler un scan QR
          </button>
          <p className="text-center text-xs text-[color:var(--color-muted-foreground)]">
            Présentez le QR de l’invitation devant la caméra
          </p>
        </Panel>

        {/* liste de recherche */}
        <div className="flex flex-col gap-3 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5">
          <label className="flex items-center gap-2 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-elevated)] px-3 py-2.5">
            <Search
              className="h-[18px] w-[18px] text-[color:var(--color-muted-foreground)]"
              strokeWidth={1.9}
              aria-hidden
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher par nom ou téléphone…"
              aria-label="Rechercher un invité"
              className="w-full bg-transparent text-sm text-[color:var(--color-foreground)] outline-none placeholder:text-[color:var(--color-muted-foreground)]"
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Effacer"
                className="text-[color:var(--color-muted-foreground)] hover:text-[color:var(--color-foreground)]"
              >
                <X className="h-4 w-4" strokeWidth={2} aria-hidden />
              </button>
            ) : null}
          </label>
          <div className="flex max-h-[360px] flex-col gap-2 overflow-y-auto pr-1">
            {filtered.length === 0 ? (
              <div className="py-8 text-center text-sm text-[color:var(--color-muted-foreground)]">
                Aucun invité ne correspond.
              </div>
            ) : (
              filtered.map((g) => {
                const inHere = checkedIn.has(g._id);
                return (
                  <div
                    key={g._id}
                    className={cn(
                      'flex items-center gap-3 rounded-xl border px-3.5 py-2.5',
                      inHere
                        ? 'border-[color:var(--color-sage-500)]/30 bg-[color:var(--color-sage-500)]/8'
                        : 'border-[color:var(--color-border)]',
                    )}
                  >
                    <div className="flex flex-1 flex-col">
                      <b className="text-sm text-[color:var(--color-foreground)]">{g.fullName}</b>
                      <span className="text-xs text-[color:var(--color-muted-foreground)]">
                        {g.phone ?? '—'}
                        {g.plusOnesAllowed ? (
                          <span className="ml-1.5 text-[color:var(--color-blush-300)]">
                            +{g.plusOnesAllowed} accomp.
                          </span>
                        ) : null}
                      </span>
                    </div>
                    {inHere ? (
                      <>
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-[color:var(--color-sage-500)]">
                          <Check className="h-3.5 w-3.5" strokeWidth={2.4} aria-hidden /> Arrivé
                        </span>
                        <button
                          type="button"
                          onClick={() => undo(g._id)}
                          aria-label={`Annuler l’arrivée de ${g.fullName}`}
                          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-[color:var(--color-muted-foreground)] transition-colors hover:text-[color:var(--color-foreground)]"
                        >
                          <RotateCcw className="h-3.5 w-3.5" strokeWidth={2} aria-hidden /> Annuler
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => doCheckin(g)}
                        aria-label={`Marquer ${g.fullName} arrivé`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface-elevated)] px-3 py-1.5 text-xs font-medium text-[color:var(--color-foreground)] transition-colors hover:border-[color:var(--color-blush-400)]"
                      >
                        <UserCheck className="h-4 w-4" strokeWidth={2} aria-hidden /> Marquer arrivé
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* arrivées récentes */}
      <Panel title="Arrivées récentes" sub={`${arrived} via cette session`}>
        {feed.length === 0 ? (
          <p className="text-sm text-[color:var(--color-muted-foreground)]">
            Les arrivées que vous enregistrez apparaîtront ici, les plus récentes en premier.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {feed.slice(0, 8).map((f, i) => (
              <div
                key={`${f.id}-${i}`}
                className="flex items-center gap-3 rounded-xl border border-[color:var(--color-border)] px-3.5 py-2.5"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[color:var(--color-sage-500)]/12 text-[color:var(--color-sage-500)]">
                  <UserCheck className="h-4 w-4" strokeWidth={1.9} aria-hidden />
                </span>
                <div className="flex flex-1 flex-col">
                  <b className="text-sm text-[color:var(--color-foreground)]">{f.name}</b>
                  <span className="text-xs text-[color:var(--color-muted-foreground)]">
                    par {f.by}
                  </span>
                </div>
                <span className="font-mono text-xs text-[color:var(--color-muted-foreground)] tabular-nums">
                  {f.time}
                </span>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  ONGLET · PLAN DE TABLE (aperçu placement)                                 */
/* -------------------------------------------------------------------------- */

const SEAT_CAPS = [10, 10, 8, 8, 10, 8, 8, 10, 8, 8, 10, 8];

export function SeatingTab({
  guests,
  guestTotal,
  eventHref,
}: {
  guests: HubGuestRow[];
  guestTotal: number;
  eventHref: (sub: string) => string;
}) {
  const eligible = useMemo(() => guests.filter((g) => g.rsvpStatus !== 'declined'), [guests]);
  // Placement en session : map invité -> index de table.
  const [seats, setSeats] = useState<Record<string, number>>({});

  const tables = useMemo(
    () =>
      SEAT_CAPS.map((capacity, i) => ({
        id: i,
        label: i === 6 ? 'Table d’honneur' : `Table ${i + 1}`,
        capacity,
        occupants: eligible.filter((g) => seats[g._id] === i),
      })),
    [eligible, seats],
  );

  const unassigned = eligible.filter((g) => seats[g._id] === undefined);
  const placedUnits = eligible.length - unassigned.length;
  const totalUnits = Math.max(guestTotal, eligible.length);

  function assign(id: string) {
    const table = tables.find((t) => t.occupants.length < t.capacity);
    if (!table) return;
    setSeats((s) => ({ ...s, [id]: table.id }));
  }
  function unassign(id: string) {
    setSeats((s) => {
      const next = { ...s };
      delete next[id];
      return next;
    });
  }

  if (eligible.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="Aucun invité à placer"
        body="Le plan de table se construit à partir de vos invités confirmés. Ajoutez des invités pour commencer le placement."
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5">
        <div className="flex flex-col">
          <span className="font-mono text-[10px] tracking-[0.16em] text-[color:var(--color-muted-foreground)] uppercase">
            {tables.length} tables
          </span>
          <b className="font-display text-xl text-[color:var(--color-foreground)] italic">
            <span className="font-mono not-italic tabular-nums">{placedUnits}</span> / {totalUnits}{' '}
            placés
          </b>
        </div>
        <div className="flex items-center gap-3">
          <div className="h-1.5 w-40 overflow-hidden rounded-full bg-[color:var(--color-surface-elevated)]">
            <span
              className="block h-full rounded-full bg-[color:var(--color-blush-400)]"
              style={{ width: `${(placedUnits / Math.max(1, eligible.length)) * 100}%` }}
            />
          </div>
          <Link
            href={eventHref('seating') as never}
            className="inline-flex items-center gap-1 font-mono text-[10px] tracking-[0.12em] text-[color:var(--color-blush-300)] uppercase hover:text-[color:var(--color-foreground)]"
          >
            Plan complet <ArrowUpRight className="h-3 w-3" strokeWidth={2} aria-hidden />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_300px]">
        {/* tables */}
        <div className="grid grid-cols-2 gap-3 self-start sm:grid-cols-3">
          {tables.map((t) => {
            const full = t.occupants.length >= t.capacity;
            return (
              <div
                key={t.id}
                className="flex flex-col gap-2 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-3.5"
              >
                <div className="flex items-center justify-between">
                  <b className="text-sm text-[color:var(--color-foreground)]">{t.label}</b>
                  <span
                    className={cn(
                      'font-mono text-[11px] tabular-nums',
                      full
                        ? 'text-[color:var(--color-sage-500)]'
                        : 'text-[color:var(--color-muted-foreground)]',
                    )}
                  >
                    {t.occupants.length}/{t.capacity}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {Array.from({ length: t.capacity }).map((_, i) => {
                    const occ = t.occupants[i];
                    return occ ? (
                      <button
                        key={i}
                        type="button"
                        onClick={() => unassign(occ._id)}
                        title={`${occ.fullName} — retirer`}
                        aria-label={`Retirer ${occ.fullName}`}
                      >
                        <Avatar name={occ.fullName} size={22} />
                      </button>
                    ) : (
                      <span
                        key={i}
                        className="h-[22px] w-[22px] rounded-full border border-dashed border-[color:var(--color-border-strong)]"
                        aria-hidden
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* non placés */}
        <div className="flex flex-col gap-3 self-start rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base text-[color:var(--color-foreground)] italic">
              Non placés
            </h3>
            <span className="font-mono text-[11px] text-[color:var(--color-muted-foreground)] tabular-nums">
              {unassigned.length}
            </span>
          </div>
          {unassigned.length === 0 ? (
            <p className="text-sm text-[color:var(--color-muted-foreground)]">
              Tous les invités confirmés sont placés. 🎉
            </p>
          ) : (
            <div className="flex max-h-[420px] flex-col gap-1.5 overflow-y-auto pr-1">
              {unassigned.map((g) => (
                <div
                  key={g._id}
                  className="flex items-center gap-2.5 rounded-xl border border-[color:var(--color-border)] px-3 py-2"
                >
                  <Avatar name={g.fullName} size={24} />
                  <span className="flex-1 truncate text-sm text-[color:var(--color-foreground)]">
                    {g.fullName}
                  </span>
                  <button
                    type="button"
                    onClick={() => assign(g._id)}
                    className="rounded-lg border border-[color:var(--color-border-strong)] px-2 py-1 text-xs text-[color:var(--color-muted-foreground)] transition-colors hover:text-[color:var(--color-foreground)]"
                  >
                    Placer
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  ONGLET · GALERIE (modération agence)                                      */
/* -------------------------------------------------------------------------- */

interface HubPhoto {
  id: string;
  seed: number;
  album: string;
  status: 'pending' | 'approved' | 'rejected';
  by: string;
  flag?: string;
  reason?: string;
}

const GAL_ALBUMS = ['Cérémonie', 'Cocktail', 'Soirée'];
function photoBg(seed: number): string {
  const h1 = (seed * 47) % 360;
  const h2 = (seed * 47 + 40) % 360;
  return `linear-gradient(135deg, oklch(42% 0.07 ${h1}), oklch(28% 0.05 ${h2}))`;
}
const GAL_SEED: ReadonlyArray<HubPhoto> = [
  { id: 'p1', seed: 1, album: 'Cérémonie', status: 'pending', by: 'Aminata D.' },
  {
    id: 'p2',
    seed: 2,
    album: 'Cérémonie',
    status: 'pending',
    by: 'Hugo L.',
    flag: 'Visage non détecté',
  },
  { id: 'p3', seed: 3, album: 'Cocktail', status: 'pending', by: 'Sophie M.' },
  { id: 'p4', seed: 4, album: 'Soirée', status: 'pending', by: 'Mehdi H.' },
  {
    id: 'p5',
    seed: 5,
    album: 'Cocktail',
    status: 'pending',
    by: 'Awa T.',
    flag: 'Contenu sensible',
  },
  { id: 'p6', seed: 6, album: 'Cérémonie', status: 'pending', by: 'Camille B.' },
  { id: 'p7', seed: 7, album: 'Soirée', status: 'pending', by: 'Yacine M.' },
  { id: 'p8', seed: 8, album: 'Cocktail', status: 'pending', by: 'Fatou S.' },
  { id: 'p11', seed: 11, album: 'Cérémonie', status: 'approved', by: 'Aminata D.' },
  { id: 'p12', seed: 12, album: 'Cocktail', status: 'approved', by: 'Sophie M.' },
  { id: 'p13', seed: 13, album: 'Soirée', status: 'approved', by: 'Mehdi H.' },
  { id: 'p16', seed: 16, album: 'Cérémonie', status: 'rejected', by: 'Hugo L.', reason: 'Flou' },
];

export function GalleryTab() {
  const { items, toast } = useToast();
  const [photos, setPhotos] = useState<HubPhoto[]>(() => GAL_SEED.map((p) => ({ ...p })));
  const [sub, setSub] = useState<HubPhoto['status']>('pending');
  const [album, setAlbum] = useState<string>('all');
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [lightbox, setLightbox] = useState<HubPhoto | null>(null);

  const counts = useMemo(
    () => ({
      pending: photos.filter((p) => p.status === 'pending').length,
      approved: photos.filter((p) => p.status === 'approved').length,
      rejected: photos.filter((p) => p.status === 'rejected').length,
    }),
    [photos],
  );

  const list = useMemo(
    () =>
      photos.filter((p) => p.status === sub).filter((p) => album === 'all' || p.album === album),
    [photos, sub, album],
  );

  const setStatus = useCallback((ids: string[], status: HubPhoto['status'], reason?: string) => {
    const set = new Set(ids);
    setPhotos((ps) =>
      ps.map((p) =>
        set.has(p.id)
          ? { ...p, status, reason: status === 'rejected' ? (reason ?? 'Rejet manuel') : undefined }
          : p,
      ),
    );
    setSelected((s) => {
      const n = new Set(s);
      ids.forEach((i) => n.delete(i));
      return n;
    });
  }, []);

  const approve = (id: string) => {
    setStatus([id], 'approved');
    toast(ThumbsUp, <span>Photo approuvée</span>);
  };
  const reject = (id: string) => {
    setStatus([id], 'rejected', 'Rejet manuel');
    toast(ThumbsDown, <span>Photo rejetée</span>);
  };
  const bulkApprove = () => {
    const ids = [...selected];
    setStatus(ids, 'approved');
    toast(
      ThumbsUp,
      <span>
        <b>{ids.length}</b> photos approuvées
      </span>,
    );
  };
  const bulkReject = () => {
    const ids = [...selected];
    setStatus(ids, 'rejected', 'Rejet groupé');
    toast(
      ThumbsDown,
      <span>
        <b>{ids.length}</b> photos rejetées
      </span>,
    );
  };
  const toggleSel = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const SUBS: ReadonlyArray<[HubPhoto['status'], string, number]> = [
    ['pending', 'En attente', counts.pending],
    ['approved', 'Approuvées', counts.approved],
    ['rejected', 'Rejetées', counts.rejected],
  ];

  return (
    <div className="flex flex-col gap-5">
      <Toaster items={items} />
      {/* sous-onglets */}
      <div
        className="flex items-center gap-1 self-start rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-1"
        role="tablist"
        aria-label="Modération photos"
      >
        {SUBS.map(([k, l, c]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={sub === k}
            onClick={() => setSub(k)}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors',
              sub === k
                ? 'bg-[color:var(--color-surface-elevated)] font-medium text-[color:var(--color-foreground)]'
                : 'text-[color:var(--color-muted-foreground)] hover:text-[color:var(--color-foreground)]',
            )}
          >
            {l}
            <span className="rounded-full bg-[color:var(--color-surface-elevated)] px-1.5 font-mono text-[10px] tabular-nums">
              {c}
            </span>
          </button>
        ))}
      </div>

      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-1">
          {['all', ...GAL_ALBUMS].map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setAlbum(a)}
              className={cn(
                'rounded-lg px-2.5 py-1.5 text-xs transition-colors',
                album === a
                  ? 'bg-[color:var(--color-surface-elevated)] font-medium text-[color:var(--color-foreground)]'
                  : 'text-[color:var(--color-muted-foreground)] hover:text-[color:var(--color-foreground)]',
              )}
            >
              {a === 'all' ? 'Tous les albums' : a}
            </button>
          ))}
        </div>
        <span className="flex-1" />
        {sub === 'pending' && selected.size > 0 ? (
          <>
            <span className="font-mono text-xs text-[color:var(--color-muted-foreground)]">
              <b className="text-[color:var(--color-foreground)]">{selected.size}</b> sélectionnées
            </span>
            <button
              type="button"
              onClick={bulkApprove}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--color-border-strong)] px-3 py-1.5 text-xs text-[color:var(--color-foreground)] transition-colors hover:border-[color:var(--color-sage-500)]"
            >
              <ThumbsUp className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden /> Tout approuver
            </button>
            <button
              type="button"
              onClick={bulkReject}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--color-border-strong)] px-3 py-1.5 text-xs text-[color:var(--color-danger)] transition-colors hover:border-[color:var(--color-danger)]"
            >
              <ThumbsDown className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden /> Tout rejeter
            </button>
          </>
        ) : null}
        <button
          type="button"
          onClick={() =>
            toast(Download, <span>Archive ZIP de {counts.approved} photos en préparation</span>)
          }
          className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--color-border)] px-3 py-1.5 text-xs text-[color:var(--color-foreground)] transition-colors hover:border-[color:var(--color-border-strong)]"
        >
          <Download className="h-3.5 w-3.5" strokeWidth={1.9} aria-hidden /> Tout télécharger
        </button>
      </div>

      {list.length === 0 ? (
        <EmptyState
          icon={sub === 'pending' ? CircleCheck : Images}
          title={sub === 'pending' ? 'Aucune photo à modérer' : 'Rien à afficher'}
          body={
            sub === 'pending'
              ? 'Toutes les photos déposées par les invités ont été traitées. Les nouvelles arrivées apparaîtront ici avant publication.'
              : 'Aucune photo dans cet album pour ce statut.'
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {list.map((p) => (
            <div
              key={p.id}
              className={cn(
                'group relative overflow-hidden rounded-2xl border',
                selected.has(p.id)
                  ? 'border-[color:var(--color-blush-400)]'
                  : 'border-[color:var(--color-border)]',
              )}
            >
              <div
                className="relative flex aspect-[4/3] items-center justify-center"
                style={{ background: photoBg(p.seed) }}
              >
                <Camera className="h-7 w-7 text-white/40" strokeWidth={1.4} aria-hidden />
                {sub === 'pending' ? (
                  <label className="absolute top-2 left-2 flex h-5 w-5 cursor-pointer items-center justify-center rounded-md bg-black/40 backdrop-blur-sm">
                    <input
                      type="checkbox"
                      checked={selected.has(p.id)}
                      onChange={() => toggleSel(p.id)}
                      aria-label={`Sélectionner la photo de ${p.by}`}
                      className="accent-[color:var(--color-blush-400)]"
                    />
                  </label>
                ) : null}
                {p.flag && sub === 'pending' ? (
                  <span
                    className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-full bg-[color:var(--color-warning)]/90 px-2 py-0.5 text-[10px] font-medium text-[color:var(--color-ink-700)]"
                    title={`Signalé : ${p.flag}`}
                  >
                    <ShieldAlert className="h-3 w-3" strokeWidth={2} aria-hidden /> {p.flag}
                  </span>
                ) : null}
                {sub !== 'pending' ? (
                  <span
                    className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
                    style={
                      sub === 'approved'
                        ? { background: 'oklch(26% 0.04 145)', color: 'oklch(82% 0.07 145)' }
                        : { background: 'oklch(28% 0.04 25)', color: 'oklch(82% 0.07 22)' }
                    }
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />{' '}
                    {sub === 'approved' ? 'Approuvée' : 'Rejetée'}
                  </span>
                ) : null}
                <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/55 opacity-0 transition-opacity group-hover:opacity-100">
                  {sub === 'pending' ? (
                    <>
                      <button
                        type="button"
                        onClick={() => approve(p.id)}
                        aria-label="Approuver"
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-[color:var(--color-sage-500)] text-[color:var(--color-ink-700)]"
                      >
                        <Check className="h-5 w-5" strokeWidth={2.4} aria-hidden />
                      </button>
                      <button
                        type="button"
                        onClick={() => setLightbox(p)}
                        aria-label="Agrandir"
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-[color:var(--color-ink-700)]"
                      >
                        <ZoomIn className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
                      </button>
                      <button
                        type="button"
                        onClick={() => reject(p.id)}
                        aria-label="Rejeter"
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-[color:var(--color-danger)] text-white"
                      >
                        <X className="h-5 w-5" strokeWidth={2.4} aria-hidden />
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setLightbox(p)}
                      aria-label="Agrandir"
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-[color:var(--color-ink-700)]"
                    >
                      <ZoomIn className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
                    </button>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-xs text-[color:var(--color-foreground)]">{p.by}</span>
                <span className="font-mono text-[10px] text-[color:var(--color-muted-foreground)]">
                  {p.album}
                </span>
              </div>
              {sub === 'rejected' && p.reason ? (
                <div className="flex items-center gap-1 border-t border-[color:var(--color-border)] px-3 py-1.5 text-[11px] text-[color:var(--color-danger)]">
                  <X className="h-3 w-3" strokeWidth={2.2} aria-hidden /> Motif : {p.reason}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {/* stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <GalStat label="Approuvées" value={counts.approved} />
        <GalStat label="En attente" value={counts.pending} />
        <GalStat label="Rejetées" value={counts.rejected} />
      </div>

      {lightbox ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
          role="dialog"
          aria-modal="true"
          aria-label={`Photo de ${lightbox.by}`}
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            onClick={() => setLightbox(null)}
            aria-label="Fermer"
            className="absolute top-5 right-5 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white"
          >
            <X className="h-5 w-5" strokeWidth={2} aria-hidden />
          </button>
          <div
            className="flex aspect-[4/3] w-full max-w-2xl items-center justify-center rounded-2xl"
            style={{ background: photoBg(lightbox.seed) }}
            onClick={(e) => e.stopPropagation()}
          >
            <Camera className="h-12 w-12 text-white/40" strokeWidth={1.3} aria-hidden />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function GalStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4">
      <span className="font-mono text-[10px] tracking-[0.16em] text-[color:var(--color-muted-foreground)] uppercase">
        {label}
      </span>
      <span className="font-mono text-2xl font-medium text-[color:var(--color-foreground)] tabular-nums">
        {value}
      </span>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  ONGLET · FACTURE (registre de facturation de l'événement)                */
/* -------------------------------------------------------------------------- */

function facEur(n: number): string {
  const hasDec = Math.round(n) !== n;
  const s = n.toLocaleString(
    'fr-FR',
    hasDec ? { minimumFractionDigits: 2, maximumFractionDigits: 2 } : {},
  );
  return s.replace(/\s/g, ' ') + ' €';
}

interface BillingPayment {
  id: string;
  date: string;
  label: string;
  amount: number;
  status: 'paid' | 'pending' | 'failed';
}

const FAC_STATUS: Record<BillingPayment['status'], { label: string; color: string }> = {
  paid: { label: 'Payé', color: SAGE },
  pending: { label: 'En attente', color: AMBER },
  failed: { label: 'Échoué', color: RED },
};

export function FactureTab({
  plan,
  eventNo,
  eventCap,
}: {
  plan: string;
  eventNo: number;
  eventCap: number | null;
}) {
  const { items, toast } = useToast();
  const [mode, setMode] = useState<'subscription' | 'payg'>('subscription');
  const isSub = mode === 'subscription';

  const data = isSub
    ? {
        title: `Couvert par l’abonnement ${plan}`,
        desc: `Ce mariage est l’un des ${eventCap ?? '—'} événements actifs inclus dans votre forfait. Aucun coût supplémentaire — les dépassements éventuels (messages, stockage) sont facturés sur votre relevé mensuel.`,
        line: {
          label: `Événement inclus · forfait ${plan}`,
          amount: 0,
          note: eventCap ? `${eventNo}ᵉ / ${eventCap} événements` : `${eventNo}ᵉ événement`,
        },
        payments: [
          {
            id: 'ev1',
            date: '1ᵉʳ juin 2026',
            label: 'Activation événement · abonnement',
            amount: 0,
            status: 'paid' as const,
          },
          {
            id: 'ev2',
            date: '14 juin 2026',
            label: 'Dépassement messages (320 × 0,06 €)',
            amount: 19.2,
            status: 'paid' as const,
          },
          {
            id: 'ev3',
            date: '2 juil. 2026',
            label: 'Stockage galerie (12 Go au-delà du cap)',
            amount: 0.36,
            status: 'pending' as const,
          },
        ],
      }
    : {
        title: 'Payé à l’usage (Pay-as-you-go)',
        desc: 'Ce mariage a été réglé à l’unité, sans abonnement. Un crédit événement couvre l’accès complet — invitations, RSVP, check-in, galerie et plan de table.',
        line: { label: '1 crédit événement (PAYG)', amount: 79, note: 'sans abonnement' },
        payments: [
          {
            id: 'pv1',
            date: '12 mai 2026',
            label: 'Crédit événement · Pay-as-you-go',
            amount: 79,
            status: 'paid' as const,
          },
          {
            id: 'pv2',
            date: '14 juin 2026',
            label: 'Dépassement messages (210 × 0,06 €)',
            amount: 12.6,
            status: 'paid' as const,
          },
          {
            id: 'pv3',
            date: '28 juin 2026',
            label: 'Invités au-delà du cap (8 × 0,25 €)',
            amount: 2,
            status: 'failed' as const,
          },
        ],
      };

  function download(p: BillingPayment) {
    if (p.status !== 'paid') return;
    toast(
      Download,
      <span>
        Facture <b>{p.label.split('·')[0]!.trim()}</b> — téléchargement PDF lancé
      </span>,
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <Toaster items={items} />
      {/* bascule abonnement / PAYG */}
      <div
        className="flex items-center gap-1 self-start rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-1"
        role="group"
        aria-label="Mode de facturation"
      >
        <span className="px-2 font-mono text-[9px] tracking-[0.16em] text-[color:var(--color-muted-foreground)] uppercase">
          Facturation
        </span>
        {(
          [
            ['subscription', 'Abonnement'],
            ['payg', 'Pay-as-you-go'],
          ] as const
        ).map(([k, l]) => (
          <button
            key={k}
            type="button"
            aria-pressed={mode === k}
            onClick={() => setMode(k)}
            className={cn(
              'rounded-lg px-3 py-1.5 text-xs transition-colors',
              mode === k
                ? 'bg-[color:var(--color-surface-elevated)] font-medium text-[color:var(--color-foreground)]'
                : 'text-[color:var(--color-muted-foreground)] hover:text-[color:var(--color-foreground)]',
            )}
          >
            {l}
          </button>
        ))}
      </div>

      {/* carte de statut */}
      <div className="flex items-start gap-4 rounded-3xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6">
        <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-[color:var(--color-surface-elevated)] text-[color:var(--color-blush-300)]">
          {isSub ? (
            <CreditCard className="h-6 w-6" strokeWidth={1.8} aria-hidden />
          ) : (
            <Coins className="h-6 w-6" strokeWidth={1.8} aria-hidden />
          )}
        </span>
        <div className="flex flex-1 flex-col gap-2">
          <span className="font-mono text-[10px] tracking-[0.16em] text-[color:var(--color-muted-foreground)] uppercase">
            Facturation de l’événement
          </span>
          <h2 className="font-display text-xl text-[color:var(--color-foreground)] italic">
            {data.title}
          </h2>
          <p className="max-w-xl text-sm text-[color:var(--color-muted-foreground)]">{data.desc}</p>
          <div className="mt-2 flex items-center justify-between rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-elevated)] px-4 py-3">
            <span className="flex flex-col">
              <b className="text-sm text-[color:var(--color-foreground)]">{data.line.label}</b>
              <span className="text-xs text-[color:var(--color-muted-foreground)]">
                {data.line.note}
              </span>
            </span>
            <span
              className={cn(
                'font-mono text-sm tabular-nums',
                data.line.amount === 0
                  ? 'text-[color:var(--color-sage-500)]'
                  : 'text-[color:var(--color-foreground)]',
              )}
            >
              {data.line.amount === 0 ? 'Inclus' : facEur(data.line.amount)}
            </span>
          </div>
        </div>
      </div>

      {/* paiements */}
      <Panel
        title="Paiements de l’événement"
        sub={`${data.payments.length} mouvements`}
        className="p-0 sm:p-0"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-y border-[color:var(--color-border)] text-left font-mono text-[9px] tracking-[0.18em] text-[color:var(--color-muted-foreground)] uppercase">
                <th className="px-5 py-3 font-medium">Date</th>
                <th className="px-5 py-3 font-medium">Libellé</th>
                <th className="px-5 py-3 text-right font-medium">Montant</th>
                <th className="px-5 py-3 font-medium">Statut</th>
                <th className="px-5 py-3 text-right font-medium">Facture</th>
              </tr>
            </thead>
            <tbody>
              {data.payments.map((p) => {
                const st = FAC_STATUS[p.status];
                return (
                  <tr
                    key={p.id}
                    className="border-b border-[color:var(--color-border)] last:border-0"
                  >
                    <td className="px-5 py-3 font-mono text-xs text-[color:var(--color-muted-foreground)]">
                      {p.date}
                    </td>
                    <td className="px-5 py-3 text-[color:var(--color-foreground)]">{p.label}</td>
                    <td className="px-5 py-3 text-right font-mono tabular-nums">
                      {p.amount === 0 ? (
                        <span className="text-[color:var(--color-sage-500)]">Inclus</span>
                      ) : (
                        <span className="text-[color:var(--color-foreground)]">
                          {facEur(p.amount)}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className="inline-flex items-center gap-1.5 text-xs font-medium"
                        style={{ color: st.color }}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />{' '}
                        {st.label}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => download(p)}
                        disabled={p.status !== 'paid'}
                        title={
                          p.status !== 'paid' ? 'Disponible une fois le paiement abouti' : undefined
                        }
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--color-border)] px-2.5 py-1.5 text-xs text-[color:var(--color-foreground)] transition-colors hover:border-[color:var(--color-border-strong)] disabled:opacity-40"
                      >
                        <Download className="h-3.5 w-3.5" strokeWidth={1.9} aria-hidden /> PDF
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="flex items-start gap-2.5 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4 text-sm text-[color:var(--color-muted-foreground)]">
        <Info
          className="h-[18px] w-[18px] flex-shrink-0 text-[color:var(--color-blush-300)]"
          strokeWidth={1.9}
          aria-hidden
        />
        <p>
          Ceci est le{' '}
          <b className="text-[color:var(--color-foreground)]">
            registre de facturation Wedillybird
          </b>{' '}
          pour cet événement ({isSub ? 'couvert par votre abonnement' : 'réglé à l’usage'}) —
          distinct de la facturation que votre agence émet à ses propres clients. Retrouvez
          l’ensemble de vos paiements dans{' '}
          <Link href="/pro/billing" className="text-[color:var(--color-blush-300)] hover:underline">
            Facturation
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
