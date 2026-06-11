'use client';

import { useState, type CSSProperties } from 'react';
import {
  Home,
  ListChecks,
  Wallet,
  FileText,
  Users,
  Image as ImageIcon,
  MessageCircle,
  Clock,
  MapPin,
  Heart,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  type LucideIcon,
} from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/cn';
import { formatEurMinor } from '@/lib/pro/format';
import { PLANNING_PHASES, PHASE_LABEL } from '@/lib/pro/planning';

interface AgencyBrand {
  name: string;
  initial: string;
  brandColor: string | null;
  logoUrl: string | null;
  fullWhiteLabel: boolean;
}
interface Couple {
  names: string;
  partnerA: string;
  partnerB: string;
  dateLabel: string;
  jminus: number;
  venue: string | null;
}
interface Rsvp {
  confirmed: number;
  declined: number;
  pending: number;
  total: number;
}
interface CoupleTask {
  _id: string;
  label: string;
  dueDate: number | null;
  daysUntil: number | null;
}

type NavKey = 'dashboard' | 'planning' | 'budget' | 'documents' | 'guests' | 'gallery' | 'messages';

const NAV: ReadonlyArray<{ key: NavKey; label: string; Icon: LucideIcon }> = [
  { key: 'dashboard', label: 'Accueil', Icon: Home },
  { key: 'planning', label: 'Rétroplanning', Icon: ListChecks },
  { key: 'budget', label: 'Budget', Icon: Wallet },
  { key: 'documents', label: 'Documents', Icon: FileText },
  { key: 'guests', label: 'Invités', Icon: Users },
  { key: 'gallery', label: 'Galerie', Icon: ImageIcon },
  { key: 'messages', label: 'Messages', Icon: MessageCircle },
];
const TABS: NavKey[] = ['dashboard', 'planning', 'budget', 'documents', 'gallery'];

interface BudgetLine {
  category: string;
  label: string;
  plannedMinor: number;
  paidMinor: number;
}
interface PortalTask {
  phase: (typeof PLANNING_PHASES)[number];
  title: string;
  done: boolean;
}
interface PortalGuest {
  _id: string;
  fullName: string;
  category: string | null;
  plusOnesAllowed: number;
  rsvpStatus: 'pending' | 'attending' | 'declined' | 'maybe';
}
interface PortalDoc {
  id: string;
  name: string;
  kind: string;
  status: 'to_sign' | 'sent' | 'signed';
  signedAt: number | null;
}

