'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
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
          placeholder="Rechercher un utilisateur…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2 text-sm text-[color:var(--color-foreground)] placeholder:text-[color:var(--color-muted-foreground)] focus:ring-1 focus:ring-[color:var(--color-border-strong)] focus:outline-none"
        />
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2 text-sm text-[color:var(--color-foreground)]"
        >
          <option value="all">Tous les rôles</option>
          <option value="couple">Couple</option>
          <option value="pro">Pro</option>
          <option value="guest">Invité</option>
          <option value="admin">Admin</option>
        </select>
        <span className="font-mono text-xs text-[color:var(--color-muted-foreground)]">
          {filtered.length} résultat{filtered.length > 1 ? 's' : ''}
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[color:var(--color-border)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[color:var(--color-border)] bg-[color:var(--color-surface)]">
              <Th>Nom</Th>
              <Th>Contact</Th>
              <Th>Rôle</Th>
              <Th>Plan</Th>
              <Th>Inscrit le</Th>
              <Th>Actions</Th>
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
  const { execute: suspend, loading: suspending } = useServerAction(adminSuspendUserAction);
  const { execute: changeRole, loading: changing } = useServerAction(adminChangeUserRoleAction);

  return (
    <tr className="border-b border-[color:var(--color-border)] last:border-0 hover:bg-[color:var(--color-surface-elevated)]/50">
      <td className="px-4 py-3 font-medium">{user.fullName ?? '—'}</td>
      <td className="px-4 py-3 text-[color:var(--color-muted-foreground)]">
        <div className="flex flex-col gap-0.5">
          {user.email ? <span>{user.email}</span> : null}
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
        {new Intl.DateTimeFormat('fr', { dateStyle: 'medium' }).format(new Date(user.createdAt))}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {user.role !== 'admin' && user.role !== 'guest' ? (
            <button
              onClick={() => {
                if (confirm(`Suspendre ${user.fullName ?? user.email ?? user._id} ?`)) {
                  suspend(user._id);
                }
              }}
              disabled={suspending}
              className="rounded-md px-2 py-1 text-xs font-medium text-red-400 transition-colors hover:bg-red-400/10 disabled:opacity-50"
            >
              Suspendre
            </button>
          ) : null}
          {user.role !== 'admin' ? (
            <select
              onChange={(e) => {
                const newRole = e.target.value as User['role'];
                if (confirm(`Changer le rôle en "${newRole}" ?`)) {
                  changeRole(user._id, newRole);
                }
                e.target.value = '';
              }}
              disabled={changing}
              defaultValue=""
              className="rounded-md border border-[color:var(--color-border)] bg-transparent px-2 py-1 text-xs text-[color:var(--color-muted-foreground)]"
            >
              <option value="" disabled>
                Rôle…
              </option>
              <option value="couple">Couple</option>
              <option value="pro">Pro</option>
              <option value="guest">Invité</option>
              <option value="admin">Admin</option>
            </select>
          ) : null}
        </div>
      </td>
    </tr>
  );
}
