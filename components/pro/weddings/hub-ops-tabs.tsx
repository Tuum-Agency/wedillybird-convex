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
import { useFormatter, useLocale, useTranslations } from 'next-intl';
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

const RSVP_PILL: Record<HubGuestRow['rsvpStatus'], { labelKey: string; bg: string; fg: string }> = {
  attending: {
    labelKey: 'rsvpPill.attending',
    bg: 'oklch(26% 0.04 145)',
    fg: 'oklch(82% 0.07 145)',
  },
  declined: { labelKey: 'rsvpPill.declined', bg: 'oklch(28% 0.04 25)', fg: 'oklch(82% 0.07 22)' },
  pending: { labelKey: 'rsvpPill.pending', bg: 'oklch(28% 0.022 78)', fg: 'oklch(85% 0.04 78)' },
  maybe: {
    labelKey: 'rsvpPill.maybe',
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
  const t = useTranslations('Pro.weddings');
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
    { key: 'all', label: t('invites.filterAll') },
    { key: 'attending', label: t('invites.filterAttending') },
    { key: 'pending', label: t('invites.filterPending') },
    { key: 'declined', label: t('invites.filterDeclined') },
  ];

  return (
    <div className="flex flex-col gap-5">
      {/* Synthèse RSVP */}
      <div className="flex flex-col gap-3 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] tracking-[0.16em] text-[color:var(--color-muted-foreground)] uppercase">
            {t('invites.guestCount', { count: total })}
            {guestCap != null ? t('invites.capSuffix', { cap: guestCap }) : ''}
          </span>
          <Link
            href={eventHref('guests') as never}
            className="font-mono text-[10px] tracking-[0.12em] text-[color:var(--color-blush-300)] uppercase hover:text-[color:var(--color-foreground)]"
          >
            {t('invites.manageGuests')}
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
          <RsvpMini color={SAGE} n={rsvp.confirmed} label={t('rsvp.attendingShort')} />
          <RsvpMini color={RED} n={rsvp.declined} label={t('rsvp.declinedShort')} />
          <RsvpMini color={AMBER} n={rsvp.pending} label={t('rsvp.pendingShort')} />
        </div>
      </div>

      {total === 0 ? (
        <EmptyState
          icon={Users}
          title={t('invites.emptyTitle')}
          body={t('invites.emptyBody')}
          cta={
            <Link
              href={eventHref('guests') as never}
              className="text-[color:var(--color-blush-300)] hover:underline"
            >
              {t('invites.emptyCta')}
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
                placeholder={t('invites.searchPlaceholder')}
                aria-label={t('invites.searchAria')}
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
                  <th className="px-4 py-3 font-medium">{t('invites.colGuest')}</th>
                  <th className="px-4 py-3 font-medium">{t('invites.colCategory')}</th>
                  <th className="px-4 py-3 font-medium">{t('invites.colPlusOnes')}</th>
                  <th className="px-4 py-3 font-medium">{t('invites.colRsvp')}</th>
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
                      {t('invites.noMatch')}
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
  const t = useTranslations('Pro.weddings');
  const p = RSVP_PILL[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium"
      style={{ background: p.bg, color: p.fg }}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" aria-hidden />
      {t(p.labelKey)}
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
  nameKey: string;
  descKey: string;
  swatch: [string, string];
  headerKey: string;
  bodyKey: string;
  hasImage: boolean;
}

const MSG_TEMPLATES: ReadonlyArray<MsgTemplate> = [
  {
    id: 'classic',
    nameKey: 'messaging.tpl.classic.name',
    descKey: 'messaging.tpl.classic.desc',
    swatch: ['oklch(34% 0.03 80)', 'oklch(78% 0.1 80)'],
    headerKey: 'messaging.tpl.classic.header',
    bodyKey: 'messaging.tpl.classic.body',
    hasImage: false,
  },
  {
    id: 'photo',
    nameKey: 'messaging.tpl.photo.name',
    descKey: 'messaging.tpl.photo.desc',
    swatch: ['oklch(34% 0.05 25)', 'oklch(76% 0.12 25)'],
    headerKey: 'messaging.tpl.photo.header',
    bodyKey: 'messaging.tpl.photo.body',
    hasImage: true,
  },
  {
    id: 'modern',
    nameKey: 'messaging.tpl.modern.name',
    descKey: 'messaging.tpl.modern.desc',
    swatch: ['oklch(34% 0.04 250)', 'oklch(76% 0.1 250)'],
    headerKey: 'messaging.tpl.modern.header',
    bodyKey: 'messaging.tpl.modern.body',
    hasImage: false,
  },
  {
    id: 'festive',
    nameKey: 'messaging.tpl.festive.name',
    descKey: 'messaging.tpl.festive.desc',
    swatch: ['oklch(36% 0.06 330)', 'oklch(78% 0.12 330)'],
    headerKey: 'messaging.tpl.festive.header',
    bodyKey: 'messaging.tpl.festive.body',
    hasImage: true,
  },
  {
    id: 'sober',
    nameKey: 'messaging.tpl.sober.name',
    descKey: 'messaging.tpl.sober.desc',
    swatch: ['oklch(32% 0.012 80)', 'oklch(72% 0.03 80)'],
    headerKey: 'messaging.tpl.sober.header',
    bodyKey: 'messaging.tpl.sober.body',
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
  const t = useTranslations('Pro.weddings');
  return (
    <aside
      className="flex flex-col gap-3 self-start rounded-3xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4"
      aria-label={t('messaging.previewAria')}
    >
      <div className="flex items-center gap-2.5 border-b border-[color:var(--color-border)] pb-3">
        <Avatar name={`${coupleA} ${coupleB}`} size={36} />
        <div className="flex flex-col">
          <b className="text-sm text-[color:var(--color-foreground)]">
            {coupleA} <span style={{ color: 'var(--color-gold-500)' }}>&amp;</span> {coupleB}
          </b>
          <span className="inline-flex items-center gap-1 font-mono text-[10px] text-[color:var(--color-muted-foreground)]">
            <ShieldCheck className="h-3 w-3" strokeWidth={2} aria-hidden />{' '}
            {t('messaging.verifiedAccount')}
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
          {t(template.headerKey)}
        </div>
        <p className="text-sm leading-relaxed text-[color:var(--color-foreground)]/90">
          {t.rich(template.bodyKey, {
            name: () => (
              <span className="rounded bg-[color:var(--color-blush-500)]/25 px-1 font-medium text-[color:var(--color-blush-300)]">
                {t('messaging.firstNameToken')}
              </span>
            ),
          })}
        </p>
        {perso.trim() ? (
          <p className="mt-2 border-l-2 border-[color:var(--color-gold-500)]/50 pl-2 text-sm text-[color:var(--color-muted-foreground)] italic">
            {t('messaging.persoQuote', { text: perso.trim() })}
          </p>
        ) : null}
        <div className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[color:var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[color:var(--color-blush-300)]">
          <Globe className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />{' '}
          {t('messaging.viewInvitation')}
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
const DELIVERY_STATUS: Record<string, { labelKey: string; Icon: LucideIcon; color: string }> = {
  replied: { labelKey: 'messaging.delivery.replied', Icon: CheckCheck, color: SAGE },
  read: { labelKey: 'messaging.delivery.read', Icon: CheckCheck, color: 'oklch(72% 0.09 250)' },
  delivered: {
    labelKey: 'messaging.delivery.delivered',
    Icon: CheckCheck,
    color: 'var(--color-muted-foreground)',
  },
  sent: {
    labelKey: 'messaging.delivery.sent',
    Icon: Check,
    color: 'var(--color-muted-foreground)',
  },
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
  const t = useTranslations('Pro.weddings');
  const format = useFormatter();
  const hNum = (n: number) => format.number(n);
  const { items, toast } = useToast();
  const [tplId, setTplId] = useState(MSG_TEMPLATES[0]!.id);
  const [perso, setPerso] = useState('');
  const [audience, setAudience] = useState<'all' | 'pending' | 'category'>('pending');
  const [cats, setCats] = useState<Set<string>>(() => new Set());
  const [confirm, setConfirm] = useState(false);
  const [sent, setSent] = useState(false);
  const [rem7, setRem7] = useState(true);
  const [rem1, setRem1] = useState(true);

  const template = MSG_TEMPLATES.find((tpl) => tpl.id === tplId) ?? MSG_TEMPLATES[0]!;
  const [used, cap] = messageQuota;
  const otherCategory = t('messaging.otherCategory');

  const catCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const g of guests) {
      const k = g.category?.trim() || otherCategory;
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [guests, otherCategory]);

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
        title={t('messaging.notPublishedTitle')}
        body={t('messaging.notPublishedBody')}
      />
    );
  }

  // Garde anti-tromperie (F2) : le broadcast agence n'est pas encore câblé à un
  // envoi réel — `doSend` ne fait que simuler un succès puis afficher un rapport
  // de livraison FABRIQUÉ (statuts « livré / lu / répondu » cycliques). Tant que
  // ce n'est pas branché sur un vrai envoi, ne pas laisser une agence croire que
  // des invitations sont parties. Repasser à `true` au câblage.
  const MESSAGING_WIRED: boolean = false;
  if (!MESSAGING_WIRED) {
    return (
      <EmptyState
        icon={Megaphone}
        title="Envoi groupé bientôt disponible"
        body="La messagerie agence est en cours de finalisation. En attendant, envoyez vos invitations depuis l'espace de chaque mariage."
      />
    );
  }

  const AUD: ReadonlyArray<{
    value: 'all' | 'pending' | 'category';
    title: string;
    sub: string;
    count: number;
  }> = [
    {
      value: 'all',
      title: t('messaging.audAllTitle'),
      sub: t('messaging.audAllSub'),
      count: guestTotal,
    },
    {
      value: 'pending',
      title: t('messaging.audPendingTitle'),
      sub: t('messaging.audPendingSub'),
      count: rsvp.pending,
    },
    {
      value: 'category',
      title: t('messaging.audCategoryTitle'),
      sub: t('messaging.audCategorySub'),
      count: catCounts.filter(([k]) => cats.has(k)).reduce((s, [, n]) => s + n, 0),
    },
  ];

  function doSend() {
    setConfirm(false);
    setSent(true);
    toast(Megaphone, <span>{t('messaging.broadcastStarted', { count: recipients })}</span>);
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
            {t('messaging.messagesThisMonth')}{' '}
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
            {t('messaging.billing')}{' '}
            <ArrowUpRight className="h-3 w-3" strokeWidth={2} aria-hidden />
          </Link>
        </div>

        {/* templates */}
        <Panel
          title={t('messaging.styleTitle')}
          sub={t('messaging.templatesCount', { count: MSG_TEMPLATES.length })}
        >
          <div
            className="grid grid-cols-2 gap-2.5 sm:grid-cols-3"
            role="radiogroup"
            aria-label={t('messaging.styleTitle')}
          >
            {MSG_TEMPLATES.map((tpl) => {
              const on = tpl.id === tplId;
              return (
                <button
                  key={tpl.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setTplId(tpl.id)}
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
                    style={{ background: tpl.swatch[0] }}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ background: tpl.swatch[1] }} />
                    <span
                      className="h-1 flex-1 rounded-full"
                      style={{
                        background: `color-mix(in oklab, ${tpl.swatch[1]} 55%, transparent)`,
                      }}
                    />
                  </span>
                  <span className="text-sm font-medium text-[color:var(--color-foreground)]">
                    {t(tpl.nameKey)}
                  </span>
                  <span className="text-[11px] text-[color:var(--color-muted-foreground)]">
                    {t(tpl.descKey)}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="m-perso" className="text-sm text-[color:var(--color-foreground)]">
                {t('messaging.personalMessage')}{' '}
                <span className="text-[color:var(--color-muted-foreground)]">
                  {t('messaging.optional')}
                </span>
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
              placeholder={t('messaging.personalPlaceholder')}
              rows={2}
              className="resize-none rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-elevated)] px-3 py-2.5 text-sm text-[color:var(--color-foreground)] outline-none placeholder:text-[color:var(--color-muted-foreground)] focus:border-[color:var(--color-blush-400)]"
            />
          </div>
        </Panel>

        {/* audience */}
        <Panel
          title={t('messaging.recipientsTitle')}
          sub={t('messaging.recipientsCount', { count: recipients })}
        >
          <div
            className="flex flex-col gap-2"
            role="radiogroup"
            aria-label={t('messaging.audienceAria')}
          >
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
                        {t('messaging.guestUnitAbbr')}
                      </span>
                    </span>
                  </button>
                  {a.value === 'category' && on ? (
                    <div className="flex flex-wrap gap-1.5 pl-1">
                      {catCounts.length === 0 ? (
                        <span className="text-xs text-[color:var(--color-muted-foreground)]">
                          {t('messaging.noCategories')}
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
              {t.rich('messaging.messagesToSend', {
                count: recipients,
                n: (chunks) => <span className="font-mono tabular-nums">{chunks}</span>,
              })}
            </b>
            <span className="text-xs text-[color:var(--color-muted-foreground)]">
              {t('messaging.quotaImpact', {
                used: hNum(used),
                after: hNum(afterUse),
                cap: hNum(cap),
              })}
              {overQuota ? t('messaging.overQuotaSuffix') : ''}
            </span>
          </div>
          <button
            type="button"
            disabled={recipients === 0}
            onClick={() => setConfirm(true)}
            className="focus-ring inline-flex flex-shrink-0 items-center justify-center gap-2 rounded-lg bg-[color:var(--color-primary)] px-5 py-2.5 text-sm font-semibold text-[color:var(--color-primary-foreground)] transition-colors hover:bg-[color:var(--color-primary-hover)] disabled:opacity-50"
          >
            <Megaphone className="h-4 w-4" strokeWidth={1.9} aria-hidden />{' '}
            {t('messaging.broadcastNow')}
          </button>
        </div>

        {/* table de livraison */}
        {sent ? (
          <Panel
            title={t('messaging.deliveryStatus')}
            sub={t('messaging.lastBroadcast', { time: '14:32' })}
            className="p-0 sm:p-0"
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse text-sm">
                <thead>
                  <tr className="border-y border-[color:var(--color-border)] text-left font-mono text-[9px] tracking-[0.18em] text-[color:var(--color-muted-foreground)] uppercase">
                    <th className="px-5 py-3 font-medium">{t('messaging.colGuest')}</th>
                    <th className="px-5 py-3 font-medium">{t('messaging.colChannel')}</th>
                    <th className="px-5 py-3 font-medium">{t('messaging.colStatus')}</th>
                    <th className="px-5 py-3 font-medium">{t('messaging.colTimestamp')}</th>
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
                            {t('messaging.channelWhatsApp')}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className="inline-flex items-center gap-1.5 text-xs font-medium"
                            style={{ color: d.color }}
                          >
                            <d.Icon className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden />{' '}
                            {t(d.labelKey)}
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
        <Panel title={t('messaging.autoReminders')}>
          <div className="flex flex-col gap-2.5">
            <ReminderRow
              label={t('messaging.reminderD7')}
              on={rem7}
              setOn={setRem7}
              next={format.dateTime(new Date('2026-09-05T10:00:00'), {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            />
            <ReminderRow
              label={t('messaging.reminderD1')}
              on={rem1}
              setOn={setRem1}
              next={format.dateTime(new Date('2026-09-11T18:00:00'), {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            />
          </div>
          <p className="text-xs text-[color:var(--color-muted-foreground)]">
            {t('messaging.remindersNote')}
          </p>
        </Panel>
      </div>

      {/* aperçu live */}
      <WaPreview template={template} perso={perso} coupleA={coupleA} coupleB={coupleB} />

      {confirm ? (
        <ConfirmDialog
          eyebrow={t('messaging.confirmEyebrow')}
          Icon={Megaphone}
          title={t('messaging.confirmTitle')}
          onClose={() => setConfirm(false)}
          confirmLabel={t('messaging.confirmCta', { count: recipients })}
          confirmIcon={Send}
          onConfirm={doSend}
        >
          <p className="text-sm text-[color:var(--color-muted-foreground)]">
            {t.rich('messaging.confirmBody', {
              count: recipients,
              style: t(template.nameKey),
              b: (chunks) => <b className="text-[color:var(--color-foreground)]">{chunks}</b>,
            })}
          </p>
          <div className="flex flex-col gap-2 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-elevated)] p-3.5 text-sm">
            <Recap
              k={t('messaging.recapRecipients')}
              v={t('messaging.recipientsCount', { count: recipients })}
            />
            <Recap k={t('messaging.recapConsumed')} v={`${recipients}`} />
            <Recap k={t('messaging.recapQuotaAfter')} v={`${hNum(afterUse)} / ${hNum(cap)}`} hl />
          </div>
          {overQuota ? (
            <p className="inline-flex items-center gap-1.5 text-xs text-[color:var(--color-warning)]">
              <AlertTriangle className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />{' '}
              {t('messaging.overQuotaWarning')}
            </p>
          ) : (
            <p className="text-xs text-[color:var(--color-muted-foreground)]">
              {t('messaging.remainingThisMonth', {
                count: cap - afterUse,
                n: hNum(cap - afterUse),
              })}
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
  const t = useTranslations('Pro.weddings');
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
          {on ? t('messaging.nextRun', { next }) : t('messaging.disabled')}
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
  const t = useTranslations('Pro.weddings');
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        type="button"
        aria-label={t('common.close')}
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
            {t('common.cancel')}
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
  const t = useTranslations('Pro.weddings');
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = total ? value / total : 0;
  return (
    <div
      className="relative flex flex-shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
      role="img"
      aria-label={t('checkin.arrivedOf', { value, total })}
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
          {t('checkin.arrivedLabel')}
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
  const t = useTranslations('Pro.weddings');
  const locale = useLocale();
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

  const nowTime = useCallback(
    () => new Date().toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }),
    [locale],
  );

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
          {t.rich('checkin.arrivedToast', {
            name: g.fullName,
            plusOnes: g.plusOnesAllowed,
            queued: String(offline),
            b: (chunks) => <b>{chunks}</b>,
          })}
        </span>,
      );
      if (viaScan) setScanResult({ name: g.fullName, plusOnes: g.plusOnesAllowed });
    },
    [checkedIn, offline, toast, arrived, nowTime, t],
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
      toast(CircleCheck, <span>{t('checkin.allArrived')}</span>);
      return;
    }
    doCheckin(next, true);
    setTimeout(() => setScanResult(null), 2400);
  }, [eligible, checkedIn, doCheckin, toast, t]);

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
              {t.rich('checkin.syncedToast', {
                count: n,
                b: (chunks) => <b>{chunks}</b>,
              })}
            </span>,
          );
        }, 600);
      }
    } else {
      setOffline(true);
      toast(
        WifiOff,
        <span>
          {t.rich('checkin.offlineToast', {
            b: (chunks) => <b>{chunks}</b>,
          })}
        </span>,
      );
    }
  }, [offline, queue.length, toast, t]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let g = eligible;
    if (q) g = g.filter((x) => x.fullName.toLowerCase().includes(q) || (x.phone ?? '').includes(q));
    return [...g].sort((a, b) => (checkedIn.has(a._id) ? 1 : 0) - (checkedIn.has(b._id) ? 1 : 0));
  }, [search, eligible, checkedIn]);

  if (eligible.length === 0) {
    return (
      <EmptyState icon={UserCheck} title={t('checkin.emptyTitle')} body={t('checkin.emptyBody')} />
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
            {t.rich('checkin.arrivedHeading', {
              arrived,
              total,
              n: (chunks) => <span className="font-mono not-italic tabular-nums">{chunks}</span>,
            })}
          </h2>
          <p className="text-sm text-[color:var(--color-muted-foreground)]">
            {t('checkin.stillExpected', { count: total - arrived })} ·{' '}
            {feed.length
              ? t('checkin.lastArrival', { time: feed[0]!.time })
              : t('checkin.noArrival')}
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
                <WifiOff className="h-3.5 w-3.5" strokeWidth={1.9} aria-hidden />{' '}
                {t.rich('checkin.offlinePending', {
                  count: queue.length,
                  b: (chunks) => <b className="tabular-nums">{chunks}</b>,
                })}
              </>
            ) : (
              <>
                <Wifi className="h-3.5 w-3.5" strokeWidth={1.9} aria-hidden />{' '}
                {t('checkin.onlineSynced')}
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
            {offline ? t('checkin.backOnline') : t('checkin.simulateOffline')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* scanner QR */}
        <Panel title={t('checkin.qrScanner')}>
          <div
            className="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-ink-700)]"
            role="img"
            aria-label={t('checkin.qrViewfinder')}
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
                  {t('checkin.scanResultArrived', {
                    name: scanResult.name,
                    plusOnes: scanResult.plusOnes,
                  })}
                </span>
              </div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={simulateScan}
            className="focus-ring inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[color:var(--color-primary)] px-5 py-2.5 text-sm font-semibold text-[color:var(--color-primary-foreground)] transition-colors hover:bg-[color:var(--color-primary-hover)]"
          >
            <ScanLine className="h-4 w-4" strokeWidth={2} aria-hidden /> {t('checkin.simulateScan')}
          </button>
          <p className="text-center text-xs text-[color:var(--color-muted-foreground)]">
            {t('checkin.scannerHint')}
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
              placeholder={t('checkin.searchPlaceholder')}
              aria-label={t('invites.searchAria')}
              className="w-full bg-transparent text-sm text-[color:var(--color-foreground)] outline-none placeholder:text-[color:var(--color-muted-foreground)]"
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label={t('common.clear')}
                className="text-[color:var(--color-muted-foreground)] hover:text-[color:var(--color-foreground)]"
              >
                <X className="h-4 w-4" strokeWidth={2} aria-hidden />
              </button>
            ) : null}
          </label>
          <div className="flex max-h-[360px] flex-col gap-2 overflow-y-auto pr-1">
            {filtered.length === 0 ? (
              <div className="py-8 text-center text-sm text-[color:var(--color-muted-foreground)]">
                {t('invites.noMatch')}
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
                            {t('checkin.plusOnesAbbr', { count: g.plusOnesAllowed })}
                          </span>
                        ) : null}
                      </span>
                    </div>
                    {inHere ? (
                      <>
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-[color:var(--color-sage-500)]">
                          <Check className="h-3.5 w-3.5" strokeWidth={2.4} aria-hidden />{' '}
                          {t('checkin.arrivedTag')}
                        </span>
                        <button
                          type="button"
                          onClick={() => undo(g._id)}
                          aria-label={t('checkin.undoArrivalAria', { name: g.fullName })}
                          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-[color:var(--color-muted-foreground)] transition-colors hover:text-[color:var(--color-foreground)]"
                        >
                          <RotateCcw className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />{' '}
                          {t('common.cancel')}
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => doCheckin(g)}
                        aria-label={t('checkin.markArrivedAria', { name: g.fullName })}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface-elevated)] px-3 py-1.5 text-xs font-medium text-[color:var(--color-foreground)] transition-colors hover:border-[color:var(--color-blush-400)]"
                      >
                        <UserCheck className="h-4 w-4" strokeWidth={2} aria-hidden />{' '}
                        {t('checkin.markArrived')}
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
      <Panel title={t('checkin.recentArrivals')} sub={t('checkin.viaSession', { count: arrived })}>
        {feed.length === 0 ? (
          <p className="text-sm text-[color:var(--color-muted-foreground)]">
            {t('checkin.recentArrivalsEmpty')}
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
                    {t('checkin.byStaff', { by: f.by })}
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
  const t = useTranslations('Pro.weddings');
  const eligible = useMemo(() => guests.filter((g) => g.rsvpStatus !== 'declined'), [guests]);
  // Placement en session : map invité -> index de table.
  const [seats, setSeats] = useState<Record<string, number>>({});

  const tables = useMemo(
    () =>
      SEAT_CAPS.map((capacity, i) => ({
        id: i,
        label: i === 6 ? t('seating.headTable') : t('seating.tableN', { n: i + 1 }),
        capacity,
        occupants: eligible.filter((g) => seats[g._id] === i),
      })),
    [eligible, seats, t],
  );

  const unassigned = eligible.filter((g) => seats[g._id] === undefined);
  const placedUnits = eligible.length - unassigned.length;
  const totalUnits = Math.max(guestTotal, eligible.length);

  function assign(id: string) {
    const table = tables.find((tbl) => tbl.occupants.length < tbl.capacity);
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
      <EmptyState icon={Users} title={t('seating.emptyTitle')} body={t('seating.emptyBody')} />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5">
        <div className="flex flex-col">
          <span className="font-mono text-[10px] tracking-[0.16em] text-[color:var(--color-muted-foreground)] uppercase">
            {t('seating.tablesCount', { count: tables.length })}
          </span>
          <b className="font-display text-xl text-[color:var(--color-foreground)] italic">
            {t.rich('seating.placedHeading', {
              placed: placedUnits,
              total: totalUnits,
              n: (chunks) => <span className="font-mono not-italic tabular-nums">{chunks}</span>,
            })}
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
            {t('seating.fullPlan')} <ArrowUpRight className="h-3 w-3" strokeWidth={2} aria-hidden />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_300px]">
        {/* tables */}
        <div className="grid grid-cols-2 gap-3 self-start sm:grid-cols-3">
          {tables.map((tbl) => {
            const full = tbl.occupants.length >= tbl.capacity;
            return (
              <div
                key={tbl.id}
                className="flex flex-col gap-2 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-3.5"
              >
                <div className="flex items-center justify-between">
                  <b className="text-sm text-[color:var(--color-foreground)]">{tbl.label}</b>
                  <span
                    className={cn(
                      'font-mono text-[11px] tabular-nums',
                      full
                        ? 'text-[color:var(--color-sage-500)]'
                        : 'text-[color:var(--color-muted-foreground)]',
                    )}
                  >
                    {tbl.occupants.length}/{tbl.capacity}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {Array.from({ length: tbl.capacity }).map((_, i) => {
                    const occ = tbl.occupants[i];
                    return occ ? (
                      <button
                        key={i}
                        type="button"
                        onClick={() => unassign(occ._id)}
                        title={t('seating.removeTitle', { name: occ.fullName })}
                        aria-label={t('seating.removeAria', { name: occ.fullName })}
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
              {t('seating.unassigned')}
            </h3>
            <span className="font-mono text-[11px] text-[color:var(--color-muted-foreground)] tabular-nums">
              {unassigned.length}
            </span>
          </div>
          {unassigned.length === 0 ? (
            <p className="text-sm text-[color:var(--color-muted-foreground)]">
              {t('seating.allPlaced')}
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
                    {t('seating.place')}
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
  flagKey?: string;
  reasonKey?: string;
}

/** Albums internes : id stable + clé i18n du libellé affiché. */
const GAL_ALBUMS = ['ceremony', 'cocktail', 'evening'] as const;
const GAL_ALBUM_LABEL_KEY: Record<string, string> = {
  ceremony: 'gallery.albumCeremony',
  cocktail: 'gallery.albumCocktail',
  evening: 'gallery.albumEvening',
};
function photoBg(seed: number): string {
  const h1 = (seed * 47) % 360;
  const h2 = (seed * 47 + 40) % 360;
  return `linear-gradient(135deg, oklch(42% 0.07 ${h1}), oklch(28% 0.05 ${h2}))`;
}
const GAL_SEED: ReadonlyArray<HubPhoto> = [
  { id: 'p1', seed: 1, album: 'ceremony', status: 'pending', by: 'Aminata D.' },
  {
    id: 'p2',
    seed: 2,
    album: 'ceremony',
    status: 'pending',
    by: 'Hugo L.',
    flagKey: 'gallery.flagNoFace',
  },
  { id: 'p3', seed: 3, album: 'cocktail', status: 'pending', by: 'Sophie M.' },
  { id: 'p4', seed: 4, album: 'evening', status: 'pending', by: 'Mehdi H.' },
  {
    id: 'p5',
    seed: 5,
    album: 'cocktail',
    status: 'pending',
    by: 'Awa T.',
    flagKey: 'gallery.flagSensitive',
  },
  { id: 'p6', seed: 6, album: 'ceremony', status: 'pending', by: 'Camille B.' },
  { id: 'p7', seed: 7, album: 'evening', status: 'pending', by: 'Yacine M.' },
  { id: 'p8', seed: 8, album: 'cocktail', status: 'pending', by: 'Fatou S.' },
  { id: 'p11', seed: 11, album: 'ceremony', status: 'approved', by: 'Aminata D.' },
  { id: 'p12', seed: 12, album: 'cocktail', status: 'approved', by: 'Sophie M.' },
  { id: 'p13', seed: 13, album: 'evening', status: 'approved', by: 'Mehdi H.' },
  {
    id: 'p16',
    seed: 16,
    album: 'ceremony',
    status: 'rejected',
    by: 'Hugo L.',
    reasonKey: 'gallery.reasonBlurry',
  },
];

export function GalleryTab() {
  const t = useTranslations('Pro.weddings');
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

  const setStatus = useCallback((ids: string[], status: HubPhoto['status'], reasonKey?: string) => {
    const set = new Set(ids);
    setPhotos((ps) =>
      ps.map((p) =>
        set.has(p.id)
          ? {
              ...p,
              status,
              reasonKey: status === 'rejected' ? (reasonKey ?? 'gallery.reasonManual') : undefined,
            }
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
    toast(ThumbsUp, <span>{t('gallery.photoApproved')}</span>);
  };
  const reject = (id: string) => {
    setStatus([id], 'rejected', 'gallery.reasonManual');
    toast(ThumbsDown, <span>{t('gallery.photoRejected')}</span>);
  };
  const bulkApprove = () => {
    const ids = [...selected];
    setStatus(ids, 'approved');
    toast(
      ThumbsUp,
      <span>
        {t.rich('gallery.photosApproved', {
          count: ids.length,
          b: (chunks) => <b>{chunks}</b>,
        })}
      </span>,
    );
  };
  const bulkReject = () => {
    const ids = [...selected];
    setStatus(ids, 'rejected', 'gallery.reasonBulk');
    toast(
      ThumbsDown,
      <span>
        {t.rich('gallery.photosRejected', {
          count: ids.length,
          b: (chunks) => <b>{chunks}</b>,
        })}
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
    ['pending', t('gallery.subPending'), counts.pending],
    ['approved', t('gallery.subApproved'), counts.approved],
    ['rejected', t('gallery.subRejected'), counts.rejected],
  ];

  return (
    <div className="flex flex-col gap-5">
      <Toaster items={items} />
      {/* sous-onglets */}
      <div
        className="flex items-center gap-1 self-start rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-1"
        role="tablist"
        aria-label={t('gallery.moderationAria')}
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
              {a === 'all' ? t('gallery.allAlbums') : t(GAL_ALBUM_LABEL_KEY[a] ?? '')}
            </button>
          ))}
        </div>
        <span className="flex-1" />
        {sub === 'pending' && selected.size > 0 ? (
          <>
            <span className="font-mono text-xs text-[color:var(--color-muted-foreground)]">
              {t.rich('gallery.selectedCount', {
                count: selected.size,
                b: (chunks) => <b className="text-[color:var(--color-foreground)]">{chunks}</b>,
              })}
            </span>
            <button
              type="button"
              onClick={bulkApprove}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--color-border-strong)] px-3 py-1.5 text-xs text-[color:var(--color-foreground)] transition-colors hover:border-[color:var(--color-sage-500)]"
            >
              <ThumbsUp className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />{' '}
              {t('gallery.approveAll')}
            </button>
            <button
              type="button"
              onClick={bulkReject}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--color-border-strong)] px-3 py-1.5 text-xs text-[color:var(--color-danger)] transition-colors hover:border-[color:var(--color-danger)]"
            >
              <ThumbsDown className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />{' '}
              {t('gallery.rejectAll')}
            </button>
          </>
        ) : null}
        <button
          type="button"
          onClick={() =>
            toast(Download, <span>{t('gallery.zipPreparing', { count: counts.approved })}</span>)
          }
          className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--color-border)] px-3 py-1.5 text-xs text-[color:var(--color-foreground)] transition-colors hover:border-[color:var(--color-border-strong)]"
        >
          <Download className="h-3.5 w-3.5" strokeWidth={1.9} aria-hidden />{' '}
          {t('gallery.downloadAll')}
        </button>
      </div>

      {list.length === 0 ? (
        <EmptyState
          icon={sub === 'pending' ? CircleCheck : Images}
          title={sub === 'pending' ? t('gallery.emptyPendingTitle') : t('gallery.emptyOtherTitle')}
          body={sub === 'pending' ? t('gallery.emptyPendingBody') : t('gallery.emptyOtherBody')}
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
                      aria-label={t('gallery.selectPhotoAria', { by: p.by })}
                      className="accent-[color:var(--color-blush-400)]"
                    />
                  </label>
                ) : null}
                {p.flagKey && sub === 'pending' ? (
                  <span
                    className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-full bg-[color:var(--color-warning)]/90 px-2 py-0.5 text-[10px] font-medium text-[color:var(--color-ink-700)]"
                    title={t('gallery.flaggedTitle', { flag: t(p.flagKey) })}
                  >
                    <ShieldAlert className="h-3 w-3" strokeWidth={2} aria-hidden /> {t(p.flagKey)}
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
                    {sub === 'approved' ? t('gallery.statusApproved') : t('gallery.statusRejected')}
                  </span>
                ) : null}
                <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/55 opacity-0 transition-opacity group-hover:opacity-100">
                  {sub === 'pending' ? (
                    <>
                      <button
                        type="button"
                        onClick={() => approve(p.id)}
                        aria-label={t('gallery.approve')}
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-[color:var(--color-sage-500)] text-[color:var(--color-ink-700)]"
                      >
                        <Check className="h-5 w-5" strokeWidth={2.4} aria-hidden />
                      </button>
                      <button
                        type="button"
                        onClick={() => setLightbox(p)}
                        aria-label={t('gallery.zoom')}
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-[color:var(--color-ink-700)]"
                      >
                        <ZoomIn className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
                      </button>
                      <button
                        type="button"
                        onClick={() => reject(p.id)}
                        aria-label={t('gallery.reject')}
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-[color:var(--color-danger)] text-white"
                      >
                        <X className="h-5 w-5" strokeWidth={2.4} aria-hidden />
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setLightbox(p)}
                      aria-label={t('gallery.zoom')}
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
                  {t(GAL_ALBUM_LABEL_KEY[p.album] ?? '')}
                </span>
              </div>
              {sub === 'rejected' && p.reasonKey ? (
                <div className="flex items-center gap-1 border-t border-[color:var(--color-border)] px-3 py-1.5 text-[11px] text-[color:var(--color-danger)]">
                  <X className="h-3 w-3" strokeWidth={2.2} aria-hidden />{' '}
                  {t('gallery.reasonLabel', { reason: t(p.reasonKey) })}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {/* stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <GalStat label={t('gallery.statApproved')} value={counts.approved} />
        <GalStat label={t('gallery.statPending')} value={counts.pending} />
        <GalStat label={t('gallery.statRejected')} value={counts.rejected} />
      </div>

      {lightbox ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
          role="dialog"
          aria-modal="true"
          aria-label={t('gallery.lightboxAria', { by: lightbox.by })}
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            onClick={() => setLightbox(null)}
            aria-label={t('common.close')}
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

function facEur(n: number, locale: string): string {
  const hasDec = Math.round(n) !== n;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: hasDec ? 2 : 0,
    maximumFractionDigits: hasDec ? 2 : 0,
  }).format(n);
}

interface BillingPayment {
  id: string;
  /** Timestamp (ms) du mouvement — formaté côté composant selon la locale. */
  dateMs: number;
  label: string;
  amount: number;
  status: 'paid' | 'pending' | 'failed';
}

const FAC_STATUS: Record<BillingPayment['status'], { labelKey: string; color: string }> = {
  paid: { labelKey: 'invoice.statusPaid', color: SAGE },
  pending: { labelKey: 'invoice.statusPending', color: AMBER },
  failed: { labelKey: 'invoice.statusFailed', color: RED },
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
  const t = useTranslations('Pro.weddings');
  const locale = useLocale();
  const format = useFormatter();
  const { items, toast } = useToast();
  const [mode, setMode] = useState<'subscription' | 'payg'>('subscription');
  const isSub = mode === 'subscription';
  const dayMonthYear = { day: 'numeric', month: 'short', year: 'numeric' } as const;
  const eventCapLabel = eventCap != null ? String(eventCap) : '—';

  const data = isSub
    ? {
        title: t('invoice.subTitle', { plan }),
        desc: t('invoice.subDesc', { cap: eventCapLabel }),
        line: {
          label: t('invoice.subLineLabel', { plan }),
          amount: 0,
          note: eventCap
            ? t('invoice.subLineNoteCap', { no: eventNo, cap: eventCap })
            : t('invoice.subLineNote', { no: eventNo }),
        },
        payments: [
          {
            id: 'ev1',
            dateMs: Date.UTC(2026, 5, 1),
            label: t('invoice.payActivation'),
            amount: 0,
            status: 'paid' as const,
          },
          {
            id: 'ev2',
            dateMs: Date.UTC(2026, 5, 14),
            label: t('invoice.payMessageOverage', {
              count: 320,
              rate: format.number(0.06, { style: 'currency', currency: 'EUR' }),
            }),
            amount: 19.2,
            status: 'paid' as const,
          },
          {
            id: 'ev3',
            dateMs: Date.UTC(2026, 6, 2),
            label: t('invoice.payStorageOverage', { gb: 12 }),
            amount: 0.36,
            status: 'pending' as const,
          },
        ],
      }
    : {
        title: t('invoice.paygTitle'),
        desc: t('invoice.paygDesc'),
        line: {
          label: t('invoice.paygLineLabel'),
          amount: 79,
          note: t('invoice.paygLineNote'),
        },
        payments: [
          {
            id: 'pv1',
            dateMs: Date.UTC(2026, 4, 12),
            label: t('invoice.payCredit'),
            amount: 79,
            status: 'paid' as const,
          },
          {
            id: 'pv2',
            dateMs: Date.UTC(2026, 5, 14),
            label: t('invoice.payMessageOverage', {
              count: 210,
              rate: format.number(0.06, { style: 'currency', currency: 'EUR' }),
            }),
            amount: 12.6,
            status: 'paid' as const,
          },
          {
            id: 'pv3',
            dateMs: Date.UTC(2026, 5, 28),
            label: t('invoice.payGuestOverage', {
              count: 8,
              rate: format.number(0.25, { style: 'currency', currency: 'EUR' }),
            }),
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
        {t.rich('invoice.downloadToast', {
          label: p.label.split('\u00b7')[0]!.trim(),
          b: (chunks) => <b>{chunks}</b>,
        })}
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
        aria-label={t('invoice.modeAria')}
      >
        <span className="px-2 font-mono text-[9px] tracking-[0.16em] text-[color:var(--color-muted-foreground)] uppercase">
          {t('invoice.billing')}
        </span>
        {(
          [
            ['subscription', t('invoice.subscription')],
            ['payg', t('invoice.payg')],
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
            {t('invoice.eventBilling')}
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
              {data.line.amount === 0 ? t('invoice.included') : facEur(data.line.amount, locale)}
            </span>
          </div>
        </div>
      </div>

      {/* paiements */}
      <Panel
        title={t('invoice.paymentsTitle')}
        sub={t('invoice.movementsCount', { count: data.payments.length })}
        className="p-0 sm:p-0"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-y border-[color:var(--color-border)] text-left font-mono text-[9px] tracking-[0.18em] text-[color:var(--color-muted-foreground)] uppercase">
                <th className="px-5 py-3 font-medium">{t('invoice.colDate')}</th>
                <th className="px-5 py-3 font-medium">{t('invoice.colLabel')}</th>
                <th className="px-5 py-3 text-right font-medium">{t('invoice.colAmount')}</th>
                <th className="px-5 py-3 font-medium">{t('invoice.colStatus')}</th>
                <th className="px-5 py-3 text-right font-medium">{t('invoice.colInvoice')}</th>
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
                      {format.dateTime(p.dateMs, dayMonthYear)}
                    </td>
                    <td className="px-5 py-3 text-[color:var(--color-foreground)]">{p.label}</td>
                    <td className="px-5 py-3 text-right font-mono tabular-nums">
                      {p.amount === 0 ? (
                        <span className="text-[color:var(--color-sage-500)]">
                          {t('invoice.included')}
                        </span>
                      ) : (
                        <span className="text-[color:var(--color-foreground)]">
                          {facEur(p.amount, locale)}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className="inline-flex items-center gap-1.5 text-xs font-medium"
                        style={{ color: st.color }}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />{' '}
                        {t(st.labelKey)}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => download(p)}
                        disabled={p.status !== 'paid'}
                        title={p.status !== 'paid' ? t('invoice.availableWhenPaid') : undefined}
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
          {t.rich('invoice.ledgerNote', {
            context: isSub ? t('invoice.ledgerCoveredSub') : t('invoice.ledgerCoveredPayg'),
            strong: (chunks) => <b className="text-[color:var(--color-foreground)]">{chunks}</b>,
            link: (chunks) => (
              <Link
                href="/pro/billing"
                className="text-[color:var(--color-blush-300)] hover:underline"
              >
                {chunks}
              </Link>
            ),
          })}
        </p>
      </div>
    </div>
  );
}
