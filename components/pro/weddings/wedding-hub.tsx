'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useFormatter, useTranslations } from 'next-intl';
import {
  ChevronRight,
  Calendar,
  Clock,
  MapPin,
  Rocket,
  CircleCheck,
  Megaphone,
  UserPlus,
  QrCode,
  Globe,
  Wallet,
  ListChecks,
  Users,
  ArrowRight,
  LayoutDashboard,
  LayoutGrid,
  Image as ImageIcon,
  Receipt,
  type LucideIcon,
} from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/cn';
import { togglePublishAction } from '@/app/[locale]/(app)/pro/weddings/actions';
import {
  InvitesTab,
  MessagingTab,
  CheckinTab,
  SeatingTab,
  GalleryTab,
  FactureTab,
  RsvpMini,
  type HubGuestRow,
} from './hub-ops-tabs';
import { SeatingBoard } from '@/components/seating/seating-board';
import type { SeatingPlan } from '@/lib/seating/board';

export type { HubGuestRow };

type EventStatus = 'draft' | 'active' | 'archived' | 'cancelled';

export interface WeddingHubData {
  eventId: string;
  coupleA: string;
  coupleB: string;
  dateLabel: string;
  jminus: number;
  venue?: string;
  plan: string;
  eventNo: number;
  eventCap: number | null;
  guestCap: number;
  guestTotal: number;
  rsvp: { confirmed: number; declined: number; pending: number };
  budgetTotalMinor: number;
  budgetEngagedPct: number;
  tasksDue: number;
  guests?: HubGuestRow[];
  /** [messages consommés ce mois, plafond mensuel] — onglet Messaging. */
  messageQuota?: [number, number];
  /** Plan de table (null si l'entitlement seatingPlan manque) — onglet Plan de table. */
  seatingPlan?: SeatingPlan | null;
}

const STATUS_PILL: Record<EventStatus, { labelKey: string; bg: string; fg: string; dot: string }> =
  {
    active: {
      labelKey: 'status.active',
      bg: 'oklch(26% 0.04 145)',
      fg: 'oklch(82% 0.07 145)',
      dot: 'oklch(72% 0.08 145)',
    },
    draft: {
      labelKey: 'status.draft',
      bg: 'oklch(28% 0.022 78)',
      fg: 'oklch(85% 0.04 78)',
      dot: 'oklch(78% 0.075 78)',
    },
    archived: {
      labelKey: 'status.archived',
      bg: 'oklch(28% 0.012 78)',
      fg: 'oklch(72% 0.018 65)',
      dot: 'oklch(72% 0.018 65)',
    },
    cancelled: {
      labelKey: 'status.cancelled',
      bg: 'oklch(28% 0.04 25)',
      fg: 'oklch(82% 0.07 22)',
      dot: 'oklch(72% 0.09 20)',
    },
  };

const TABS: ReadonlyArray<{ key: string; labelKey: string; Icon: LucideIcon; sub?: string }> = [
  { key: 'apercu', labelKey: 'tabs.overview', Icon: LayoutDashboard },
  { key: 'invites', labelKey: 'tabs.guests', Icon: Users, sub: 'guests' },
  { key: 'messaging', labelKey: 'tabs.messaging', Icon: Megaphone, sub: 'messaging' },
  { key: 'checkin', labelKey: 'tabs.checkin', Icon: QrCode, sub: 'check-in' },
  { key: 'tables', labelKey: 'tabs.seating', Icon: LayoutGrid, sub: 'seating' },
  { key: 'gallery', labelKey: 'tabs.gallery', Icon: ImageIcon, sub: 'gallery' },
  { key: 'invoice', labelKey: 'tabs.invoice', Icon: Receipt, sub: 'invoice' },
];

