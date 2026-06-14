'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  FileText,
  Receipt,
  Search,
  Plus,
  Wallet,
  Loader,
  CircleAlert,
  MoreVertical,
  Eye,
  Pencil,
  FileCheck,
  Trash2,
  ArrowLeft,
  Send,
  CircleCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PayLinkButton } from '@/components/pro/payments/pay-link-button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/cn';
import { formatEurMinor, formatDateFr, nowMs } from '@/lib/pro/format';
import {
  type QuoteDocType,
  type DocStatus,
  type LineItem,
  statusLabel,
  statusTone,
  type StatusTone,
  docSubtotalMinor,
  docTaxMinor,
  docTotalMinor,
  docPaidMinor,
  docRemainingMinor,
  computeInvoiceStatus,
  lineTotalMinor,
  quoteKpis,
} from '@/lib/pro/quotes';
import {
  createDocAction,
  updateDocAction,
  updateStatusAction,
  convertDocAction,
  removeDocAction,
  recordPaymentAction,
} from '@/app/[locale]/(app)/pro/quotes/actions';

export interface QuoteDoc {
  _id: string;
  type: QuoteDocType;
  number: string;
  clientId?: string;
  clientName: string;
  eventId?: string;
  status: DocStatus;
  lineItems: LineItem[];
  discountMinor?: number;
  discountPct?: number;
  taxRate?: number;
  schedule?: { label: string; amountMinor: number; dueDate?: number; paid: boolean }[];
  issueDate: number;
  dueDate?: number;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}
export interface ClientOpt {
  _id: string;
  name: string;
}
export interface WeddingOpt {
  _id: string;
  coupleNames: string;
  date: number;
}

const TONE_CLASS: Record<StatusTone, string> = {
  muted: 'bg-[color:var(--color-surface-elevated)] text-[color:var(--color-muted-foreground)]',
  info: 'bg-[oklch(28%_0.05_250)] text-[oklch(82%_0.08_250)]',
  ok: 'bg-[oklch(26%_0.04_145)] text-[oklch(82%_0.07_145)]',
  warn: 'bg-[oklch(28%_0.022_78)] text-[oklch(85%_0.04_78)]',
  danger: 'bg-[oklch(28%_0.04_25)] text-[oklch(82%_0.07_22)]',
};

