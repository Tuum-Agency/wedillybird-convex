'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { inviteMemberAction, revokeMemberAction } from '@/app/[locale]/(app)/pro/actions';

type Role = 'owner' | 'admin' | 'planner' | 'viewer';
type Status = 'pending' | 'active' | 'revoked';

export interface MemberItem {
  _id: string;
  role: Role;
  status: Status;
  fullName?: string;
  phone?: string;
  email?: string;
  invitedAt: number;
  acceptedAt?: number;
}

interface Props {
  organizationId: string;
  canManage: boolean;
  initialMembers: MemberItem[];
}

export function TeamManager({ organizationId, canManage, initialMembers }: Props) {
  const t = useTranslations('Pro');
  const tCommon = useTranslations('Common');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [lastInviteToken, setLastInviteToken] = useState<string | null>(null);

  function onInvite(formData: FormData) {
    setError(null);
    setLastInviteToken(null);
    startTransition(async () => {
      const result = await inviteMemberAction(organizationId, formData);
      if (result.ok) {
        setLastInviteToken(result.inviteToken);
        router.refresh();
        return;
      }
      setError(t(`errors.${result.error.toLowerCase()}` as const));
    });
  }

  function onRevoke(membershipId: string) {
    startTransition(async () => {
      const result = await revokeMemberAction(membershipId);
      if (result.ok) router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {canManage ? (
        <form
          action={onInvite}
          className="flex flex-col gap-3 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5"
          data-testid="invite-form"
        >
          <h2 className="font-display text-lg font-semibold">{t('inviteTitle')}</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="phone">{t('phoneLabel')}</Label>
              <Input id="phone" name="phone" type="tel" placeholder={t('phonePlaceholder')} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">{t('emailLabel')}</Label>
              <Input id="email" name="email" type="email" placeholder={t('emailPlaceholder')} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="role">{t('roleLabel')}</Label>
              <select
                id="role"
                name="role"
                defaultValue="planner"
                className="focus-ring h-10 rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3"
              >
                <option value="admin">{t('roles.admin')}</option>
                <option value="planner">{t('roles.planner')}</option>
                <option value="viewer">{t('roles.viewer')}</option>
              </select>
            </div>
          </div>
          {error ? (
            <p role="alert" className="text-sm text-[color:var(--color-destructive)]">
              {error}
            </p>
          ) : null}
          {lastInviteToken ? (
            <p
              data-testid="invite-success"
              className="rounded-lg border border-[color:var(--color-accent)] bg-[color:var(--color-surface)] p-3 text-sm"
            >
              {t('inviteSuccess')} <code className="font-mono text-xs">{lastInviteToken}</code>
            </p>
          ) : null}
          <div className="flex justify-end">
            <Button type="submit" disabled={pending} data-testid="submit-invite">
              {pending ? tCommon('loading') : t('inviteSubmit')}
            </Button>
          </div>
        </form>
      ) : null}

      <ul className="flex flex-col gap-2" data-testid="member-list">
        {initialMembers.map((m) => (
          <li
            key={m._id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4"
            data-testid="member-row"
            data-status={m.status}
          >
            <div className="flex flex-col gap-1">
              <span className="font-medium">{m.fullName ?? m.phone ?? m.email ?? '—'}</span>
              <span className="text-xs text-[color:var(--color-muted)]">
                {m.phone && m.fullName ? m.phone : null}
                {m.email && m.fullName ? ` · ${m.email}` : null}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={m.status === 'active' ? 'accent' : 'primary'}>
                {t(`statuses.${m.status}` as const)}
              </Badge>
              <Badge variant="neutral">{t(`roles.${m.role}` as const)}</Badge>
              {canManage && m.role !== 'owner' && m.status !== 'revoked' ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onRevoke(m._id)}
                  disabled={pending}
                  data-testid="revoke-member"
                >
                  {t('revoke')}
                </Button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