export function WeddingHubClient({
  data,
  initialStatus,
}: {
  data: WeddingHubData;
  initialStatus: EventStatus;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<EventStatus>(initialStatus);
  return <WeddingHubInner {...data} status={status} setStatus={setStatus} router={router} />;
}

function WeddingHubInner(
  props: WeddingHubData & {
    status: EventStatus;
    setStatus: (s: EventStatus) => void;
    router: ReturnType<typeof useRouter>;
  },
) {
  const { eventId, status, setStatus, router } = props;
  const t = useTranslations('Pro.weddings');
  const format = useFormatter();
  const budgetEur = props.budgetTotalMinor / 100;
  const budgetLabel = format.number(budgetEur, {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: Number.isInteger(budgetEur) ? 0 : 2,
  });
  const [pending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<string>('apercu');
  // Tous les onglets opérationnels sont rendus DANS le hub (univers dark).
  const IN_HUB_TABS = new Set([
    'apercu',
    'invites',
    'messaging',
    'checkin',
    'tables',
    'gallery',
    'invoice',
  ]);
  const published = status === 'active' || status === 'archived';
  const pill = STATUS_PILL[status];
  const counted = props.rsvp.confirmed + props.rsvp.declined + props.rsvp.pending;
  // Invités « peut-être » = total − (confirmés + absents + en attente). Comptés
  // dans le total mais sans statut ferme → on les matérialise pour que le donut
  // couvre bien les 24 invités (sinon il reste un arc vide).
  const maybe = Math.max(0, props.guestTotal - counted);
  // Taux de réponse = part des invités ayant répondu (tout sauf « en attente »).
  const responseRate =
    props.guestTotal > 0
      ? Math.round(((props.guestTotal - props.rsvp.pending) / props.guestTotal) * 100)
      : 0;

  function eventHref(sub: string) {
    return `/events/${eventId}/${sub}` as never;
  }

  function togglePublish(next: boolean) {
    startTransition(async () => {
      const res = await togglePublishAction(eventId, next);
      if (res.ok) {
        setStatus(res.status);
        router.refresh();
      } else {
        const msg =
          res.error === 'EVENT_QUOTA_EXCEEDED' ? t('hub.quotaExceeded') : t('hub.publishFailed');
        alert(msg);
      }
    });
  }

  const segments = [
    { value: props.rsvp.confirmed, color: 'var(--color-sage-500)', label: t('rsvp.confirmed') },
    { value: props.rsvp.declined, color: 'var(--color-danger)', label: t('rsvp.declined') },
    { value: props.rsvp.pending, color: 'var(--color-warning)', label: t('rsvp.pending') },
    ...(maybe > 0
      ? [{ value: maybe, color: 'var(--color-muted-foreground)', label: t('rsvp.maybe') }]
      : []),
  ];

  return (
    <div className="container-page flex flex-col gap-6 py-6 sm:py-8">
      {/* Breadcrumb */}
      <nav
        aria-label={t('hub.breadcrumb')}
        className="flex items-center gap-1.5 font-mono text-[10px] tracking-[0.18em] text-[color:var(--color-muted-foreground)] uppercase"
      >
        <Link href="/pro/weddings" className="hover:text-[color:var(--color-foreground)]">
          {t('hub.weddings')}
        </Link>
        <ChevronRight className="h-3 w-3" strokeWidth={2} aria-hidden />
        <span className="text-[color:var(--color-foreground)]">
          {props.coupleA} &amp; {props.coupleB}
        </span>
      </nav>

      {/* Persistent header */}
      <header className="flex flex-col gap-5 border-b border-[color:var(--color-border)] pb-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-col gap-2.5">
          <div className="flex flex-wrap items-center gap-3">
            <h1
              className="font-display italic"
              style={{
                fontSize: 'clamp(1.9rem, 4vw, 2.75rem)',
                lineHeight: 1.05,
                letterSpacing: '-0.022em',
                color: 'var(--color-foreground)',
              }}
            >
              {props.coupleA} <span style={{ color: 'var(--color-gold-500)' }}>&amp;</span>{' '}
              {props.coupleB}
            </h1>
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] tracking-[0.16em] uppercase"
              style={{ background: pill.bg, color: pill.fg }}
            >
              <span
                aria-hidden
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ background: pill.dot }}
              />
              {t(pill.labelKey)}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] text-[color:var(--color-muted-foreground)]">
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden />
              {props.dateLabel}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" strokeWidth={1.9} aria-hidden />
              {t('hub.dayMinusPrefix')}
              <b className="text-[color:var(--color-foreground)]">{props.jminus}</b>
            </span>
            {props.venue ? (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden />
                {props.venue}
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col items-start gap-3 lg:items-end">
          {/* Publish */}
          <div className="flex items-center gap-3 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-2.5">
            <span className="flex flex-col">
              <b className="text-sm text-[color:var(--color-foreground)]">
                {published ? t('hub.invitationsSent') : t('hub.draftNotPublished')}
              </b>
              <span className="font-mono text-[10px] text-[color:var(--color-muted-foreground)]">
                {props.eventCap != null
                  ? t('hub.eventNoCapPlan', {
                      no: props.eventNo,
                      cap: props.eventCap,
                      plan: props.plan,
                    })
                  : t('hub.eventNoPlan', { no: props.eventNo, plan: props.plan })}
              </span>
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={published}
              aria-label={published ? t('hub.backToDraft') : t('hub.publishEvent')}
              disabled={pending || status === 'archived'}
              onClick={() => togglePublish(!published)}
              className={cn(
                'relative h-6 w-11 flex-shrink-0 rounded-full transition-colors disabled:opacity-50',
                published
                  ? 'bg-[color:var(--color-blush-700)]'
                  : 'bg-[color:var(--color-surface-elevated)]',
              )}
            >
              <span
                aria-hidden
                className={cn(
                  'absolute top-0.5 h-5 w-5 rounded-full shadow-sm transition-all duration-200 ease-out',
                  published ? 'left-[22px] bg-[color:var(--color-blush-400)]' : 'left-0.5 bg-white',
                )}
              />
            </button>
          </div>
          {/* RSVP mini */}
          <div className="flex items-center gap-3 font-mono text-[11px]">
            <RsvpMini
              color="var(--color-sage-500)"
              n={props.rsvp.confirmed}
              label={t('rsvp.confirmedShort')}
            />
            <RsvpMini
              color="var(--color-danger)"
              n={props.rsvp.declined}
              label={t('rsvp.declinedShort')}
            />
            <RsvpMini
              color="var(--color-warning)"
              n={props.rsvp.pending}
              label={t('rsvp.pendingShort')}
            />
          </div>
        </div>
      </header>

      {/* Tabs (Aperçu inline ; autres = pages opérationnelles) */}
      <div className="-mx-1 flex gap-1 overflow-x-auto border-b border-[color:var(--color-border)] pb-px">
        {TABS.map((tab) => {
          const active = tab.key === activeTab;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => {
                if (IN_HUB_TABS.has(tab.key)) setActiveTab(tab.key);
                else router.push(eventHref(tab.sub!));
              }}
              className={cn(
                'inline-flex flex-shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm transition-colors',
                active
                  ? 'border-[color:var(--color-blush-400)] font-medium text-[color:var(--color-foreground)]'
                  : 'border-transparent text-[color:var(--color-muted-foreground)] hover:text-[color:var(--color-foreground)]',
              )}
            >
              <tab.Icon className="h-4 w-4" strokeWidth={1.85} aria-hidden />
              {t(tab.labelKey)}
            </button>
          );
        })}
      </div>

      {/* Contenu de l'onglet actif */}
      {activeTab === 'apercu' ? (
        <div className="flex flex-col gap-5">
          {/* Publish card */}
          <div
            className={cn(
              'flex flex-col items-start gap-4 rounded-3xl border p-6 sm:flex-row sm:items-center sm:justify-between',
              published
                ? 'border-[color:var(--color-border)]'
                : 'border-[color:var(--color-blush-400)]',
            )}
            style={{ background: 'var(--color-surface)' }}
          >
            <div className="flex items-start gap-3.5">
              <span
                aria-hidden
                className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-[color:var(--color-surface-elevated)] text-[color:var(--color-blush-300)]"
              >
                {published ? (
                  <CircleCheck className="h-5 w-5" strokeWidth={1.85} />
                ) : (
                  <Rocket className="h-5 w-5" strokeWidth={1.85} />
                )}
              </span>
              <div className="flex flex-col gap-1">
                <h3 className="font-display text-lg text-[color:var(--color-foreground)] italic">
                  {published ? t('hub.eventActive') : t('hub.readyToPublish')}
                </h3>
                <p className="max-w-md text-sm text-[color:var(--color-muted-foreground)]">
                  {published ? t('hub.invitationsDistributable') : t('hub.publishToDistribute')}
                </p>
              </div>
            </div>
            {!published ? (
              <button
                type="button"
                onClick={() => togglePublish(true)}
                disabled={pending}
                className="focus-ring inline-flex flex-shrink-0 items-center gap-2 rounded-lg bg-[color:var(--color-primary)] px-5 py-2.5 text-sm font-semibold text-[color:var(--color-primary-foreground)] transition-colors hover:bg-[color:var(--color-primary-hover)] disabled:opacity-50"
              >
                <Rocket className="h-4 w-4" strokeWidth={2} aria-hidden />
                {pending ? t('hub.publishing') : t('hub.publishEvent')}
              </button>
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {/* Left: donut + quick actions */}
            <div className="flex flex-col gap-5">
              <section className="flex flex-col gap-4 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-lg text-[color:var(--color-foreground)] italic">
                    {t('hub.rsvpResponses')}
                  </h2>
                  <Link
                    href={eventHref('guests')}
                    className="inline-flex items-center gap-1 font-mono text-[10px] tracking-[0.16em] text-[color:var(--color-muted-foreground)] uppercase hover:text-[color:var(--color-foreground)]"
                  >
                    {t('hub.viewGuests')} <ArrowRight className="h-3 w-3" strokeWidth={2} />
                  </Link>
                </div>
                <div className="flex flex-col items-center gap-6 sm:flex-row">
                  <Donut
                    segments={segments}
                    total={props.guestTotal}
                    unitLabel={t('hub.guestsUnit')}
                  />
                  <div className="flex flex-1 flex-col gap-2 self-stretch">
                    {segments.map((s) => (
                      <div
                        key={s.label}
                        className="flex items-center gap-2 text-sm text-[color:var(--color-foreground)]"
                      >
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ background: s.color }}
                          aria-hidden
                        />
                        <span className="flex-1">{s.label}</span>
                        <span className="font-mono tabular-nums">{s.value}</span>
                        <span className="w-10 text-right font-mono text-xs text-[color:var(--color-muted-foreground)] tabular-nums">
                          {t('hub.percent', {
                            n:
                              props.guestTotal > 0
                                ? Math.round((s.value / props.guestTotal) * 100)
                                : 0,
                          })}
                        </span>
                      </div>
                    ))}
                    <div className="mt-1 flex items-center justify-between border-t border-[color:var(--color-border)] pt-2.5 text-sm text-[color:var(--color-muted-foreground)]">
                      {t('hub.responseRate')}
                      <span className="font-mono text-[color:var(--color-foreground)] tabular-nums">
                        {t('hub.percent', { n: responseRate })}
                      </span>
                    </div>
                  </div>
                </div>
              </section>

              <section className="flex flex-col gap-3 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6">
                <h2 className="font-display text-lg text-[color:var(--color-foreground)] italic">
                  {t('hub.quickActions')}
                </h2>
                <div className="grid grid-cols-2 gap-2.5">
                  <QuickAction
                    href={eventHref('messaging')}
                    Icon={Megaphone}
                    label={t('hub.qaBroadcast')}
                    disabled={!published}
                  />
                  <QuickAction
                    href={eventHref('guests')}
                    Icon={UserPlus}
                    label={t('hub.qaAddGuests')}
                  />
                  <QuickAction
                    href={eventHref('check-in')}
                    Icon={QrCode}
                    label={t('hub.qaOpenCheckin')}
                  />
                  <QuickAction
                    href={eventHref('preview')}
                    Icon={Globe}
                    label={t('hub.qaPublicPage')}
                  />
                </div>
              </section>
            </div>

            {/* Right: KPIs */}
            <div className="grid grid-cols-2 gap-3 self-start">
              <KpiCard
                Icon={Clock}
                label={t('hub.kpiCountdown')}
                value={t('hub.dayMinusValue', { n: props.jminus })}
                sub={props.dateLabel}
              />
              <KpiCard
                Icon={Users}
                label={t('hub.kpiGuests')}
                value={`${props.guestTotal}`}
                unit={`/${props.guestCap}`}
                bar={Math.min(
                  100,
                  props.guestCap > 0 ? (props.guestTotal / props.guestCap) * 100 : 0,
                )}
              />
              <KpiLink
                href={`/pro/budget?event=${eventId}`}
                Icon={Wallet}
                label={t('hub.kpiBudget')}
                value={budgetLabel}
                sub={t('hub.budgetEngaged', { pct: props.budgetEngagedPct })}
                linkLabel={t('hub.viewBudget')}
              />
              <KpiLink
                href={`/pro/planning?event=${eventId}`}
                Icon={ListChecks}
                label={t('hub.kpiTasks')}
                value={`${props.tasksDue}`}
                sub={t('hub.tasksDueSoon')}
                linkLabel={t('hub.backlog')}
              />
            </div>
          </div>
        </div>
      ) : activeTab === 'invites' ? (
        <InvitesTab
          guests={props.guests ?? []}
          rsvp={props.rsvp}
          guestCap={props.guestCap}
          eventHref={eventHref}
        />
      ) : activeTab === 'messaging' ? (
        <MessagingTab
          published={published}
          guests={props.guests ?? []}
          rsvp={props.rsvp}
          guestTotal={props.guestTotal}
          messageQuota={props.messageQuota ?? [0, 1]}
          coupleA={props.coupleA}
          coupleB={props.coupleB}
        />
      ) : activeTab === 'checkin' ? (
        <CheckinTab guests={props.guests ?? []} guestTotal={props.guestTotal} />
      ) : activeTab === 'tables' ? (
        props.seatingPlan ? (
          <SeatingBoard eventId={eventId} initial={props.seatingPlan} />
        ) : (
          <SeatingTab
            guests={props.guests ?? []}
            guestTotal={props.guestTotal}
            eventHref={eventHref}
          />
        )
      ) : activeTab === 'gallery' ? (
        <GalleryTab />
      ) : activeTab === 'invoice' ? (
        <FactureTab plan={props.plan} eventNo={props.eventNo} eventCap={props.eventCap} />
      ) : null}
    </div>
  );
}

