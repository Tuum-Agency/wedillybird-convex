'use client';

import { Fragment, useState, useTransition, type FormEvent } from 'react';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useTranslations, useFormatter } from 'next-intl';
import {
  Plus,
  Pencil,
  Trash2,
  X,
  AlertTriangle,
  Scale,
  PieChart,
  Banknote,
  Wallet,
  Check,
  Store,
  Download,
  ChevronDown,
  Paperclip,
  Receipt,
  ExternalLink,
  Link2,
  Copy,
  Clock,
} from 'lucide-react';
import { createVendorAction } from '@/app/[locale]/(app)/pro/vendors/actions';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { WeddingSelect, type WeddingOption } from '@/components/pro/wedding-select';
import { cn } from '@/lib/cn';
import {
  BUDGET_CATEGORIES,
  groupByCategory,
  lineStatus,
  summarizeBudget,
  envelopeState,
  donutSegments,
  budgetAlerts,
  categoryHue,
  PAYMENT_METHODS,
  type LineStatus,
  type CategoryGroup,
  type PaymentMethod,
  type PaymentStatus,
} from '@/lib/pro/budget';
import { parseEurToMinor, nowMs } from '@/lib/pro/format';
import {
  createBudgetLineAction,
  updateBudgetLineAction,
  removeBudgetLineAction,
  setBudgetEnvelopeAction,
  addBudgetPaymentAction,
  removeBudgetPaymentAction,
  createBudgetPaymentLinkAction,
} from '@/app/[locale]/(app)/pro/budget/actions';

export interface BudgetPaymentRow {
  _id: string;
  amountMinor: number;
  method: PaymentMethod;
  status: PaymentStatus;
  paidAt: number;
  note?: string;
  proofFileName?: string;
  proofUrl: string | null;
  provider?: 'stripe' | 'mock';
  checkoutUrl?: string;
  createdAt: number;
}

export interface BudgetLineRow {
  _id: string;
  category: string;
  label: string;
  vendorName?: string;
  plannedMinor: number;
  paidMinor: number;
  dueDate?: number;
  createdAt: number;
  updatedAt: number;
  payments: BudgetPaymentRow[];
}

/** Catégories canoniques → sous-clé i18n stable (libellé localisé en UI). */
const CATEGORY_KEY: Record<string, string> = {
  Lieu: 'venue',
  Traiteur: 'catering',
  'Photo / Vidéo': 'photoVideo',
  'Décoration & Fleurs': 'decorFlowers',
  Tenues: 'attire',
  'Musique / DJ': 'musicDj',
  Papeterie: 'stationery',
  Transport: 'transport',
  Divers: 'misc',
};

/**
 * Hook : libellé de catégorie localisé. Les catégories canoniques sont
 * traduites ; une catégorie libre (custom) est affichée telle quelle.
 */
function useCategoryLabel() {
  const t = useTranslations('Pro.budgetBoard');
  return (category: string) => {
    const key = CATEGORY_KEY[category];
    return key ? t(`categories.${key}` as const) : category;
  };
}

/** Couleurs des pastilles de statut (les libellés viennent de l'i18n). */
const STATUS_PILL_TONE: Record<LineStatus, { bg: string; fg: string }> = {
  todo: { bg: 'oklch(28% 0.015 60)', fg: 'oklch(80% 0.02 60)' },
  partial: { bg: 'oklch(30% 0.05 85)', fg: 'oklch(88% 0.08 85)' },
  paid: { bg: 'oklch(27% 0.05 145)', fg: 'oklch(83% 0.08 145)' },
  overdue: { bg: 'oklch(28% 0.06 25)', fg: 'oklch(85% 0.08 25)' },
};

/** Codes d'erreur serveur disposant d'un libellé dédié (sinon message générique). */
const KNOWN_ERROR_CODES = new Set([
  'INVALID_LABEL',
  'INVALID_AMOUNT',
  'FEATURE_NOT_IN_PLAN',
  'FORBIDDEN',
  'INVALID_PROOF_TYPE',
  'INVALID_PROOF_SIZE',
  'UPLOAD_FAILED',
  'PAYMENTS_NOT_CONFIGURED',
]);

/** Hook : traduit un code d'erreur serveur en message FR (fallback générique). */
function useErrorLabel() {
  const t = useTranslations('Pro.budgetBoard');
  return (code: string) =>
    KNOWN_ERROR_CODES.has(code) ? t(`errors.${code}` as const) : t('errors.generic');
}

/**
 * Hook de formatage monétaire localisé (centimes → « 18 000 € »). Reproduit la
 * logique FR partagée mais via la locale active (pas de `fr-FR` codé en dur).
 */
function useEurFormat() {
  const format = useFormatter();
  return (minor: number | null | undefined) => {
    if (minor == null) return '—';
    const eur = minor / 100;
    return format.number(eur, {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: Number.isInteger(eur) ? 0 : 2,
    });
  };
}

/**
 * Hook de formatage de date localisé (ms → « 12 sept. 2026 »), UTC pour éviter
 * les décalages SSR.
 */
function useDateFormat() {
  const format = useFormatter();
  return (ms: number | null | undefined) => {
    if (ms == null) return '—';
    return format.dateTime(new Date(ms), {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    });
  };
}

function toDateInput(ms: number | undefined): string {
  if (!ms) return '';
  return new Date(ms).toISOString().slice(0, 10);
}

