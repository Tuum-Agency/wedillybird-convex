'use client';

import { useMemo, useState, useTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations, useFormatter } from 'next-intl';
import {
  Plus,
  ArrowLeft,
  ArrowRight,
  CircleCheck,
  Ban,
  X,
  Search,
  Stamp,
  Sparkles,
  Send,
  Download,
  PenLine,
  BadgeCheck,
  Loader,
  ShieldCheck,
  FileText,
  Link2,
  Pencil,
  CreditCard,
  CalendarCheck,
  Check,
  type LucideIcon,
} from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { cn } from '@/lib/cn';
import { parseEurToMinor, nowMs } from '@/lib/pro/format';
import { toast } from '@/components/ui/toast';
import {
  contractTone,
  nextStatus,
  mergeFields,
  generateContractSections,
  getJurisdiction,
  esignFramework,
  JURISDICTIONS,
  SERVICE_TYPES,
  AI_DISCLAIMER,
  bookingCurrentStep,
  type ContractStatus,
  type ContractTone,
  type ContractSection,
  type ServiceType,
} from '@/lib/pro/contracts';
import {
  createContractAction,
  updateContractAction,
  advanceContractAction,
  cancelContractAction,
} from '@/app/[locale]/(app)/pro/contracts/actions';

export interface Contract {
  _id: string;
  number: string;
  clientId?: string;
  clientName: string;
  eventId?: string;
  quoteId?: string;
  status: ContractStatus;
  sections: ContractSection[];
  totalMinor: number;
  jurisdiction?: string;
  sentAt?: number;
  signedAt?: number;
  countersignedAt?: number;
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
  eventDate?: number;
  venue?: string;
}

type View = 'list' | 'builder' | 'detail' | 'templates';

/* --------------------------- locale-aware formatting --------------------------- */
/**
 * Formatage localisé via next-intl (timeZone/now hérités de la config i18n).
 * Remplace les anciens helpers `fr-FR` codés en dur de `lib/pro/format`.
 */
type Fmt = ReturnType<typeof useFormatter>;

/** Centimes d'euro → monnaie localisée (sans décimales si montant rond). */
function fmtMoney(format: Fmt, minor: number | null | undefined): string {
  if (minor == null) return '—';
  const eur = minor / 100;
  return format.number(eur, {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: Number.isInteger(eur) ? 0 : 2,
  });
}

/** Timestamp ms → date localisée courte (ex. « 12 sept. 2026 »). */
function fmtDate(format: Fmt, ms: number | null | undefined): string {
  if (ms == null) return '—';
  return format.dateTime(new Date(ms), { day: 'numeric', month: 'short', year: 'numeric' });
}

const TONE: Record<ContractTone, string> = {
  muted: 'bg-[color:var(--color-surface-elevated)] text-[color:var(--color-muted-foreground)]',
  info: 'bg-[color:var(--color-info-soft)] text-[color:color-mix(in_oklab,var(--color-info),var(--color-foreground)_40%)]',
  warn: 'bg-[color:var(--color-warning-soft)] text-[color:color-mix(in_oklab,var(--color-warning),var(--color-foreground)_55%)]',
  ok: 'bg-[color:var(--color-success-soft)] text-[color:color-mix(in_oklab,var(--color-success),var(--color-foreground)_42%)]',
  danger:
    'bg-[color:var(--color-danger-soft)] text-[color:color-mix(in_oklab,var(--color-danger),var(--color-foreground)_40%)]',
};

