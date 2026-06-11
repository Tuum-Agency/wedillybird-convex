'use client';

import { useMemo, useState, useTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Heart, Plus, Star, Trash2, X, Wallet, BadgeCheck, Users } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/cn';
import { formatEurMinor } from '@/lib/pro/format';
import {
  ENGAGEMENT_STATUSES,
  ENGAGEMENT_STATUS_META,
  engagementKpis,
  vendorCategoryHue,
  vendorInitials,
  type EngagementStatus,
} from '@/lib/pro/vendors';
import {
  attachVendorAction,
  setEngagementStatusAction,
  detachVendorAction,
} from '@/app/[locale]/(app)/pro/vendors/actions';

export interface EngagementRow {
  _id: string;
  vendorId: string;
  eventId: string;
  status: EngagementStatus;
  plannedMinor?: number;
  budgetLineId: string | null;
  vendorName: string;
  vendorCategory: string;
  vendorRating?: number;
  createdAt: number;
}

interface VendorOpt {
  _id: string;
  name: string;
  category: string;
  rating?: number;
}

const selectClass =
  'focus-ring h-10 rounded-lg border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface-elevated)] px-3 text-sm text-[color:var(--color-foreground)]';

export function VendorEngagements({
  vendors,
  events,
  engagements,
  setEngagements,
  canWrite,
}: {
  vendors: VendorOpt[];
  events: ReadonlyArray<{ _id: string; label: string }>;
  engagements: EngagementRow[];
  setEngagements: React.Dispatch<React.SetStateAction<EngagementRow[]>>;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [selectedEventId, setSelectedEventId] = useState<string>(events[0]?._id ?? '');
  const [attachOpen, setAttachOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const eventEngagements = useMemo(
    () => engagements.filter((e) => e.eventId === selectedEventId),
    [engagements, selectedEventId],
  );
  const kpis = engagementKpis(eventEngagements);
  const attachedVendorIds = new Set(eventEngagements.map((e) => e.vendorId));
  const availableVendors = vendors.filter((v) => !attachedVendorIds.has(v._id));

  function onSetStatus(row: EngagementRow, status: EngagementStatus) {
    if (!canWrite || status === row.status) return;
    const prev = row.status;
    setEngagements((list) => list.map((e) => (e._id === row._id ? { ...e, status } : e)));
    startTransition(async () => {
      const res = await setEngagementStatusAction(row._id, status);
      if (!res.ok)
        setEngagements((list) => list.map((e) => (e._id === row._id ? { ...e, status: prev } : e)));
    });
  }

  function onDetach(row: EngagementRow) {
    if (!confirm(`Détacher « ${row.vendorName} » de ce mariage ?`)) return;
    setEngagements((list) => list.filter((e) => e._id !== row._id));
    startTransition(async () => {
      const res = await detachVendorAction(row._id);
      if (!res.ok) router.refresh();
    });
  }

  if (events.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-[color:var(--color-border-strong)] bg-[color:var(--color-surface)]/40 px-8 py-14 text-center text-sm text-[color:var(--color-muted-foreground)]">
        Aucun mariage pour l’instant. Créez un mariage pour y rattacher des prestataires.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Switcher mariage + rattacher */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[9px] tracking-[0.18em] text-[color:var(--color-muted-foreground)] uppercase">
            Mariage
          </span>
          <Select value={selectedEventId} onValueChange={setSelectedEventId}>
            <SelectTrigger className={selectClass} aria-label="Choisir le mariage">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {events.map((ev) => (
                <SelectItem key={ev._id} value={ev._id}>
                  {ev.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <span className="flex-1 text-sm text-[color:var(--color-muted-foreground)]">
          {kpis.total} prestataire{kpis.total > 1 ? 's' : ''} rattaché{kpis.total > 1 ? 's' : ''} à
          ce mariage
        </span>
        {canWrite ? (
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={() => setAttachOpen(true)}
            disabled={availableVendors.length === 0}
            data-testid="attach-vendor"
          >
            <Plus className="h-4 w-4" strokeWidth={2.2} aria-hidden />
            Rattacher un prestataire
          </Button>
        ) : null}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Kpi Icon={Users} label="Prestataires" value={`${kpis.total}`} />
        <Kpi
          Icon={BadgeCheck}
          label="Confirmés"
          value={`${kpis.confirmed}`}
          unit={`/${kpis.total}`}
        />
        <Kpi Icon={Wallet} label="Budget rattaché" value={formatEurMinor(kpis.budgetMinor)} />
      </div>

      {/* Liste des engagements */}
      {eventEngagements.length === 0 ? (
        <div className="flex flex-col items-center gap-5 rounded-3xl border border-dashed border-[color:var(--color-border-strong)] bg-[color:var(--color-surface)]/40 px-8 py-12 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[color:var(--color-surface-elevated)] text-[color:var(--color-blush-300)]">
            <Heart className="h-6 w-6" strokeWidth={1.7} aria-hidden />
          </span>
          <p className="max-w-sm text-sm text-[color:var(--color-muted-foreground)]">
            Aucun prestataire rattaché à ce mariage.
          </p>
          <ol className="flex flex-wrap items-center justify-center gap-2 text-left">
            {[
              ['01', 'Choisir un prestataire de l’annuaire'],
              ['02', 'Définir le statut d’engagement'],
              ['03', 'Relier au budget du mariage'],
            ].map(([n, label]) => (
              <li
                key={n}
                className="inline-flex items-center gap-2 rounded-xl border border-[color:var(--color-border)] px-3 py-2 text-xs text-[color:var(--color-muted-foreground)]"
              >
                <span className="font-mono text-[color:var(--color-blush-300)]">{n}</span> {label}
              </li>
            ))}
          </ol>
          {canWrite && availableVendors.length > 0 ? (
            <Button type="button" variant="primary" size="md" onClick={() => setAttachOpen(true)}>
              <Plus className="h-4 w-4" strokeWidth={2.2} aria-hidden />
              Rattacher un prestataire
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)]">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-[color:var(--color-border)] text-left font-mono text-[9px] tracking-[0.18em] text-[color:var(--color-muted-foreground)] uppercase">
                <th className="px-4 py-3 font-medium">Prestataire</th>
                <th className="px-4 py-3 font-medium">Note</th>
                <th className="px-4 py-3 font-medium">Budget lié</th>
                <th className="px-4 py-3 font-medium">Statut</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {eventEngagements.map((row) => (
                <tr
                  key={row._id}
                  className="border-b border-[color:var(--color-border)] last:border-0"
                >
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-2.5">
                      <VAvatar name={row.vendorName} />
                      <span className="flex flex-col">
                        <span className="text-[color:var(--color-foreground)]">
                          {row.vendorName}
                        </span>
                        <span className="font-mono text-[10px] text-[color:var(--color-muted-foreground)]">
                          {row.vendorCategory}
                        </span>
                      </span>
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {row.vendorRating ? (
                      <span className="inline-flex items-center gap-1 text-xs text-[color:var(--color-foreground)]">
                        <Star
                          className="h-3.5 w-3.5 text-[color:var(--color-gold-500)]"
                          fill="currentColor"
                          strokeWidth={0}
                          aria-hidden
                        />
                        {row.vendorRating.toFixed(1)}
                      </span>
                    ) : (
                      <span className="text-xs text-[color:var(--color-muted-foreground)]">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs tabular-nums">
                    {row.plannedMinor ? (
                      <span className="inline-flex items-center gap-1.5 text-[color:var(--color-foreground)]">
                        {formatEurMinor(row.plannedMinor)}
                        {row.budgetLineId ? (
                          <span
                            title="Ligne budget liée"
                            className="h-1.5 w-1.5 rounded-full bg-[color:var(--color-sage-500)]"
                            aria-hidden
                          />
                        ) : null}
                      </span>
                    ) : (
                      <span className="text-[color:var(--color-muted-foreground)]">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {canWrite ? (
                      <Select
                        value={row.status}
                        onValueChange={(v) => onSetStatus(row, v as EngagementStatus)}
                      >
                        <SelectTrigger
                          aria-label={`Statut de ${row.vendorName}`}
                          className="focus-ring rounded-full border-0 px-2.5 py-1 text-[11px] font-medium"
                          style={{
                            background: ENGAGEMENT_STATUS_META[row.status].bg,
                            color: ENGAGEMENT_STATUS_META[row.status].fg,
                          }}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ENGAGEMENT_STATUSES.map((s) => (
                            <SelectItem key={s} value={s}>
                              {ENGAGEMENT_STATUS_META[s].label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <StatusPill status={row.status} />
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {canWrite ? (
                      <button
                        type="button"
                        onClick={() => onDetach(row)}
                        aria-label={`Détacher ${row.vendorName}`}
                        className="focus-ring rounded-md p-1 text-[color:var(--color-muted-foreground)] hover:text-[color:var(--color-danger)]"
                      >
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.85} />
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {attachOpen ? (
        <AttachDialog
          vendors={availableVendors}
          eventId={selectedEventId}
          pending={pending}
          onClose={() => setAttachOpen(false)}
          onAttached={(row) => {
            setEngagements((list) => [...list, row]);
            setAttachOpen(false);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}

function AttachDialog({
  vendors,
  eventId,
  pending,
  onClose,
  onAttached,
}: {
  vendors: VendorOpt[];
  eventId: string;
  pending: boolean;
  onClose: () => void;
  onAttached: (row: EngagementRow) => void;
}) {
  const [vendorId, setVendorId] = useState(vendors[0]?._id ?? '');
  const [status, setStatus] = useState<EngagementStatus>('contacted');
  const [linkBudget, setLinkBudget] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const amountEur = Number(String(fd.get('plannedEur') ?? '').replace(',', '.'));
    const plannedMinor =
      Number.isFinite(amountEur) && amountEur > 0 ? Math.round(amountEur * 100) : undefined;
    const vendor = vendors.find((v) => v._id === vendorId);
    if (!vendor) {
      setError('Choisissez un prestataire.');
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await attachVendorAction({
        vendorId,
        eventId,
        status,
        plannedMinor,
        createBudgetLine: linkBudget && plannedMinor != null,
      });
      if (!res.ok) {
        setError(
          res.error === 'ALREADY_ATTACHED'
            ? 'Ce prestataire est déjà rattaché.'
            : 'Une erreur est survenue. Réessayez.',
        );
        return;
      }
      onAttached({
        _id: res.id ?? `tmp_${Date.now()}`,
        vendorId,
        eventId,
        status,
        plannedMinor,
        budgetLineId: res.budgetLineCreated ? 'pending' : null,
        vendorName: vendor.name,
        vendorCategory: vendor.category,
        vendorRating: vendor.rating,
        createdAt: Date.now(),
      });
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Rattacher un prestataire"
    >
      <button
        type="button"
        aria-label="Fermer"
        onClick={onClose}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
      />
      <form
        onSubmit={onSubmit}
        className="relative flex w-full max-w-md flex-col gap-4 rounded-2xl border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface)] p-6 shadow-[var(--shadow-popover)]"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[color:var(--color-surface-elevated)] text-[color:var(--color-blush-300)]">
            <Heart className="h-5 w-5" strokeWidth={1.85} aria-hidden />
          </span>
          <h3 className="font-display text-xl text-[color:var(--color-foreground)] italic">
            Rattacher un prestataire
          </h3>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-[color:var(--color-muted-foreground)]">
            Prestataire
          </span>
          <Select value={vendorId} onValueChange={setVendorId} required>
            <SelectTrigger className={selectClass}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {vendors.map((v) => (
                <SelectItem key={v._id} value={v._id}>
                  {v.name} · {v.category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>

        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1 text-xs font-medium text-[color:var(--color-muted-foreground)]">
            Statut d’engagement
          </legend>
          <div className="grid grid-cols-2 gap-2">
            {ENGAGEMENT_STATUSES.map((s) => {
              const on = status === s;
              const meta = ENGAGEMENT_STATUS_META[s];
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors',
                    on
                      ? 'border-[color:var(--color-blush-400)] bg-[color:var(--color-surface-elevated)]'
                      : 'border-[color:var(--color-border)] hover:border-[color:var(--color-border-strong)]',
                  )}
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: meta.dot }}
                    aria-hidden
                  />
                  <span className="text-[color:var(--color-foreground)]">{meta.label}</span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="flex flex-col gap-2 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-elevated)] p-3">
          <label className="flex items-center gap-2.5 text-sm text-[color:var(--color-foreground)]">
            <input
              type="checkbox"
              checked={linkBudget}
              onChange={(e) => setLinkBudget(e.target.checked)}
              className="h-4 w-4 accent-[color:var(--color-blush-400)]"
            />
            Créer la ligne budget correspondante
          </label>
          <label className="flex items-center justify-between gap-3 text-sm">
            <span className="text-[color:var(--color-muted-foreground)]">Montant prévu (€)</span>
            <input
              name="plannedEur"
              type="number"
              min="0"
              step="1"
              inputMode="decimal"
              placeholder="0"
              className="focus-ring h-9 w-32 rounded-lg border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface)] px-3 text-right font-mono text-sm text-[color:var(--color-foreground)] tabular-nums"
            />
          </label>
        </div>

        {error ? (
          <p role="alert" className="text-sm text-[color:var(--color-danger)]">
            {error}
          </p>
        ) : null}

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className={cn(buttonVariants({ variant: 'ghost', size: 'md' }))}
          >
            <X className="h-4 w-4" strokeWidth={2} aria-hidden /> Annuler
          </button>
          <Button type="submit" variant="primary" size="md" disabled={pending}>
            <Plus className="h-4 w-4" strokeWidth={2.2} aria-hidden /> Rattacher
          </Button>
        </div>
      </form>
    </div>
  );
}

function Kpi({
  Icon,
  label,
  value,
  unit,
}: {
  Icon: typeof Wallet;
  label: string;
  value: string;
  unit?: string;
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
    </article>
  );
}

function StatusPill({ status }: { status: EngagementStatus }) {
  const meta = ENGAGEMENT_STATUS_META[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium"
      style={{ background: meta.bg, color: meta.fg }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.dot }} aria-hidden />
      {meta.label}
    </span>
  );
}

function VAvatar({ name }: { name: string }) {
  const h = vendorCategoryHue(name);
  return (
    <span
      aria-hidden
      className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg font-mono text-[11px] font-medium"
      style={{ background: `oklch(32% 0.045 ${h})`, color: `oklch(84% 0.06 ${h})` }}
    >
      {vendorInitials(name)}
    </span>
  );
}
