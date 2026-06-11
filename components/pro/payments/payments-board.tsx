'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Wallet,
  CircleAlert,
  Check,
  Landmark,
  Calendar,
  Send,
  Copy,
  Link2,
  MessageSquare,
  Scale,
  ShieldCheck,
  Lock,
  ChevronRight,
  X,
  Download,
  Tag,
  CreditCard,
  Hash,
  Info,
  Hourglass,
  LayoutDashboard,
  ListChecks,
  Settings,
  Sparkles,
  Plus,
  ExternalLink,
  type LucideIcon,
} from 'lucide-react';
import { useLocale } from 'next-intl';
import { cn } from '@/lib/cn';
import { formatEurMinor, formatDateFr } from '@/lib/pro/format';
import { toast } from '@/components/ui/toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  buildLedger,
  buildPlans,
  computeFee,
  nextDueMilestone,
  PAY_STATUS_LABEL,
  PAYOUT_STATUS_LABEL,
  isChargeRefundable,
  paymentRequestMessage,
  PAYMENT_MODE_META,
  PAYMENT_MODE_ORDER,
  TERM_LABELS,
  TERM_DISCLAIMER,
  TX_TYPE_LABEL,
  type ConnectedFinances,
  type ConnectedPayment,
  type InvoiceLike,
  type MilestoneStatus,
  type Milestone,
  type PaymentMode,
  type PaymentPlan,
  type TermType,
} from '@/lib/pro/payments';
import { recordPaymentAction } from '@/app/[locale]/(app)/pro/quotes/actions';
import { setPaymentsSettingsAction } from '@/app/[locale]/(app)/pro/actions';
import {
  createFreePaymentLinkAction,
  getConnectedFinancesAction,
  refundConnectedChargeAction,
} from '@/app/[locale]/(app)/pro/payments/actions';
import { PayLinkButton, linkErr } from './pay-link-button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface Account {
  mode: PaymentMode;
  /** Compte Stripe de l'agence connecté ? */
  connected: boolean;
  country: 'FR';
}

type SubTab = 'dashboard' | 'plan' | 'disputes' | 'settings';

const SUBTABS: { k: SubTab; label: string; Icon: LucideIcon }[] = [
  { k: 'dashboard', label: 'Tableau de bord', Icon: LayoutDashboard },
  { k: 'plan', label: 'Échéancier', Icon: ListChecks },
  { k: 'disputes', label: 'Litiges', Icon: Scale },
  { k: 'settings', label: 'Réglages', Icon: Settings },
];

/* ------------------------------ tons de pastilles ------------------------------ */

type Tone = 'ok' | 'warn' | 'danger' | 'info' | 'muted';

const PILL_TONE: Record<Tone, string> = {
  ok: 'bg-[oklch(26%_0.045_150)] text-[oklch(84%_0.09_150)]',
  warn: 'bg-[oklch(29%_0.05_80)] text-[oklch(87%_0.09_85)]',
  danger: 'bg-[oklch(28%_0.05_25)] text-[oklch(84%_0.09_25)]',
  info: 'bg-[oklch(28%_0.045_255)] text-[oklch(85%_0.08_258)]',
  muted: 'bg-[color:var(--color-surface-elevated)] text-[color:var(--color-muted-foreground)]',
};

const STATUS_TONE: Record<MilestoneStatus, Tone> = {
  paid: 'ok',
  overdue: 'danger',
  upcoming: 'warn',
};

function PayStatusPill({ status }: { status: MilestoneStatus }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[9.5px] tracking-[0.12em] whitespace-nowrap uppercase',
        PILL_TONE[STATUS_TONE[status]],
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-90" aria-hidden />
      {PAY_STATUS_LABEL[status]}
    </span>
  );
}

function StripeBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[10px] tracking-[0.08em] text-[color:var(--color-muted-foreground)]">
      <Lock className="h-3 w-3 text-[color:var(--color-sage-500)]" strokeWidth={2} aria-hidden />
      Paiements sécurisés par{' '}
      <b className="font-semibold tracking-normal text-[color:var(--color-foreground)]">Stripe</b>
    </span>
  );
}

function CoupleName({ name }: { name: string }) {
  const parts = name.split(' & ');
  if (parts.length < 2) return <>{name}</>;
  return (
    <>
      {parts[0]} <span style={{ color: 'var(--color-gold-500)' }}>&amp;</span>{' '}
      {parts.slice(1).join(' & ')}
    </>
  );
}

function initials(name: string): string {
  const parts = name.replace(/&/g, ' ').split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '··';
}

/* ------------------------------ primitives ------------------------------ */

/** Décomposition des frais (le couple paie − frais Stripe = vous recevez). */
function FeeBreakdown({
  amountMinor,
  country,
  approx,
  title = 'Détail des frais',
}: {
  amountMinor: number;
  country: 'FR';
  approx?: boolean;
  title?: string | null;
}) {
  const f = computeFee(amountMinor, country);
  const a = approx ? '~ ' : '';
  return (
    <div className="flex flex-col gap-0.5 rounded-xl border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface-elevated)] px-4 py-3.5">
      {title ? (
        <div className="mb-2 font-mono text-[9px] tracking-[0.18em] text-[color:var(--color-muted-foreground)] uppercase">
          {title}
        </div>
      ) : null}
      <FeeRow label="Le couple paie" value={formatEurMinor(f.clientPaysMinor)} strong />
      <FeeRow op="−" label="Frais Stripe" value={`${a}${formatEurMinor(f.stripeFeeMinor)}`} sub />
      <div className="mt-1.5 flex items-center justify-between gap-3 border-t border-[color:var(--color-border)] pt-2.5 font-mono text-sm">
        <span className="inline-flex items-center gap-2 font-medium text-[color:var(--color-foreground)]">
          <span className="inline-block w-3 text-[color:var(--color-muted-foreground)]">=</span>Vous
          recevez
        </span>
        <span className="font-semibold text-[color:var(--color-blush-300)] tabular-nums">
          {a}
          {formatEurMinor(f.netReceivedMinor)}
        </span>
      </div>
      <div className="mt-2 font-mono text-[10px] leading-relaxed text-[color:var(--color-muted-foreground)]">
        Vous encaissez sur votre propre compte Stripe.
      </div>
    </div>
  );
}