function Donut({
  segments,
  total,
  unitLabel,
  size = 150,
  stroke = 17,
}: {
  segments: ReadonlyArray<{ value: number; color: string; label: string }>;
  total: number;
  unitLabel: string;
  size?: number;
  stroke?: number;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dashes = segments.map((s) => (total ? s.value / total : 0) * c);
  const arcs = segments.map((s, i) => ({
    color: s.color,
    dash: dashes[i] ?? 0,
    offset: dashes.slice(0, i).reduce((a, b) => a + b, 0),
  }));
  return (
    <div
      className="relative flex flex-shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
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
        {arcs.map((a, i) => (
          <circle
            key={i}
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={a.color}
            strokeWidth={stroke}
            strokeDasharray={`${a.dash} ${c - a.dash}`}
            strokeDashoffset={-a.offset}
            strokeLinecap="butt"
          />
        ))}
      </svg>
      <span className="absolute flex flex-col items-center">
        <span className="font-mono text-2xl font-medium text-[color:var(--color-foreground)] tabular-nums">
          {total}
        </span>
        <span className="font-mono text-[9px] tracking-[0.18em] text-[color:var(--color-muted-foreground)] uppercase">
          {unitLabel}
        </span>
      </span>
    </div>
  );
}

function QuickAction({
  href,
  Icon,
  label,
  disabled,
}: {
  href: string;
  Icon: LucideIcon;
  label: string;
  disabled?: boolean;
}) {
  const inner = (
    <>
      <Icon className="h-[18px] w-[18px]" strokeWidth={1.85} aria-hidden />
      <span className="text-left text-sm">{label}</span>
    </>
  );
  if (disabled) {
    return (
      <span className="flex cursor-not-allowed items-center gap-2.5 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-elevated)]/40 px-3.5 py-3 text-[color:var(--color-muted-foreground)] opacity-50">
        {inner}
      </span>
    );
  }
  return (
    <Link
      href={href as never}
      className="focus-ring flex items-center gap-2.5 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-elevated)] px-3.5 py-3 text-[color:var(--color-foreground)] transition-colors hover:border-[color:var(--color-border-strong)]"
    >
      {inner}
    </Link>
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
      <span className="inline-flex items-center gap-1.5 font-mono text-[9px] tracking-[0.18em] text-[color:var(--color-muted-foreground)] uppercase">
        <Icon className="h-3 w-3" strokeWidth={1.9} aria-hidden />
        {label}
      </span>
      <span className="font-mono text-2xl font-medium text-[color:var(--color-foreground)] tabular-nums">
        {value}
        {unit ? (
          <span className="text-sm text-[color:var(--color-muted-foreground)]">{unit}</span>
        ) : null}
      </span>
      {bar != null ? (
        <div className="h-1 w-full overflow-hidden rounded-full bg-[color:var(--color-surface-elevated)]">
          <span
            className="block h-full rounded-full"
            style={{ width: `${bar}%`, background: 'var(--color-blush-400)' }}
          />
        </div>
      ) : null}
      {sub ? (
        <span className="text-xs text-[color:var(--color-muted-foreground)]">{sub}</span>
      ) : null}
    </article>
  );
}

function KpiLink({
  href,
  Icon,
  label,
  value,
  sub,
  linkLabel,
}: {
  href: string;
  Icon: LucideIcon;
  label: string;
  value: string;
  sub: string;
  linkLabel: string;
}) {
  return (
    <Link
      href={href as never}
      className="focus-ring group flex flex-col gap-2 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4 transition-colors hover:border-[color:var(--color-border-strong)]"
    >
      <span className="inline-flex items-center gap-1.5 font-mono text-[9px] tracking-[0.18em] text-[color:var(--color-muted-foreground)] uppercase">
        <Icon className="h-3 w-3" strokeWidth={1.9} aria-hidden />
        {label}
      </span>
      <span className="font-mono text-2xl font-medium text-[color:var(--color-foreground)] tabular-nums">
        {value}
      </span>
      <span className="flex items-center justify-between text-xs text-[color:var(--color-muted-foreground)]">
        {sub}
        <span className="inline-flex items-center gap-0.5 text-[color:var(--color-blush-300)]">
          {linkLabel} <ArrowRight className="h-3 w-3" strokeWidth={2} />
        </span>
      </span>
    </Link>
  );
}
