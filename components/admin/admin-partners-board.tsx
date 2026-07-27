'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  adminCreateInfluencerAction,
  adminUpdateInfluencerAction,
  adminGenerateInfluencerCodeAction,
  adminStartInfluencerOnboardingAction,
  adminRefreshInfluencerConnectAction,
  adminPayInfluencerAction,
  type PartnerInfluencer,
  type PartnerCommission,
} from '@/app/[locale]/(app)/admin/actions';

const SOURCE_LABEL: Record<PartnerCommission['source'], string> = {
  payment: 'Forfait couple',
  payg: 'Pay-as-you-go',
  subscription: 'Abonnement pro',
};

const COMMISSION_STATUS: Record<
  PartnerCommission['status'],
  { label: string; variant: 'success' | 'neutral' | 'warning' }
> = {
  pending: { label: 'Due', variant: 'warning' },
  paid: { label: 'Versée', variant: 'success' },
  reversed: { label: 'Annulée', variant: 'neutral' },
};

const PERK_LABEL: Record<PartnerInfluencer['premiumPerk'], string> = {
  none: 'Aucun',
  promised: 'Premium promis',
  granted: 'Premium offert',
};

function formatEur(minor: number): string {
  return `${(minor / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €`;
}

function formatAmount(minor: number, currency: string): string {
  const amount = minor / 100;
  if (currency === 'EUR')
    return `${amount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €`;
  if (currency === 'USD') return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  return `${amount.toLocaleString('fr-FR')} ${currency}`;
}