function FeeRow({
  op,
  label,
  rate,
  value,
  sub,
  strong,
}: {
  op?: string;
  label: string;
  rate?: string;
  value: string;
  sub?: boolean;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1 font-mono text-[13px]">
      <span
        className={cn(
          'inline-flex items-center gap-2',
          sub ? 'text-[color:var(--color-muted-foreground)]' : 'text-[color:var(--color-ink-700)]',
        )}
      >
        <span className="inline-block w-3 text-[color:var(--color-muted-foreground)]">
          {op ?? ''}
        </span>
        {label}
        {rate ? (
          <span className="rounded border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-1.5 py-px text-[9px] text-[color:var(--color-muted-foreground)]">
            {rate}
          </span>
        ) : null}
      </span>
      <span
        className={cn(
          'whitespace-nowrap tabular-nums',
          strong
            ? 'text-sm text-[color:var(--color-foreground)]'
            : sub
              ? 'text-[color:var(--color-muted-foreground)]'
              : 'text-[color:var(--color-foreground)]',
        )}
      >
        {value}
      </span>
    </div>
  );
}

function SectionHead({ title, count }: { title: string; count?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="font-display text-lg text-[color:var(--color-foreground)] italic">{title}</h2>
      {count ? (
        <span className="font-mono text-[10px] tracking-[0.16em] text-[color:var(--color-muted-foreground)] uppercase">
          {count}
        </span>
      ) : null}
    </div>
  );
}

/* ============================ TABLEAU DE BORD ============================ */

function MoneyHero({
  collectedMinor,
  upcomingMinor,
  overdueMinor,
  nextDue,
  account,
}: {
  collectedMinor: number;
  upcomingMinor: number;
  overdueMinor: number;
  nextDue: Milestone | null;
  account: Account;
}) {
  const modeMeta = PAYMENT_MODE_META[account.mode];
  return (
    <div
      className="relative flex flex-col gap-5 rounded-3xl border border-[color:var(--color-blush-500)]/30 p-6 sm:p-7"
      style={{
        background:
          'linear-gradient(120deg, var(--color-surface), color-mix(in oklab, var(--color-blush-500) 12%, var(--color-surface)))',
        boxShadow: 'var(--shadow-blush)',
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <span className="inline-flex items-center gap-2 font-mono text-[9.5px] tracking-[0.2em] text-[color:var(--color-muted-foreground)] uppercase">
            <Wallet className="h-3 w-3" strokeWidth={1.9} aria-hidden />
            Encaissé · suivi
          </span>
          <span
            className="font-mono font-medium text-[color:var(--color-foreground)] tabular-nums"
            style={{ fontSize: 'clamp(34px, 5vw, 46px)', lineHeight: 1, letterSpacing: '-0.02em' }}
          >
            {formatEurMinor(collectedMinor)}
          </span>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[9.5px] tracking-[0.1em] uppercase',
              account.connected ? PILL_TONE.ok : PILL_TONE.muted,
            )}
          >
            <ShieldCheck className="h-3 w-3" strokeWidth={2} aria-hidden />
            {modeMeta.label}
          </span>
          <StripeBadge />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-border)] sm:grid-cols-3">
        <HeroTile Icon={Hourglass} label="À venir" value={formatEurMinor(upcomingMinor)} />
        <HeroTile
          Icon={CircleAlert}
          label="En retard"
          value={formatEurMinor(overdueMinor)}
          danger={overdueMinor > 0}
        />
        <HeroTile
          Icon={Calendar}
          label="Prochaine échéance"
          value={nextDue?.dueDate ? formatDateFr(nextDue.dueDate) : '—'}
          accent
        />
      </div>
    </div>
  );
}

function HeroTile({
  Icon,
  label,
  value,
  danger,
  accent,
}: {
  Icon: LucideIcon;
  label: string;
  value: string;
  danger?: boolean;
  accent?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5 bg-[color:var(--color-surface)]/90 px-4 py-3.5">
      <span className="inline-flex items-center gap-1.5 font-mono text-[9px] tracking-[0.16em] text-[color:var(--color-muted-foreground)] uppercase">
        <Icon
          className="h-3 w-3 text-[color:var(--color-blush-300)]"
          strokeWidth={1.9}
          aria-hidden
        />
        {label}
      </span>
      <span
        className={cn(
          'font-mono whitespace-nowrap tabular-nums',
          accent ? 'text-[15px] text-[color:var(--color-blush-300)]' : 'text-[19px]',
          danger ? 'text-[oklch(75%_0.12_25)]' : !accent && 'text-[color:var(--color-foreground)]',
        )}
      >
        {value}
      </span>
    </div>
  );
}

const FINANCES_ERR: Record<string, string> = {
  NOT_CONNECTED: 'Connectez votre compte Stripe pour suivre votre solde et vos virements ici.',
};
const financesErr = (c: string) =>
  FINANCES_ERR[c] ?? 'Impossible de récupérer vos données Stripe pour le moment.';

const REFUND_ERR: Record<string, string> = {
  FORBIDDEN: 'Seuls le propriétaire et les admins peuvent rembourser.',
  NOT_CONNECTED: 'Aucun compte Stripe connecté.',
};
const refundErr = (c: string) => REFUND_ERR[c] ?? 'Remboursement impossible. Réessayez.';

/**
 * Solde + virements RÉELS lus sur le compte Stripe connecté de l'agence (Lot B) —
 * l'agence suit son argent sans quitter la plateforme. Récupéré à l'affichage via
 * une server action (lecture seule). États : non connecté / chargement / erreur / data.
 */