/** Groupe les chiffres par milliers avec une espace fine insécable (18000 → 18 000). */
function groupDigits(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

const VENDOR_INPUT_CLASS =
  'h-10 w-full rounded-lg border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface-elevated)] px-3 text-sm text-[color:var(--color-foreground)] outline-none placeholder:text-[color:var(--color-muted-foreground)] focus:border-[color:var(--color-blush-400)]';

/**
 * Combobox prestataire : tape pour chercher dans l'annuaire de l'agence,
 * choisir un prestataire existant, **en créer un** (ajouté à la base), ou
 * laisser un nom libre (ponctuel). Le champ `vendorName` reste soumis au form.
 */
function VendorPicker({
  vendors: initialVendors,
  defaultValue,
  category,
}: {
  vendors: ReadonlyArray<{ name: string; category?: string }>;
  defaultValue?: string;
  category: string;
}) {
  const t = useTranslations('Pro.budgetBoard');
  const [vendors, setVendors] = useState(initialVendors);
  const [value, setValue] = useState(defaultValue ?? '');
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const q = value.trim().toLowerCase();
  const matches = vendors.filter((v) => v.name.toLowerCase().includes(q)).slice(0, 6);
  const exact = vendors.some((v) => v.name.toLowerCase() === q);

  async function createVendor() {
    const name = value.trim();
    if (!name || creating) return;
    setCreating(true);
    const fd = new FormData();
    fd.set('name', name);
    fd.set('category', category);
    const res = await createVendorAction(fd);
    setCreating(false);
    if (res.ok) setVendors((vs) => [...vs, { name, category }]);
    setOpen(false);
  }

  return (
    <div className="relative">
      <input
        name="vendorName"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        autoComplete="off"
        placeholder={t('vendorPicker.placeholder')}
        className={VENDOR_INPUT_CLASS}
      />
      {open ? (
        <>
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            className="fixed inset-0 z-10 cursor-default"
            onClick={() => setOpen(false)}
          />
          <ul className="absolute top-full left-0 z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface)] p-1 shadow-[var(--shadow-popover)]">
            {matches.map((v) => (
              <li key={v.name}>
                <button
                  type="button"
                  onClick={() => {
                    setValue(v.name);
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-[color:var(--color-foreground)] transition-colors hover:bg-[color:var(--color-surface-elevated)]"
                >
                  <Store
                    className="h-3.5 w-3.5 flex-shrink-0 text-[color:var(--color-blush-300)]"
                    strokeWidth={1.85}
                    aria-hidden
                  />
                  <span className="flex-1 truncate">{v.name}</span>
                  {v.category ? (
                    <span className="font-mono text-[10px] text-[color:var(--color-muted-foreground)]">
                      {v.category}
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
            {q && !exact ? (
              <li>
                <button
                  type="button"
                  onClick={createVendor}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-[color:var(--color-blush-300)] transition-colors hover:bg-[color:var(--color-surface-elevated)]"
                >
                  <Plus className="h-3.5 w-3.5 flex-shrink-0" strokeWidth={2.2} aria-hidden />
                  <span className="flex-1 truncate">
                    {creating
                      ? t('vendorPicker.creating')
                      : t('vendorPicker.create', { name: value.trim() })}
                  </span>
                  <span className="font-mono text-[10px] text-[color:var(--color-muted-foreground)]">
                    {t('vendorPicker.newVendor')}
                  </span>
                </button>
              </li>
            ) : null}
            {matches.length === 0 && !q ? (
              <li className="px-2 py-1.5 text-xs text-[color:var(--color-muted-foreground)]">
                {t('vendorPicker.hint')}
              </li>
            ) : null}
          </ul>
        </>
      ) : null}
    </div>
  );
}

/**
 * Édition de l'enveloppe : champ contrôlé, gros caractères cohérents avec
 * l'affichage (Bodoni italic), séparateur de milliers en direct, suffixe €.
 */
function EnvelopeEditor({
  initialMinor,
  onSave,
  onCancel,
}: {
  initialMinor: number;
  onSave: (eur: string) => void;
  onCancel: () => void;
}) {
  const t = useTranslations('Pro.budgetBoard');
  const [digits, setDigits] = useState(
    initialMinor > 0 ? String(Math.round(initialMinor / 100)) : '',
  );
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(digits);
      }}
      className="flex items-center gap-2"
    >
      <div className="flex flex-1 items-baseline gap-1 rounded-lg border border-[color:var(--color-blush-400)] bg-[color:var(--color-surface-elevated)] px-2.5 py-1">
        <input
          autoFocus
          inputMode="numeric"
          value={groupDigits(digits)}
          onChange={(e) => setDigits(e.target.value.replace(/\D/g, '').slice(0, 9))}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onCancel();
          }}
          placeholder="18 000"
          aria-label={t('envelope.fieldAria')}
          className="font-display w-full min-w-0 bg-transparent text-2xl text-[color:var(--color-foreground)] italic tabular-nums outline-none placeholder:text-[color:var(--color-muted-foreground)] placeholder:not-italic"
        />
        <span className="font-display text-xl text-[color:var(--color-muted-foreground)] italic">
          €
        </span>
      </div>
      <button
        type="submit"
        aria-label={t('envelope.saveAria')}
        className="focus-ring grid h-8 w-8 flex-shrink-0 cursor-pointer place-items-center rounded-md text-[color:var(--color-sage-500)] transition-colors hover:bg-[color:var(--color-surface-elevated)]"
      >
        <Check className="h-4 w-4" strokeWidth={2.2} />
      </button>
    </form>
  );
}

export function BudgetBoard({
  events,
  selectedEventId,
  orgName,
  lines: initialLines,
  envelopeMinor: initialEnvelope,
  canEdit,
  vendors,
}: {
  events: ReadonlyArray<WeddingOption>;
  selectedEventId: string;
  orgName: string;
  lines: BudgetLineRow[];
  envelopeMinor: number;
  canEdit: boolean;
  /** Annuaire prestataires de l'org (pour le combobox de la ligne budget). */
  vendors: ReadonlyArray<{ name: string; category?: string }>;
}) {
  const router = useRouter();
  const t = useTranslations('Pro.budgetBoard');
  const fmtEur = useEurFormat();
  const fmtDate = useDateFormat();
  const errLabel = useErrorLabel();
  const catLabel = useCategoryLabel();
  const selectedEvent = events.find((e) => e._id === selectedEventId) ?? events[0];
  const coupleLabel = selectedEvent
    ? `${selectedEvent.partnerA}${selectedEvent.partnerB ? ` & ${selectedEvent.partnerB}` : ''}`
    : t('coupleFallback');
  const [lines, setLines] = useState<BudgetLineRow[]>(initialLines);
  const [envelopeMinor, setEnvelope] = useState(initialEnvelope);
  const [envEditing, setEnvEditing] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<BudgetLineRow | null>(null);
  const [presetCategory, setPresetCategory] = useState<string>('Lieu');
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  /** Lignes dont l'historique de paiements est déplié. */
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  /** Ligne ciblée par le dialogue « enregistrer un paiement » (null = fermé). */
  const [payingLine, setPayingLine] = useState<BudgetLineRow | null>(null);
  /** Mode du dialogue paiement : encaisser (manuel) ou demander un lien en ligne. */
  const [payMode, setPayMode] = useState<'manual' | 'online'>('manual');
  /** Montant partagé entre les deux modes du dialogue paiement. */
  const [payAmount, setPayAmount] = useState('');
  /** Lien généré (mode en ligne) à copier/partager. */
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const now = nowMs();
  const summary = summarizeBudget(lines);
  const groups = groupByCategory(lines);
  const paidPct =
    summary.plannedMinor > 0
      ? Math.min(100, Math.round((summary.paidMinor / summary.plannedMinor) * 100))
      : 0;
  const envState = envelopeState(summary.plannedMinor, envelopeMinor);
  // On garde `budgetAlerts` pour décider QUELLES alertes afficher (kind/tone) ;
  // titres et corps sont (re)traduits côté UI à partir des données dérivées.
  const overrunCount = lines.filter((l) => l.paidMinor > l.plannedMinor).length;
  const overdueCount = lines.filter(
    (l) => l.dueDate != null && l.dueDate < now && l.paidMinor < l.plannedMinor,
  ).length;
  const alerts = budgetAlerts(lines, summary, envelopeMinor, now).map((a) => {
    const body =
      a.kind === 'envelope'
        ? t('alerts.envelope.body', { amount: fmtEur(summary.plannedMinor - envelopeMinor) })
        : a.kind === 'overrun'
          ? t('alerts.overrun.body', { count: overrunCount })
          : t('alerts.overdue.body', { count: overdueCount });
    return {
      kind: a.kind,
      tone: a.tone,
      title: t(`alerts.${a.kind}.title` as const),
      body,
    };
  });
  const donut = donutSegments(groups);

  function saveEnvelope(eur: string) {
    const minor = parseEurToMinor(eur) ?? 0;
    setEnvelope(minor);
    setEnvEditing(false);
    startTransition(async () => {
      await setBudgetEnvelopeAction(selectedEventId, eur);
      router.refresh();
    });
  }

  function openCreate(category: string) {
    setEditing(null);
    setPresetCategory(category);
    setFormError(null);
    setDrawerOpen(true);
  }
  function openEdit(line: BudgetLineRow) {
    setEditing(line);
    setFormError(null);
    setDrawerOpen(true);
  }

  function rowFromForm(fd: FormData, base: BudgetLineRow | null): BudgetLineRow {
    const get = (k: string) => {
      const v = fd.get(k);
      return typeof v === 'string' && v.trim() ? v.trim() : undefined;
    };
    const due = get('dueDate');
    const nowT = Date.now();
    return {
      _id: base?._id ?? `tmp_${nowT}`,
      category: get('category') ?? 'Divers',
      label: get('label') ?? '',
      vendorName: get('vendorName'),
      plannedMinor: parseEurToMinor(get('plannedEur')) ?? 0,
      // `paidMinor` est dérivé des paiements ; on conserve l'existant en édition.
      paidMinor: base?.paidMinor ?? 0,
      dueDate: due ? Date.parse(due) || undefined : undefined,
      createdAt: base?.createdAt ?? nowT,
      updatedAt: nowT,
      payments: base?.payments ?? [],
    };
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const optimistic = rowFromForm(fd, editing);
    setFormError(null);
    startTransition(async () => {
      const res = editing
        ? await updateBudgetLineAction(editing._id, fd)
        : await createBudgetLineAction(selectedEventId, fd);
      if (!res.ok) {
        setFormError(errLabel(res.error));
        return;
      }
      if (editing) {
        setLines((prev) => prev.map((l) => (l._id === editing._id ? { ...optimistic } : l)));
      } else {
        setLines((prev) => [...prev, { ...optimistic, _id: res.id ?? optimistic._id }]);
      }
      setDrawerOpen(false);
      setEditing(null);
      router.refresh();
    });
  }

  function onRemove(line: BudgetLineRow) {
    if (!confirm(t('confirmRemoveLine', { label: line.label }))) return;
    setLines((prev) => prev.filter((l) => l._id !== line._id));
    startTransition(async () => {
      const res = await removeBudgetLineAction(line._id);
      if (!res.ok) router.refresh();
    });
  }

  function toggleExpanded(lineId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(lineId)) next.delete(lineId);
      else next.add(lineId);
      return next;
    });
  }

  /** Ouvre le dialogue paiement pour une ligne (montant pré-rempli au reste dû). */
  function openPayment(line: BudgetLineRow) {
    setFormError(null);
    setPayMode('manual');
    setPayAmount(String(Math.max(0, line.plannedMinor - line.paidMinor) / 100));
    setGeneratedLink(null);
    setCopied(false);
    setPayingLine(line);
  }

  /** Génère un lien de paiement en ligne (Stripe) pour le montant saisi. */
  function onGenerateLink() {
    if (!payingLine) return;
    const lineId = payingLine._id;
    setFormError(null);
    startTransition(async () => {
      const res = await createBudgetPaymentLinkAction(lineId, payAmount);
      if (!res.ok) {
        setFormError(errLabel(res.error));
        return;
      }
      setGeneratedLink(res.url);
      const amount = parseEurToMinor(payAmount) ?? 0;
      const newPayment: BudgetPaymentRow = {
        _id: res.paymentId,
        amountMinor: amount,
        method: 'online',
        status: 'pending',
        paidAt: Date.now(),
        proofUrl: null,
        provider: 'stripe',
        checkoutUrl: res.url,
        createdAt: Date.now(),
      };
      setLines((prev) =>
        prev.map((l) => (l._id === lineId ? { ...l, payments: [newPayment, ...l.payments] } : l)),
      );
      setExpanded((prev) => new Set(prev).add(lineId));
      router.refresh();
    });
  }

  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard indisponible — l'utilisateur peut copier manuellement le champ.
    }
  }

  /**
   * Enregistre un paiement reçu (montant + moyen + date + justificatif optionnel).
   * Le `paidMinor` de la ligne est recalculé côté serveur ; on `router.refresh()`
   * pour récupérer le registre à jour (URL de justificatif incluse).
   */
  function onSubmitPayment(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!payingLine) return;
    const fd = new FormData(e.currentTarget);
    const lineId = payingLine._id;
    setFormError(null);
    startTransition(async () => {
      const res = await addBudgetPaymentAction(lineId, fd);
      if (!res.ok) {
        setFormError(errLabel(res.error));
        return;
      }
      // Mise à jour optimiste : le composant garde son état local (les props
      // rafraîchies ne sont pas réappliquées). L'URL du justificatif n'est
      // résolue qu'au prochain rechargement complet — `router.refresh()` la
      // récupère côté serveur pour la navigation suivante.
      const amount = parseEurToMinor(String(fd.get('amountEur') ?? '')) ?? 0;
      const method = ((fd.get('method') as string) || 'transfer') as PaymentMethod;
      const noteRaw = (fd.get('note') as string | null)?.trim();
      const paidAtRaw = fd.get('paidAt') as string | null;
      const paidAt = paidAtRaw ? Date.parse(paidAtRaw) || Date.now() : Date.now();
      const proof = fd.get('proof');
      const proofFileName = proof instanceof File && proof.size > 0 ? proof.name : undefined;
      const newPayment: BudgetPaymentRow = {
        _id: res.id ?? `tmp_${Date.now()}`,
        amountMinor: amount,
        method,
        status: 'succeeded',
        paidAt,
        note: noteRaw || undefined,
        proofFileName,
        proofUrl: null,
        createdAt: Date.now(),
      };
      setLines((prev) =>
        prev.map((l) =>
          l._id === lineId
            ? { ...l, paidMinor: l.paidMinor + amount, payments: [newPayment, ...l.payments] }
            : l,
        ),
      );
      setPayingLine(null);
      setExpanded((prev) => new Set(prev).add(lineId));
      router.refresh();
    });
  }

  function onRemovePayment(line: BudgetLineRow, payment: BudgetPaymentRow) {
    if (!confirm(t('confirmRemovePayment', { amount: fmtEur(payment.amountMinor) }))) return;
    setLines((prev) =>
      prev.map((l) =>
        l._id === line._id
          ? {
              ...l,
              payments: l.payments.filter((p) => p._id !== payment._id),
              paidMinor: Math.max(
                0,
                l.paidMinor - (payment.status === 'succeeded' ? payment.amountMinor : 0),
              ),
            }
          : l,
      ),
    );
    startTransition(async () => {
      const res = await removeBudgetPaymentAction(payment._id);
      router.refresh();
      if (!res.ok) setFormError(errLabel(res.error));
    });
  }

  return (
    <div className="container-page flex flex-col gap-6 py-8 sm:py-10">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-col gap-2.5">
          <span className="font-mono text-[10px] tracking-[0.32em] text-[color:var(--color-muted-foreground)] uppercase">
            {t('eyebrow', { org: orgName })}
            {!canEdit ? t('readOnlySuffix') : ''}
          </span>
          <h1 className="sr-only">{t('srTitle', { couple: coupleLabel })}</h1>
          <WeddingSelect
            events={events}
            value={selectedEventId}
            label=""
            showVenue
            onChange={(id) => router.push(`/pro/budget?event=${id}` as Route)}
          />
        </div>

        <div className="flex flex-shrink-0 items-center gap-2.5">
          <BudgetExportMenu lines={lines} coupleLabel={coupleLabel} now={now} />
          {canEdit ? (
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={() => openCreate('Lieu')}
              data-testid="header-new-line"
            >
              <Plus className="h-4 w-4" strokeWidth={2.2} aria-hidden />
              {t('addLine')}
            </Button>
          ) : null}
        </div>
      </header>

      {/* KPIs */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="flex flex-col gap-2 rounded-2xl border border-[color:var(--color-blush-400)]/40 bg-[color:var(--color-surface)] p-4">
          <span className="flex items-center justify-between font-mono text-[9px] tracking-[0.18em] text-[color:var(--color-muted-foreground)] uppercase">
            <span className="flex items-center gap-1.5">
              <Scale
                className="h-3 w-3 text-[color:var(--color-blush-300)]"
                strokeWidth={1.9}
                aria-hidden
              />
              {t('kpi.envelope')}
            </span>
            {canEdit && !envEditing ? (
              <button
                type="button"
                onClick={() => setEnvEditing(true)}
                aria-label={t('envelope.editAria')}
                title={t('envelope.editAria')}
                className="focus-ring cursor-pointer text-[color:var(--color-muted-foreground)] transition-colors hover:text-[color:var(--color-foreground)]"
              >
                <Pencil className="h-3 w-3" strokeWidth={1.9} />
              </button>
            ) : null}
          </span>
          {envEditing ? (
            <EnvelopeEditor
              initialMinor={envelopeMinor}
              onSave={saveEnvelope}
              onCancel={() => setEnvEditing(false)}
            />
          ) : (
            <span className="font-display text-2xl text-[color:var(--color-foreground)] italic tabular-nums">
              {envelopeMinor > 0 ? fmtEur(envelopeMinor) : '—'}
            </span>
          )}
        </div>
        <Kpi
          Icon={PieChart}
          label={t('kpi.planned')}
          value={fmtEur(summary.plannedMinor)}
          tone={envState === 'over' ? 'danger' : 'default'}
          sub={
            envState === 'over'
              ? t('kpi.plannedOverSub', { amount: fmtEur(summary.plannedMinor - envelopeMinor) })
              : t('kpi.plannedSub', { posts: groups.length, lines: summary.lineCount })
          }
        />
        <Kpi
          Icon={Banknote}
          label={t('kpi.paid')}
          value={fmtEur(summary.paidMinor)}
          sub={t('kpi.paidSub', { pct: paidPct })}
        />
        <Kpi
          Icon={Wallet}
          label={t('kpi.remaining')}
          value={fmtEur(summary.remainingMinor)}
          tone={summary.remainingMinor < 0 ? 'danger' : 'default'}
          sub={t('kpi.remainingSub', { lines: summary.lineCount })}
        />
      </section>

      {/* Barre de santé */}
      {summary.plannedMinor > 0 ? (
        <div className="flex flex-col gap-2 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[color:var(--color-muted-foreground)]">
              {t('health.progress')}
            </span>
            <span className="font-mono text-[color:var(--color-foreground)] tabular-nums">
              {t('health.progressStat', {
                pct: paidPct,
                paid: fmtEur(summary.paidMinor),
                planned: fmtEur(summary.plannedMinor),
              })}
            </span>
          </div>
          <div className="relative h-2 w-full overflow-hidden rounded-full bg-[color:var(--color-surface-elevated)]">
            <span
              className="block h-full rounded-full"
              style={{
                width: `${paidPct}%`,
                background: summary.overPaid ? 'var(--color-danger)' : 'var(--color-blush-400)',
              }}
            />
            {envelopeMinor > 0 ? (
              <span
                className="absolute top-0 h-full w-px bg-[color:var(--color-gold-500)]"
                style={{ left: `${Math.min(100, (envelopeMinor / summary.plannedMinor) * 100)}%` }}
                aria-hidden
              />
            ) : null}
          </div>
          {envelopeMinor > 0 ? (
            <div className="flex items-center justify-between font-mono text-[10px]">
              <span
                style={{
                  color:
                    envState === 'over'
                      ? 'var(--color-danger)'
                      : envState === 'near'
                        ? 'var(--color-warning)'
                        : 'var(--color-sage-500)',
                }}
              >
                {t(`envelopeState.${envState}` as const)}
              </span>
              <span className="text-[color:var(--color-muted-foreground)]">
                {t('health.envelopeAmount', { amount: fmtEur(envelopeMinor) })}
              </span>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Alertes */}
      {alerts.length ? (
        <div className="flex flex-col gap-2">
          {alerts.map((a) => (
            <div
              key={a.kind}
              className="flex items-start gap-2.5 rounded-2xl border px-4 py-3 text-sm"
              style={
                a.tone === 'danger'
                  ? {
                      borderColor: 'var(--color-danger)',
                      background: 'oklch(28% 0.06 25)',
                      color: 'oklch(85% 0.08 25)',
                    }
                  : {
                      borderColor: 'var(--color-warning)',
                      background: 'oklch(28% 0.04 85)',
                      color: 'oklch(86% 0.07 85)',
                    }
              }
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" strokeWidth={2} aria-hidden />
              <span className="flex flex-col">
                <b>{a.title}</b>
                <span className="opacity-90">{a.body}</span>
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {/* Graphiques */}
      {summary.plannedMinor > 0 ? (
        <section className="grid gap-3 lg:grid-cols-2">
          <DonutCard segments={donut} totalMinor={summary.plannedMinor} />
          <BarsCard groups={groups} />
        </section>
      ) : null}

      {!canEdit ? (
        <p className="font-mono text-[10px] tracking-[0.12em] text-[color:var(--color-muted-foreground)] uppercase">
          {t('readOnlyNote')}
        </p>
      ) : null}

      {/* Catégories */}
      {lines.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-3xl border border-dashed border-[color:var(--color-border-strong)] bg-[color:var(--color-surface)]/40 px-8 py-14 text-center">
          <p className="max-w-sm text-sm text-[color:var(--color-muted-foreground)]">
            {t('empty.text')} {canEdit ? t('empty.cta') : ''}
          </p>
          {canEdit ? (
            <Button type="button" variant="primary" size="md" onClick={() => openCreate('Lieu')}>
              <Plus className="h-4 w-4" strokeWidth={2.2} aria-hidden />
              {t('addLine')}
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map((g) => (
            <section
              key={g.category}
              className="overflow-hidden rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)]"
            >
              <div className="flex items-center justify-between border-b border-[color:var(--color-border)] px-4 py-3">
                <h2 className="font-display text-base text-[color:var(--color-foreground)] italic">
                  {catLabel(g.category)}
                </h2>
                <span className="font-mono text-[11px] text-[color:var(--color-muted-foreground)] tabular-nums">
                  {fmtEur(g.paidMinor)} / {fmtEur(g.plannedMinor)}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-[color:var(--color-border)] text-left font-mono text-[9px] tracking-[0.16em] text-[color:var(--color-muted-foreground)] uppercase">
                      <th scope="col" className="px-4 py-2 font-medium">
                        {t('cols.item')}
                      </th>
                      <th scope="col" className="px-4 py-2 text-right font-medium">
                        {t('cols.planned')}
                      </th>
                      <th scope="col" className="px-4 py-2 text-right font-medium">
                        {t('cols.paid')}
                      </th>
                      <th scope="col" className="px-4 py-2 text-right font-medium">
                        {t('cols.remaining')}
                      </th>
                      <th scope="col" className="px-4 py-2 font-medium">
                        {t('cols.dueDate')}
                      </th>
                      <th scope="col" className="px-4 py-2 font-medium">
                        {t('cols.status')}
                      </th>
                      <th scope="col" className="px-4 py-2 text-right font-medium">
                        <span className="sr-only">{t('cols.actions')}</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.items.map((l) => {
                      const st = lineStatus(l, now);
                      const pill = STATUS_PILL_TONE[st];
                      const isOpen = expanded.has(l._id);
                      const payCount = l.payments.length;
                      return (
                        <Fragment key={l._id}>
                          <tr
                            className="border-b border-[color:var(--color-border)] last:border-0 data-[open=true]:border-0"
                            data-open={isOpen}
                          >
                            <td className="px-4 py-2.5">
                              <span className="flex items-center gap-1.5">
                                {payCount > 0 ? (
                                  <button
                                    type="button"
                                    onClick={() => toggleExpanded(l._id)}
                                    aria-label={
                                      isOpen
                                        ? t('row.hidePaymentsAria', { label: l.label })
                                        : t('row.showPaymentsAria', { label: l.label })
                                    }
                                    aria-expanded={isOpen}
                                    className="focus-ring -ml-1 inline-flex flex-shrink-0 items-center gap-0.5 rounded-md px-1 py-0.5 font-mono text-[10px] text-[color:var(--color-muted-foreground)] transition-colors hover:text-[color:var(--color-foreground)]"
                                  >
                                    <ChevronDown
                                      className={cn(
                                        'h-3 w-3 transition-transform',
                                        isOpen && 'rotate-180',
                                      )}
                                      strokeWidth={2}
                                      aria-hidden
                                    />
                                    {payCount}
                                  </button>
                                ) : null}
                                <span className="text-[color:var(--color-foreground)]">
                                  {l.label}
                                </span>
                              </span>
                              {l.vendorName ? (
                                <span className="ml-2 text-xs text-[color:var(--color-muted-foreground)]">
                                  · {l.vendorName}
                                </span>
                              ) : null}
                            </td>
                            <td className="px-4 py-2.5 text-right font-mono text-xs text-[color:var(--color-muted-foreground)] tabular-nums">
                              {fmtEur(l.plannedMinor)}
                            </td>
                            <td className="px-4 py-2.5 text-right font-mono text-xs text-[color:var(--color-foreground)] tabular-nums">
                              {fmtEur(l.paidMinor)}
                            </td>
                            <td className="px-4 py-2.5 text-right font-mono text-xs text-[color:var(--color-muted-foreground)] tabular-nums">
                              {fmtEur(l.plannedMinor - l.paidMinor)}
                            </td>
                            <td className="px-4 py-2.5 font-mono text-[11px] text-[color:var(--color-muted-foreground)]">
                              {fmtDate(l.dueDate)}
                            </td>
                            <td className="px-4 py-2.5">
                              <span
                                className="inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[9px] tracking-[0.12em] uppercase"
                                style={{ background: pill.bg, color: pill.fg }}
                              >
                                {t(`status.${st}` as const)}
                              </span>
                            </td>
                            <td className="px-4 py-2.5">
                              {canEdit ? (
                                <div className="flex items-center justify-end gap-1">
                                  {l.paidMinor < l.plannedMinor ? (
                                    <button
                                      type="button"
                                      onClick={() => openPayment(l)}
                                      aria-label={t('row.recordPaymentAria', { label: l.label })}
                                      title={t('row.recordPaymentTitle')}
                                      className="focus-ring inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-medium text-[color:var(--color-muted-foreground)] transition-colors hover:bg-[color:var(--color-surface-elevated)] hover:text-[color:var(--color-sage-500)]"
                                    >
                                      <Banknote className="h-3.5 w-3.5" strokeWidth={2} />
                                      {t('row.payment')}
                                    </button>
                                  ) : null}
                                  <button
                                    type="button"
                                    onClick={() => openEdit(l)}
                                    aria-label={t('row.editAria', { label: l.label })}
                                    className="focus-ring rounded-md p-1.5 text-[color:var(--color-muted-foreground)] hover:bg-[color:var(--color-surface-elevated)] hover:text-[color:var(--color-foreground)]"
                                  >
                                    <Pencil className="h-3.5 w-3.5" strokeWidth={1.85} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onRemove(l)}
                                    aria-label={t('row.removeAria', { label: l.label })}
                                    className="focus-ring rounded-md p-1.5 text-[color:var(--color-muted-foreground)] hover:bg-[color:var(--color-surface-elevated)] hover:text-[color:var(--color-danger)]"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" strokeWidth={1.85} />
                                  </button>
                                </div>
                              ) : null}
                            </td>
                          </tr>
                          {isOpen ? (
                            <tr className="border-b border-[color:var(--color-border)] last:border-0">
                              <td
                                colSpan={7}
                                className="bg-[color:var(--color-surface-elevated)]/40 px-4 pt-1 pb-3"
                              >
                                <PaymentHistory
                                  line={l}
                                  canEdit={canEdit}
                                  onRemovePayment={onRemovePayment}
                                />
                              </td>
                            </tr>
                          ) : null}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {canEdit ? (
                <button
                  type="button"
                  onClick={() => openCreate(g.category)}
                  className="focus-ring flex w-full items-center gap-2 border-t border-[color:var(--color-border)] px-4 py-2.5 text-left text-xs text-[color:var(--color-muted-foreground)] transition-colors hover:bg-[color:var(--color-surface-elevated)] hover:text-[color:var(--color-foreground)]"
                >
                  <Plus className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                  {t('addLineInCategory', { category: catLabel(g.category) })}
                </button>
              ) : null}
            </section>
          ))}
          {canEdit ? (
            <div>
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={() => openCreate('Lieu')}
                data-testid="new-budget-line"
              >
                <Plus className="h-4 w-4" strokeWidth={2.2} aria-hidden />
                {t('newLine')}
              </Button>
            </div>
          ) : null}
        </div>
      )}

      <Dialog open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? t('lineDialog.editTitle') : t('lineDialog.createTitle')}
            </DialogTitle>
          </DialogHeader>
          <form
            key={editing?._id ?? `new-${presetCategory}`}
            onSubmit={onSubmit}
            className="flex flex-col gap-4 pb-2"
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5 sm:col-span-2">
                <span className="text-xs font-medium text-[color:var(--color-muted-foreground)]">
                  {t('lineDialog.labelLabel')}
                </span>
                <Input
                  name="label"
                  required
                  defaultValue={editing?.label ?? ''}
                  placeholder={t('lineDialog.labelPlaceholder')}
                />
              </label>
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-[color:var(--color-muted-foreground)]">
                  {t('lineDialog.categoryLabel')}
                </span>
                <Select name="category" defaultValue={editing?.category ?? presetCategory}>
                  <SelectTrigger aria-label={t('lineDialog.categoryLabel')}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BUDGET_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {catLabel(c)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-[color:var(--color-muted-foreground)]">
                  {t('lineDialog.vendorLabel')}
                </span>
                <VendorPicker
                  vendors={vendors}
                  defaultValue={editing?.vendorName}
                  category={editing?.category ?? presetCategory}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-[color:var(--color-muted-foreground)]">
                  {t('lineDialog.plannedLabel')}
                </span>
                <Input
                  name="plannedEur"
                  inputMode="decimal"
                  defaultValue={editing ? String(editing.plannedMinor / 100) : ''}
                  placeholder="5000"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-[color:var(--color-muted-foreground)]">
                  {t('lineDialog.dueDateLabel')}
                </span>
                <Input name="dueDate" type="date" defaultValue={toDateInput(editing?.dueDate)} />
              </label>
              {editing ? (
                <p className="text-xs text-[color:var(--color-muted-foreground)] sm:col-span-2">
                  {t('lineDialog.paidNotePrefix')}{' '}
                  <b className="text-[color:var(--color-foreground)]">
                    {fmtEur(editing.paidMinor)}
                  </b>{' '}
                  {t('lineDialog.paidNoteSuffix')}
                </p>
              ) : null}
            </div>

            {formError ? (
              <p role="alert" className="text-sm text-[color:var(--color-danger)]">
                {formError}
              </p>
            ) : null}

            <div className="mt-1 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className={cn(buttonVariants({ variant: 'ghost', size: 'md' }))}
              >
                <X className="h-4 w-4" strokeWidth={2} aria-hidden />
                {t('actions.cancel')}
              </button>
              <Button type="submit" variant="primary" size="md" disabled={pending}>
                {pending ? t('actions.saving') : editing ? t('actions.save') : t('actions.add')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={payingLine !== null} onOpenChange={(o) => !o && setPayingLine(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('paymentDialog.title')}</DialogTitle>
          </DialogHeader>
          {payingLine ? (
            <div className="flex flex-col gap-4 pb-2">
              <p className="text-xs text-[color:var(--color-muted-foreground)]">
                {payingLine.label}
                {payingLine.vendorName ? ` · ${payingLine.vendorName}` : ''}{' '}
                {t('paymentDialog.remainingPrefix')}{' '}
                <b className="text-[color:var(--color-foreground)]">
                  {fmtEur(Math.max(0, payingLine.plannedMinor - payingLine.paidMinor))}
                </b>
              </p>

              {/* Segmented : encaisser un paiement reçu vs envoyer un lien en ligne. */}
              <div className="flex gap-1 rounded-lg border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface-elevated)] p-1">
                {(
                  [
                    { k: 'manual', label: t('paymentDialog.modeManual'), Icon: Banknote },
                    { k: 'online', label: t('paymentDialog.modeOnline'), Icon: Link2 },
                  ] as const
                ).map(({ k, label, Icon }) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => {
                      setPayMode(k);
                      setFormError(null);
                      setGeneratedLink(null);
                    }}
                    aria-pressed={payMode === k}
                    className={cn(
                      'flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
                      payMode === k
                        ? 'bg-[color:var(--color-surface)] text-[color:var(--color-foreground)] shadow-sm'
                        : 'text-[color:var(--color-muted-foreground)] hover:text-[color:var(--color-foreground)]',
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                    {label}
                  </button>
                ))}
              </div>

              {payMode === 'manual' ? (
                <form
                  key={`m-${payingLine._id}`}
                  onSubmit={onSubmitPayment}
                  className="flex flex-col gap-4"
                >
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="flex flex-col gap-1.5">
                      <span className="text-xs font-medium text-[color:var(--color-muted-foreground)]">
                        {t('paymentDialog.amountReceivedLabel')}
                      </span>
                      <Input
                        name="amountEur"
                        inputMode="decimal"
                        required
                        autoFocus
                        value={payAmount}
                        onChange={(e) => setPayAmount(e.target.value)}
                        placeholder="1000"
                      />
                    </label>
                    <div className="flex flex-col gap-1.5">
                      <span className="text-xs font-medium text-[color:var(--color-muted-foreground)]">
                        {t('paymentDialog.methodLabel')}
                      </span>
                      <Select name="method" defaultValue="transfer">
                        <SelectTrigger aria-label={t('paymentDialog.methodSelectAria')}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PAYMENT_METHODS.filter((m) => m !== 'online').map((m) => (
                            <SelectItem key={m} value={m}>
                              {t(`methods.${m}` as const)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <label className="flex flex-col gap-1.5">
                      <span className="text-xs font-medium text-[color:var(--color-muted-foreground)]">
                        {t('paymentDialog.dateLabel')}
                      </span>
                      <Input name="paidAt" type="date" defaultValue={toDateInput(now)} />
                    </label>
                    <label className="flex flex-col gap-1.5">
                      <span className="text-xs font-medium text-[color:var(--color-muted-foreground)]">
                        {t('paymentDialog.noteLabel')}
                      </span>
                      <Input name="note" placeholder={t('paymentDialog.notePlaceholder')} />
                    </label>
                    <label className="flex flex-col gap-1.5 sm:col-span-2">
                      <span className="flex items-center gap-1.5 text-xs font-medium text-[color:var(--color-muted-foreground)]">
                        <Paperclip className="h-3 w-3" strokeWidth={2} aria-hidden />
                        {t('paymentDialog.proofLabel')}
                      </span>
                      <input
                        name="proof"
                        type="file"
                        accept="application/pdf,image/jpeg,image/png,image/webp"
                        className="block w-full cursor-pointer rounded-lg border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface-elevated)] text-xs text-[color:var(--color-muted-foreground)] file:mr-3 file:cursor-pointer file:border-0 file:bg-[color:var(--color-surface)] file:px-3 file:py-2 file:text-xs file:font-medium file:text-[color:var(--color-foreground)]"
                      />
                      <span className="font-mono text-[10px] text-[color:var(--color-muted-foreground)]">
                        {t('paymentDialog.proofHint')}
                      </span>
                    </label>
                  </div>

                  {formError ? (
                    <p role="alert" className="text-sm text-[color:var(--color-danger)]">
                      {formError}
                    </p>
                  ) : null}

                  <div className="mt-1 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setPayingLine(null)}
                      className={cn(buttonVariants({ variant: 'ghost', size: 'md' }))}
                    >
                      <X className="h-4 w-4" strokeWidth={2} aria-hidden />
                      {t('actions.cancel')}
                    </button>
                    <Button type="submit" variant="primary" size="md" disabled={pending}>
                      <Banknote className="h-4 w-4" strokeWidth={2} aria-hidden />
                      {pending ? t('actions.saving') : t('paymentDialog.savePayment')}
                    </Button>
                  </div>
                </form>
              ) : generatedLink ? (
                <div className="flex flex-col gap-3">
                  <div className="flex items-start gap-2.5 rounded-xl border border-[color:var(--color-sage-500)]/40 bg-[color:var(--color-surface-elevated)] px-3.5 py-3 text-sm">
                    <Check
                      className="mt-0.5 h-4 w-4 flex-shrink-0 text-[color:var(--color-sage-500)]"
                      strokeWidth={2.2}
                      aria-hidden
                    />
                    <span className="flex flex-col gap-0.5">
                      <b className="text-[color:var(--color-foreground)]">
                        {t('paymentDialog.linkReadyTitle')}
                      </b>
                      <span className="text-[color:var(--color-muted-foreground)]">
                        {t('paymentDialog.linkReadyBody')}
                      </span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      readOnly
                      value={generatedLink}
                      aria-label={t('paymentDialog.linkFieldAria')}
                      onFocus={(e) => e.currentTarget.select()}
                      className="h-10 w-full flex-1 rounded-lg border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface-elevated)] px-3 font-mono text-xs text-[color:var(--color-foreground)] outline-none"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="md"
                      onClick={() => copyLink(generatedLink)}
                    >
                      {copied ? (
                        <Check className="h-4 w-4" strokeWidth={2.2} aria-hidden />
                      ) : (
                        <Copy className="h-4 w-4" strokeWidth={2} aria-hidden />
                      )}
                      {copied ? t('actions.copied') : t('actions.copy')}
                    </Button>
                  </div>
                  <div className="mt-1 flex items-center justify-end">
                    <Button
                      type="button"
                      variant="primary"
                      size="md"
                      onClick={() => setPayingLine(null)}
                    >
                      {t('actions.done')}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-[color:var(--color-muted-foreground)]">
                      {t('paymentDialog.amountToRequestLabel')}
                    </span>
                    <Input
                      inputMode="decimal"
                      autoFocus
                      value={payAmount}
                      onChange={(e) => setPayAmount(e.target.value)}
                      placeholder="1000"
                    />
                  </label>
                  <p className="flex items-start gap-2 text-xs text-[color:var(--color-muted-foreground)]">
                    <Link2
                      className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-[color:var(--color-blush-300)]"
                      strokeWidth={1.9}
                      aria-hidden
                    />
                    {t('paymentDialog.onlineHint')}
                  </p>

                  {formError ? (
                    <p role="alert" className="text-sm text-[color:var(--color-danger)]">
                      {formError}
                    </p>
                  ) : null}

                  <div className="mt-1 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setPayingLine(null)}
                      className={cn(buttonVariants({ variant: 'ghost', size: 'md' }))}
                    >
                      <X className="h-4 w-4" strokeWidth={2} aria-hidden />
                      {t('actions.cancel')}
                    </button>
                    <Button
                      type="button"
                      variant="primary"
                      size="md"
                      disabled={pending}
                      onClick={onGenerateLink}
                    >
                      <Link2 className="h-4 w-4" strokeWidth={2} aria-hidden />
                      {pending ? t('paymentDialog.generating') : t('paymentDialog.generateLink')}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Bouton « copier le lien » avec retour visuel, autonome (état local). */
function CopyLinkButton({ url }: { url: string }) {
  const t = useTranslations('Pro.budgetBoard');
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
          setDone(true);
          setTimeout(() => setDone(false), 1800);
        } catch {
          // clipboard indisponible
        }
      }}
      className="focus-ring inline-flex items-center gap-1 rounded-md text-[color:var(--color-blush-300)] hover:underline"
    >
      {done ? (
        <Check className="h-3 w-3" strokeWidth={2.2} aria-hidden />
      ) : (
        <Copy className="h-3 w-3" strokeWidth={1.9} aria-hidden />
      )}
      {done ? t('payHistory.linkCopied') : t('payHistory.copyLink')}
    </button>
  );
}

/** Liste des paiements d'une ligne (registre déplié) : date · moyen · montant · statut · justificatif. */
function PaymentHistory({
  line,
  canEdit,
  onRemovePayment,
}: {
  line: BudgetLineRow;
  canEdit: boolean;
  onRemovePayment: (line: BudgetLineRow, payment: BudgetPaymentRow) => void;
}) {
  const t = useTranslations('Pro.budgetBoard');
  const fmtEur = useEurFormat();
  const fmtDate = useDateFormat();
  if (line.payments.length === 0) {
    return (
      <p className="py-1 text-xs text-[color:var(--color-muted-foreground)]">
        {t('payHistory.empty')}
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-1">
      {line.payments.map((p) => {
        const pendingOnline = p.status === 'pending';
        const failed = p.status === 'failed';
        return (
          <li
            key={p._id}
            className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg px-2 py-1.5 text-xs hover:bg-[color:var(--color-surface)]"
          >
            <span className="font-mono text-[11px] text-[color:var(--color-muted-foreground)] tabular-nums">
              {fmtDate(p.paidAt)}
            </span>
            <span className="text-[color:var(--color-foreground)]">
              {t(`methods.${p.method}` as const)}
            </span>
            <span
              className={cn(
                'font-mono font-medium tabular-nums',
                failed
                  ? 'text-[color:var(--color-muted-foreground)] line-through'
                  : 'text-[color:var(--color-foreground)]',
              )}
            >
              {fmtEur(p.amountMinor)}
            </span>
            {pendingOnline ? (
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[9px] tracking-[0.1em] uppercase"
                style={{ background: 'oklch(30% 0.05 85)', color: 'oklch(88% 0.08 85)' }}
              >
                <Clock className="h-2.5 w-2.5" strokeWidth={2} aria-hidden />
                {t('payHistory.pending')}
              </span>
            ) : null}
            {failed ? (
              <span
                className="inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[9px] tracking-[0.1em] uppercase"
                style={{ background: 'oklch(28% 0.06 25)', color: 'oklch(85% 0.08 25)' }}
              >
                {t('payHistory.failed')}
              </span>
            ) : null}
            {p.note ? (
              <span className="text-[color:var(--color-muted-foreground)]">· {p.note}</span>
            ) : null}
            {pendingOnline && p.checkoutUrl ? (
              <CopyLinkButton url={p.checkoutUrl} />
            ) : p.proofUrl ? (
              <a
                href={p.proofUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="focus-ring inline-flex items-center gap-1 rounded-md text-[color:var(--color-blush-300)] hover:underline"
              >
                <Receipt className="h-3 w-3" strokeWidth={1.9} aria-hidden />
                {p.method === 'online'
                  ? t('payHistory.receipt')
                  : (p.proofFileName ?? t('payHistory.proof'))}
                <ExternalLink className="h-2.5 w-2.5" strokeWidth={2} aria-hidden />
              </a>
            ) : !pendingOnline && !failed ? (
              <span className="font-mono text-[10px] text-[color:var(--color-muted-foreground)]/70">
                {t('payHistory.noProof')}
              </span>
            ) : null}
            {canEdit ? (
              <button
                type="button"
                onClick={() => onRemovePayment(line, p)}
                aria-label={
                  pendingOnline
                    ? t('payHistory.cancelLinkAria', { amount: fmtEur(p.amountMinor) })
                    : t('payHistory.removePaymentAria', { amount: fmtEur(p.amountMinor) })
                }
                title={
                  pendingOnline ? t('payHistory.cancelLinkTitle') : t('payHistory.removeTitle')
                }
                className="focus-ring ml-auto rounded-md p-1 text-[color:var(--color-muted-foreground)] transition-colors hover:bg-[color:var(--color-surface)] hover:text-[color:var(--color-danger)]"
              >
                <Trash2 className="h-3 w-3" strokeWidth={1.85} />
              </button>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

/** Échappe une cellule CSV (séparateur `;`, compatible Excel FR). */
function csvCell(value: string): string {
  return /[";\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function slugify(s: string): string {
  return (
    s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase() || 'mariage'
  );
}

/**
 * Export du budget en CSV (généré côté client depuis les lignes courantes).
 * Bouton + menu déroulant (un format pour l'instant) — pas d'appel serveur.
 */
function BudgetExportMenu({
  lines,
  coupleLabel,
  now,
}: {
  lines: BudgetLineRow[];
  coupleLabel: string;
  now: number;
}) {
  const t = useTranslations('Pro.budgetBoard');
  const catLabel = useCategoryLabel();
  const fmtDate = useDateFormat();
  const [open, setOpen] = useState(false);
  const disabled = lines.length === 0;

  function downloadCsv() {
    const header = [
      t('csv.category'),
      t('csv.item'),
      t('csv.vendor'),
      t('csv.planned'),
      t('csv.paid'),
      t('csv.remaining'),
      t('csv.dueDate'),
      t('csv.status'),
    ];
    const rows = lines.map((l) => [
      catLabel(l.category),
      l.label,
      l.vendorName ?? '',
      String(Math.round(l.plannedMinor / 100)),
      String(Math.round(l.paidMinor / 100)),
      String(Math.round((l.plannedMinor - l.paidMinor) / 100)),
      l.dueDate ? fmtDate(l.dueDate) : '',
      t(`status.${lineStatus(l, now)}` as const),
    ]);
    const csv = [header, ...rows].map((r) => r.map(csvCell).join(';')).join('\r\n');
    // BOM pour qu'Excel détecte l'UTF-8 (accents).
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `budget-${slugify(coupleLabel)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setOpen(false);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        title={disabled ? t('export.disabledTitle') : t('export.title')}
        className={cn(
          buttonVariants({ variant: 'outline', size: 'md' }),
          'gap-2',
          disabled && 'cursor-not-allowed opacity-50',
        )}
        data-testid="budget-export"
      >
        <Download className="h-4 w-4" strokeWidth={1.9} aria-hidden />
        {t('export.button')}
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 text-[color:var(--color-muted-foreground)] transition-transform',
            open && 'rotate-180',
          )}
          strokeWidth={2}
          aria-hidden
        />
      </button>
      {open && !disabled ? (
        <>
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            className="fixed inset-0 z-30 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div
            role="menu"
            className="absolute top-full right-0 z-40 mt-1.5 w-48 overflow-hidden rounded-xl border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface)] p-1 shadow-[var(--shadow-popover)]"
          >
            <button
              type="button"
              role="menuitem"
              onClick={downloadCsv}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-[color:var(--color-foreground)] transition-colors hover:bg-[color:var(--color-surface-elevated)]"
            >
              <Download
                className="h-3.5 w-3.5 flex-shrink-0 text-[color:var(--color-blush-300)]"
                strokeWidth={1.9}
                aria-hidden
              />
              <span className="flex flex-1 flex-col">
                {t('export.csv')}
                <span className="font-mono text-[10px] text-[color:var(--color-muted-foreground)]">
                  {t('export.lineCount', { count: lines.length })}
                </span>
              </span>
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}

function Kpi({
  Icon,
  label,
  value,
  sub,
  tone = 'default',
}: {
  Icon: typeof PieChart;
  label: string;
  value: string;
  sub?: string;
  tone?: 'default' | 'danger';
}) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4">
      <span className="flex items-center gap-1.5 font-mono text-[9px] tracking-[0.18em] text-[color:var(--color-muted-foreground)] uppercase">
        <Icon className="h-3 w-3" strokeWidth={1.9} aria-hidden />
        {label}
      </span>
      <span
        className="font-display text-2xl italic tabular-nums"
        style={{ color: tone === 'danger' ? 'var(--color-danger)' : 'var(--color-foreground)' }}
      >
        {value}
      </span>
      {sub ? (
        <span className="font-mono text-[10px] text-[color:var(--color-muted-foreground)]">
          {sub}
        </span>
      ) : null}
    </div>
  );
}

function DonutCard({
  segments,
  totalMinor,
}: {
  segments: ReturnType<typeof donutSegments>;
  totalMinor: number;
}) {
  const t = useTranslations('Pro.budgetBoard');
  const fmtEur = useEurFormat();
  const catLabel = useCategoryLabel();
  const R = 80;
  const C = 2 * Math.PI * R;
  const arcs = segments.map((s, i) => {
    const len = s.pct * C;
    const off = -segments.slice(0, i).reduce((a, x) => a + x.pct * C, 0);
    return { category: s.category, hue: s.hue, dash: len, off };
  });
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6">
      <span className="font-mono text-[10px] tracking-[0.16em] text-[color:var(--color-muted-foreground)] uppercase">
        {t('donut.title')}
      </span>
      <div className="flex flex-col items-center gap-6 sm:flex-row">
        <div className="relative h-56 w-56 flex-shrink-0">
          <svg viewBox="0 0 200 200" className="h-56 w-56 -rotate-90">
            <circle
              cx="100"
              cy="100"
              r={R}
              fill="none"
              stroke="var(--color-surface-elevated)"
              strokeWidth={30}
            />
            {arcs.map((a) => (
              <circle
                key={a.category}
                cx="100"
                cy="100"
                r={R}
                fill="none"
                stroke={`oklch(66% 0.14 ${a.hue})`}
                strokeWidth={30}
                strokeDasharray={`${a.dash} ${C - a.dash}`}
                strokeDashoffset={a.off}
                strokeLinecap="butt"
              />
            ))}
          </svg>
          <span className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="font-display text-2xl text-[color:var(--color-foreground)] italic tabular-nums">
              {fmtEur(totalMinor)}
            </span>
            <span className="font-mono text-[9px] tracking-[0.14em] text-[color:var(--color-muted-foreground)] uppercase">
              {t('postsCount', { count: segments.length })}
            </span>
          </span>
        </div>
        <div className="flex w-full min-w-0 flex-1 flex-col gap-2.5">
          {segments.map((s) => (
            <div key={s.category} className="flex items-center gap-2.5 text-sm">
              <span
                className="h-3 w-3 flex-shrink-0 rounded-full"
                style={{ background: `oklch(66% 0.14 ${s.hue})` }}
                aria-hidden
              />
              <span className="min-w-0 flex-1 truncate text-[color:var(--color-ink-700)]">
                {catLabel(s.category)}
              </span>
              <span className="font-mono font-medium text-[color:var(--color-foreground)] tabular-nums">
                {t('percent', { pct: Math.round(s.pct * 100) })}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function BarsCard({ groups }: { groups: CategoryGroup<BudgetLineRow>[] }) {
  const t = useTranslations('Pro.budgetBoard');
  const fmtEur = useEurFormat();
  const catLabel = useCategoryLabel();
  const max = Math.max(1, ...groups.map((g) => g.plannedMinor));
  const sorted = [...groups].sort((a, b) => b.plannedMinor - a.plannedMinor);
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-[10px] tracking-[0.16em] text-[color:var(--color-muted-foreground)] uppercase">
          {t('bars.title')}
        </span>
        <span className="flex items-center gap-3 font-mono text-[10px] text-[color:var(--color-muted-foreground)]">
          <span className="inline-flex items-center gap-1.5">
            <span
              className="h-2 w-3 rounded-sm bg-[color:var(--color-border-strong)]"
              aria-hidden
            />
            {t('bars.legendPlanned')}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-3 rounded-sm bg-[color:var(--color-blush-400)]" aria-hidden />
            {t('bars.legendPaid')}
          </span>
        </span>
      </div>
      <div className="flex flex-col gap-3.5">
        {sorted.map((g) => {
          const over = g.paidMinor > g.plannedMinor;
          const pct = g.plannedMinor > 0 ? Math.round((g.paidMinor / g.plannedMinor) * 100) : 0;
          return (
            <div key={g.category} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-[color:var(--color-ink-700)]">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: `oklch(66% 0.14 ${categoryHue(g.category)})` }}
                    aria-hidden
                  />
                  {catLabel(g.category)}
                </span>
                <span className="font-mono text-[11px] tabular-nums">
                  <b
                    className={
                      over
                        ? 'text-[color:var(--color-danger)]'
                        : 'text-[color:var(--color-foreground)]'
                    }
                  >
                    {fmtEur(g.paidMinor)}
                  </b>
                  <span className="text-[color:var(--color-muted-foreground)]">
                    {' '}
                    / {fmtEur(g.plannedMinor)} · {t('percent', { pct })}
                  </span>
                </span>
              </div>
              <div className="relative h-3 w-full overflow-hidden rounded-full bg-[color:var(--color-surface-elevated)]">
                <span
                  className="absolute top-0 left-0 h-full rounded-full bg-[color:var(--color-border-strong)]"
                  style={{ width: `${(g.plannedMinor / max) * 100}%` }}
                  aria-hidden
                />
                <span
                  className="absolute top-0 left-0 h-full rounded-full"
                  style={{
                    width: `${(Math.min(g.paidMinor, max) / max) * 100}%`,
                    background: over ? 'var(--color-danger)' : 'var(--color-blush-400)',
                  }}
                  aria-hidden
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