export function AdminPartnersBoard({
  influencers,
  commissions,
}: {
  influencers: PartnerInfluencer[];
  commissions: PartnerCommission[];
}) {
  const router = useRouter();
  const refresh = () => router.refresh();

  return (
    <div className="flex flex-col gap-8">
      {/* Influenceuses */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-lg italic">Influenceuses partenaires</h2>
            <p className="text-sm text-[color:var(--color-muted-foreground)]">
              Chaque partenaire a un code promo (remise pour sa communauté) et un taux de commission
              sur les ventes réalisées via ce code.
            </p>
          </div>
          <CreateInfluencerDialog onDone={refresh} />
        </div>

        <div className="overflow-x-auto rounded-xl border border-[color:var(--color-border)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[color:var(--color-border)] bg-[color:var(--color-surface)]">
                <Th>Partenaire</Th>
                <Th>Code</Th>
                <Th>Commission</Th>
                <Th>Ventes</Th>
                <Th>Dû</Th>
                <Th>Versé</Th>
                <Th>Versement</Th>
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {influencers.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-8 text-center text-[color:var(--color-muted-foreground)]"
                  >
                    Aucune influenceuse. Ajoutez votre première partenaire pour lui générer un code.
                  </td>
                </tr>
              ) : (
                influencers.map((i) => (
                  <InfluencerRow key={i._id} influencer={i} onDone={refresh} />
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Registre des commissions */}
      <section className="flex flex-col gap-4">
        <div>
          <h2 className="font-display text-lg italic">Commissions</h2>
          <p className="text-sm text-[color:var(--color-muted-foreground)]">
            Une ligne par vente attribuée. Les commissions dues sont versées par partenaire depuis
            le tableau ci-dessus.
          </p>
        </div>

        <div className="overflow-x-auto rounded-xl border border-[color:var(--color-border)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[color:var(--color-border)] bg-[color:var(--color-surface)]">
                <Th>Partenaire</Th>
                <Th>Vente</Th>
                <Th>Montant vente</Th>
                <Th>Taux</Th>
                <Th>Commission</Th>
                <Th>Statut</Th>
                <Th>Date</Th>
              </tr>
            </thead>
            <tbody>
              {commissions.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center text-[color:var(--color-muted-foreground)]"
                  >
                    Aucune commission enregistrée pour le moment.
                  </td>
                </tr>
              ) : (
                commissions.map((c) => <CommissionRow key={c._id} commission={c} />)
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function InfluencerRow({
  influencer: i,
  onDone,
}: {
  influencer: PartnerInfluencer;
  onDone: () => void;
}) {
  return (
    <tr className="border-b border-[color:var(--color-border)] align-top last:border-0 hover:bg-[color:var(--color-surface-elevated)]/50">
      <td className="px-4 py-3">
        <span className="flex flex-col">
          <span className="flex items-center gap-2 font-medium">
            {i.name}
            {i.status === 'paused' ? <Badge variant="neutral">En pause</Badge> : null}
          </span>
          {i.handle ? (
            <span className="font-mono text-xs text-[color:var(--color-muted-foreground)]">
              {i.handle}
            </span>
          ) : null}
          {i.premiumPerk !== 'none' ? (
            <span className="mt-0.5 text-[10px] tracking-wide text-[color:var(--color-muted-foreground)] uppercase">
              {PERK_LABEL[i.premiumPerk]}
            </span>
          ) : null}
        </span>
      </td>
      <td className="px-4 py-3">
        {i.code ? (
          <span className="flex flex-col">
            <span className="font-mono font-medium">{i.code}</span>
            {i.discountPct != null ? (
              <span className="text-xs text-[color:var(--color-muted-foreground)]">
                −{i.discountPct}% communauté
              </span>
            ) : null}
          </span>
        ) : (
          <GenerateCodeDialog influencer={i} onDone={onDone} />
        )}
      </td>
      <td className="px-4 py-3 font-mono">{i.commissionPct}%</td>
      <td className="px-4 py-3 font-mono">{i.salesCount}</td>
      <td className="px-4 py-3 font-mono">
        {i.pendingMinor > 0 ? formatEur(i.pendingMinor) : '—'}
      </td>
      <td className="px-4 py-3 font-mono text-[color:var(--color-muted-foreground)]">
        {i.paidMinor > 0 ? formatEur(i.paidMinor) : '—'}
      </td>
      <td className="px-4 py-3">
        <ConnectCell influencer={i} onDone={onDone} />
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-col items-start gap-1.5">
          <PayButton influencer={i} onDone={onDone} />
          <EditInfluencerDialog influencer={i} onDone={onDone} />
        </div>
      </td>
    </tr>
  );
}

function CommissionRow({ commission: c }: { commission: PartnerCommission }) {
  const locale = useLocale();
  const status = COMMISSION_STATUS[c.status];
  return (
    <tr className="border-b border-[color:var(--color-border)] last:border-0 hover:bg-[color:var(--color-surface-elevated)]/50">
      <td className="px-4 py-3 font-medium">{c.influencerName}</td>
      <td className="px-4 py-3 text-[color:var(--color-muted-foreground)]">
        <span className="flex flex-col">
          <span>{SOURCE_LABEL[c.source]}</span>
          {c.description ? <span className="text-xs">{c.description}</span> : null}
        </span>
      </td>
      <td className="px-4 py-3 font-mono">{formatAmount(c.saleAmountMinor, c.currency)}</td>
      <td className="px-4 py-3 font-mono text-[color:var(--color-muted-foreground)]">
        {c.commissionPct}%
      </td>
      <td className="px-4 py-3 font-mono font-medium">
        {formatAmount(c.commissionMinor, c.currency)}
      </td>
      <td className="px-4 py-3">
        <Badge variant={status.variant}>{status.label}</Badge>
      </td>
      <td className="px-4 py-3 text-[color:var(--color-muted-foreground)]">
        {new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(c.createdAt))}
      </td>
    </tr>
  );
}

function ConnectCell({
  influencer: i,
  onDone,
}: {
  influencer: PartnerInfluencer;
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onboard() {
    setError(null);
    startTransition(async () => {
      const res = await adminStartInfluencerOnboardingAction({ influencerId: i._id });
      if (!res.ok) return setError(res.error);
      window.open(res.url, '_blank', 'noopener,noreferrer');
      onDone();
    });
  }

  function refreshStatus() {
    setError(null);
    startTransition(async () => {
      const res = await adminRefreshInfluencerConnectAction({ influencerId: i._id });
      if (!res.ok) return setError(res.error);
      onDone();
    });
  }

  if (i.connectPayoutsEnabled) {
    return <Badge variant="success">Versements actifs</Badge>;
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        onClick={onboard}
        disabled={pending}
        className="rounded-md px-2 py-1 text-xs font-medium text-[color:var(--color-primary)] transition-colors hover:bg-[color:var(--color-primary)]/10 disabled:opacity-50"
      >
        {pending
          ? '…'
          : i.stripeConnectAccountId
            ? 'Reprendre l’onboarding'
            : 'Configurer le versement'}
      </button>
      {i.stripeConnectAccountId ? (
        <button
          onClick={refreshStatus}
          disabled={pending}
          className="rounded-md px-2 py-1 text-[11px] font-medium text-[color:var(--color-muted-foreground)] transition-colors hover:text-[color:var(--color-foreground)] disabled:opacity-50"
        >
          Rafraîchir le statut
        </button>
      ) : null}
      {error ? <span className="text-[11px] text-[color:var(--color-danger)]">{error}</span> : null}
    </div>
  );
}

function PayButton({
  influencer: i,
  onDone,
}: {
  influencer: PartnerInfluencer;
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const disabled = pending || i.pendingCount === 0 || !i.connectPayoutsEnabled;

  function pay() {
    setError(null);
    startTransition(async () => {
      const res = await adminPayInfluencerAction({ influencerId: i._id });
      if (!res.ok) return setError(res.error);
      onDone();
    });
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button variant="primary" size="sm" type="button" onClick={pay} disabled={disabled}>
        {pending ? '…' : `Verser${i.pendingMinor > 0 ? ' ' + formatEur(i.pendingMinor) : ''}`}
      </Button>
      {error ? <span className="text-[11px] text-[color:var(--color-danger)]">{error}</span> : null}
    </div>
  );
}

function GenerateCodeDialog({
  influencer: i,
  onDone,
}: {
  influencer: PartnerInfluencer;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [discountPct, setDiscountPct] = useState('15');

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await adminGenerateInfluencerCodeAction({
        influencerId: i._id,
        code,
        discountPct: Number(discountPct),
      });
      if (!res.ok) return setError(res.error);
      setOpen(false);
      onDone();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" type="button">
          Générer le code
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Code promo — {i.name}</DialogTitle>
          <DialogDescription>
            Crée un coupon Stripe (remise permanente pour la communauté) et le code lisible saisi au
            paiement. Chaque vente via ce code sera attribuée et commissionnée à {i.commissionPct}%.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <Field label="Code (A-Z, 0-9)">
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              placeholder="Ex. KMWNK15"
              className={`${inputCls} font-mono`}
            />
          </Field>
          <Field label="Remise communauté (%)">
            <input
              type="number"
              min={1}
              max={100}
              value={discountPct}
              onChange={(e) => setDiscountPct(e.target.value)}
              className={inputCls}
            />
          </Field>
        </div>
        {error ? <p className="mt-3 text-sm text-[color:var(--color-danger)]">{error}</p> : null}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" size="sm" type="button" disabled={pending}>
              Annuler
            </Button>
          </DialogClose>
          <Button variant="primary" size="sm" type="button" onClick={submit} disabled={pending}>
            {pending ? 'Création…' : 'Créer le code'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateInfluencerDialog({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [handle, setHandle] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [commissionPct, setCommissionPct] = useState('20');
  const [premiumPerk, setPremiumPerk] = useState<PartnerInfluencer['premiumPerk']>('promised');

  function submit() {
    setError(null);
    if (!name.trim()) return setError('Le nom est requis.');
    startTransition(async () => {
      const res = await adminCreateInfluencerAction({
        name: name.trim(),
        handle: handle.trim() || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        commissionPct: Number(commissionPct),
        premiumPerk,
      });
      if (!res.ok) return setError(res.error);
      setOpen(false);
      setName('');
      setHandle('');
      setEmail('');
      setPhone('');
      onDone();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="primary" size="sm" type="button">
          Ajouter une influenceuse
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nouvelle influenceuse partenaire</DialogTitle>
          <DialogDescription>
            Vous générerez son code promo et configurerez son versement une fois créée.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <Field label="Nom">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex. Camille Martin"
              className={inputCls}
            />
          </Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Pseudo réseau">
              <input
                type="text"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                placeholder="@camille"
                className={inputCls}
              />
            </Field>
            <Field label="Commission (%)">
              <input
                type="number"
                min={0}
                max={100}
                value={commissionPct}
                onChange={(e) => setCommissionPct(e.target.value)}
                className={inputCls}
              />
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Email">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="camille@exemple.fr"
                className={inputCls}
              />
            </Field>
            <Field label="Téléphone">
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+33…"
                className={inputCls}
              />
            </Field>
          </div>
          <Field label="Premium offert (mariage perso)">
            <Select
              value={premiumPerk}
              onValueChange={(v) => setPremiumPerk(v as PartnerInfluencer['premiumPerk'])}
            >
              <SelectTrigger className={inputCls}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Aucun</SelectItem>
                <SelectItem value="promised">Promis</SelectItem>
                <SelectItem value="granted">Déjà offert</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
        {error ? <p className="mt-3 text-sm text-[color:var(--color-danger)]">{error}</p> : null}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" size="sm" type="button" disabled={pending}>
              Annuler
            </Button>
          </DialogClose>
          <Button variant="primary" size="sm" type="button" onClick={submit} disabled={pending}>
            {pending ? 'Création…' : 'Créer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditInfluencerDialog({
  influencer: i,
  onDone,
}: {
  influencer: PartnerInfluencer;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [commissionPct, setCommissionPct] = useState(String(i.commissionPct));
  const [status, setStatus] = useState<PartnerInfluencer['status']>(i.status);
  const [premiumPerk, setPremiumPerk] = useState<PartnerInfluencer['premiumPerk']>(i.premiumPerk);
  const [notes, setNotes] = useState(i.notes ?? '');

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await adminUpdateInfluencerAction({
        influencerId: i._id,
        commissionPct: Number(commissionPct),
        status,
        premiumPerk,
        notes,
      });
      if (!res.ok) return setError(res.error);
      setOpen(false);
      onDone();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="rounded-md px-2 py-1 text-xs font-medium text-[color:var(--color-muted-foreground)] transition-colors hover:text-[color:var(--color-foreground)]">
          Éditer
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Éditer — {i.name}</DialogTitle>
          <DialogDescription>
            Le taux s’applique aux prochaines ventes (les commissions déjà enregistrées gardent leur
            taux).
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Commission (%)">
              <input
                type="number"
                min={0}
                max={100}
                value={commissionPct}
                onChange={(e) => setCommissionPct(e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Statut">
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as PartnerInfluencer['status'])}
              >
                <SelectTrigger className={inputCls}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="paused">En pause</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Premium offert (mariage perso)">
            <Select
              value={premiumPerk}
              onValueChange={(v) => setPremiumPerk(v as PartnerInfluencer['premiumPerk'])}
            >
              <SelectTrigger className={inputCls}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Aucun</SelectItem>
                <SelectItem value="promised">Promis</SelectItem>
                <SelectItem value="granted">Déjà offert</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Notes">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className={inputCls}
            />
          </Field>
        </div>
        {error ? <p className="mt-3 text-sm text-[color:var(--color-danger)]">{error}</p> : null}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" size="sm" type="button" disabled={pending}>
              Annuler
            </Button>
          </DialogClose>
          <Button variant="primary" size="sm" type="button" onClick={submit} disabled={pending}>
            {pending ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const inputCls =
  'w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2 text-sm text-[color:var(--color-foreground)] focus:ring-1 focus:ring-[color:var(--color-border-strong)] focus:outline-none';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-mono text-[10px] tracking-[0.16em] text-[color:var(--color-muted-foreground)] uppercase">
        {label}
      </span>
      {children}
    </label>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-3 text-left font-mono text-[10px] tracking-[0.2em] text-[color:var(--color-muted-foreground)] uppercase">
      {children}
    </th>
  );
}