function StatusPill({ type, status }: { type: QuoteDocType; status: DocStatus }) {
  const tone = statusTone(type, status);
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium',
        TONE_CLASS[tone],
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" aria-hidden />
      {statusLabel(type, status)}
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

/** Traduit un code d'erreur serveur en message lisible (clos, donc switch). */
function errLabel(t: (key: string) => string, code: string): string {
  switch (code) {
    case 'FEATURE_NOT_IN_PLAN':
      return t('errors.featureNotInPlan');
    case 'FORBIDDEN':
      return t('errors.forbidden');
    case 'INVALID_CLIENT':
      return t('errors.invalidClient');
    case 'INVALID_LINES':
      return t('errors.invalidLines');
    default:
      return t('errors.generic');
  }
}

type View =
  | { kind: 'list' }
  | { kind: 'builder'; type: QuoteDocType; doc?: QuoteDoc }
  | { kind: 'detail'; doc: QuoteDoc };

export function QuotesBoard({
  initialDocs,
  clients,
  weddings,
  organizationId,
  canWrite,
  connected,
}: {
  initialDocs: QuoteDoc[];
  clients: ClientOpt[];
  weddings: WeddingOpt[];
  organizationId: string;
  canWrite: boolean;
  connected: boolean;
}) {
  const t = useTranslations('Pro.quotesBoard');
  const router = useRouter();
  const [docs, setDocs] = useState<QuoteDoc[]>(initialDocs);
  const [view, setView] = useState<View>({ kind: 'list' });
  const [tab, setTab] = useState<QuoteDocType>('quote');
  const [query, setQuery] = useState('');
  const [pending, startTransition] = useTransition();

  const kpis = useMemo(() => quoteKpis(docs), [docs]);
  const counts = useMemo(
    () => ({
      quote: docs.filter((d) => d.type === 'quote').length,
      invoice: docs.filter((d) => d.type === 'invoice').length,
    }),
    [docs],
  );
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return docs
      .filter((d) => d.type === tab)
      .filter((d) => !q || `${d.number} ${d.clientName}`.toLowerCase().includes(q));
  }, [docs, tab, query]);

  function refresh() {
    startTransition(() => router.refresh());
  }

  if (view.kind === 'builder') {
    return (
      <QuoteBuilder
        docType={view.type}
        initial={view.doc}
        clients={clients}
        weddings={weddings}
        organizationId={organizationId}
        onBack={() => setView({ kind: 'list' })}
        onSaved={(doc) => {
          setDocs((prev) => {
            const i = prev.findIndex((d) => d._id === doc._id);
            return i >= 0 ? prev.map((d) => (d._id === doc._id ? doc : d)) : [doc, ...prev];
          });
          setView({ kind: 'detail', doc });
          refresh();
        }}
      />
    );
  }
  if (view.kind === 'detail') {
    return (
      <QuoteDetail
        doc={view.doc}
        canWrite={canWrite}
        connected={connected}
        onBack={() => setView({ kind: 'list' })}
        onEdit={() => setView({ kind: 'builder', type: view.doc.type, doc: view.doc })}
        onChanged={(doc) => {
          setDocs((prev) => prev.map((d) => (d._id === doc._id ? doc : d)));
          setView({ kind: 'detail', doc });
          refresh();
        }}
        onConverted={() => {
          setView({ kind: 'list' });
          refresh();
        }}
      />
    );
  }

  return (
    <div className="container-page flex flex-col gap-6 py-8 sm:py-10">
      <header className="flex flex-col gap-1.5">
        <span className="font-mono text-[10px] tracking-[0.32em] text-[color:var(--color-muted-foreground)] uppercase">
          {t('eyebrow')}
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
          {t('title')}
        </h1>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          tone="ok"
          Icon={Wallet}
          label={t('kpis.collected')}
          value={formatEurMinor(kpis.collectedMinor)}
        />
        <Kpi
          tone="warn"
          Icon={Loader}
          label={t('kpis.pending')}
          value={formatEurMinor(kpis.pendingMinor)}
        />
        <Kpi
          tone="danger"
          Icon={CircleAlert}
          label={t('kpis.overdue')}
          value={formatEurMinor(kpis.overdueMinor)}
        />
        <Kpi
          tone="muted"
          Icon={FileText}
          label={t('kpis.openQuotes')}
          value={formatEurMinor(kpis.openQuotesMinor)}
        />
      </div>

      {/* tabs + search + action */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="flex items-center rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-0.5">
          {(['quote', 'invoice'] as const).map((tabKind) => (
            <button
              key={tabKind}
              type="button"
              onClick={() => setTab(tabKind)}
              aria-selected={tab === tabKind}
              role="tab"
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                tab === tabKind
                  ? 'bg-[color:var(--color-surface-elevated)] text-[color:var(--color-foreground)]'
                  : 'text-[color:var(--color-muted-foreground)]',
              )}
            >
              {tabKind === 'quote' ? (
                <FileText className="h-3.5 w-3.5" strokeWidth={1.9} />
              ) : (
                <Receipt className="h-3.5 w-3.5" strokeWidth={1.9} />
              )}
              {tabKind === 'quote' ? t('tabs.quotes') : t('tabs.invoices')}
              <span className="font-mono text-[10px] text-[color:var(--color-muted-foreground)]">
                {tabKind === 'quote' ? counts.quote : counts.invoice}
              </span>
            </button>
          ))}
        </div>
        <label className="relative flex min-w-[180px] flex-1 items-center sm:max-w-xs">
          <Search
            className="pointer-events-none absolute left-3 h-4 w-4 text-[color:var(--color-muted-foreground)]"
            strokeWidth={1.9}
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('searchPlaceholder')}
            aria-label={t('searchAriaLabel')}
            className="focus-ring h-9 w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] pr-3 pl-9 text-sm text-[color:var(--color-foreground)] placeholder:text-[color:var(--color-muted-foreground)]"
          />
        </label>
        <span className="flex-1" />
        {canWrite ? (
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={() => setView({ kind: 'builder', type: tab })}
            data-testid="new-doc"
          >
            <Plus className="h-4 w-4" strokeWidth={2.2} aria-hidden />
            {tab === 'quote' ? t('newQuote') : t('newInvoice')}
          </Button>
        ) : null}
      </div>

      {/* table */}
      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[color:var(--color-border-strong)] bg-[color:var(--color-surface)]/40 px-8 py-14 text-center text-sm text-[color:var(--color-muted-foreground)]">
          {query
            ? t('empty.noMatch')
            : tab === 'quote'
              ? t('empty.noQuotes')
              : t('empty.noInvoices')}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)]">
          <table className="w-full min-w-[820px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-[color:var(--color-border)] text-left font-mono text-[9px] tracking-[0.18em] text-[color:var(--color-muted-foreground)] uppercase">
                <th className="px-4 py-3 font-medium">{t('cols.number')}</th>
                <th className="px-4 py-3 font-medium">{t('cols.client')}</th>
                {tab === 'quote' ? (
                  <th className="px-4 py-3 font-medium">{t('cols.wedding')}</th>
                ) : null}
                <th className="px-4 py-3 text-right font-medium">{t('cols.amount')}</th>
                {tab === 'invoice' ? (
                  <th className="px-4 py-3 font-medium">{t('cols.paidRemaining')}</th>
                ) : null}
                <th className="px-4 py-3 font-medium">{t('cols.status')}</th>
                <th className="px-4 py-3 font-medium">
                  {tab === 'quote' ? t('cols.validity') : t('cols.dueDate')}
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => {
                const total = docTotalMinor(d);
                const wedding = weddings.find((w) => w._id === d.eventId);
                return (
                  <tr
                    key={d._id}
                    onClick={() => setView({ kind: 'detail', doc: d })}
                    className="cursor-pointer border-b border-[color:var(--color-border)] transition-colors last:border-0 hover:bg-[color:var(--color-surface-elevated)]"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-[color:var(--color-foreground)]">
                      {d.number}
                    </td>
                    <td className="font-display px-4 py-3 text-sm text-[color:var(--color-foreground)] italic">
                      <CoupleName name={d.clientName} />
                    </td>
                    {tab === 'quote' ? (
                      <td className="px-4 py-3 text-xs text-[color:var(--color-muted-foreground)]">
                        {wedding?.coupleNames ?? '—'}
                      </td>
                    ) : null}
                    <td className="px-4 py-3 text-right font-mono text-xs text-[color:var(--color-foreground)] tabular-nums">
                      {formatEurMinor(total)}
                    </td>
                    {tab === 'invoice' ? (
                      <td className="px-4 py-3">
                        {d.schedule?.length ? (
                          <div className="flex flex-col gap-1">
                            <div className="flex justify-between font-mono text-[10px] text-[color:var(--color-muted-foreground)]">
                              <span className="text-[color:var(--color-foreground)]">
                                {formatEurMinor(docPaidMinor(d))}
                              </span>
                              <span>/ {formatEurMinor(total)}</span>
                            </div>
                            <div className="h-1 overflow-hidden rounded-full bg-[color:var(--color-surface-elevated)]">
                              <span
                                className="block h-full rounded-full bg-[color:var(--color-sage-500)]"
                                style={{ width: `${total ? (docPaidMinor(d) / total) * 100 : 0}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="font-mono text-xs text-[color:var(--color-muted-foreground)]">
                            {formatEurMinor(0)}
                          </span>
                        )}
                      </td>
                    ) : null}
                    <td className="px-4 py-3">
                      <StatusPill type={d.type} status={d.status} />
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-[color:var(--color-muted-foreground)]">
                      {formatDateFr(d.dueDate)}
                    </td>
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <RowMenu
                        doc={d}
                        canWrite={canWrite}
                        onOpen={() => setView({ kind: 'detail', doc: d })}
                        onEdit={() => setView({ kind: 'builder', type: d.type, doc: d })}
                        onConvert={() => {
                          startTransition(async () => {
                            const res = await convertDocAction(d._id);
                            if (res.ok) refresh();
                            else alert(errLabel(t, res.error));
                          });
                        }}
                        onDelete={() => {
                          if (!confirm(t('confirmDelete', { number: d.number }))) return;
                          setDocs((prev) => prev.filter((x) => x._id !== d._id));
                          startTransition(async () => {
                            await removeDocAction(d._id);
                            refresh();
                          });
                        }}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {pending ? (
        <span className="sr-only" role="status">
          {t('updating')}
        </span>
      ) : null}
    </div>
  );
}

function Kpi({
  tone,
  Icon,
  label,
  value,
}: {
  tone: StatusTone;
  Icon: typeof Wallet;
  label: string;
  value: string;
}) {
  const accent: Record<StatusTone, string> = {
    ok: 'var(--color-sage-500)',
    warn: 'var(--color-warning)',
    danger: 'var(--color-danger)',
    info: 'var(--color-blush-400)',
    muted: 'var(--color-muted-foreground)',
  };
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4">
      <span className="flex items-center gap-1.5 font-mono text-[9px] tracking-[0.18em] text-[color:var(--color-muted-foreground)] uppercase">
        <Icon className="h-3 w-3" strokeWidth={1.9} style={{ color: accent[tone] }} aria-hidden />
        {label}
      </span>
      <span className="font-display text-2xl text-[color:var(--color-foreground)] italic tabular-nums">
        {value}
      </span>
    </div>
  );
}

function RowMenu({
  doc,
  canWrite,
  onOpen,
  onEdit,
  onConvert,
  onDelete,
}: {
  doc: QuoteDoc;
  canWrite: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onConvert: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations('Pro.quotesBoard');
  const [open, setOpen] = useState(false);
  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={t('rowMenu.actions')}
        aria-haspopup="menu"
        aria-expanded={open}
        className="focus-ring rounded-lg p-1.5 text-[color:var(--color-muted-foreground)] hover:bg-[color:var(--color-surface)] hover:text-[color:var(--color-foreground)]"
      >
        <MoreVertical className="h-4 w-4" strokeWidth={2} />
      </button>
      {open ? (
        <>
          <div className="fixed inset-0 z-10" aria-hidden onClick={() => setOpen(false)} />
          <div
            role="menu"
            className="absolute top-full right-0 z-20 mt-1 flex w-52 flex-col rounded-xl border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface-elevated)] p-1 text-left shadow-[var(--shadow-popover)]"
          >
            <MenuBtn
              Icon={Eye}
              onClick={() => {
                onOpen();
                setOpen(false);
              }}
            >
              {t('rowMenu.view')}
            </MenuBtn>
            {canWrite ? (
              <MenuBtn
                Icon={Pencil}
                onClick={() => {
                  onEdit();
                  setOpen(false);
                }}
              >
                {t('rowMenu.edit')}
              </MenuBtn>
            ) : null}
            {canWrite && doc.type === 'quote' ? (
              <MenuBtn
                Icon={FileCheck}
                onClick={() => {
                  onConvert();
                  setOpen(false);
                }}
              >
                {t('convertToInvoice')}
              </MenuBtn>
            ) : null}
            {canWrite ? (
              <>
                <span className="mx-1 my-1 h-px bg-[color:var(--color-border)]" />
                <MenuBtn
                  Icon={Trash2}
                  danger
                  onClick={() => {
                    onDelete();
                    setOpen(false);
                  }}
                >
                  {t('rowMenu.delete')}
                </MenuBtn>
              </>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}

function MenuBtn({
  Icon,
  children,
  onClick,
  danger,
}: {
  Icon: typeof Eye;
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cn(
        'flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm hover:bg-[color:var(--color-surface)]',
        danger ? 'text-[color:var(--color-danger)]' : 'text-[color:var(--color-foreground)]',
      )}
    >
      <Icon className="h-3.5 w-3.5 flex-shrink-0" strokeWidth={1.85} aria-hidden />
      {children}
    </button>
  );
}

/* ============================ BUILDER ============================ */

function QuoteBuilder({
  docType,
  initial,
  clients,
  weddings,
  organizationId,
  onBack,
  onSaved,
}: {
  docType: QuoteDocType;
  initial?: QuoteDoc;
  clients: ClientOpt[];
  weddings: WeddingOpt[];
  organizationId: string;
  onBack: () => void;
  onSaved: (doc: QuoteDoc) => void;
}) {
  const t = useTranslations('Pro.quotesBoard');
  const [lines, setLines] = useState<LineItem[]>(
    initial?.lineItems.map((l) => ({ ...l })) ?? [
      { label: t('builder.defaultLineLabel'), qty: 1, unitPriceMinor: 140000 },
    ],
  );
  const [clientId, setClientId] = useState(initial?.clientId ?? clients[0]?._id ?? '');
  const [eventId, setEventId] = useState(initial?.eventId ?? '');
  const [discountEur, setDiscountEur] = useState(
    initial?.discountMinor ? String(initial.discountMinor / 100) : '0',
  );
  const [taxRate, setTaxRate] = useState(initial?.taxRate ?? 0);
  const [acompte, setAcompte] = useState(30);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const discountMinor = Math.round((parseFloat(discountEur) || 0) * 100);
  const doc = { type: docType, lineItems: lines, discountMinor, taxRate, status: 'draft' as const };
  const sub = docSubtotalMinor(doc);
  const tax = docTaxMinor(doc);
  const total = docTotalMinor(doc);
  const isInvoice = docType === 'invoice';
  const acompteMinor = Math.round((total * acompte) / 100);

  const setLine = (i: number, k: keyof LineItem, raw: string) =>
    setLines((ls) =>
      ls.map((l, j) =>
        j === i
          ? {
              ...l,
              [k]:
                k === 'label'
                  ? raw
                  : k === 'unitPriceMinor'
                    ? Math.round((parseFloat(raw) || 0) * 100)
                    : parseFloat(raw) || 0,
            }
          : l,
      ),
    );

  const agencyInitial = t('preview.agencyInitial');

  function save(send: boolean) {
    setError(null);
    const clean = lines.filter((l) => l.label.trim());
    if (!clientId) {
      setError(t('errors.invalidClient'));
      return;
    }
    if (!clean.length) {
      setError(t('errors.invalidLines'));
      return;
    }
    const schedule = isInvoice
      ? [
          {
            label: t('builder.scheduleDeposit', { pct: acompte }),
            amountMinor: acompteMinor,
            paid: false,
          },
          { label: t('builder.scheduleBalance'), amountMinor: total - acompteMinor, paid: false },
        ]
      : undefined;
    start(async () => {
      const payload = {
        type: docType,
        clientId,
        eventId: eventId || undefined,
        lineItems: clean,
        discountMinor,
        taxRate,
        schedule,
        status: send ? ('sent' as DocStatus) : ('draft' as DocStatus),
      };
      const res = initial
        ? await updateDocAction(initial._id, payload)
        : await createDocAction(organizationId, payload);
      if (!res.ok) {
        setError(errLabel(t, res.error));
        return;
      }
      const saved: QuoteDoc = {
        _id: initial?._id ?? res.id ?? `tmp_${nowMs()}`,
        type: docType,
        number: initial?.number ?? res.number ?? '—',
        clientId,
        clientName: clients.find((c) => c._id === clientId)?.name ?? '—',
        eventId: eventId || undefined,
        status: send ? 'sent' : 'draft',
        lineItems: clean,
        discountMinor,
        taxRate,
        schedule,
        issueDate: initial?.issueDate ?? nowMs(),
        createdAt: initial?.createdAt ?? nowMs(),
        updatedAt: nowMs(),
      };
      onSaved(saved);
    });
  }

  return (
    <div className="container-page flex flex-col gap-5 py-8 sm:py-10">
      <button
        onClick={onBack}
        className="focus-ring flex items-center gap-1.5 self-start text-sm text-[color:var(--color-muted-foreground)] hover:text-[color:var(--color-foreground)]"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2} aria-hidden />
        {t('back')}
      </button>
      <h1 className="font-display text-2xl text-[color:var(--color-foreground)] italic">
        {initial
          ? t('builder.editTitle', { number: initial.number })
          : docType === 'quote'
            ? t('newQuote')
            : t('newInvoice')}
      </h1>

      <div className="grid gap-5 lg:grid-cols-[1fr_minmax(300px,380px)]">
        {/* form */}
        <div className="flex flex-col gap-4">
          <Card title={t('builder.clientWeddingCard')}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t('cols.client')}>
                <Select value={clientId} onValueChange={setClientId}>
                  <SelectTrigger className={SELECT}>
                    <SelectValue placeholder={t('builder.noClientPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => (
                      <SelectItem key={c._id} value={c._id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label={t('builder.linkedWedding')}>
                <Select
                  value={eventId || 'none'}
                  onValueChange={(v) => setEventId(v === 'none' ? '' : v)}
                >
                  <SelectTrigger className={SELECT}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('builder.noneOption')}</SelectItem>
                    {weddings.map((w) => (
                      <SelectItem key={w._id} value={w._id}>
                        {w.coupleNames}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </Card>

          <Card title={t('builder.linesCard')}>
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-[1fr_64px_88px_88px_32px] gap-2 px-1 font-mono text-[9px] tracking-[0.14em] text-[color:var(--color-muted-foreground)] uppercase">
                <span>{t('builder.colLabel')}</span>
                <span className="text-right">{t('builder.colQty')}</span>
                <span className="text-right">{t('builder.colUnitPrice')}</span>
                <span className="text-right">{t('builder.colTotal')}</span>
                <span />
              </div>
              {lines.map((l, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[1fr_64px_88px_88px_32px] items-center gap-2"
                >
                  <input
                    value={l.label}
                    onChange={(e) => setLine(i, 'label', e.target.value)}
                    aria-label={t('builder.colLabel')}
                    className={INPUT}
                  />
                  <input
                    value={l.qty}
                    onChange={(e) => setLine(i, 'qty', e.target.value)}
                    inputMode="numeric"
                    aria-label={t('builder.qtyAria')}
                    className={cn(INPUT, 'text-right font-mono')}
                  />
                  <input
                    value={l.unitPriceMinor / 100}
                    onChange={(e) => setLine(i, 'unitPriceMinor', e.target.value)}
                    inputMode="numeric"
                    aria-label={t('builder.unitPriceAria')}
                    className={cn(INPUT, 'text-right font-mono')}
                  />
                  <span className="text-right font-mono text-xs text-[color:var(--color-foreground)] tabular-nums">
                    {formatEurMinor(lineTotalMinor(l))}
                  </span>
                  <button
                    onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}
                    aria-label={t('builder.removeLineAria')}
                    className="focus-ring flex items-center justify-center rounded-md p-1 text-[color:var(--color-muted-foreground)] hover:text-[color:var(--color-danger)]"
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={1.8} />
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={() => setLines((ls) => [...ls, { label: '', qty: 1, unitPriceMinor: 0 }])}
              className="focus-ring mt-1 inline-flex items-center gap-1.5 self-start rounded-lg border border-dashed border-[color:var(--color-border-strong)] px-3 py-1.5 text-xs text-[color:var(--color-muted-foreground)] hover:text-[color:var(--color-foreground)]"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden />
              {t('builder.addLine')}
            </button>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <Field label={t('builder.discountField')}>
                <input
                  value={discountEur}
                  onChange={(e) => setDiscountEur(e.target.value)}
                  inputMode="numeric"
                  className={cn(INPUT, 'text-right font-mono')}
                />
              </Field>
              <Field label={t('builder.taxField')}>
                <Select value={String(taxRate)} onValueChange={(v) => setTaxRate(parseFloat(v))}>
                  <SelectTrigger className={SELECT}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">{t('builder.taxNone')}</SelectItem>
                    <SelectItem value="20">{t('builder.taxFr')}</SelectItem>
                    <SelectItem value="5">{t('builder.taxUs')}</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <div className="mt-2 flex flex-col gap-1.5 border-t border-[color:var(--color-border)] pt-3">
              <TotalRow label={t('builder.subtotal')} value={formatEurMinor(sub)} />
              {discountMinor > 0 ? (
                <TotalRow
                  label={t('builder.discount')}
                  value={`−${formatEurMinor(discountMinor)}`}
                />
              ) : null}
              {taxRate > 0 ? (
                <TotalRow
                  label={t('builder.taxRow', { rate: taxRate })}
                  value={formatEurMinor(tax)}
                />
              ) : null}
              <TotalRow label={t('builder.total')} value={formatEurMinor(total)} grand />
            </div>
          </Card>

          {isInvoice ? (
            <Card title={t('builder.scheduleCard')}>
              <Field label={t('builder.depositField')}>
                <input
                  value={acompte}
                  onChange={(e) =>
                    setAcompte(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))
                  }
                  inputMode="numeric"
                  className={cn(INPUT, 'max-w-[120px] text-right font-mono')}
                />
              </Field>
              <div className="mt-2 flex flex-col gap-2">
                <ScheduleRow
                  label={t('builder.scheduleDepositOnSign', { pct: acompte })}
                  amount={formatEurMinor(acompteMinor)}
                  when={t('builder.whenToday')}
                />
                <ScheduleRow
                  label={t('builder.scheduleBalance')}
                  amount={formatEurMinor(total - acompteMinor)}
                  when={t('builder.whenDue')}
                />
              </div>
            </Card>
          ) : null}

          {error ? (
            <p role="alert" className="text-sm text-[color:var(--color-danger)]">
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="md"
              disabled={pending}
              onClick={() => save(false)}
            >
              <FileText className="h-4 w-4" strokeWidth={1.8} aria-hidden />
              {t('builder.saveDraft')}
            </Button>
            <Button
              type="button"
              variant="primary"
              size="md"
              disabled={pending}
              onClick={() => save(true)}
            >
              <Send className="h-4 w-4" strokeWidth={1.9} aria-hidden />
              {pending ? t('builder.sending') : t('builder.send')}
            </Button>
          </div>
        </div>

        {/* live preview */}
        <div className="self-start rounded-2xl border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface-elevated)] p-5 shadow-[var(--shadow-soft)]">
          <div className="flex items-start justify-between gap-3 border-b border-[color:var(--color-border)] pb-3">
            <span className="flex items-center gap-2">
              <span className="font-display flex h-8 w-8 items-center justify-center rounded-lg bg-[color:var(--color-blush-500)] text-sm text-white">
                {agencyInitial}
              </span>
              <b className="text-sm text-[color:var(--color-foreground)]">
                {t('preview.agencyName')}
              </b>
            </span>
            <span className="text-right">
              <span className="font-display block text-base text-[color:var(--color-foreground)] italic">
                {docType === 'quote' ? t('doc.quote') : t('doc.invoice')}
              </span>
              <span className="block font-mono text-[10px] text-[color:var(--color-muted-foreground)]">
                {initial?.number ?? '—'}
              </span>
            </span>
          </div>
          <div className="flex items-center justify-between py-3 text-xs">
            <span>
              <span className="block font-mono text-[9px] tracking-[0.14em] text-[color:var(--color-muted-foreground)] uppercase">
                {t('cols.client')}
              </span>
              <span className="text-[color:var(--color-foreground)]">
                {clients.find((c) => c._id === clientId)?.name ?? '—'}
              </span>
            </span>
            <span className="text-right">
              <span className="block font-mono text-[9px] tracking-[0.14em] text-[color:var(--color-muted-foreground)] uppercase">
                {t('doc.date')}
              </span>
              <span className="text-[color:var(--color-foreground)]">{formatDateFr(nowMs())}</span>
            </span>
          </div>
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr className="border-b border-[color:var(--color-border)] text-left font-mono text-[8px] tracking-[0.1em] text-[color:var(--color-muted-foreground)] uppercase">
                <th className="py-1.5">{t('doc.designation')}</th>
                <th className="py-1.5 text-right">{t('builder.colQty')}</th>
                <th className="py-1.5 text-right">{t('builder.colUnitPrice')}</th>
                <th className="py-1.5 text-right">{t('builder.colTotal')}</th>
              </tr>
            </thead>
            <tbody>
              {lines
                .filter((l) => l.label.trim())
                .map((l, i) => (
                  <tr key={i} className="border-b border-[color:var(--color-border)]/60">
                    <td className="py-1.5 text-[color:var(--color-foreground)]">{l.label}</td>
                    <td className="py-1.5 text-right font-mono text-[color:var(--color-muted-foreground)]">
                      {l.qty}
                    </td>
                    <td className="py-1.5 text-right font-mono text-[color:var(--color-muted-foreground)]">
                      {formatEurMinor(l.unitPriceMinor)}
                    </td>
                    <td className="py-1.5 text-right font-mono text-[color:var(--color-foreground)]">
                      {formatEurMinor(lineTotalMinor(l))}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          <div className="mt-3 flex justify-between border-t border-[color:var(--color-border)] pt-2 text-sm">
            <span className="text-[color:var(--color-muted-foreground)]">{t('builder.total')}</span>
            <span className="font-display text-[color:var(--color-foreground)] italic">
              {formatEurMinor(total)}
            </span>
          </div>
          <div className="mt-3 text-center text-[color:var(--color-gold-500)]">✦</div>
        </div>
      </div>
    </div>
  );
}

/* ============================ DETAIL ============================ */

function QuoteDetail({
  doc,
  canWrite,
  connected,
  onBack,
  onEdit,
  onChanged,
  onConverted,
}: {
  doc: QuoteDoc;
  canWrite: boolean;
  connected: boolean;
  onBack: () => void;
  onEdit: () => void;
  onChanged: (d: QuoteDoc) => void;
  onConverted: () => void;
}) {
  const t = useTranslations('Pro.quotesBoard');
  const [pending, start] = useTransition();
  const total = docTotalMinor(doc);
  const paid = docPaidMinor(doc);
  const rem = docRemainingMinor(doc);

  function setStatus(status: DocStatus) {
    start(async () => {
      const res = await updateStatusAction(doc._id, status);
      if (res.ok) onChanged({ ...doc, status });
    });
  }

  /** Encaisse une échéance (versement manuel) + recalcule le statut (partiel/payée). */
  function recordPayment(index: number) {
    if (!doc.schedule) return;
    const prev = doc;
    const schedule = doc.schedule.map((s, i) => (i === index ? { ...s, paid: true } : s));
    const paidNow = schedule.filter((s) => s.paid).reduce((a, s) => a + s.amountMinor, 0);
    onChanged({ ...doc, schedule, status: computeInvoiceStatus(paidNow, total, doc.status) });
    start(async () => {
      const res = await recordPaymentAction(doc._id, index);
      if (!res.ok) onChanged(prev);
    });
  }

  return (
    <div className="container-page flex flex-col gap-5 py-8 sm:py-10">
      <button
        onClick={onBack}
        className="focus-ring flex items-center gap-1.5 self-start text-sm text-[color:var(--color-muted-foreground)] hover:text-[color:var(--color-foreground)]"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2} aria-hidden />
        {t('detail.backToList')}
      </button>

      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        {/* document */}
        <div className="rounded-2xl border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface-elevated)] p-6">
          <div className="flex items-start justify-between gap-3 border-b border-[color:var(--color-border)] pb-4">
            <span className="flex items-center gap-2">
              <span className="font-display flex h-9 w-9 items-center justify-center rounded-lg bg-[color:var(--color-blush-500)] text-base text-white">
                {t('preview.agencyInitial')}
              </span>
              <b className="text-[color:var(--color-foreground)]">{t('preview.agencyName')}</b>
            </span>
            <span className="text-right">
              <span className="font-display block text-lg text-[color:var(--color-foreground)] italic">
                {doc.type === 'quote' ? t('doc.quote') : t('doc.invoice')}
              </span>
              <span className="block font-mono text-[11px] text-[color:var(--color-muted-foreground)]">
                {doc.number}
              </span>
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 py-4 text-xs">
            <span>
              <span className="block font-mono text-[9px] tracking-[0.14em] text-[color:var(--color-muted-foreground)] uppercase">
                {t('cols.client')}
              </span>
              <span className="text-[color:var(--color-foreground)]">{doc.clientName}</span>
            </span>
            <span className="text-center">
              <span className="block font-mono text-[9px] tracking-[0.14em] text-[color:var(--color-muted-foreground)] uppercase">
                {t('doc.issued')}
              </span>
              <span className="text-[color:var(--color-foreground)]">
                {formatDateFr(doc.issueDate)}
              </span>
            </span>
            <span className="text-right">
              <span className="block font-mono text-[9px] tracking-[0.14em] text-[color:var(--color-muted-foreground)] uppercase">
                {doc.type === 'quote' ? t('cols.validity') : t('cols.dueDate')}
              </span>
              <span className="text-[color:var(--color-foreground)]">
                {formatDateFr(doc.dueDate)}
              </span>
            </span>
          </div>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-[color:var(--color-border)] text-left font-mono text-[9px] tracking-[0.12em] text-[color:var(--color-muted-foreground)] uppercase">
                <th className="py-2">{t('doc.designation')}</th>
                <th className="py-2 text-right">{t('builder.colQty')}</th>
                <th className="py-2 text-right">{t('builder.colUnitPrice')}</th>
                <th className="py-2 text-right">{t('builder.colTotal')}</th>
              </tr>
            </thead>
            <tbody>
              {doc.lineItems.map((l, i) => (
                <tr key={i} className="border-b border-[color:var(--color-border)]/60">
                  <td className="py-2 text-[color:var(--color-foreground)]">{l.label}</td>
                  <td className="py-2 text-right font-mono text-[color:var(--color-muted-foreground)]">
                    {l.qty}
                  </td>
                  <td className="py-2 text-right font-mono text-[color:var(--color-muted-foreground)]">
                    {formatEurMinor(l.unitPriceMinor)}
                  </td>
                  <td className="py-2 text-right font-mono text-[color:var(--color-foreground)]">
                    {formatEurMinor(lineTotalMinor(l))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-3 flex flex-col gap-1.5 border-t border-[color:var(--color-border)] pt-3">
            <TotalRow label={t('builder.total')} value={formatEurMinor(total)} grand />
            {doc.schedule?.length ? (
              <>
                <TotalRow label={t('detail.paid')} value={formatEurMinor(paid)} />
                <TotalRow label={t('detail.remaining')} value={formatEurMinor(rem)} />
              </>
            ) : null}
          </div>

          {/* Échéances — encaissement manuel (sans Wedillybird Pay) */}
          {doc.schedule?.length ? (
            <div className="mt-4 flex flex-col gap-2 border-t border-[color:var(--color-border)] pt-4">
              <span className="font-mono text-[9px] tracking-[0.14em] text-[color:var(--color-muted-foreground)] uppercase">
                {t('detail.scheduleHeading')}
              </span>
              {doc.schedule.map((s, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2"
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <b className="truncate text-sm text-[color:var(--color-foreground)]">
                      {s.label}
                    </b>
                    <span className="font-mono text-[10px] text-[color:var(--color-muted-foreground)]">
                      {s.dueDate
                        ? t('detail.scheduleDue', { date: formatDateFr(s.dueDate) })
                        : t('detail.onReceipt')}
                    </span>
                  </span>
                  <span className="font-mono text-sm text-[color:var(--color-foreground)] tabular-nums">
                    {formatEurMinor(s.amountMinor)}
                  </span>
                  {s.paid ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--color-sage-500)]/15 px-2 py-0.5 text-[11px] font-medium text-[color:var(--color-sage-500)]">
                      <CircleCheck className="h-3 w-3" strokeWidth={2.2} aria-hidden />
                      {t('detail.collected')}
                    </span>
                  ) : canWrite ? (
                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      {doc.type === 'invoice' && connected ? (
                        <PayLinkButton
                          docId={doc._id}
                          index={i}
                          connected={connected}
                          clientName={doc.clientName}
                        />
                      ) : null}
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => recordPayment(i)}
                        className="focus-ring inline-flex items-center gap-1 rounded-lg border border-[color:var(--color-border-strong)] px-2.5 py-1 text-[11px] font-medium text-[color:var(--color-foreground)] transition-colors hover:border-[color:var(--color-sage-500)] hover:text-[color:var(--color-sage-500)] disabled:opacity-50"
                      >
                        <CircleCheck className="h-3.5 w-3.5" strokeWidth={1.9} aria-hidden />
                        {t('detail.markPaid')}
                      </button>
                    </div>
                  ) : (
                    <span className="text-[11px] text-[color:var(--color-muted-foreground)]">
                      {t('detail.awaiting')}
                    </span>
                  )}
                </div>
              ))}
              <p className="text-[11px] text-[color:var(--color-muted-foreground)]">
                {t('detail.manualNote')}
              </p>
            </div>
          ) : null}
        </div>

        {/* side */}
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5">
            <div className="mb-3 flex items-center justify-between">
              <span className="font-display text-base text-[color:var(--color-foreground)] italic">
                {t('cols.status')}
              </span>
              <StatusPill type={doc.type} status={doc.status} />
            </div>
            {canWrite ? (
              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  disabled={pending}
                  onClick={() => setStatus('sent')}
                >
                  <Send className="h-4 w-4" strokeWidth={1.9} aria-hidden />
                  {t('detail.followUp')}
                </Button>
                {doc.type === 'quote' ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="md"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        const r = await convertDocAction(doc._id);
                        if (r.ok) onConverted();
                      })
                    }
                  >
                    <FileCheck className="h-4 w-4" strokeWidth={1.8} aria-hidden />
                    {t('convertToInvoice')}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="md"
                    disabled={pending}
                    onClick={() => setStatus('paid')}
                  >
                    <CircleCheck className="h-4 w-4" strokeWidth={1.8} aria-hidden />
                    {t('detail.markPaid')}
                  </Button>
                )}
                <Button type="button" variant="ghost" size="md" onClick={onEdit}>
                  <Pencil className="h-4 w-4" strokeWidth={1.8} aria-hidden />
                  {t('detail.edit')}
                </Button>
              </div>
            ) : null}
          </div>

          <DetailTimeline docId={doc._id} issueDate={doc.issueDate} />
        </div>
      </div>
    </div>
  );
}

function DetailTimeline({ docId, issueDate }: { docId: string; issueDate: number }) {
  // La timeline détaillée est rechargée à l'ouverture du détail via le serveur ;
  // ici on affiche au minimum la création (les events s'ajoutent côté Convex).
  const t = useTranslations('Pro.quotesBoard');
  return (
    <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5">
      <span className="mb-3 block font-mono text-[10px] tracking-[0.16em] text-[color:var(--color-muted-foreground)] uppercase">
        {t('detail.history')}
      </span>
      <div className="flex items-start gap-3">
        <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[color:var(--color-surface-elevated)] text-[color:var(--color-blush-300)]">
          <FileText className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden />
        </span>
        <span className="flex flex-col">
          <span className="text-sm text-[color:var(--color-foreground)]">
            {t('detail.documentCreated')}
          </span>
          <span className="font-mono text-[10px] text-[color:var(--color-muted-foreground)]">
            {formatDateFr(issueDate)}
          </span>
        </span>
      </div>
      <input type="hidden" value={docId} readOnly />
    </div>
  );
}

/* ---- petits primitifs ---- */
const SELECT =
  'focus-ring h-10 w-full rounded-lg border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface-elevated)] px-3 text-sm text-[color:var(--color-foreground)]';
const INPUT =
  'focus-ring h-9 w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface-elevated)] px-2.5 text-sm text-[color:var(--color-foreground)]';

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5">
      <span className="font-mono text-[10px] tracking-[0.16em] text-[color:var(--color-muted-foreground)] uppercase">
        {title}
      </span>
      {children}
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-[color:var(--color-muted-foreground)]">
        {label}
      </span>
      {children}
    </label>
  );
}
function TotalRow({ label, value, grand }: { label: string; value: string; grand?: boolean }) {
  return (
    <div className={cn('flex justify-between', grand ? 'text-base' : 'text-sm')}>
      <span className="text-[color:var(--color-muted-foreground)]">{label}</span>
      <span
        className={cn(
          'font-mono tabular-nums',
          grand
            ? 'font-display text-lg text-[color:var(--color-foreground)] not-italic'
            : 'text-[color:var(--color-foreground)]',
        )}
      >
        {value}
      </span>
    </div>
  );
}
function ScheduleRow({ label, amount, when }: { label: string; amount: string; when: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface-elevated)] px-3 py-2 text-xs">
      <span className="text-[color:var(--color-foreground)]">{label}</span>
      <span className="font-mono text-[color:var(--color-foreground)] tabular-nums">{amount}</span>
      <span className="font-mono text-[10px] text-[color:var(--color-muted-foreground)]">
        {when}
      </span>
    </div>
  );
}