export function CouplePortal(props: {
  agency: AgencyBrand;
  couple: Couple;
  rsvp: Rsvp;
  budget: { plannedMinor: number; paidMinor: number; engagedPct: number; lines: BudgetLine[] };
  planning: { progressPct: number; done: number; total: number; tasks: PortalTask[] };
  guests: PortalGuest[];
  documents: PortalDoc[];
  planner: { name: string; initials: string };
  coupleTasks: CoupleTask[];
  backHref: string;
}) {
  const { agency } = props;
  const [tab, setTab] = useState<NavKey>('dashboard');
  const brand = agency.brandColor ?? 'var(--color-gold-600, #b08a4f)';
  const rootStyle = { '--brand': brand } as CSSProperties;

  return (
    <div
      data-theme="light"
      className="min-h-dvh bg-[color:var(--color-background)] text-[color:var(--color-foreground)]"
      style={rootStyle}
    >
      <div className="mx-auto flex w-full max-w-6xl gap-0 lg:gap-8 lg:px-6">
        {/* Sidebar desktop */}
        <aside
          className="sticky top-0 hidden h-dvh w-60 flex-shrink-0 flex-col gap-1 py-7 lg:flex"
          aria-label="Navigation"
        >
          <Brand agency={agency} />
          <nav className="mt-6 flex flex-col gap-0.5">
            {NAV.map((n) => (
              <NavButton
                key={n.key}
                item={n}
                active={tab === n.key}
                onClick={() => setTab(n.key)}
              />
            ))}
          </nav>
          <div className="mt-auto flex flex-col gap-3">
            <Link
              href={props.backHref as never}
              className="inline-flex items-center gap-1.5 text-xs text-[color:var(--color-muted-foreground)] transition-colors hover:text-[color:var(--color-foreground)]"
            >
              <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.9} aria-hidden /> Retour au
              back-office
            </Link>
            {!agency.fullWhiteLabel ? <PoweredBy /> : null}
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Topbar mobile */}
          <header className="flex items-center justify-between border-b border-[color:var(--color-border)] px-4 py-3 lg:hidden">
            <Brand agency={agency} compact />
            <button
              type="button"
              onClick={() => setTab('messages')}
              aria-label="Messages"
              className="relative flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--color-border)]"
            >
              <MessageCircle className="h-[18px] w-[18px]" strokeWidth={1.85} aria-hidden />
            </button>
          </header>

          <main
            className="flex flex-col gap-6 px-4 py-6 pb-28 sm:px-6 lg:px-0 lg:py-8 lg:pb-12"
            aria-label={NAV.find((n) => n.key === tab)?.label}
          >
            {tab === 'dashboard' ? (
              <Dashboard {...props} />
            ) : tab === 'planning' ? (
              <PortalPlanning
                tasks={props.planning.tasks}
                progressPct={props.planning.progressPct}
              />
            ) : tab === 'budget' ? (
              <PortalBudget budget={props.budget} />
            ) : tab === 'guests' ? (
              <PortalGuests guests={props.guests} rsvp={props.rsvp} />
            ) : tab === 'documents' ? (
              <PortalDocuments documents={props.documents} />
            ) : tab === 'gallery' ? (
              <PortalGallery jminus={props.couple.jminus} />
            ) : tab === 'messages' ? (
              <PortalMessages planner={props.planner} couple={props.couple} />
            ) : (
              <ComingSoon
                label={NAV.find((n) => n.key === tab)?.label ?? ''}
                backHref={props.backHref}
              />
            )}
            {!agency.fullWhiteLabel ? (
              <div className="lg:hidden">
                <PoweredBy />
              </div>
            ) : null}
          </main>
        </div>
      </div>

      {/* Bottom tab bar mobile */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 flex items-stretch border-t border-[color:var(--color-border)] bg-[color:var(--color-surface)]/95 backdrop-blur lg:hidden"
        aria-label="Navigation principale"
      >
        {TABS.map((k) => {
          const n = NAV.find((x) => x.key === k)!;
          const active = tab === k;
          return (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px]',
                active ? 'text-[color:var(--brand)]' : 'text-[color:var(--color-muted-foreground)]',
              )}
            >
              <n.Icon className="h-5 w-5" strokeWidth={1.85} aria-hidden />
              {n.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

function Brand({ agency, compact }: { agency: AgencyBrand; compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className="font-display flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl text-lg text-white"
        style={{ background: 'var(--brand)' }}
      >
        {agency.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={agency.logoUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          agency.initial
        )}
      </span>
      {!compact ? (
        <span className="flex flex-col leading-tight">
          <b className="text-sm text-[color:var(--color-foreground)]">{agency.name}</b>
          <span className="font-mono text-[10px] tracking-[0.14em] text-[color:var(--color-muted-foreground)] uppercase">
            Espace mariés
          </span>
        </span>
      ) : (
        <span className="font-mono text-[10px] tracking-[0.14em] text-[color:var(--color-muted-foreground)] uppercase">
          Espace mariés
        </span>
      )}
    </div>
  );
}

function NavButton({
  item,
  active,
  onClick,
}: {
  item: { key: NavKey; label: string; Icon: LucideIcon };
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'focus-ring flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors',
        active
          ? 'bg-[color:var(--color-surface-elevated)] font-medium text-[color:var(--color-foreground)]'
          : 'text-[color:var(--color-muted-foreground)] hover:text-[color:var(--color-foreground)]',
      )}
    >
      <span
        className={cn(
          'flex h-7 w-7 items-center justify-center rounded-lg',
          active ? 'text-[color:var(--brand)]' : '',
        )}
      >
        <item.Icon className="h-[18px] w-[18px]" strokeWidth={1.85} aria-hidden />
      </span>
      {item.label}
    </button>
  );
}

function PoweredBy() {
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[10px] tracking-[0.1em] text-[color:var(--color-muted-foreground)]">
      <Heart className="h-3 w-3" strokeWidth={2} aria-hidden /> Propulsé par Wedillybird
    </span>
  );
}

