'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Lock, Download, Repeat, TriangleAlert, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  transferOwnershipAction,
  deleteOrganizationAction,
} from '@/app/[locale]/(app)/pro/actions';

interface MemberOpt {
  userId?: string;
  fullName?: string;
  email?: string;
  role: 'owner' | 'admin' | 'planner' | 'viewer';
  status: 'pending' | 'active' | 'revoked';
}

export function DangerZone({
  orgName,
  isOwner,
  members,
}: {
  orgName: string;
  isOwner: boolean;
  members: MemberOpt[];
}) {
  const t = useTranslations('Pro.main');
  const router = useRouter();
  const [transferOpen, setTransferOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [exported, setExported] = useState(false);

  if (!isOwner) {
    return (
      <section className="flex items-center gap-3 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5">
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-[color:var(--color-surface-elevated)] text-[color:var(--color-muted-foreground)]">
          <Lock className="h-4 w-4" strokeWidth={1.85} aria-hidden />
        </span>
        <p className="text-sm text-[color:var(--color-muted-foreground)]">
          {t.rich('danger.ownerOnly', {
            b: (chunks) => <b className="text-[color:var(--color-foreground)]">{chunks}</b>,
          })}
        </p>
      </section>
    );
  }

  const transferable = members.filter(
    (m) => m.status === 'active' && m.role !== 'owner' && m.userId,
  );

  return (
    <section className="flex flex-col divide-y divide-[color:var(--color-border)] overflow-hidden rounded-2xl border border-[color:var(--color-danger)]/40 bg-[color:var(--color-surface)]">
      <DangerRow
        title={t('danger.exportTitle')}
        desc={t('danger.exportDesc')}
        action={
          <Button type="button" variant="outline" size="md" onClick={() => setExported(true)}>
            <Download className="h-4 w-4" strokeWidth={1.8} aria-hidden />
            {exported ? t('danger.exportPreparing') : t('danger.exportCta')}
          </Button>
        }
      />
      <DangerRow
        title={t('danger.transferTitle')}
        desc={t('danger.transferDesc')}
        action={
          <Button
            type="button"
            variant="outline"
            size="md"
            onClick={() => setTransferOpen(true)}
            disabled={transferable.length === 0}
            data-testid="open-transfer"
          >
            <Repeat className="h-4 w-4" strokeWidth={1.8} aria-hidden />
            {t('danger.transferCta')}
          </Button>
        }
      />
      <DangerRow
        title={t('danger.deleteTitle')}
        desc={t('danger.deleteDesc')}
        action={
          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            data-testid="open-delete-org"
            className="focus-ring inline-flex items-center gap-2 rounded-lg bg-[color:var(--color-danger)] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            <TriangleAlert className="h-4 w-4" strokeWidth={1.9} aria-hidden />
            {t('danger.deleteCta')}
          </button>
        }
      />

      {transferOpen ? (
        <TransferDialog
          members={transferable}
          onClose={() => setTransferOpen(false)}
          onDone={() => {
            setTransferOpen(false);
            router.refresh();
          }}
        />
      ) : null}
      {deleteOpen ? (
        <ConfirmDeleteDialog
          orgName={orgName}
          onClose={() => setDeleteOpen(false)}
          onDeleted={() => router.push('/pro/onboarding')}
        />
      ) : null}
    </section>
  );
}

function DangerRow({
  title,
  desc,
  action,
}: {
  title: string;
  desc: string;
  action: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-0.5">
        <b className="text-sm text-[color:var(--color-foreground)]">{title}</b>
        <span className="text-xs text-[color:var(--color-muted-foreground)]">{desc}</span>
      </div>
      <div className="flex-shrink-0">{action}</div>
    </div>
  );
}

function TransferDialog({
  members,
  onClose,
  onDone,
}: {
  members: MemberOpt[];
  onClose: () => void;
  onDone: () => void;
}) {
  const t = useTranslations('Pro.main');
  const [userId, setUserId] = useState(members[0]?.userId ?? '');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function confirm() {
    if (!userId) return;
    setError(null);
    startTransition(async () => {
      const res = await transferOwnershipAction(userId);
      if (!res.ok) {
        setError(t('danger.transferError'));
        return;
      }
      onDone();
    });
  }

  return (
    <Modal
      label={t('danger.transferTitle')}
      eyebrow={t('danger.sensitiveAction')}
      eyebrowColor="var(--color-warning)"
      title={t('danger.transferTitle')}
      onClose={onClose}
    >
      <p className="text-sm text-[color:var(--color-muted-foreground)]">
        {t.rich('danger.transferModalBody', {
          b: (chunks) => <b className="text-[color:var(--color-foreground)]">{chunks}</b>,
        })}
      </p>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-[color:var(--color-muted-foreground)]">
          {t('danger.newOwnerLabel')}
        </span>
        <Select value={userId} onValueChange={setUserId}>
          <SelectTrigger className="focus-ring h-10 rounded-lg border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface-elevated)] px-3 text-sm text-[color:var(--color-foreground)]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {members.map((m) => (
              <SelectItem key={m.userId} value={m.userId ?? ''}>
                {m.fullName ?? m.email ?? t('danger.memberFallback')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>
      {error ? (
        <p role="alert" className="text-sm text-[color:var(--color-danger)]">
          {error}
        </p>
      ) : null}
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg px-4 py-2 text-sm text-[color:var(--color-muted-foreground)] hover:text-[color:var(--color-foreground)]"
        >
          {t('danger.cancel')}
        </button>
        <Button type="button" variant="primary" size="md" onClick={confirm} disabled={pending}>
          <Repeat className="h-4 w-4" strokeWidth={2} aria-hidden />{' '}
          {pending ? t('danger.transferring') : t('danger.transferCta')}
        </Button>
      </div>
    </Modal>
  );
}

function ConfirmDeleteDialog({
  orgName,
  onClose,
  onDeleted,
}: {
  orgName: string;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const t = useTranslations('Pro.main');
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const ok = value.trim() === orgName;

  function confirm() {
    if (!ok) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteOrganizationAction(orgName);
      if (!res.ok) {
        setError(
          res.error === 'NAME_MISMATCH' ? t('danger.deleteNameMismatch') : t('danger.deleteError'),
        );
        return;
      }
      onDeleted();
    });
  }

  return (
    <Modal
      label={t('danger.deleteTitle')}
      eyebrow={t('danger.irreversibleAction')}
      eyebrowColor="var(--color-danger)"
      title={t('danger.deleteModalTitle', { orgName })}
      onClose={onClose}
      danger
    >
      <p className="text-sm text-[color:var(--color-ink-700)]">
        {t.rich('danger.deleteModalBody', {
          b: (chunks) => <b className="text-[color:var(--color-foreground)]">{chunks}</b>,
        })}
      </p>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-[color:var(--color-muted-foreground)]">
          {t('danger.deleteConfirmLabel', { orgName })}
        </span>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={orgName}
          data-testid="delete-confirm-input"
          className="focus-ring h-10 rounded-lg border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface)] px-3 text-sm text-[color:var(--color-foreground)]"
        />
      </label>
      {error ? (
        <p role="alert" className="text-sm text-[color:var(--color-danger)]">
          {error}
        </p>
      ) : null}
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg px-4 py-2 text-sm text-[color:var(--color-muted-foreground)] hover:text-[color:var(--color-foreground)]"
        >
          {t('danger.cancel')}
        </button>
        <button
          type="button"
          onClick={confirm}
          disabled={!ok || pending}
          data-testid="confirm-delete-org"
          className="focus-ring inline-flex items-center gap-2 rounded-lg bg-[color:var(--color-danger)] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <TriangleAlert className="h-4 w-4" strokeWidth={1.9} aria-hidden />{' '}
          {pending ? t('danger.deleting') : t('danger.deletePermanently')}
        </button>
      </div>
    </Modal>
  );
}

function Modal({
  label,
  eyebrow,
  eyebrowColor,
  title,
  children,
  onClose,
  danger,
}: {
  label: string;
  eyebrow: string;
  eyebrowColor: string;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  danger?: boolean;
}) {
  const t = useTranslations('Pro.main');
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="alertdialog"
      aria-modal="true"
      aria-label={label}
    >
      <button
        type="button"
        aria-label={t('danger.close')}
        onClick={onClose}
        className="absolute inset-0 bg-black/55 backdrop-blur-sm"
      />
      <div
        className={cn(
          'relative flex w-full max-w-md flex-col gap-4 rounded-2xl border bg-[color:var(--color-surface)] p-6 shadow-[var(--shadow-popover)]',
          danger
            ? 'border-[color:var(--color-danger)]/50'
            : 'border-[color:var(--color-border-strong)]',
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <span
              className="font-mono text-[9px] tracking-[0.24em] uppercase"
              style={{ color: eyebrowColor }}
            >
              {eyebrow}
            </span>
            <h3 className="font-display text-xl text-[color:var(--color-foreground)] italic">
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('danger.close')}
            className="text-[color:var(--color-muted-foreground)] hover:text-[color:var(--color-foreground)]"
          >
            <X className="h-5 w-5" strokeWidth={2} aria-hidden />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