function StatusPill({ status }: { status: ContractStatus }) {
  const t = useTranslations('Pro.contractsBoard');
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium',
        TONE[contractTone(status)],
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" aria-hidden />
      {t(`status.${status}`)}
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

/** Traduit un code d'erreur d'action serveur, avec repli générique. */
function errLabel(t: ReturnType<typeof useTranslations>, code: string): string {
  return t.has(`errors.${code}`) ? t(`errors.${code}`) : t('errors.GENERIC');
}

type T = ReturnType<typeof useTranslations>;

/**
 * Libellés des prestations / juridictions : les données canoniques vivent dans
 * `lib/pro/contracts` (partagées Convex + tests) ; on les localise ici par
 * id/code avec repli sur la valeur de la lib si la clé est absente.
 */
function serviceName(t: T, id: ServiceType, fallback: string): string {
  return t.has(`serviceTypes.${id}.name`) ? t(`serviceTypes.${id}.name`) : fallback;
}
function serviceDesc(t: T, id: ServiceType, fallback: string): string {
  return t.has(`serviceTypes.${id}.desc`) ? t(`serviceTypes.${id}.desc`) : fallback;
}
function jurisdictionLabel(t: T, code: string, fallback: string): string {
  return t.has(`jurisdictions.${code}`) ? t(`jurisdictions.${code}`) : fallback;
}

/* ------------------------------ merge context ------------------------------ */

function buildCtx(
  contract: Pick<Contract, 'clientName' | 'totalMinor' | 'eventId'>,
  orgName: string,
  plannerName: string,
  weddings: WeddingOpt[],
  format: Fmt,
  labels: { agency: string; agreedDate: string; agreedVenue: string; balanceDue: string },
): Record<string, string> {
  const w = weddings.find((x) => x._id === contract.eventId);
  const total = contract.totalMinor;
  const acompte = Math.round(total * 0.3);
  return {
    agence: orgName,
    planner: plannerName || labels.agency,
    couple: contract.clientName,
    date: w?.eventDate ? fmtDate(format, w.eventDate) : labels.agreedDate,
    lieu: w?.venue ?? labels.agreedVenue,
    total: fmtMoney(format, total),
    acompte: fmtMoney(format, acompte),
    solde: fmtMoney(format, total - acompte),
    echeance_solde: labels.balanceDue,
  };
}

/* ============================ SMART-FILE ============================ */

const SMART_STEPS: { k: string; Icon: LucideIcon }[] = [
  { k: 'quote_sent', Icon: FileText },
  { k: 'quote_accepted', Icon: CircleCheck },
  { k: 'contract_signed', Icon: PenLine },
  { k: 'deposit_paid', Icon: CreditCard },
  { k: 'booked', Icon: CalendarCheck },
];

function SmartFile({ contract }: { contract: Contract }) {
  const t = useTranslations('Pro.contractsBoard');
  const current = bookingCurrentStep(contract.status);
  return (
    <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5 sm:p-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <span className="font-display text-base text-[color:var(--color-foreground)] italic">
          {t('smartFile.title')} · <CoupleName name={contract.clientName} />
        </span>
        <span className="font-mono text-[10px] tracking-[0.06em] text-[color:var(--color-muted-foreground)]">
          {contract.number}
        </span>
      </div>
      <div className="flex items-start">
        {SMART_STEPS.map((s, i) => {
          const done = i < current;
          const isCurrent = i === current;
          return (
            <div
              key={s.k}
              className={cn(
                'flex items-center',
                i === SMART_STEPS.length - 1 ? 'flex-none' : 'flex-1',
              )}
            >
              <div className="flex w-max flex-none flex-col items-center gap-2">
                <span
                  className={cn(
                    'grid h-9 w-9 place-items-center rounded-full border-[1.5px] transition-colors',
                    done
                      ? 'border-[color:var(--color-blush-400)] bg-[color:var(--color-blush-400)] text-[oklch(20%_0.02_28)]'
                      : isCurrent
                        ? 'border-[color:var(--color-blush-400)] text-[color:var(--color-blush-300)] shadow-[0_0_0_4px_color-mix(in_oklab,var(--color-blush-500)_18%,transparent)]'
                        : 'border-[color:var(--color-border-strong)] bg-[color:var(--color-surface)] text-[color:var(--color-muted-foreground)]',
                  )}
                >
                  {done ? (
                    <Check className="h-4 w-4" strokeWidth={2.6} aria-hidden />
                  ) : (
                    <s.Icon className="h-4 w-4" strokeWidth={1.8} aria-hidden />
                  )}
                </span>
                <span
                  className={cn(
                    'hidden text-center font-mono text-[9px] tracking-[0.06em] whitespace-nowrap uppercase sm:block',
                    done || isCurrent
                      ? 'text-[color:var(--color-foreground)]'
                      : 'text-[color:var(--color-muted-foreground)]',
                  )}
                >
                  {t(`smartSteps.${s.k}`)}
                </span>
              </div>
              {i < SMART_STEPS.length - 1 ? (
                <span className="mx-2 mt-[18px] h-0.5 min-w-4 flex-1 overflow-hidden rounded bg-[color:var(--color-border-strong)]">
                  <span
                    className={cn(
                      'block h-full bg-[color:var(--color-blush-400)] transition-all',
                      done ? 'w-full' : 'w-0',
                    )}
                  />
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
      {contract.quoteId ? (
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-[color:var(--color-muted-foreground)]">
          <Link2 className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden />
          {t('smartFile.linkedObjects')}
          <Chip>{contract.number}</Chip>
        </div>
      ) : null}
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface-elevated)] px-2 py-0.5 font-mono text-[10px] text-[color:var(--color-ink-700)]">
      {children}
    </span>
  );
}

/* ============================ PREVIEW (branded, light) ============================ */

function ContractPreview({
  contract,
  ctx,
  brandColor,
  orgName,
}: {
  contract: Contract;
  ctx: Record<string, string>;
  brandColor: string;
  orgName: string;
}) {
  const t = useTranslations('Pro.contractsBoard');
  const coupleFirst = contract.clientName.split('&')[0]?.trim() ?? contract.clientName;
  const coupleSigned =
    contract.status === 'signed_client' ||
    contract.status === 'countersigned' ||
    contract.status === 'active';
  const agencySigned = contract.status === 'active' || contract.status === 'countersigned';
  return (
    <div className="overflow-hidden rounded-2xl border border-[oklch(90%_0.015_70)] bg-[oklch(98.5%_0.008_85)] text-[oklch(28%_0.02_45)] shadow-[0_10px_40px_-12px_oklch(20%_0.02_40/0.25)]">
      <div
        className="flex items-center justify-between gap-3 border-b border-[oklch(92%_0.012_70)] px-6 py-4"
        style={{ background: 'oklch(96.5% 0.015 80)' }}
      >
        <div className="flex items-center gap-2.5">
          <span
            className="font-display grid h-8 w-8 place-items-center rounded-lg text-base text-white italic"
            style={{ background: brandColor }}
          >
            {orgName.charAt(0).toUpperCase()}
          </span>
          <b className="text-sm font-semibold text-[oklch(25%_0.02_40)]">{orgName}</b>
        </div>
        <div className="text-right">
          <div className="font-mono text-[9px] tracking-[0.16em] text-[oklch(55%_0.02_55)] uppercase">
            {t('preview.contract')}
          </div>
          <div className="font-mono text-xs text-[oklch(30%_0.02_45)]">{contract.number}</div>
        </div>
      </div>
      <div className="flex flex-col gap-4 px-6 py-5">
        <div className="flex items-start justify-between gap-3 text-[11px]">
          <div>
            <div className="font-mono text-[8px] tracking-[0.1em] text-[oklch(55%_0.02_55)] uppercase">
              {t('preview.client')}
            </div>
            <div className="text-[13px] text-[oklch(25%_0.02_40)]">{contract.clientName}</div>
          </div>
          <div className="text-right">
            <div className="font-mono text-[8px] tracking-[0.1em] text-[oklch(55%_0.02_55)] uppercase">
              {t('preview.wedding')}
            </div>
            <div className="text-[13px] text-[oklch(25%_0.02_40)]">{ctx.date}</div>
          </div>
        </div>
        {contract.sections.map((s, i) => (
          <div key={i}>
            <h4 className="font-display mb-1 text-sm italic" style={{ color: brandColor }}>
              {i + 1}. {s.title}
            </h4>
            <p className="text-[11px] leading-relaxed text-[oklch(34%_0.02_45)]">
              {mergeFields(s.body, ctx)}
            </p>
          </div>
        ))}
        <div className="text-center text-[color:var(--color-gold-500)]">✦</div>
        <div className="grid grid-cols-2 gap-4 border-t border-[oklch(90%_0.02_70)] pt-3">
          <SigLine label={t('preview.theCouple')} value={coupleSigned ? coupleFirst : ''} />
          <SigLine label={t('preview.theAgency')} value={agencySigned ? (ctx.planner ?? '') : ''} />
        </div>
      </div>
    </div>
  );
}

function SigLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-mono text-[8px] tracking-[0.1em] text-[oklch(55%_0.02_55)] uppercase">
        {label}
      </span>
      <span className="font-display flex h-8 items-end border-b border-[oklch(80%_0.02_60)] text-base text-[oklch(28%_0.02_40)] italic">
        {value}
      </span>
    </div>
  );
}

/* ============================ ROOT ============================ */

export function ContractsBoard({
  initialContracts,
  clients,
  weddings,
  organizationId,
  orgName,
  plannerName,
  brandColor,
  canWrite,
}: {
  initialContracts: Contract[];
  clients: ClientOpt[];
  weddings: WeddingOpt[];
  organizationId: string;
  orgName: string;
  plannerName: string;
  brandColor: string;
  canWrite: boolean;
}) {
  const t = useTranslations('Pro.contractsBoard');
  const router = useRouter();
  const [contracts, setContracts] = useState<Contract[]>(initialContracts);
  const [view, setView] = useState<View>('list');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createService, setCreateService] = useState<ServiceType>('coordination');
  const [pending, start] = useTransition();

  const active = activeId ? (contracts.find((c) => c._id === activeId) ?? null) : null;
  const brand = brandColor || 'oklch(48% 0.085 22)';

  function patchLocal(c: Contract) {
    setContracts((prev) => prev.map((x) => (x._id === c._id ? c : x)));
  }
  function openDetail(id: string) {
    setActiveId(id);
    setView('detail');
  }
  function openBuilder(id: string) {
    setActiveId(id);
    setView('builder');
  }
  function openCreate(service: ServiceType) {
    setCreateService(service);
    setCreating(true);
  }

  function submitCreate(fd: FormData) {
    const clientId = String(fd.get('clientId') || '');
    const eventId = String(fd.get('eventId') || '');
    const jurisdiction = String(fd.get('jurisdiction') || 'FR');
    const service = String(fd.get('service') || 'coordination') as ServiceType;
    const totalMinor = parseEurToMinor(String(fd.get('total') || '')) ?? 0;
    const sections = generateContractSections({ jurisdiction, serviceType: service });
    start(async () => {
      const res = await createContractAction(organizationId, {
        clientId: clientId || undefined,
        eventId: eventId || undefined,
        totalMinor,
        sections,
        jurisdiction,
      });
      if (!res.ok) {
        toast.error(errLabel(t, res.error));
        return;
      }
      const id = res.id ?? `tmp_${nowMs()}`;
      const newC: Contract = {
        _id: id,
        number: res.number ?? '—',
        clientId: clientId || undefined,
        clientName: clients.find((c) => c._id === clientId)?.name ?? '—',
        eventId: eventId || undefined,
        status: 'draft',
        sections,
        totalMinor,
        jurisdiction,
        createdAt: nowMs(),
        updatedAt: nowMs(),
      };
      setContracts((prev) => [newC, ...prev]);
      setCreating(false);
      openBuilder(id);
      router.refresh();
    });
  }

  return (
    <div className="container-page flex flex-col gap-6 py-8 sm:py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
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
            {view === 'templates'
              ? t('title.templates')
              : view === 'builder'
                ? t('title.builder')
                : t('title.list')}
          </h1>
        </div>
        {view === 'list' && canWrite ? (
          <div className="flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={() => setView('templates')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--color-border-strong)] px-3.5 py-2 text-xs text-[color:var(--color-ink-700)] hover:text-[color:var(--color-foreground)]"
            >
              <Stamp className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden />
              {t('templates')}
            </button>
            <button
              type="button"
              onClick={() => openCreate('coordination')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[color:var(--color-blush-400)] px-3.5 py-2 text-xs font-medium text-[oklch(20%_0.02_28)] hover:brightness-105"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden />
              {t('newContract')}
            </button>
          </div>
        ) : null}
      </header>

      {view === 'list' ? (
        <ListView contracts={contracts} onOpen={openDetail} />
      ) : view === 'templates' ? (
        <TemplatesView
          onUse={(s) => openCreate(s)}
          onBack={() => setView('list')}
          canWrite={canWrite}
        />
      ) : view === 'builder' && active ? (
        <BuilderView
          contract={active}
          weddings={weddings}
          orgName={orgName}
          plannerName={plannerName}
          brand={brand}
          canWrite={canWrite}
          pending={pending}
          onBack={() => setView('list')}
          onPatch={patchLocal}
          onRefresh={() => start(() => router.refresh())}
          start={start}
        />
      ) : view === 'detail' && active ? (
        <DetailView
          contract={active}
          weddings={weddings}
          orgName={orgName}
          plannerName={plannerName}
          brand={brand}
          canWrite={canWrite}
          pending={pending}
          onBack={() => setView('list')}
          onEdit={() => openBuilder(active._id)}
          onPatch={patchLocal}
          onRefresh={() => start(() => router.refresh())}
          start={start}
        />
      ) : (
        <ListView contracts={contracts} onOpen={openDetail} />
      )}

      <Drawer open={creating} onOpenChange={(o) => !o && setCreating(false)}>
        <DrawerContent className="mx-auto max-w-lg">
          <DrawerHeader>
            <DrawerTitle>{t('newContract')}</DrawerTitle>
          </DrawerHeader>
          <CreateForm
            clients={clients}
            weddings={weddings}
            service={createService}
            pending={pending}
            onCancel={() => setCreating(false)}
            onSubmit={submitCreate}
          />
        </DrawerContent>
      </Drawer>
    </div>
  );
}

/* ============================ LIST ============================ */

function ListView({ contracts, onOpen }: { contracts: Contract[]; onOpen: (id: string) => void }) {
  const t = useTranslations('Pro.contractsBoard');
  const format = useFormatter();
  const [q, setQ] = useState('');
  const smart =
    contracts.find((c) => c.status !== 'active' && c.status !== 'cancelled') ??
    contracts[0] ??
    null;
  const shown = contracts.filter(
    (c) => !q.trim() || `${c.number} ${c.clientName}`.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div className="flex flex-col gap-5">
      {smart ? <SmartFile contract={smart} /> : null}

      <label className="flex max-w-xs items-center gap-2 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2">
        <Search
          className="h-4 w-4 text-[color:var(--color-muted-foreground)]"
          strokeWidth={1.9}
          aria-hidden
        />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('list.searchPlaceholder')}
          aria-label={t('list.searchAria')}
          className="w-full bg-transparent text-sm text-[color:var(--color-foreground)] outline-none placeholder:text-[color:var(--color-muted-foreground)]"
        />
      </label>

      {contracts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[color:var(--color-border-strong)] bg-[color:var(--color-surface)]/40 px-8 py-12 text-center text-sm text-[color:var(--color-muted-foreground)]">
          {t('list.empty')}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)]">
          <table className="w-full min-w-[820px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-[color:var(--color-border)] text-left font-mono text-[9px] tracking-[0.18em] text-[color:var(--color-muted-foreground)] uppercase">
                <th className="px-4 py-3 font-medium">{t('cols.number')}</th>
                <th className="px-4 py-3 font-medium">{t('cols.client')}</th>
                <th className="px-4 py-3 text-right font-medium">{t('cols.amount')}</th>
                <th className="px-4 py-3 font-medium">{t('cols.status')}</th>
                <th className="px-4 py-3 font-medium">{t('cols.sent')}</th>
                <th className="px-4 py-3 font-medium">{t('cols.signed')}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {shown.map((c) => (
                <tr
                  key={c._id}
                  onClick={() => onOpen(c._id)}
                  className="cursor-pointer border-b border-[color:var(--color-border)] transition-colors last:border-0 hover:bg-[color:var(--color-surface-elevated)]"
                >
                  <td className="px-4 py-3 font-mono text-xs text-[color:var(--color-foreground)]">
                    {c.number}
                  </td>
                  <td className="font-display px-4 py-3 text-sm text-[color:var(--color-foreground)] italic">
                    <CoupleName name={c.clientName} />
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-[color:var(--color-foreground)] tabular-nums">
                    {fmtMoney(format, c.totalMinor)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill status={c.status} />
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-[color:var(--color-muted-foreground)]">
                    {fmtDate(format, c.sentAt)}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-[color:var(--color-muted-foreground)]">
                    {fmtDate(format, c.signedAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <ArrowRight
                      className="h-4 w-4 text-[color:var(--color-muted-foreground)]"
                      strokeWidth={2}
                      aria-hidden
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ============================ TEMPLATES ============================ */

function TemplatesView({
  onUse,
  onBack,
  canWrite,
}: {
  onUse: (s: ServiceType) => void;
  onBack: () => void;
  canWrite: boolean;
}) {
  const t = useTranslations('Pro.contractsBoard');
  return (
    <div className="flex flex-col gap-5">
      <button
        onClick={onBack}
        className="focus-ring flex items-center gap-1.5 self-start text-sm text-[color:var(--color-muted-foreground)] hover:text-[color:var(--color-foreground)]"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2} aria-hidden />
        {t('backToList')}
      </button>
      <div className="grid gap-3 sm:grid-cols-3">
        {SERVICE_TYPES.map((svc) => (
          <button
            key={svc.id}
            type="button"
            disabled={!canWrite}
            onClick={() => onUse(svc.id)}
            className="focus-ring group flex flex-col gap-2.5 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-elevated)] p-4 text-left transition-all hover:-translate-y-0.5 hover:border-[color:var(--color-blush-400)] disabled:opacity-60"
          >
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[color:var(--color-blush-500)]/15 text-[color:var(--color-blush-300)]">
              <Stamp className="h-[18px] w-[18px]" strokeWidth={1.7} aria-hidden />
            </span>
            <span className="font-display text-base text-[color:var(--color-foreground)] italic">
              {serviceName(t, svc.id, svc.name)}
            </span>
            <span className="flex-1 text-xs leading-relaxed text-[color:var(--color-muted-foreground)]">
              {serviceDesc(t, svc.id, svc.desc)}
            </span>
            <span className="inline-flex items-center gap-1 font-mono text-[10px] text-[color:var(--color-blush-300)]">
              <Plus className="h-3 w-3" strokeWidth={2.2} aria-hidden />
              {t('useTemplate')}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ============================ BUILDER ============================ */

function BuilderView({
  contract,
  weddings,
  orgName,
  plannerName,
  brand,
  canWrite,
  pending,
  onBack,
  onPatch,
  onRefresh,
  start,
}: {
  contract: Contract;
  weddings: WeddingOpt[];
  orgName: string;
  plannerName: string;
  brand: string;
  canWrite: boolean;
  pending: boolean;
  onBack: () => void;
  onPatch: (c: Contract) => void;
  onRefresh: () => void;
  start: (cb: () => void) => void;
}) {
  const t = useTranslations('Pro.contractsBoard');
  const format = useFormatter();
  const [sections, setSections] = useState<ContractSection[]>(contract.sections);
  const [jurisdiction, setJurisdiction] = useState(contract.jurisdiction ?? 'FR');
  const [service, setService] = useState<ServiceType>('coordination');
  const mfAgency = t('mergeFields.agency');
  const mfAgreedDate = t('mergeFields.agreedDate');
  const mfAgreedVenue = t('mergeFields.agreedVenue');
  const mfBalanceDue = t('mergeFields.balanceDue');
  const ctx = useMemo(
    () =>
      buildCtx(
        { ...contract, totalMinor: contract.totalMinor },
        orgName,
        plannerName,
        weddings,
        format,
        {
          agency: mfAgency,
          agreedDate: mfAgreedDate,
          agreedVenue: mfAgreedVenue,
          balanceDue: mfBalanceDue,
        },
      ),
    [
      contract,
      orgName,
      plannerName,
      weddings,
      format,
      mfAgency,
      mfAgreedDate,
      mfAgreedVenue,
      mfBalanceDue,
    ],
  );
  const esign = esignFramework(jurisdiction);
  const clientSigned =
    contract.status === 'signed_client' ||
    contract.status === 'countersigned' ||
    contract.status === 'active';
  const agencySigned = contract.status === 'countersigned' || contract.status === 'active';

  function generate() {
    const next = generateContractSections({ jurisdiction, serviceType: service });
    setSections(next);
    toast.success(
      t('builder.clausesGenerated', {
        jurisdiction: jurisdictionLabel(t, jurisdiction, getJurisdiction(jurisdiction).label),
      }),
    );
  }
  function save() {
    start(async () => {
      const res = await updateContractAction(contract._id, { sections, jurisdiction });
      if (res.ok) {
        onPatch({ ...contract, sections, jurisdiction, updatedAt: nowMs() });
        toast.success(t('builder.draftSaved'));
      } else toast.error(errLabel(t, res.error));
      onRefresh();
    });
  }
  function sendForSignature() {
    start(async () => {
      // sauvegarde les sections avant l'envoi
      await updateContractAction(contract._id, { sections, jurisdiction });
      const res = await advanceContractAction(contract._id);
      if (res.ok && res.status) {
        onPatch({
          ...contract,
          sections,
          jurisdiction,
          status: res.status,
          sentAt: nowMs(),
          updatedAt: nowMs(),
        });
        toast.success(t('builder.sentForSignature'));
        onBack();
      } else toast.error(errLabel(t, res.ok ? 'UNKNOWN' : res.error));
      onRefresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <button
        onClick={onBack}
        className="focus-ring flex items-center gap-1.5 self-start text-sm text-[color:var(--color-muted-foreground)] hover:text-[color:var(--color-foreground)]"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2} aria-hidden />
        {t('backToList')}
      </button>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <div className="flex flex-col gap-4">
          {/* assistant IA */}
          {canWrite ? (
            <div className="flex flex-col gap-3 rounded-2xl border border-[color:var(--color-blush-500)]/30 bg-[color:var(--color-blush-500)]/8 p-4">
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-[color:var(--color-blush-500)]/18 text-[color:var(--color-blush-300)]">
                  <Sparkles className="h-4 w-4" strokeWidth={1.9} aria-hidden />
                </span>
                <span className="font-display text-[15px] text-[color:var(--color-foreground)] italic">
                  {t('builder.assistant')}
                </span>
                <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-[color:var(--color-surface-elevated)] px-2 py-0.5 font-mono text-[9px] tracking-[0.08em] text-[color:var(--color-blush-300)] uppercase">
                  <ShieldCheck className="h-2.5 w-2.5" strokeWidth={2} aria-hidden />
                  {esign.label}
                </span>
              </div>
              <div className="grid gap-2.5 sm:grid-cols-2 sm:items-end">
                <label className="flex flex-col gap-1">
                  <span className="font-mono text-[9px] tracking-[0.16em] text-[color:var(--color-muted-foreground)] uppercase">
                    {t('builder.jurisdiction')}
                  </span>
                  <Select value={jurisdiction} onValueChange={setJurisdiction}>
                    <SelectTrigger className="focus-ring rounded-lg border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface)] px-3 py-2 text-sm text-[color:var(--color-foreground)]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {JURISDICTIONS.map((j) => (
                        <SelectItem key={j.code} value={j.code}>
                          {jurisdictionLabel(t, j.code, j.label)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="font-mono text-[9px] tracking-[0.16em] text-[color:var(--color-muted-foreground)] uppercase">
                    {t('builder.service')}
                  </span>
                  <Select value={service} onValueChange={(v) => setService(v as ServiceType)}>
                    <SelectTrigger className="focus-ring rounded-lg border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface)] px-3 py-2 text-sm text-[color:var(--color-foreground)]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SERVICE_TYPES.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {serviceName(t, s.id, s.name)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
              </div>
              <button
                type="button"
                onClick={generate}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[color:var(--color-blush-400)] px-3.5 py-2 text-xs font-medium text-[oklch(20%_0.02_28)] hover:brightness-105"
              >
                <Sparkles className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                {t('builder.generateClauses', {
                  jurisdiction: jurisdictionLabel(
                    t,
                    jurisdiction,
                    getJurisdiction(jurisdiction).label,
                  ),
                })}
              </button>
              <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-[color:var(--color-muted-foreground)]">
                <ShieldCheck
                  className="mt-0.5 h-3 w-3 flex-shrink-0"
                  strokeWidth={1.8}
                  aria-hidden
                />
                {t.has('aiDisclaimer') ? t('aiDisclaimer') : AI_DISCLAIMER}
              </p>
            </div>
          ) : null}

          {/* sections */}
          <div className="flex flex-col gap-3 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4">
            <span className="font-mono text-[10px] tracking-[0.16em] text-[color:var(--color-muted-foreground)] uppercase">
              {t('builder.sectionsTitle')}
            </span>
            <div className="flex flex-col gap-3">
              {sections.map((s, i) => (
                <div
                  key={i}
                  className="overflow-hidden rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-elevated)]"
                >
                  <div className="flex items-center gap-2.5 border-b border-[color:var(--color-border)] px-3.5 py-2.5">
                    <span className="grid h-5 w-5 place-items-center rounded bg-[color:var(--color-blush-500)]/15 font-mono text-[11px] text-[color:var(--color-blush-300)]">
                      {i + 1}
                    </span>
                    <span className="font-display text-sm text-[color:var(--color-foreground)] italic">
                      {s.title}
                    </span>
                  </div>
                  <textarea
                    value={s.body}
                    disabled={!canWrite}
                    onChange={(e) =>
                      setSections((ss) =>
                        ss.map((x, j) => (j === i ? { ...x, body: e.target.value } : x)),
                      )
                    }
                    aria-label={t('builder.sectionAria', { title: s.title })}
                    className="min-h-16 w-full resize-y bg-transparent px-3.5 py-3 text-[12.5px] leading-relaxed text-[color:var(--color-ink-700)] outline-none"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* signatures */}
          <div className="flex flex-col gap-3 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4">
            <span className="font-mono text-[10px] tracking-[0.16em] text-[color:var(--color-muted-foreground)] uppercase">
              {t('builder.esignTitle')}
            </span>
            <div className="grid gap-3 sm:grid-cols-2">
              <SigBlock
                who={t('builder.sigCouple', { name: contract.clientName })}
                signed={clientSigned}
                value={clientSigned ? (contract.clientName.split('&')[0]?.trim() ?? '') : ''}
                pendingLabel={t('builder.awaitingSignature')}
                doneLabel={t('builder.signed')}
              />
              <SigBlock
                who={t('builder.sigAgency', { name: plannerName || orgName })}
                signed={agencySigned}
                value={agencySigned ? plannerName || orgName : ''}
                pendingLabel={t('builder.toCountersign')}
                doneLabel={t('builder.countersigned')}
              />
            </div>
          </div>

          {/* actions */}
          {canWrite ? (
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="ghost" size="md" disabled={pending} onClick={save}>
                <FileText className="h-4 w-4" strokeWidth={1.8} aria-hidden />
                {t('builder.saveDraft')}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="md"
                disabled={pending}
                onClick={() => toast.success(t('toasts.pdfDownloaded'))}
              >
                <Download className="h-4 w-4" strokeWidth={1.8} aria-hidden />
                {t('builder.pdf')}
              </Button>
              {contract.status === 'draft' ? (
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  disabled={pending}
                  onClick={sendForSignature}
                >
                  <Send className="h-4 w-4" strokeWidth={1.9} aria-hidden />
                  {t('builder.sendForSignature')}
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="lg:sticky lg:top-6 lg:self-start">
          <ContractPreview
            contract={{ ...contract, sections }}
            ctx={ctx}
            brandColor={brand}
            orgName={orgName}
          />
        </div>
      </div>
    </div>
  );
}

function SigBlock({
  who,
  signed,
  value,
  pendingLabel,
  doneLabel,
}: {
  who: string;
  signed: boolean;
  value: string;
  pendingLabel: string;
  doneLabel: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-2.5 rounded-xl border p-4',
        signed
          ? 'border-[color:var(--color-sage-500)]/50 bg-[oklch(26%_0.04_150)]/25'
          : 'border-[color:var(--color-border-strong)] bg-[color:var(--color-surface-elevated)]',
      )}
    >
      <span className="font-mono text-[9px] tracking-[0.14em] text-[color:var(--color-muted-foreground)] uppercase">
        {who}
      </span>
      <span
        className={cn(
          'font-display grid h-12 place-items-center rounded-lg text-xl text-[color:var(--color-foreground)] italic',
          signed
            ? 'border border-[color:var(--color-sage-500)]'
            : 'border border-dashed border-[color:var(--color-border-strong)]',
        )}
      >
        {value}
      </span>
      <span
        className={cn(
          'inline-flex items-center gap-1.5 font-mono text-[10px]',
          signed ? 'text-[oklch(80%_0.09_150)]' : 'text-[color:var(--color-muted-foreground)]',
        )}
      >
        {signed ? (
          <BadgeCheck className="h-3 w-3" strokeWidth={2} aria-hidden />
        ) : (
          <Loader className="h-3 w-3" strokeWidth={2} aria-hidden />
        )}
        {signed ? doneLabel : pendingLabel}
      </span>
    </div>
  );
}

/* ============================ DETAIL + AUDIT ============================ */

function DetailView({
  contract,
  weddings,
  orgName,
  plannerName,
  brand,
  canWrite,
  pending,
  onBack,
  onEdit,
  onPatch,
  onRefresh,
  start,
}: {
  contract: Contract;
  weddings: WeddingOpt[];
  orgName: string;
  plannerName: string;
  brand: string;
  canWrite: boolean;
  pending: boolean;
  onBack: () => void;
  onEdit: () => void;
  onPatch: (c: Contract) => void;
  onRefresh: () => void;
  start: (cb: () => void) => void;
}) {
  const t = useTranslations('Pro.contractsBoard');
  const format = useFormatter();
  const { confirm, confirmDialog } = useConfirm();
  const mfAgency = t('mergeFields.agency');
  const mfAgreedDate = t('mergeFields.agreedDate');
  const mfAgreedVenue = t('mergeFields.agreedVenue');
  const mfBalanceDue = t('mergeFields.balanceDue');
  const ctx = useMemo(
    () =>
      buildCtx(contract, orgName, plannerName, weddings, format, {
        agency: mfAgency,
        agreedDate: mfAgreedDate,
        agreedVenue: mfAgreedVenue,
        balanceDue: mfBalanceDue,
      }),
    [
      contract,
      orgName,
      plannerName,
      weddings,
      format,
      mfAgency,
      mfAgreedDate,
      mfAgreedVenue,
      mfBalanceDue,
    ],
  );
  const esign = esignFramework(contract.jurisdiction);
  const next = nextStatus(contract.status);

  const timeline = [
    {
      event: t('timeline.created'),
      at: contract.createdAt,
      by: plannerName || orgName,
      sign: false,
    },
    ...(contract.sentAt
      ? [
          {
            event: t('timeline.sent'),
            at: contract.sentAt,
            by: plannerName || orgName,
            sign: false,
          },
        ]
      : []),
    ...(contract.signedAt
      ? [
          {
            event: t('timeline.signedBy', { name: contract.clientName }),
            at: contract.signedAt,
            by: contract.clientName,
            sign: true,
          },
        ]
      : []),
    ...(contract.countersignedAt
      ? [
          {
            event: t('timeline.countersigned'),
            at: contract.countersignedAt,
            by: plannerName || orgName,
            sign: true,
          },
        ]
      : []),
    ...(contract.status === 'active'
      ? [{ event: t('timeline.active'), at: contract.updatedAt, by: undefined, sign: false }]
      : []),
    ...(contract.status === 'cancelled'
      ? [{ event: t('timeline.cancelled'), at: contract.updatedAt, by: undefined, sign: false }]
      : []),
  ];

  function advance() {
    start(async () => {
      const res = await advanceContractAction(contract._id);
      if (res.ok && res.status) {
        onPatch({
          ...contract,
          status: res.status,
          sentAt: res.status === 'sent' ? nowMs() : contract.sentAt,
          signedAt: res.status === 'signed_client' ? nowMs() : contract.signedAt,
          countersignedAt: res.status === 'countersigned' ? nowMs() : contract.countersignedAt,
          updatedAt: nowMs(),
        });
        toast.success(t('toasts.statusUpdated'));
      }
      onRefresh();
    });
  }
  async function cancel() {
    if (!(await confirm({ title: t('detail.confirmCancel'), destructive: true }))) return;
    start(async () => {
      const res = await cancelContractAction(contract._id);
      if (res.ok) onPatch({ ...contract, status: 'cancelled', updatedAt: nowMs() });
      onRefresh();
    });
  }

  const advanceLabel =
    contract.status === 'draft'
      ? t('detail.advance.send')
      : contract.status === 'sent'
        ? t('detail.advance.markSigned')
        : contract.status === 'signed_client'
          ? t('detail.advance.countersign')
          : contract.status === 'countersigned'
            ? t('detail.advance.activate')
            : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={onBack}
          className="focus-ring flex items-center gap-1.5 text-sm text-[color:var(--color-muted-foreground)] hover:text-[color:var(--color-foreground)]"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2} aria-hidden />
          {t('backToList')}
        </button>
        {canWrite && contract.status !== 'active' && contract.status !== 'cancelled' ? (
          <button
            onClick={onEdit}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--color-border-strong)] px-3 py-1.5 text-xs text-[color:var(--color-ink-700)] hover:text-[color:var(--color-foreground)]"
          >
            <Pencil className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden />
            {t('detail.edit')}
          </button>
        ) : null}
      </div>

      {contract.status === 'active' ? <SmartFile contract={contract} /> : null}

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <ContractPreview contract={contract} ctx={ctx} brandColor={brand} orgName={orgName} />

        <div className="flex flex-col gap-4">
          {/* statut + actions */}
          <div className="flex flex-col gap-3 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5">
            <div className="flex items-center justify-between">
              <span className="font-display text-base text-[color:var(--color-foreground)] italic">
                {t('detail.statusTitle')}
              </span>
              <StatusPill status={contract.status} />
            </div>
            {canWrite ? (
              <div className="flex flex-col gap-2">
                {advanceLabel ? (
                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    disabled={pending}
                    onClick={advance}
                  >
                    {contract.status === 'countersigned' ? (
                      <CircleCheck className="h-4 w-4" strokeWidth={1.85} aria-hidden />
                    ) : contract.status === 'signed_client' ? (
                      <PenLine className="h-4 w-4" strokeWidth={1.8} aria-hidden />
                    ) : (
                      <Send className="h-4 w-4" strokeWidth={1.9} aria-hidden />
                    )}
                    {advanceLabel}
                  </Button>
                ) : (
                  <p className="text-xs text-[color:var(--color-muted-foreground)]">
                    {contract.status === 'active'
                      ? t('detail.activeNote')
                      : t('detail.cancelledNote')}
                  </p>
                )}
                {contract.status === 'active' ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="md"
                    onClick={() => toast.success(t('toasts.certificateDownloaded'))}
                  >
                    <BadgeCheck className="h-4 w-4" strokeWidth={1.8} aria-hidden />
                    {t('detail.signatureCertificate')}
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  onClick={() => toast.success(t('toasts.signedPdfDownloaded'))}
                >
                  <Download className="h-4 w-4" strokeWidth={1.8} aria-hidden />
                  {contract.status === 'active'
                    ? t('detail.downloadSignedPdf')
                    : t('detail.downloadPdf')}
                </Button>
                {!next && contract.status === 'active' ? null : contract.status !== 'cancelled' &&
                  contract.status !== 'active' ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="md"
                    disabled={pending}
                    onClick={cancel}
                  >
                    <Ban className="h-4 w-4" strokeWidth={1.8} aria-hidden />
                    {t('detail.cancelContract')}
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* audit */}
          <div className="flex flex-col gap-3 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5">
            <span className="font-mono text-[10px] tracking-[0.16em] text-[color:var(--color-muted-foreground)] uppercase">
              {t('detail.auditTrail')}
            </span>
            <div className="flex items-start gap-2.5 rounded-xl border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface-elevated)] px-3.5 py-3">
              <ShieldCheck
                className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-[color:var(--color-sage-500)]"
                strokeWidth={1.8}
                aria-hidden
              />
              <p className="text-[12px] leading-relaxed text-[color:var(--color-ink-700)]">
                <b className="text-[color:var(--color-foreground)]">{esign.label}</b> — {esign.note}{' '}
                {t('detail.internalCopyArchived')}
              </p>
            </div>
            <div className="flex flex-col">
              {timeline.map((a, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[28px_1fr_auto] items-start gap-3 border-t border-[color:var(--color-border)] py-2.5 first:border-t-0"
                >
                  <span
                    className={cn(
                      'grid h-7 w-7 place-items-center rounded-lg',
                      a.sign
                        ? 'bg-[oklch(26%_0.04_150)] text-[oklch(82%_0.08_150)]'
                        : 'bg-[color:var(--color-surface-elevated)] text-[color:var(--color-blush-300)]',
                    )}
                  >
                    {a.sign ? (
                      <PenLine className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden />
                    ) : (
                      <FileText className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden />
                    )}
                  </span>
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-[13px] text-[color:var(--color-foreground)]">
                      {a.event}
                    </span>
                    {a.by ? (
                      <span className="font-mono text-[9.5px] text-[color:var(--color-muted-foreground)]">
                        {t('detail.by', { name: a.by })}
                      </span>
                    ) : null}
                  </span>
                  <span className="font-mono text-[10px] whitespace-nowrap text-[color:var(--color-muted-foreground)]">
                    {fmtDate(format, a.at)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      {confirmDialog}
    </div>
  );
}

/* ============================ CREATE FORM ============================ */

function CreateForm({
  clients,
  weddings,
  service,
  pending,
  onSubmit,
  onCancel,
}: {
  clients: ClientOpt[];
  weddings: WeddingOpt[];
  service: ServiceType;
  pending: boolean;
  onSubmit: (fd: FormData) => void;
  onCancel: () => void;
}) {
  const t = useTranslations('Pro.contractsBoard');
  const [eventId, setEventId] = useState('none');
  function handle(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    onSubmit(new FormData(e.currentTarget));
  }
  const selectClass =
    'focus-ring h-10 rounded-lg border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface-elevated)] px-3 text-sm text-[color:var(--color-foreground)]';
  return (
    <form onSubmit={handle} className="flex flex-col gap-4 pb-2">
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-[color:var(--color-muted-foreground)]">
          {t('createForm.clientLabel')}
        </span>
        <Select name="clientId" required defaultValue={clients[0]?._id}>
          <SelectTrigger className={selectClass}>
            <SelectValue placeholder={t('createForm.clientPlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            {clients.map((c) => (
              <SelectItem key={c._id} value={c._id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-[color:var(--color-muted-foreground)]">
          {t('createForm.weddingLabel')}
        </span>
        <input type="hidden" name="eventId" value={eventId === 'none' ? '' : eventId} />
        <Select value={eventId} onValueChange={setEventId}>
          <SelectTrigger className={selectClass}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">{t('createForm.weddingNone')}</SelectItem>
            {weddings.map((w) => (
              <SelectItem key={w._id} value={w._id}>
                {w.coupleNames}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>
      <div className="grid gap-4 sm:grid-cols-2 sm:items-end">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-[color:var(--color-muted-foreground)]">
            {t('builder.service')}
          </span>
          <Select name="service" defaultValue={service}>
            <SelectTrigger className={selectClass}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SERVICE_TYPES.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {serviceName(t, s.id, s.name)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-[color:var(--color-muted-foreground)]">
            {t('builder.jurisdiction')}
          </span>
          <Select name="jurisdiction" defaultValue="FR">
            <SelectTrigger className={selectClass}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {JURISDICTIONS.map((j) => (
                <SelectItem key={j.code} value={j.code}>
                  {jurisdictionLabel(t, j.code, j.label)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-[color:var(--color-muted-foreground)]">
          {t('createForm.totalLabel')}
        </span>
        <Input name="total" inputMode="decimal" placeholder="2500" />
      </label>
      <div className="mt-1 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className={cn(buttonVariants({ variant: 'ghost', size: 'md' }))}
        >
          <X className="h-4 w-4" strokeWidth={2} aria-hidden />
          {t('createForm.cancel')}
        </button>
        <Button type="submit" variant="primary" size="md" disabled={pending}>
          {pending ? t('createForm.creating') : t('createForm.create')}
        </Button>
      </div>
    </form>
  );
}