function Dashboard({
  couple,
  rsvp,
  budget,
  planning,
  coupleTasks,
}: {
  couple: Couple;
  rsvp: Rsvp;
  budget: { plannedMinor: number; paidMinor: number; engagedPct: number };
  planning: { progressPct: number; done: number; total: number };
  coupleTasks: CoupleTask[];
}) {
  return (
    <div className="flex flex-col gap-6">
      {/* Hero */}
      <section className="flex flex-col items-center gap-3 rounded-3xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-6 py-10 text-center">
        <span className="font-mono text-[10px] tracking-[0.28em] text-[color:var(--color-muted-foreground)] uppercase">
          Votre mariage
        </span>
        <h1
          className="font-display italic"
          style={{
            fontSize: 'clamp(2rem, 6vw, 3.25rem)',
            lineHeight: 1.05,
            letterSpacing: '-0.022em',
          }}
        >
          {couple.partnerA} <span style={{ color: 'var(--brand)' }}>&amp;</span> {couple.partnerB}
        </h1>
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 font-mono text-[11px] text-[color:var(--color-muted-foreground)]">
          <span className="inline-flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden /> {couple.dateLabel}
          </span>
          {couple.venue ? (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden /> {couple.venue}
            </span>
          ) : null}
        </div>
        <div
          className="mt-2 inline-flex items-baseline gap-2 rounded-full px-5 py-2"
          style={{ background: 'color-mix(in oklab, var(--brand) 12%, transparent)' }}
        >
          <span className="font-display text-3xl italic" style={{ color: 'var(--brand)' }}>
            J−{couple.jminus}
          </span>
          <span className="text-xs text-[color:var(--color-muted-foreground)]">
            avant le grand jour
          </span>
        </div>
      </section>

      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          Icon={Users}
          label="RSVP confirmés"
          value={`${rsvp.confirmed}`}
          unit={`/${rsvp.total}`}
          bar={rsvp.total > 0 ? (rsvp.confirmed / rsvp.total) * 100 : 0}
        />
        <KpiCard
          Icon={Wallet}
          label="Budget engagé"
          value={`${budget.engagedPct} %`}
          sub={formatEurMinor(budget.paidMinor)}
          bar={budget.engagedPct}
        />
        <KpiCard
          Icon={ListChecks}
          label="Préparatifs"
          value={`${planning.progressPct} %`}
          sub={`${planning.done}/${planning.total} tâches`}
          bar={planning.progressPct}
        />
        <KpiCard
          Icon={CheckCircle2}
          label="À faire"
          value={`${coupleTasks.length}`}
          sub="actions en attente"
        />
      </div>

      {/* À vous de jouer */}
      <section className="flex flex-col gap-3 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6">
        <h2 className="font-display text-lg italic">À vous de jouer</h2>
        {coupleTasks.length === 0 ? (
          <p className="text-sm text-[color:var(--color-muted-foreground)]">
            Tout est à jour — rien à faire de votre côté pour l’instant. ✨
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {coupleTasks.map((t) => (
              <li
                key={t._id}
                className="flex items-center gap-3 rounded-xl border border-[color:var(--color-border)] px-3.5 py-3"
              >
                <span
                  className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full"
                  style={{
                    background: 'color-mix(in oklab, var(--brand) 14%, transparent)',
                    color: 'var(--brand)',
                  }}
                >
                  <CheckCircle2 className="h-4 w-4" strokeWidth={1.9} aria-hidden />
                </span>
                <span className="flex-1 text-sm">{t.label}</span>
                {t.daysUntil != null ? (
                  <span
                    className={cn(
                      'font-mono text-[11px] tabular-nums',
                      t.daysUntil < 0
                        ? 'text-[color:var(--color-danger)]'
                        : t.daysUntil <= 7
                          ? 'text-[color:var(--color-warning)]'
                          : 'text-[color:var(--color-muted-foreground)]',
                    )}
                  >
                    {t.daysUntil < 0
                      ? `J+${-t.daysUntil}`
                      : t.daysUntil === 0
                        ? 'Jour J'
                        : `J−${t.daysUntil}`}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function KpiCard({
  Icon,
  label,
  value,
  unit,
  sub,
  bar,
}: {
  Icon: LucideIcon;
  label: string;
  value: string;
  unit?: string;
  sub?: string;
  bar?: number;
}) {
  return (
    <article className="flex flex-col gap-2 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4">
      <span className="inline-flex items-center gap-1.5 font-mono text-[9px] tracking-[0.16em] text-[color:var(--color-muted-foreground)] uppercase">
        <Icon className="h-3 w-3" strokeWidth={1.9} aria-hidden /> {label}
      </span>
      <span className="font-mono text-2xl font-medium tabular-nums">
        {value}
        {unit ? (
          <span className="text-sm text-[color:var(--color-muted-foreground)]">{unit}</span>
        ) : null}
      </span>
      {bar != null ? (
        <div className="h-1 w-full overflow-hidden rounded-full bg-[color:var(--color-surface-elevated)]">
          <span
            className="block h-full rounded-full"
            style={{ width: `${Math.min(100, bar)}%`, background: 'var(--brand)' }}
          />
        </div>
      ) : null}
      {sub ? (
        <span className="text-xs text-[color:var(--color-muted-foreground)]">{sub}</span>
      ) : null}
    </article>
  );
}

function PageTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <header className="flex flex-col gap-1">
      <span className="font-mono text-[10px] tracking-[0.24em] text-[color:var(--color-muted-foreground)] uppercase">
        {eyebrow}
      </span>
      <h1 className="font-display text-3xl italic" style={{ letterSpacing: '-0.02em' }}>
        {title}
      </h1>
    </header>
  );
}

function hueFor(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
}

function PortalPlanning({ tasks, progressPct }: { tasks: PortalTask[]; progressPct: number }) {
  const phases = PLANNING_PHASES.map((phase) => ({
    phase,
    label: PHASE_LABEL[phase],
    items: tasks.filter((t) => t.phase === phase),
  })).filter((p) => p.items.length > 0);

  return (
    <div className="flex flex-col gap-5">
      <PageTitle eyebrow="Votre mariage" title="Rétroplanning" />
      <div className="flex items-center gap-3 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5">
        <span className="font-display text-3xl italic" style={{ color: 'var(--brand)' }}>
          {progressPct} %
        </span>
        <div className="flex flex-1 flex-col gap-1.5">
          <span className="text-sm text-[color:var(--color-muted-foreground)]">
            Avancement de vos préparatifs
          </span>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[color:var(--color-surface-elevated)]">
            <span
              className="block h-full rounded-full"
              style={{ width: `${progressPct}%`, background: 'var(--brand)' }}
            />
          </div>
        </div>
      </div>
      {phases.map((p) => {
        const done = p.items.filter((i) => i.done).length;
        return (
          <section
            key={p.phase}
            className="flex flex-col gap-3 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg italic">{p.label}</h2>
              <span className="font-mono text-[11px] text-[color:var(--color-muted-foreground)] tabular-nums">
                {done}/{p.items.length}
              </span>
            </div>
            <ul className="flex flex-col gap-1.5">
              {p.items.map((t, i) => (
                <li key={i} className="flex items-center gap-2.5 text-sm">
                  <span
                    className={cn(
                      'flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border',
                      t.done
                        ? 'border-transparent text-white'
                        : 'border-[color:var(--color-border-strong)]',
                    )}
                    style={t.done ? { background: 'var(--brand)' } : undefined}
                  >
                    {t.done ? (
                      <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2.4} aria-hidden />
                    ) : null}
                  </span>
                  <span
                    className={cn(
                      t.done ? 'text-[color:var(--color-muted-foreground)] line-through' : '',
                    )}
                  >
                    {t.title}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function PortalBudget({
  budget,
}: {
  budget: { plannedMinor: number; paidMinor: number; engagedPct: number; lines: BudgetLine[] };
}) {
  return (
    <div className="flex flex-col gap-5">
      <PageTitle eyebrow="Votre mariage" title="Budget" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <KpiCard Icon={Wallet} label="Budget prévu" value={formatEurMinor(budget.plannedMinor)} />
        <KpiCard
          Icon={Wallet}
          label="Déjà réglé"
          value={formatEurMinor(budget.paidMinor)}
          bar={budget.engagedPct}
        />
        <KpiCard
          Icon={Wallet}
          label="Reste à payer"
          value={formatEurMinor(Math.max(0, budget.plannedMinor - budget.paidMinor))}
        />
      </div>
      {budget.lines.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[color:var(--color-border-strong)] bg-[color:var(--color-surface)]/50 px-8 py-12 text-center text-sm text-[color:var(--color-muted-foreground)]">
          Le budget détaillé sera bientôt disponible ici.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {budget.lines.map((l, i) => {
            const pct =
              l.plannedMinor > 0 ? Math.min(100, (l.paidMinor / l.plannedMinor) * 100) : 0;
            const hue = hueFor(l.category);
            return (
              <div
                key={i}
                className="flex flex-col gap-2 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2.5">
                    <span
                      className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                      style={{ background: `oklch(62% 0.1 ${hue})` }}
                      aria-hidden
                    />
                    <span className="flex flex-col">
                      <b className="text-sm">{l.label}</b>
                      <span className="font-mono text-[10px] tracking-[0.1em] text-[color:var(--color-muted-foreground)] uppercase">
                        {l.category}
                      </span>
                    </span>
                  </span>
                  <span className="text-right font-mono text-xs text-[color:var(--color-muted-foreground)] tabular-nums">
                    <b className="text-[color:var(--color-foreground)]">
                      {formatEurMinor(l.paidMinor)}
                    </b>{' '}
                    / {formatEurMinor(l.plannedMinor)}
                  </span>
                </div>
                <div className="h-1 w-full overflow-hidden rounded-full bg-[color:var(--color-surface-elevated)]">
                  <span
                    className="block h-full rounded-full"
                    style={{ width: `${pct}%`, background: `oklch(62% 0.1 ${hue})` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const PORTAL_RSVP_PILL: Record<
  PortalGuest['rsvpStatus'],
  { label: string; bg: string; fg: string }
> = {
  attending: { label: 'Confirmé', bg: 'oklch(94% 0.04 145)', fg: 'oklch(45% 0.1 145)' },
  declined: { label: 'Absent', bg: 'oklch(95% 0.03 25)', fg: 'oklch(52% 0.13 25)' },
  pending: { label: 'En attente', bg: 'oklch(95% 0.03 80)', fg: 'oklch(52% 0.1 80)' },
  maybe: {
    label: 'Peut-être',
    bg: 'var(--color-surface-elevated)',
    fg: 'var(--color-muted-foreground)',
  },
};

function PortalGuests({ guests, rsvp }: { guests: PortalGuest[]; rsvp: Rsvp }) {
  const counted = rsvp.confirmed + rsvp.declined + rsvp.pending;
  return (
    <div className="flex flex-col gap-5">
      <PageTitle eyebrow="Votre mariage" title="Invités" />
      <div className="flex flex-col gap-3 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5">
        <div className="flex items-center justify-between font-mono text-[11px]">
          <span className="text-[color:var(--color-muted-foreground)]">
            {guests.length} invité{guests.length > 1 ? 's' : ''}
          </span>
          <span className="flex items-center gap-3">
            <span>
              <b style={{ color: 'oklch(50% 0.1 145)' }}>{rsvp.confirmed}</b> confirmés
            </span>
            <span>
              <b style={{ color: 'oklch(55% 0.13 25)' }}>{rsvp.declined}</b> absents
            </span>
            <span>
              <b style={{ color: 'oklch(55% 0.1 80)' }}>{rsvp.pending}</b> en attente
            </span>
          </span>
        </div>
        <div className="flex h-2 w-full overflow-hidden rounded-full bg-[color:var(--color-surface-elevated)]">
          {counted > 0 ? (
            <>
              <span
                className="h-full"
                style={{
                  width: `${(rsvp.confirmed / counted) * 100}%`,
                  background: 'oklch(70% 0.1 145)',
                }}
              />
              <span
                className="h-full"
                style={{
                  width: `${(rsvp.declined / counted) * 100}%`,
                  background: 'oklch(68% 0.13 25)',
                }}
              />
              <span
                className="h-full"
                style={{
                  width: `${(rsvp.pending / counted) * 100}%`,
                  background: 'oklch(75% 0.1 80)',
                }}
              />
            </>
          ) : null}
        </div>
      </div>
      {guests.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[color:var(--color-border-strong)] bg-[color:var(--color-surface)]/50 px-8 py-12 text-center text-sm text-[color:var(--color-muted-foreground)]">
          Votre liste d’invités apparaîtra ici.
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)]">
          <ul className="divide-y divide-[color:var(--color-border)]">
            {guests.map((g) => {
              const p = PORTAL_RSVP_PILL[g.rsvpStatus];
              return (
                <li key={g._id} className="flex items-center gap-3 px-4 py-3">
                  <span
                    className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full font-mono text-[11px] font-medium"
                    style={{
                      background: `oklch(92% 0.04 ${hueFor(g.fullName)})`,
                      color: `oklch(45% 0.08 ${hueFor(g.fullName)})`,
                    }}
                  >
                    {(g.fullName.trim().charAt(0) || '·').toUpperCase()}
                  </span>
                  <span className="flex flex-1 flex-col">
                    <b className="text-sm">{g.fullName}</b>
                    <span className="text-xs text-[color:var(--color-muted-foreground)]">
                      {g.category ?? 'Invité'}
                      {g.plusOnesAllowed > 0 ? ` · +${g.plusOnesAllowed}` : ''}
                    </span>
                  </span>
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium"
                    style={{ background: p.bg, color: p.fg }}
                  >
                    {p.label}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

const DOC_STATUS: Record<PortalDoc['status'], { label: string; bg: string; fg: string }> = {
  to_sign: { label: 'À signer', bg: 'oklch(95% 0.04 60)', fg: 'oklch(50% 0.12 50)' },
  sent: { label: 'À consulter', bg: 'oklch(95% 0.03 80)', fg: 'oklch(52% 0.1 80)' },
  signed: { label: 'Signé', bg: 'oklch(94% 0.04 145)', fg: 'oklch(45% 0.1 145)' },
};

function PortalDocuments({ documents }: { documents: PortalDoc[] }) {
  const pending = documents.filter((d) => d.status === 'to_sign').length;
  return (
    <div className="flex flex-col gap-5">
      <PageTitle eyebrow="Votre mariage" title="Documents" />
      {pending > 0 ? (
        <div
          className="flex items-center gap-3 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4"
          style={{ borderColor: 'color-mix(in oklab, var(--brand) 35%, var(--color-border))' }}
        >
          <span
            className="flex h-9 w-9 items-center justify-center rounded-xl"
            style={{
              background: 'color-mix(in oklab, var(--brand) 14%, transparent)',
              color: 'var(--brand)',
            }}
          >
            <FileText className="h-[18px] w-[18px]" strokeWidth={1.85} aria-hidden />
          </span>
          <p className="text-sm">
            <b>
              {pending} document{pending > 1 ? 's' : ''} à signer.
            </b>{' '}
            <span className="text-[color:var(--color-muted-foreground)]">
              Prenez un moment pour les valider.
            </span>
          </p>
        </div>
      ) : null}
      {documents.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[color:var(--color-border-strong)] bg-[color:var(--color-surface)]/50 px-8 py-12 text-center text-sm text-[color:var(--color-muted-foreground)]">
          Aucun document partagé pour l’instant. Votre wedding planner les déposera ici.
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)]">
          <ul className="divide-y divide-[color:var(--color-border)]">
            {documents.map((d) => {
              const s = DOC_STATUS[d.status];
              return (
                <li key={d.id} className="flex items-center gap-3 px-4 py-3.5">
                  <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-[color:var(--color-surface-elevated)] text-[color:var(--color-muted-foreground)]">
                    <FileText className="h-[18px] w-[18px]" strokeWidth={1.7} aria-hidden />
                  </span>
                  <span className="flex flex-1 flex-col">
                    <b className="text-sm">{d.name}</b>
                    <span className="font-mono text-[10px] tracking-[0.1em] text-[color:var(--color-muted-foreground)] uppercase">
                      {d.kind}
                    </span>
                  </span>
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium"
                    style={{ background: s.bg, color: s.fg }}
                  >
                    {d.status === 'signed' ? (
                      <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden />
                    ) : null}
                    {s.label}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

const GALLERY_TILES = Array.from({ length: 12 }, (_, i) => {
  const h1 = (i * 47 + 30) % 360;
  const h2 = (i * 47 + 80) % 360;
  return `linear-gradient(135deg, oklch(86% 0.05 ${h1}), oklch(80% 0.06 ${h2}))`;
});

function PortalGallery({ jminus }: { jminus: number }) {
  const before = jminus > 0;
  return (
    <div className="flex flex-col gap-5">
      <PageTitle eyebrow="Votre mariage" title="Galerie" />
      {before ? (
        <div className="flex flex-col items-center gap-4 rounded-3xl border border-dashed border-[color:var(--color-border-strong)] bg-[color:var(--color-surface)]/50 px-8 py-16 text-center">
          <span
            className="flex h-12 w-12 items-center justify-center rounded-2xl"
            style={{
              background: 'color-mix(in oklab, var(--brand) 14%, transparent)',
              color: 'var(--brand)',
            }}
          >
            <ImageIcon className="h-6 w-6" strokeWidth={1.7} aria-hidden />
          </span>
          <h2 className="font-display text-xl italic">Bientôt vos plus beaux souvenirs</h2>
          <p className="max-w-sm text-sm text-[color:var(--color-muted-foreground)]">
            Votre galerie partagée s’ouvrira après le mariage. Vos invités pourront y déposer leurs
            photos, et votre planner les modèrera avant publication.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {GALLERY_TILES.map((bg, i) => (
            <div
              key={i}
              className="flex aspect-square items-center justify-center rounded-2xl"
              style={{ background: bg }}
            >
              <ImageIcon className="h-6 w-6 text-white/50" strokeWidth={1.5} aria-hidden />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PortalMessages({
  planner,
  couple,
}: {
  planner: { name: string; initials: string };
  couple: Couple;
}) {
  return (
    <div className="flex flex-col gap-5">
      <PageTitle eyebrow="Votre mariage" title="Messages" />
      <div className="flex items-center gap-3 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4">
        <span
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full font-mono text-sm font-medium text-white"
          style={{ background: 'var(--brand)' }}
        >
          {planner.initials || 'WP'}
        </span>
        <span className="flex flex-col">
          <b className="text-sm">{planner.name}</b>
          <span className="text-xs text-[color:var(--color-muted-foreground)]">
            Votre wedding planner
          </span>
        </span>
      </div>
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[color:var(--color-border-strong)] bg-[color:var(--color-surface)]/50 px-8 py-12 text-center">
        <span
          className="flex h-10 w-10 items-center justify-center rounded-2xl"
          style={{
            background: 'color-mix(in oklab, var(--brand) 14%, transparent)',
            color: 'var(--brand)',
          }}
        >
          <MessageCircle className="h-5 w-5" strokeWidth={1.7} aria-hidden />
        </span>
        <p className="max-w-sm text-sm text-[color:var(--color-muted-foreground)]">
          Échangez directement avec votre planner pour toute question sur l’organisation de votre
          mariage. La messagerie arrive très prochainement.
        </p>
      </div>
      <div className="flex items-center gap-2 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-2 opacity-60">
        <input
          disabled
          placeholder={`Écrire à ${planner.name.split(' ')[0]}…`}
          aria-label="Message"
          className="h-9 flex-1 bg-transparent px-3 text-sm outline-none placeholder:text-[color:var(--color-muted-foreground)]"
        />
        <button
          type="button"
          disabled
          aria-label="Envoyer"
          className="flex h-9 w-9 items-center justify-center rounded-xl text-white"
          style={{ background: 'var(--brand)' }}
        >
          <ArrowRight className="h-4 w-4" strokeWidth={2} aria-hidden />
        </button>
      </div>
      <p className="text-center font-mono text-[10px] tracking-[0.12em] text-[color:var(--color-muted-foreground)] uppercase">
        {couple.names}
      </p>
    </div>
  );
}

function ComingSoon({ label, backHref }: { label: string; backHref: string }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-3xl border border-dashed border-[color:var(--color-border-strong)] bg-[color:var(--color-surface)]/50 px-8 py-16 text-center">
      <span
        className="flex h-12 w-12 items-center justify-center rounded-2xl"
        style={{
          background: 'color-mix(in oklab, var(--brand) 14%, transparent)',
          color: 'var(--brand)',
        }}
      >
        <Heart className="h-6 w-6" strokeWidth={1.7} aria-hidden />
      </span>
      <h2 className="font-display text-xl italic">{label}</h2>
      <p className="max-w-sm text-sm text-[color:var(--color-muted-foreground)]">
        Cette section de votre espace arrive très bientôt. En attendant, votre wedding planner gère
        tout depuis le back-office.
      </p>
      <Link
        href={backHref as never}
        className="inline-flex items-center gap-1.5 text-sm"
        style={{ color: 'var(--brand)' }}
      >
        Voir côté agence <ArrowRight className="h-4 w-4" strokeWidth={2} aria-hidden />
      </Link>
    </div>
  );
}