function ConnectedFinancesSection({
  connected,
  canManage,
}: {
  connected: boolean;
  canManage: boolean;
}) {
  const [loading, setLoading] = useState(connected);
  const [data, setData] = useState<ConnectedFinances | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refundTarget, setRefundTarget] = useState<ConnectedPayment | null>(null);
  const [refundError, setRefundError] = useState<string | null>(null);
  const [refunding, startRefund] = useTransition();

  function confirmRefund() {
    if (!refundTarget) return;
    const chargeId = refundTarget.id;
    setRefundError(null);
    startRefund(async () => {
      const res = await refundConnectedChargeAction(chargeId);
      if (!res.ok) {
        setRefundError(refundErr(res.error));
        return;
      }
      toast.success('Remboursement effectué');
      setRefundTarget(null);
      const fresh = await getConnectedFinancesAction();
      if (fresh.ok) setData(fresh.data);
    });
  }

  useEffect(() => {
    if (!connected) return;
    let active = true;
    getConnectedFinancesAction().then((res) => {
      if (!active) return;
      if (res.ok) {
        setData(res.data);
        setError(null);
      } else {
        setError(financesErr(res.error));
      }
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [connected]);

  return (
    <section className="flex flex-col gap-3">
      <SectionHead title="Solde & versements" count="Votre compte Stripe" />
      {!connected ? (
        <div className="flex items-center gap-3 rounded-2xl border border-dashed border-[color:var(--color-border-strong)] bg-[color:var(--color-surface)]/40 px-6 py-7 text-sm text-[color:var(--color-muted-foreground)]">
          <Landmark className="h-5 w-5 flex-shrink-0" strokeWidth={1.6} aria-hidden />
          Connectez votre compte Stripe pour suivre votre solde et vos virements directement ici.
        </div>
      ) : loading ? (
        <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-6 py-7 text-sm text-[color:var(--color-muted-foreground)]">
          Chargement de votre solde Stripe…
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-6 py-5 text-sm text-[color:var(--color-muted-foreground)]">
          <CircleAlert className="h-4 w-4 flex-shrink-0" strokeWidth={1.9} aria-hidden />
          {error}
        </div>
      ) : data ? (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-border)] sm:grid-cols-2">
            <div className="flex flex-col gap-1.5 bg-[color:var(--color-surface)] px-4 py-3.5">
              <span className="inline-flex items-center gap-1.5 font-mono text-[9px] tracking-[0.16em] text-[color:var(--color-muted-foreground)] uppercase">
                <Wallet
                  className="h-3 w-3 text-[color:var(--color-sage-500)]"
                  strokeWidth={1.9}
                  aria-hidden
                />
                Disponible
              </span>
              <span className="font-mono text-[19px] text-[color:var(--color-foreground)] tabular-nums">
                {formatEurMinor(data.balance.availableMinor)}
              </span>
            </div>
            <div className="flex flex-col gap-1.5 bg-[color:var(--color-surface)] px-4 py-3.5">
              <span className="inline-flex items-center gap-1.5 font-mono text-[9px] tracking-[0.16em] text-[color:var(--color-muted-foreground)] uppercase">
                <Hourglass
                  className="h-3 w-3 text-[color:var(--color-blush-300)]"
                  strokeWidth={1.9}
                  aria-hidden
                />
                En attente
              </span>
              <span className="font-mono text-[19px] text-[color:var(--color-foreground)] tabular-nums">
                {formatEurMinor(data.balance.pendingMinor)}
              </span>
            </div>
          </div>

          {data.payouts.length > 0 ? (
            <div className="overflow-hidden rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)]">
              {data.payouts.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-3 border-b border-[color:var(--color-border)] px-4 py-3 last:border-0"
                >
                  <span className="inline-flex items-center gap-2 text-sm text-[color:var(--color-ink-700)]">
                    <Landmark
                      className="h-3.5 w-3.5 text-[color:var(--color-muted-foreground)]"
                      strokeWidth={1.7}
                      aria-hidden
                    />
                    Virement{p.arrivalDate ? ` · ${formatDateFr(p.arrivalDate)}` : ''}
                  </span>
                  <span className="flex items-center gap-2.5">
                    <span className="font-mono text-sm text-[color:var(--color-foreground)] tabular-nums">
                      {formatEurMinor(p.amountMinor)}
                    </span>
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 font-mono text-[9px] uppercase',
                        p.status === 'paid' ? PILL_TONE.ok : PILL_TONE.warn,
                      )}
                    >
                      {PAYOUT_STATUS_LABEL[p.status] ?? p.status}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="px-1 text-xs text-[color:var(--color-muted-foreground)]">
              Aucun virement pour l’instant. Vos versements apparaîtront ici dès le premier
              encaissement.
            </p>
          )}

          {data.payments.length > 0 ? (
            <div className="flex flex-col gap-2">
              <span className="px-1 font-mono text-[9px] tracking-[0.18em] text-[color:var(--color-muted-foreground)] uppercase">
                Encaissements récents
              </span>
              <div className="overflow-hidden rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)]">
                {data.payments.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-3 border-b border-[color:var(--color-border)] px-4 py-3 last:border-0"
                  >
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate text-sm text-[color:var(--color-foreground)]">
                        {p.description ?? p.customerEmail ?? 'Encaissement'}
                      </span>
                      <span className="font-mono text-[11px] text-[color:var(--color-muted-foreground)]">
                        {p.created ? formatDateFr(p.created) : ''}
                        {p.refunded ? ' · remboursé' : ''}
                      </span>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-2.5">
                      <span className="font-mono text-sm text-[color:var(--color-foreground)] tabular-nums">
                        {formatEurMinor(p.amountMinor)}
                      </span>
                      {p.receiptUrl ? (
                        <a
                          href={p.receiptUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface)] px-2.5 py-1.5 text-xs text-[color:var(--color-ink-700)] hover:text-[color:var(--color-foreground)]"
                        >
                          <Download className="h-3 w-3" strokeWidth={1.9} aria-hidden />
                          Reçu
                        </a>
                      ) : null}
                      {canManage && isChargeRefundable(p) ? (
                        <button
                          type="button"
                          onClick={() => {
                            setRefundError(null);
                            setRefundTarget(p);
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface)] px-2.5 py-1.5 text-xs text-[color:var(--color-ink-700)] hover:border-[color:var(--color-danger)] hover:text-[color:var(--color-foreground)]"
                        >
                          Rembourser
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <p className="px-1 font-mono text-[10px] leading-relaxed text-[color:var(--color-muted-foreground)]">
            Données lues en direct sur votre compte Stripe — la fréquence des virements se règle
            dans votre dashboard Stripe.
          </p>
        </div>
      ) : null}

      <Dialog
        open={refundTarget != null}
        onOpenChange={(v) => {
          if (!v) {
            setRefundTarget(null);
            setRefundError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rembourser cet encaissement ?</DialogTitle>
            <DialogDescription>
              {refundTarget
                ? `${formatEurMinor(refundTarget.amountMinor)} seront renvoyés au client depuis votre compte Stripe. Cette action est irréversible.`
                : ''}
            </DialogDescription>
          </DialogHeader>
          {refundError ? (
            <p role="alert" className="text-xs text-[color:var(--color-danger)]">
              {refundError}
            </p>
          ) : null}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" size="md">
                Annuler
              </Button>
            </DialogClose>
            <Button
              type="button"
              variant="destructive"
              size="md"
              disabled={refunding}
              onClick={confirmRefund}
            >
              {refunding ? 'Remboursement…' : 'Confirmer le remboursement'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function DashboardScreen({
  account,
  collectedMinor,
  upcomingMinor,
  overdueMinor,
  nextDue,
  milestones,
  onActivate,
  onRow,
  canManage,
}: {
  account: Account;
  collectedMinor: number;
  upcomingMinor: number;
  overdueMinor: number;
  nextDue: Milestone | null;
  milestones: Milestone[];
  onActivate: () => void;
  onRow: (m: Milestone) => void;
  canManage: boolean;
}) {
  return (
    <div className="flex flex-col gap-5">
      {!account.connected ? (
        <div className="flex flex-col items-start gap-3 rounded-2xl border border-[color:var(--color-blush-500)]/25 bg-[color:var(--color-blush-500)]/8 p-4 sm:flex-row sm:items-center">
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px] bg-[color:var(--color-blush-500)]/18 text-[color:var(--color-blush-300)]">
            <CreditCard className="h-[18px] w-[18px]" strokeWidth={1.9} aria-hidden />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <b className="text-[13.5px] font-semibold text-[color:var(--color-foreground)]">
              Connectez votre compte Stripe pour encaisser en ligne
            </b>
            <span className="text-[12.5px] text-[color:var(--color-ink-700)]">
              Reliez votre propre compte Stripe (carte de connexion en haut de page) : les paiements
              par carte arrivent directement sur votre compte. En attendant, vous gardez le suivi
              manuel.
            </span>
          </div>
          <button
            type="button"
            onClick={onActivate}
            className="focus-ring inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg bg-[color:var(--color-blush-400)] px-3.5 py-2 text-xs font-medium text-[oklch(20%_0.02_28)] hover:brightness-105"
          >
            <Settings className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
            Réglages
          </button>
        </div>
      ) : null}

      <MoneyHero
        collectedMinor={collectedMinor}
        upcomingMinor={upcomingMinor}
        overdueMinor={overdueMinor}
        nextDue={nextDue}
        account={account}
      />

      {/* Transactions */}
      <section className="flex flex-col gap-3">
        <SectionHead
          title="Transactions"
          count={`${milestones.length} échéance${milestones.length > 1 ? 's' : ''}`}
        />
        {milestones.length === 0 ? (
          <EmptyBlock>
            Aucune transaction pour l’instant. Les échéances de vos factures apparaîtront ici.
          </EmptyBlock>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[color:var(--color-border)] text-left font-mono text-[9px] tracking-[0.18em] text-[color:var(--color-muted-foreground)] uppercase">
                    <th className="px-4 py-3 font-medium">Couple</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium">Échéance</th>
                    <th className="px-4 py-3 text-right font-medium">Montant</th>
                    <th className="px-4 py-3 text-right font-medium">Frais Stripe</th>
                    <th className="px-4 py-3 text-right font-medium">Net reçu</th>
                    <th className="px-4 py-3 font-medium">Statut</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {milestones.map((m) => {
                    const f = computeFee(m.amountMinor, account.country);
                    return (
                      <tr
                        key={`${m.docId}-${m.index}`}
                        onClick={() => onRow(m)}
                        className="cursor-pointer border-b border-[color:var(--color-border)] last:border-0 hover:bg-[color:var(--color-surface-elevated)]"
                      >
                        <td className="font-display px-4 py-3 text-sm text-[color:var(--color-foreground)] italic">
                          <CoupleName name={m.clientName} />
                        </td>
                        <td className="px-4 py-3 font-mono text-[11px] tracking-[0.08em] text-[color:var(--color-ink-700)] uppercase">
                          {TX_TYPE_LABEL[milestoneTypeFor(m)]}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-[color:var(--color-muted-foreground)]">
                          {m.dueDate ? formatDateFr(m.dueDate) : '—'}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs text-[color:var(--color-foreground)] tabular-nums">
                          {formatEurMinor(m.amountMinor)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs text-[color:var(--color-muted-foreground)] tabular-nums">
                          {formatEurMinor(f.stripeFeeMinor)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs text-[color:var(--color-blush-300)] tabular-nums">
                          {m.paid ? formatEurMinor(f.netReceivedMinor) : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <PayStatusPill status={m.status} />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <ChevronRight
                            className="h-4 w-4 text-[color:var(--color-muted-foreground)]"
                            strokeWidth={2}
                            aria-hidden
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="border-t border-[color:var(--color-border)] px-4 py-3">
              <p className="flex items-start gap-2 text-[11.5px] leading-relaxed text-[color:var(--color-muted-foreground)]">
                <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" strokeWidth={1.8} aria-hidden />
                Net reçu = montant encaissé − frais Stripe. Les paiements en ligne vont directement
                sur votre propre compte Stripe.
              </p>
            </div>
          </div>
        )}
      </section>

      {/* Solde & versements réels (lus sur le compte Stripe connecté) */}
      <ConnectedFinancesSection connected={account.connected} canManage={canManage} />
    </div>
  );
}

function milestoneTypeFor(m: Milestone): 'acompte' | 'echeance' | 'solde' {
  // Le type est porté par le plan ; pour le ledger plat on retombe sur le libellé.
  const lbl = m.label.toLowerCase();
  if (lbl.includes('acompte') || lbl.includes('arrhes')) return 'acompte';
  if (lbl.includes('solde')) return 'solde';
  return 'echeance';
}

/* ============================ LIENS DE PAIEMENT ============================ */
// `PayLinkButton` + `linkErr` sont partagés (cockpit + Devis & Factures) →
// voir `./pay-link-button`.

/** Dialogue de création d'un lien de paiement libre (montant + libellé ad hoc). */
function FreePayLinkDialog({
  open,
  onOpenChange,
  connected,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  connected: boolean;
}) {
  const locale = useLocale();
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [clientName, setClientName] = useState('');
  const [link, setLink] = useState<{
    url: string;
    amountMinor: number;
    description: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function reset() {
    setAmount('');
    setDescription('');
    setClientName('');
    setLink(null);
    setError(null);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouveau lien de paiement</DialogTitle>
          <DialogDescription>Encaissé directement sur votre compte Stripe.</DialogDescription>
        </DialogHeader>

        {link ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-[color:var(--color-foreground)]">
              Lien créé et copié. Partagez-le avec votre client :
            </p>
            <div className="flex items-center gap-2 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-elevated)] px-3.5 py-3">
              <Link2
                className="h-3.5 w-3.5 flex-shrink-0 text-[color:var(--color-muted-foreground)]"
                strokeWidth={1.9}
                aria-hidden
              />
              <span className="flex-1 truncate font-mono text-xs text-[color:var(--color-blush-300)]">
                {link.url}
              </span>
              <a
                href={link.url}
                target="_blank"
                rel="noreferrer"
                aria-label="Ouvrir le lien"
                className="focus-ring rounded-md p-1 text-[color:var(--color-muted-foreground)] hover:text-[color:var(--color-foreground)]"
              >
                <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden />
              </a>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={() => {
                  void navigator.clipboard?.writeText(link.url);
                  toast.success('Lien copié');
                }}
              >
                <Copy className="h-4 w-4" strokeWidth={1.9} aria-hidden />
                Copier le lien
              </Button>
              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={() => {
                  void navigator.clipboard?.writeText(
                    paymentRequestMessage(locale, {
                      clientName: clientName || undefined,
                      amountMinor: link.amountMinor,
                      description: link.description,
                      url: link.url,
                    }),
                  );
                  toast.success('Message prêt à envoyer copié');
                }}
              >
                <MessageSquare className="h-4 w-4" strokeWidth={1.9} aria-hidden />
                Copier le message
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="font-mono text-[9px] tracking-[0.18em] text-[color:var(--color-muted-foreground)] uppercase">
                Montant (€)
              </span>
              <Input
                inputMode="decimal"
                placeholder="1500"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="font-mono text-[9px] tracking-[0.18em] text-[color:var(--color-muted-foreground)] uppercase">
                Libellé du service
              </span>
              <Input
                placeholder="Acompte prestation mariage"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="font-mono text-[9px] tracking-[0.18em] text-[color:var(--color-muted-foreground)] uppercase">
                Client (optionnel)
              </span>
              <Input
                placeholder="Awa & Karim"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
              />
            </label>
            {!connected ? (
              <p className="text-xs text-[color:var(--color-muted-foreground)]">
                Connectez d’abord votre compte Stripe (carte en haut de la page).
              </p>
            ) : null}
            {error ? (
              <p role="alert" className="text-xs text-[color:var(--color-danger)]">
                {error}
              </p>
            ) : null}
          </div>
        )}

        <DialogFooter>
          {link ? (
            <DialogClose asChild>
              <Button type="button" variant="outline" size="md">
                Fermer
              </Button>
            </DialogClose>
          ) : (
            <>
              <DialogClose asChild>
                <Button type="button" variant="outline" size="md">
                  Annuler
                </Button>
              </DialogClose>
              <Button
                type="button"
                variant="primary"
                size="md"
                disabled={pending || !connected}
                onClick={() => {
                  setError(null);
                  start(async () => {
                    const res = await createFreePaymentLinkAction({
                      amountEur: amount,
                      description,
                      clientName: clientName || undefined,
                    });
                    if (!res.ok) {
                      setError(linkErr(res.error));
                      return;
                    }
                    setLink({
                      url: res.url,
                      amountMinor: res.amountMinor,
                      description: res.description,
                    });
                    void navigator.clipboard?.writeText(res.url);
                    toast.success('Lien de paiement créé et copié');
                  });
                }}
              >
                {pending ? 'Création…' : 'Créer le lien'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============================ ÉCHÉANCIER ============================ */

function PlanScreen({
  plans,
  account,
  canWrite,
  onMarkPaid,
  pending,
}: {
  plans: PaymentPlan[];
  account: Account;
  canWrite: boolean;
  onMarkPaid: (docId: string, index: number) => void;
  pending: boolean;
}) {
  const [selected, setSelected] = useState(plans[0]?.docId ?? '');
  const [term, setTerm] = useState<TermType>('arrhes');
  const plan = plans.find((p) => p.docId === selected) ?? plans[0] ?? null;

  if (!plan) {
    return (
      <EmptyBlock>
        Aucun échéancier. Créez une facture avec échéancier dans Devis &amp; Factures pour suivre
        les paiements ici.
      </EmptyBlock>
    );
  }

  const next = plan.milestones.find((m) => !m.paid) ?? null;

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      {plans.length > 1 ? (
        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[9px] tracking-[0.18em] text-[color:var(--color-muted-foreground)] uppercase">
            Échéancier
          </span>
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger className="focus-ring rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3.5 py-2.5 text-sm text-[color:var(--color-foreground)]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {plans.map((p) => (
                <SelectItem key={p.docId} value={p.docId}>
                  {p.clientName} · {p.docNumber} — {formatEurMinor(p.totalMinor)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      ) : null}

      {/* plan hero */}
      <div
        className="flex flex-wrap items-start justify-between gap-4 rounded-3xl border border-[color:var(--color-blush-500)]/30 p-6"
        style={{
          background:
            'linear-gradient(120deg, var(--color-surface), color-mix(in oklab, var(--color-blush-500) 10%, var(--color-surface)))',
          boxShadow: 'var(--shadow-blush)',
        }}
      >
        <div className="flex flex-col gap-1.5">
          <span className="font-mono text-[9.5px] tracking-[0.2em] text-[color:var(--color-muted-foreground)] uppercase">
            Échéancier · <CoupleName name={plan.clientName} />
          </span>
          <span
            className="font-mono text-[32px] font-medium text-[color:var(--color-foreground)] tabular-nums"
            style={{ lineHeight: 1 }}
          >
            {formatEurMinor(plan.totalMinor)}
          </span>
        </div>
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[9.5px] tracking-[0.1em] uppercase',
            plan.paidCount === plan.totalCount ? PILL_TONE.ok : PILL_TONE.warn,
          )}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-current opacity-90" aria-hidden />
          {plan.paidCount} / {plan.totalCount} réglé
        </span>
      </div>

      {/* jalons */}
      <section className="flex flex-col gap-3">
        <SectionHead title="Jalons de paiement" />
        <div className="flex flex-col gap-2.5">
          {plan.milestones.map((m, i) => (
            <div
              key={`${m.docId}-${m.index}`}
              className={cn(
                'grid grid-cols-[auto_1fr_auto] items-center gap-3.5 rounded-2xl border p-4 transition-colors',
                m.paid
                  ? 'border-[color:var(--color-border)] bg-[oklch(26%_0.03_150)]/30'
                  : 'border-[color:var(--color-border)] bg-[color:var(--color-surface)] hover:border-[color:var(--color-border-strong)]',
              )}
            >
              <span
                className={cn(
                  'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[10px] font-mono text-[13px]',
                  m.paid
                    ? PILL_TONE.ok
                    : 'bg-[color:var(--color-surface-elevated)] text-[color:var(--color-muted-foreground)]',
                )}
              >
                {m.paid ? <Check className="h-4 w-4" strokeWidth={2.4} aria-hidden /> : i + 1}
              </span>
              <div className="flex min-w-0 flex-col gap-1.5">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="font-display text-[17px] text-[color:var(--color-foreground)] italic">
                    {m.label}
                  </span>
                  <span className="rounded-full border border-[color:var(--color-gold-300)]/30 bg-[color:var(--color-accent-soft)] px-2 py-0.5 font-mono text-[8px] tracking-[0.14em] text-[color:var(--color-gold-300)] uppercase">
                    {TX_TYPE_LABEL[m.type]}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-3.5 text-xs text-[color:var(--color-muted-foreground)]">
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="h-3 w-3" strokeWidth={1.8} aria-hidden />
                    <span className="font-mono text-[color:var(--color-ink-700)]">
                      {m.dueDate ? `Échéance ${formatDateFr(m.dueDate)}` : 'Sans date'}
                    </span>
                  </span>
                  <PayStatusPill status={m.status} />
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className="font-mono text-[18px] font-medium whitespace-nowrap text-[color:var(--color-foreground)] tabular-nums">
                  {formatEurMinor(m.amountMinor)}
                </span>
                {!m.paid && canWrite ? (
                  <div className="flex flex-wrap items-center justify-end gap-1.5">
                    <PayLinkButton
                      docId={m.docId}
                      index={m.index}
                      connected={account.connected}
                      clientName={m.clientName}
                    />
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => onMarkPaid(m.docId, m.index)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface)] px-2.5 py-1.5 text-xs text-[color:var(--color-ink-700)] hover:border-[color:var(--color-sage-500)] hover:text-[color:var(--color-foreground)]"
                    >
                      <Check className="h-3 w-3" strokeWidth={2.2} aria-hidden />
                      Marquer payé
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* terme localisé */}
      <section className="flex flex-col gap-3.5 rounded-3xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5">
        <span className="font-display text-lg text-[color:var(--color-foreground)] italic">
          Type d’engagement (France)
        </span>
        <div className="flex flex-wrap gap-2">
          {(['arrhes', 'acompte'] as const).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={term === k}
              onClick={() => setTerm(k)}
              className={cn(
                'inline-flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-[13px] transition-colors',
                term === k
                  ? 'border-[color:var(--color-blush-400)] bg-[color:var(--color-blush-500)]/12 text-[color:var(--color-foreground)]'
                  : 'border-[color:var(--color-border)] bg-[color:var(--color-surface-elevated)] text-[color:var(--color-ink-700)] hover:text-[color:var(--color-foreground)]',
              )}
            >
              <span
                className={cn(
                  'h-3.5 w-3.5 rounded-full border-2',
                  term === k
                    ? 'border-[color:var(--color-blush-400)] bg-[color:var(--color-blush-400)]'
                    : 'border-[color:var(--color-border-strong)]',
                )}
                aria-hidden
              />
              {TERM_LABELS[k].label}
            </button>
          ))}
        </div>
        <p className="text-[13px] leading-relaxed text-[color:var(--color-ink-700)]">
          {TERM_LABELS[term].note}
        </p>
        <div className="flex items-start gap-2.5 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-elevated)] px-3.5 py-3">
          <Scale
            className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-[color:var(--color-muted-foreground)]"
            strokeWidth={1.8}
            aria-hidden
          />
          <p className="text-[12.5px] leading-relaxed text-[color:var(--color-muted-foreground)]">
            {TERM_DISCLAIMER}
          </p>
        </div>
      </section>

      {/* prochaine demande */}
      <section className="flex flex-col gap-3.5 rounded-3xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5">
        <span className="font-display text-lg text-[color:var(--color-foreground)] italic">
          Prochaine demande · {next ? next.label : 'Aucune'}
        </span>
        {next ? (
          <>
            <FeeBreakdown
              amountMinor={next.amountMinor}
              country={account.country}
              approx
              title="Aperçu pour le couple"
            />
            {canWrite ? (
              <div className="flex flex-col items-start gap-2 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-elevated)] px-3.5 py-3">
                <PayLinkButton
                  docId={next.docId}
                  index={next.index}
                  connected={account.connected}
                  clientName={next.clientName}
                />
                <p className="font-mono text-[10px] leading-relaxed text-[color:var(--color-muted-foreground)]">
                  Le lien est encaissé directement sur votre compte Stripe. Copiez-le pour l’envoyer
                  par WhatsApp, email…
                </p>
              </div>
            ) : null}
          </>
        ) : (
          <p className="text-[13px] text-[color:var(--color-muted-foreground)]">
            Toutes les échéances de cet échéancier sont réglées. 🎉
          </p>
        )}
      </section>
    </div>
  );
}

/* ============================ LITIGES ============================ */

function DisputesScreen() {
  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <div
        className="flex items-start gap-3 rounded-2xl border p-4"
        style={{
          borderColor: 'color-mix(in oklab, var(--color-blush-500) 30%, var(--color-border))',
          background: 'color-mix(in oklab, var(--color-blush-500) 8%, var(--color-surface))',
        }}
      >
        <ShieldCheck
          className="mt-0.5 h-[18px] w-[18px] flex-shrink-0 text-[color:var(--color-blush-300)]"
          strokeWidth={1.9}
          aria-hidden
        />
        <p className="text-[13px] leading-relaxed text-[color:var(--color-ink-700)]">
          <b className="font-semibold text-[color:var(--color-foreground)]">
            Vos litiges, votre compte Stripe.
          </b>{' '}
          Les paiements en ligne sont encaissés directement sur votre propre compte Stripe : en cas
          de contestation, tout se gère depuis votre tableau de bord Stripe (notification, preuves,
          décision de la banque). Wedillybird n’intervient jamais dans vos fonds.
        </p>
      </div>

      <div className="flex flex-col items-center gap-2 rounded-3xl border border-dashed border-[color:var(--color-border-strong)] bg-[color:var(--color-surface)]/40 px-8 py-12 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[color:var(--color-surface-elevated)] text-[color:var(--color-sage-500)]">
          <ShieldCheck className="h-6 w-6" strokeWidth={1.6} aria-hidden />
        </span>
        <h3 className="font-display text-xl text-[color:var(--color-foreground)] italic">
          Litiges gérés dans Stripe
        </h3>
        <p className="max-w-md text-[13px] leading-relaxed text-[color:var(--color-muted-foreground)]">
          Les éventuelles contestations de paiement apparaissent dans votre tableau de bord Stripe,
          avec la marche à suivre et les délais. Wedillybird n’est pas dans le flux des fonds.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <SectionHead title="Comment ça se passe" />
        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-border)] sm:grid-cols-2">
          <PolicyCell label="Qui est notifié" value="Vous, directement depuis Stripe." />
          <PolicyCell
            label="Qui fournit les preuves"
            value="Vous (contrat, échanges, livrables), depuis Stripe."
          />
          <PolicyCell label="Qui décide" value="La banque du couple, pas Wedillybird ni Stripe." />
          <PolicyCell label="Où" value="Votre tableau de bord Stripe — vous gardez la main." />
        </div>
      </section>
    </div>
  );
}

function PolicyCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1.5 bg-[color:var(--color-surface)] px-4 py-3.5">
      <span className="font-mono text-[9px] tracking-[0.16em] text-[color:var(--color-muted-foreground)] uppercase">
        {label}
      </span>
      <span className="text-[13px] leading-relaxed text-[color:var(--color-ink-700)]">{value}</span>
    </div>
  );
}

/* ============================ RÉGLAGES ============================ */

function SettingsScreen({
  account,
  mode,
  onMode,
  canWrite,
}: {
  account: Account;
  mode: PaymentMode;
  onMode: (m: PaymentMode) => void;
  canWrite: boolean;
}) {
  return (
    <div className="flex max-w-3xl flex-col gap-5">
      {/* mode */}
      <div className="flex flex-col gap-4 rounded-3xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5 sm:p-6">
        <span className="font-display text-lg text-[color:var(--color-foreground)] italic">
          Mode d’encaissement
        </span>
        <div className="flex flex-col gap-2.5" role="radiogroup" aria-label="Mode d’encaissement">
          {PAYMENT_MODE_ORDER.map((k) => {
            const meta = PAYMENT_MODE_META[k];
            const on = mode === k;
            return (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={on}
                disabled={!canWrite}
                onClick={() => onMode(k)}
                className={cn(
                  'flex items-start gap-3.5 rounded-2xl border p-4 text-left transition-colors',
                  on
                    ? 'border-[color:var(--color-blush-400)] bg-[color:var(--color-blush-500)]/10'
                    : 'border-[color:var(--color-border)] bg-[color:var(--color-surface-elevated)] hover:border-[color:var(--color-border-strong)]',
                  !canWrite && 'cursor-not-allowed opacity-70',
                )}
              >
                <span
                  className={cn(
                    'mt-0.5 flex h-4.5 w-4.5 flex-shrink-0 items-center justify-center rounded-full border-2',
                    on
                      ? 'border-[color:var(--color-blush-400)]'
                      : 'border-[color:var(--color-border-strong)]',
                  )}
                  aria-hidden
                >
                  {on ? (
                    <span className="h-2 w-2 rounded-full bg-[color:var(--color-blush-400)]" />
                  ) : null}
                </span>
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-[color:var(--color-foreground)]">
                      {meta.label}
                    </span>
                    {meta.recommended ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-[color:var(--color-gold-300)]/30 bg-[color:var(--color-accent-soft)] px-2 py-0.5 font-mono text-[9px] tracking-[0.1em] text-[color:var(--color-gold-300)] uppercase">
                        <Sparkles className="h-2.5 w-2.5" strokeWidth={2} aria-hidden />
                        Recommandé
                      </span>
                    ) : null}
                  </span>
                  <span className="text-[12.5px] leading-relaxed text-[color:var(--color-muted-foreground)]">
                    {meta.desc}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        <p className="text-[12px] leading-relaxed text-[color:var(--color-muted-foreground)]">
          Conséquence : {PAYMENT_MODE_META[mode].consequence}
        </p>
      </div>

      {/* frais */}
      <div className="flex flex-col gap-3.5 rounded-3xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5 sm:p-6">
        <span className="font-display text-lg text-[color:var(--color-foreground)] italic">
          Frais
        </span>
        <FeeBreakdown
          amountMinor={630000}
          country={account.country}
          title="Ce que vous recevez · exemple 6 300 €"
        />
      </div>

      <div
        className="flex items-start gap-3 rounded-2xl border p-4"
        style={{
          borderColor: 'color-mix(in oklab, var(--color-blush-500) 26%, var(--color-border))',
          background: 'color-mix(in oklab, var(--color-blush-500) 8%, var(--color-surface))',
        }}
      >
        <ShieldCheck
          className="mt-0.5 h-4 w-4 flex-shrink-0 text-[color:var(--color-blush-300)]"
          strokeWidth={1.9}
          aria-hidden
        />
        <p className="text-[13px] leading-relaxed text-[color:var(--color-ink-700)]">
          <b className="font-semibold text-[color:var(--color-foreground)]">
            Votre argent, votre compte.
          </b>{' '}
          Les paiements en ligne sont encaissés directement sur votre propre compte Stripe —
          Wedillybird ne détient jamais vos fonds. <StripeBadge />
        </p>
      </div>
    </div>
  );
}

/* ============================ TIROIR DÉTAIL TRANSACTION ============================ */

function TxDetailSheet({
  tx,
  account,
  onClose,
}: {
  tx: Milestone;
  account: Account;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-label={`Transaction ${tx.clientName}`}
    >
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div className="relative flex h-full w-full max-w-md flex-col border-l border-[color:var(--color-border)] bg-[color:var(--color-surface)] shadow-[var(--shadow-popover)]">
        <div className="flex items-start gap-3 border-b border-[color:var(--color-border)] p-5">
          <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-[color:var(--color-blush-500)]/15 font-mono text-sm text-[color:var(--color-blush-300)]">
            {initials(tx.clientName)}
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="font-mono text-[9px] tracking-[0.18em] text-[color:var(--color-muted-foreground)] uppercase">
              Transaction · {TX_TYPE_LABEL[milestoneTypeFor(tx)]}
            </span>
            <h2 className="font-display text-xl text-[color:var(--color-foreground)] italic">
              <CoupleName name={tx.clientName} />
            </h2>
            <div className="flex items-center gap-2.5">
              <PayStatusPill status={tx.status} />
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="focus-ring rounded-lg p-1.5 text-[color:var(--color-muted-foreground)] hover:bg-[color:var(--color-surface-elevated)] hover:text-[color:var(--color-foreground)]"
          >
            <X className="h-4 w-4" strokeWidth={2} aria-hidden />
          </button>
        </div>
        <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-5">
          <div className="flex flex-col gap-2.5">
            <span className="font-mono text-[9px] tracking-[0.18em] text-[color:var(--color-muted-foreground)] uppercase">
              Détail des frais
            </span>
            <FeeBreakdown amountMinor={tx.amountMinor} country={account.country} title={null} />
          </div>
          <div className="flex flex-col gap-2.5">
            <span className="font-mono text-[9px] tracking-[0.18em] text-[color:var(--color-muted-foreground)] uppercase">
              Informations
            </span>
            <div className="flex flex-col divide-y divide-[color:var(--color-border)] rounded-xl border border-[color:var(--color-border)]">
              <KvRow Icon={Tag} label="Type" value={TX_TYPE_LABEL[milestoneTypeFor(tx)]} />
              <KvRow Icon={CreditCard} label="Facture" value={tx.docNumber} mono />
              <KvRow
                Icon={Calendar}
                label="Échéance"
                value={tx.dueDate ? formatDateFr(tx.dueDate) : '—'}
                mono
              />
              <KvRow Icon={Hash} label="Référence" value={`${tx.docNumber}-${tx.index + 1}`} mono />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2.5 border-t border-[color:var(--color-border)] p-5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3.5 py-2 text-xs text-[color:var(--color-muted-foreground)] hover:text-[color:var(--color-foreground)]"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

function KvRow({
  Icon,
  label,
  value,
  mono,
}: {
  Icon: LucideIcon;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 px-3.5 py-2.5">
      <Icon
        className="h-3.5 w-3.5 flex-shrink-0 text-[color:var(--color-muted-foreground)]"
        strokeWidth={1.8}
        aria-hidden
      />
      <span className="flex-1 text-xs text-[color:var(--color-muted-foreground)]">{label}</span>
      <span className={cn('text-xs text-[color:var(--color-foreground)]', mono && 'font-mono')}>
        {value}
      </span>
    </div>
  );
}

function EmptyBlock({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-[color:var(--color-border-strong)] bg-[color:var(--color-surface)]/40 px-8 py-12 text-center text-sm text-[color:var(--color-muted-foreground)]">
      {children}
    </div>
  );
}

/* ============================ ROOT ============================ */

export function PaymentsBoard({
  invoices: initialInvoices,
  account: initialAccount,
  canWrite,
  canManage,
  now,
}: {
  invoices: InvoiceLike[];
  account: Account;
  canWrite: boolean;
  canManage: boolean;
  now: number;
}) {
  const router = useRouter();
  const [invoices, setInvoices] = useState<InvoiceLike[]>(initialInvoices);
  const [tab, setTab] = useState<SubTab>('dashboard');
  const [mode, setMode] = useState<PaymentMode>(initialAccount.mode);
  const [txDetail, setTxDetail] = useState<Milestone | null>(null);
  const [freeLinkOpen, setFreeLinkOpen] = useState(false);
  const [pending, start] = useTransition();

  const account: Account = { ...initialAccount, mode };

  const { milestones, kpis } = useMemo(() => buildLedger(invoices, now), [invoices, now]);
  const plans = useMemo(() => buildPlans(invoices, now), [invoices, now]);
  const nextDue = useMemo(() => nextDueMilestone(milestones, now), [milestones, now]);

  function markPaid(docId: string, index: number) {
    setInvoices((prev) =>
      prev.map((inv) =>
        inv._id === docId
          ? {
              ...inv,
              schedule: inv.schedule?.map((s, i) => (i === index ? { ...s, paid: true } : s)),
            }
          : inv,
      ),
    );
    toast.success('Échéance marquée encaissée');
    start(async () => {
      await recordPaymentAction(docId, index);
      router.refresh();
    });
  }

  function changeMode(m: PaymentMode) {
    if (!canWrite) return;
    setMode(m);
    toast.success(`Mode : ${PAYMENT_MODE_META[m].label}`);
    start(async () => {
      await setPaymentsSettingsAction({ mode: m });
      router.refresh();
    });
  }

  return (
    <div className="container-page flex flex-col gap-6 py-8 sm:py-10">
      <header className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] tracking-[0.32em] text-[color:var(--color-muted-foreground)] uppercase">
              Finances · Paiements
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
              Paiements
            </h1>
            <p className="max-w-[60ch] text-[13.5px] leading-relaxed text-[color:var(--color-muted-foreground)]">
              Suivez vos encaissements et échéanciers, envoyez des liens de paiement — encaissés
              directement sur votre propre compte Stripe.
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            {canWrite ? (
              <button
                type="button"
                onClick={() => setFreeLinkOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--color-border-strong)] px-3.5 py-2 text-xs text-[color:var(--color-ink-700)] hover:text-[color:var(--color-foreground)]"
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                Nouveau lien
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setTab('plan')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--color-border-strong)] px-3.5 py-2 text-xs text-[color:var(--color-ink-700)] hover:text-[color:var(--color-foreground)]"
            >
              <Send className="h-3.5 w-3.5" strokeWidth={1.9} aria-hidden />
              Demande de paiement
            </button>
            <button
              type="button"
              onClick={() => setTab('settings')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[color:var(--color-blush-400)] px-3.5 py-2 text-xs font-medium text-[oklch(20%_0.02_28)] hover:brightness-105"
            >
              <Settings className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
              Réglages
            </button>
          </div>
        </div>

        {/* sous-onglets */}
        <div
          className="flex items-center gap-1 self-start overflow-x-auto rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-1"
          role="tablist"
          aria-label="Sections paiements"
        >
          {SUBTABS.map((t) => (
            <button
              key={t.k}
              type="button"
              role="tab"
              aria-selected={tab === t.k}
              onClick={() => setTab(t.k)}
              className={cn(
                'inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm whitespace-nowrap transition-colors',
                tab === t.k
                  ? 'bg-[color:var(--color-surface-elevated)] font-medium text-[color:var(--color-foreground)] shadow-[var(--shadow-soft)]'
                  : 'text-[color:var(--color-muted-foreground)] hover:text-[color:var(--color-foreground)]',
              )}
            >
              <t.Icon className="h-4 w-4" strokeWidth={1.9} aria-hidden />
              {t.label}
            </button>
          ))}
        </div>
      </header>

      {tab === 'dashboard' ? (
        <DashboardScreen
          account={account}
          collectedMinor={kpis.collectedMinor}
          upcomingMinor={kpis.upcomingMinor}
          overdueMinor={kpis.overdueMinor}
          nextDue={nextDue}
          milestones={milestones}
          onActivate={() => setTab('settings')}
          onRow={setTxDetail}
          canManage={canManage}
        />
      ) : tab === 'plan' ? (
        <PlanScreen
          plans={plans}
          account={account}
          canWrite={canWrite}
          onMarkPaid={markPaid}
          pending={pending}
        />
      ) : tab === 'disputes' ? (
        <DisputesScreen />
      ) : (
        <SettingsScreen account={account} mode={mode} onMode={changeMode} canWrite={canWrite} />
      )}

      {txDetail ? (
        <TxDetailSheet tx={txDetail} account={account} onClose={() => setTxDetail(null)} />
      ) : null}
      <FreePayLinkDialog
        open={freeLinkOpen}
        onOpenChange={setFreeLinkOpen}
        connected={account.connected}
      />
    </div>
  );
}
