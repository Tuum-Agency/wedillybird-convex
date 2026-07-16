'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useServerAction } from '@/components/admin/use-admin-action';
import {
  adminSuspendUserAction,
  adminChangeUserRoleAction,
} from '@/app/[locale]/(app)/admin/actions';

type User = {
  _id: string;
  phone?: string;
  email?: string;
  fullName?: string;
  role: 'couple' | 'pro' | 'guest' | 'admin';
  planTier?: string;
  createdAt: number;
  lastSeenAt?: number;
};

const ROLE_VARIANT: Record<string, 'neutral' | 'primary' | 'accent' | 'warning' | 'destructive'> = {
  couple: 'primary',
  pro: 'accent',
  guest: 'neutral',
  admin: 'warning',
};

export function AdminUsersTable({ users }: { users: User[] }) {
  const t = useTranslations('Admin');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  const filtered = users.filter((u) => {
    const matchSearch =
      !search ||
      u.fullName?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase()) ||
      u.phone?.includes(search);
    const matchRole = roleFilter === 'all' || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder={t('users.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-10 w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 text-sm text-[color:var(--color-foreground)] placeholder:text-[color:var(--color-muted-foreground)] focus:ring-1 focus:ring-[color:var(--color-border-strong)] focus:outline-none sm:w-72"
        />
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] text-sm text-[color:var(--color-foreground)] sm:w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('users.roleFilterAll')}</SelectItem>
            <SelectItem value="couple">{t('roles.couple')}</SelectItem>
            <SelectItem value="pro">{t('roles.pro')}</SelectItem>
            <SelectItem value="guest">{t('roles.guest')}</SelectItem>
            <SelectItem value="admin">{t('roles.admin')}</SelectItem>
          </SelectContent>
        </Select>
        <span className="font-mono text-xs text-[color:var(--color-muted-foreground)]">
          {t('users.count', { count: filtered.length })}
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[color:var(--color-border)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[color:var(--color-border)] bg-[color:var(--color-surface)]">
              <Th>{t('users.colName')}</Th>
              <Th>{t('users.colContact')}</Th>
              <Th>{t('users.colRole')}</Th>
              <Th>{t('users.colPlan')}</Th>
              <Th>{t('users.colRegisteredAt')}</Th>
              <Th>{t('common.colActions')}</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <UserRow key={u._id} user={u} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-3 text-left font-mono text-[10px] tracking-[0.2em] text-[color:var(--color-muted-foreground)] uppercase">
      {children}
    </th>
  );
}

function UserRow({ user }: { user: User }) {
  const t = useTranslations('Admin');
  const locale = useLocale();
  const { execute: suspend, loading: suspending } = useServerAction(adminSuspendUserAction);
  const { execute: changeRole, loading: changing } = useServerAction(adminChangeUserRoleAction);

  return (
    <tr className="border-b border-[color:var(--color-border)] last:border-0 hover:bg-[color:var(--color-surface-elevated)]/50">
      <td className="px-4 py-3 font-medium">{user.fullName ?? '—'}</td>
      <td className="px-4 py-3 text-[color:var(--color-muted-foreground)]">
        <div className="flex min-w-0 flex-col gap-0.5">
          {user.email ? <span className="break-all">{user.email}</span> : null}
          {user.phone ? <span className="font-mono text-xs">{user.phone}</span> : null}
        </div>
      </td>
      <td className="px-4 py-3">
        <Badge variant={ROLE_VARIANT[user.role] ?? 'neutral'}>{user.role}</Badge>
      </td>
      <td className="px-4 py-3 text-[color:var(--color-muted-foreground)]">
        {user.planTier ?? '—'}
      </td>
      <td className="px-4 py-3 text-[color:var(--color-muted-foreground)]">
        {new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(user.createdAt))}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {user.role !== 'admin' && user.role !== 'guest' ? (
            <button
              onClick={() => {
                if (
                  confirm(
                    t('users.confirmSuspend', {
                      name: user.fullName ?? user.email ?? user._id,
                    }),
                  )
                ) {
                  suspend(user._id);
                }
              }}
              disabled={suspending}
              className="rounded-md px-2 py-1 text-xs font-medium text-red-400 transition-colors hover:bg-red-400/10 disabled:opacity-50"
            >
              {t('users.suspend')}
            </button>
          ) : null}
          {user.role !== 'admin' ? (
            <Select
              value=""
              disabled={changing}
              onValueChange={(v) => {
                const newRole = v as User['role'];
                if (confirm(t('users.confirmChangeRole', { role: newRole }))) {
                  changeRole(user._id, newRole);
                }
              }}
            >
              <SelectTrigger className="rounded-md border border-[color:var(--color-border)] bg-transparent px-2 py-1 text-xs text-[color:var(--color-muted-foreground)]">
                <SelectValue placeholder={t('users.rolePlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="couple">{t('roles.couple')}</SelectItem>
                <SelectItem value="pro">{t('roles.pro')}</SelectItem>
                <SelectItem value="guest">{t('roles.guest')}</SelectItem>
                <SelectItem value="admin">{t('roles.admin')}</SelectItem>
              </SelectContent>
            </Select>
          ) : null}
        </div>
      </td>
    </tr>
  );
}
