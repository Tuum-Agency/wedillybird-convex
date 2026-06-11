'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  ShieldCheck,
  Crown,
  PenLine,
  Eye,
  Mail,
  Phone,
  Lock,
  MoreVertical,
  Send,
  X,
  Ban,
  UserCheck,
  Check,
  Plus,
  Copy,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/cn';
import { formatDateFr } from '@/lib/pro/format';
import {
  ASSIGNABLE_ROLES,
  ROLE_LABEL,
  ROLE_SUB,
  ROLE_DESC,
  STATUS_LABEL,
  CAPABILITIES,
  seatUsage,
  seatLimitForTier,
  memberInitials,
  memberHue,
  type Role,
  type MemberStatus,
} from '@/lib/pro/team';
import {
  inviteMemberAction,
  revokeMemberAction,
  changeMemberRoleAction,
  cancelInviteAction,
  resendInviteAction,
  reactivateMemberAction,
} from '@/app/[locale]/(app)/pro/actions';

export interface MemberItem {
  _id: string;
  userId?: string;
  role: Role;
  status: MemberStatus;
  fullName?: string;
  phone?: string;
  email?: string;
  invitedAt: number;
  acceptedAt?: number;
}

interface Props {
  organizationId: string;
  canManage: boolean;
  currentUserId: string;
  myRole: Role;
  tier: 'starter' | 'business' | 'agency' | null;
  initialMembers: MemberItem[];
}

const ROLE_ICON: Record<Role, typeof Crown> = {
  owner: Crown,
  admin: ShieldCheck,
  planner: PenLine,
  viewer: Eye,
};
const ROLE_TINT: Record<Role, { bg: string; fg: string }> = {
  owner: { bg: 'oklch(28% 0.05 85)', fg: 'oklch(85% 0.09 85)' },
  admin: { bg: 'oklch(28% 0.05 22)', fg: 'oklch(85% 0.07 22)' },
  planner: { bg: 'oklch(28% 0.05 265)', fg: 'oklch(83% 0.08 265)' },
  viewer: { bg: 'var(--color-surface-elevated)', fg: 'var(--color-muted-foreground)' },
};
const STATUS_TINT: Record<MemberStatus, { bg: string; fg: string }> = {
  active: { bg: 'oklch(26% 0.04 145)', fg: 'oklch(82% 0.07 145)' },
  pending: { bg: 'oklch(28% 0.022 78)', fg: 'oklch(85% 0.04 78)' },
  revoked: { bg: 'var(--color-surface-elevated)', fg: 'var(--color-muted-foreground)' },
};

const ERR: Record<string, string> = {
  SEAT_LIMIT_REACHED: 'Limite de sièges atteinte pour votre forfait.',
  ALREADY_MEMBER: 'Cette personne est déjà membre.',
  NO_CONTACT: 'Renseignez un e-mail ou un numéro WhatsApp.',
  INVALID_PHONE: 'Numéro invalide (avec l’indicatif, ex. +33…).',
  FORBIDDEN: 'Réservé au propriétaire et aux admins.',
};
const errLabel = (c: string) => ERR[c] ?? 'Une erreur est survenue.';

function Avatar({ name, size = 34 }: { name: string; size?: number }) {
  const hue = memberHue(name);
  return (
    <span
      aria-hidden
      className="flex flex-shrink-0 items-center justify-center rounded-full font-mono"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.36),
        background: `oklch(40% 0.06 ${hue})`,
        color: `oklch(93% 0.04 ${hue})`,
      }}
    >
      {memberInitials(name)}
    </span>
  );
}

function RolePill({ role }: { role: Role }) {
  const t = ROLE_TINT[role];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[10px] tracking-[0.1em] uppercase"
      style={{ background: t.bg, color: t.fg }}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" aria-hidden />
      {ROLE_LABEL[role]}
    </span>
  );
}
function StatusPill({ status }: { status: MemberStatus }) {
  const t = STATUS_TINT[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium"
      style={{ background: t.bg, color: t.fg }}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" aria-hidden />
      {STATUS_LABEL[status]}
    </span>
  );
}

export function TeamManager({
  organizationId,
  canManage,
  currentUserId,
  myRole,
  tier,
  initialMembers,
}: Props) {
  const router = useRouter();
  const [members, setMembers] = useState<MemberItem[]>(initialMembers);
  const [tab, setTab] = useState<'members' | 'roles'>('members');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [pending, start] = useTransition();

  const seat = useMemo(() => seatUsage(members, seatLimitForTier(tier)), [members, tier]);
  const activeMembers = members.filter((m) => m.status !== 'pending');
  const pendingInvites = members.filter((m) => m.status === 'pending');
  const activeCount = members.filter((m) => m.status === 'active').length;

  function refresh() {
    start(() => router.refresh());
  }
  function run(fn: () => Promise<{ ok: boolean; error?: string }>, optimistic?: () => void) {
    optimistic?.();
    start(async () => {
      const r = await fn();
      if (!r.ok && r.error) alert(errLabel(r.error));
      refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Tabs */}
      <div
        role="tablist"
        aria-label="Sections équipe"
        className="flex gap-1 border-b border-[color:var(--color-border)]"
      >
        {(
          [
            ['members', `Membres`],
            ['roles', 'Rôles & permissions'],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={cn(
              'relative -mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors',
              tab === k
                ? 'border-[color:var(--color-blush-400)] text-[color:var(--color-foreground)]'
                : 'border-transparent text-[color:var(--color-muted-foreground)] hover:text-[color:var(--color-foreground)]',
            )}
          >
            {label}
            {k === 'members' ? (
              <span className="ml-1.5 font-mono text-[10px] text-[color:var(--color-muted-foreground)]">
                {activeCount}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {tab === 'members' ? (
        <>
          {!canManage ? (
            <div className="flex items-start gap-2.5 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-3 text-xs text-[color:var(--color-muted-foreground)]">
              <Lock className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" strokeWidth={1.85} aria-hidden />
              Vous consultez l’équipe en tant que {ROLE_LABEL[myRole]}. L’invitation, le changement
              de rôle et la révocation sont réservés au propriétaire et aux admins.
            </div>
          ) : null}

          {/* Seat meter */}
          <div className="flex flex-col gap-3 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-2">
              <span className="font-mono text-[10px] tracking-[0.18em] text-[color:var(--color-muted-foreground)] uppercase">
                {members.length} membre{members.length > 1 ? 's' : ''} · {activeCount} actif
                {activeCount > 1 ? 's' : ''}
                {seat.limit != null
                  ? ` · ${seat.free} siège${(seat.free ?? 0) > 1 ? 's' : ''} libre${(seat.free ?? 0) > 1 ? 's' : ''}`
                  : ' · sièges illimités'}
              </span>
              {seat.limit != null ? (
                <div className="flex gap-1">
                  {Array.from({ length: seat.limit }).map((_, i) => (
                    <span
                      key={i}
                      className={cn(
                        'h-1.5 w-8 rounded-full',
                        i < seat.used
                          ? 'bg-[color:var(--color-blush-400)]'
                          : 'bg-[color:var(--color-surface-elevated)]',
                      )}
                      aria-hidden
                    />
                  ))}
                </div>
              ) : null}
            </div>
            {canManage ? (
              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={() => setInviteOpen((o) => !o)}
                data-testid="open-invite"
              >
                <Plus className="h-4 w-4" strokeWidth={2.2} aria-hidden />
                Inviter un membre
              </Button>
            ) : null}
          </div>

          {/* Invite form */}
          {canManage && inviteOpen ? (
            <InviteCard
              organizationId={organizationId}
              onClose={() => setInviteOpen(false)}
              onInvited={refresh}
            />
          ) : null}

          {/* Pending invitations */}
          {pendingInvites.length ? (
            <section className="flex flex-col gap-2">
              <h2 className="font-mono text-[10px] tracking-[0.16em] text-[color:var(--color-muted-foreground)] uppercase">
                Invitations en attente · {pendingInvites.length}
              </h2>
              <div className="flex flex-col gap-2">
                {pendingInvites.map((m) => (
                  <div
                    key={m._id}
                    className="flex flex-wrap items-center gap-3 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] py-3 pr-3 pl-4"
                    style={{ borderLeft: '3px solid oklch(78% 0.075 78)' }}
                  >
                    <span className="flex flex-shrink-0 items-center gap-1.5 text-xs text-[color:var(--color-muted-foreground)]">
                      {m.email ? (
                        <Mail className="h-3.5 w-3.5" strokeWidth={1.85} />
                      ) : (
                        <Phone className="h-3.5 w-3.5" strokeWidth={1.85} />
                      )}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm text-[color:var(--color-foreground)]">
                        {m.email ?? m.phone ?? 'Invitation'}
                      </span>
                      <span className="font-mono text-[10px] text-[color:var(--color-muted-foreground)]">
                        Invité·e le {formatDateFr(m.invitedAt)}
                      </span>
                    </span>
                    <RolePill role={m.role} />
                    {canManage ? (
                      <span className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => run(() => resendInviteAction(m._id))}
                          disabled={pending}
                          className="focus-ring inline-flex items-center gap-1 rounded-lg border border-[color:var(--color-border)] px-2 py-1 text-[11px] text-[color:var(--color-muted-foreground)] hover:text-[color:var(--color-foreground)]"
                        >
                          <Send className="h-3 w-3" strokeWidth={1.9} />
                          Renvoyer
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm('Annuler cette invitation ?'))
                              run(
                                () => cancelInviteAction(m._id),
                                () => setMembers((p) => p.filter((x) => x._id !== m._id)),
                              );
                          }}
                          disabled={pending}
                          className="focus-ring inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-[color:var(--color-danger)] hover:opacity-80"
                        >
                          <X className="h-3 w-3" strokeWidth={2} />
                          Annuler
                        </button>
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {/* Members table */}
          <div className="overflow-x-auto rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)]">
            <table
              className="w-full min-w-[760px] border-collapse text-sm"
              data-testid="member-list"
            >
              <thead>
                <tr className="border-b border-[color:var(--color-border)] text-left font-mono text-[9px] tracking-[0.18em] text-[color:var(--color-muted-foreground)] uppercase">
                  <th className="px-4 py-3 font-medium">Membre</th>
                  <th className="px-4 py-3 font-medium">Coordonnées</th>
                  <th className="px-4 py-3 font-medium">Rôle</th>
                  <th className="px-4 py-3 font-medium">Statut</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {activeMembers.map((m) => {
                  const name = m.fullName ?? m.phone ?? m.email ?? 'Membre';
                  const isYou = m.userId === currentUserId;
                  const isOwner = m.role === 'owner';
                  return (
                    <tr
                      key={m._id}
                      data-testid="member-row"
                      data-status={m.status}
                      className={cn(
                        'border-b border-[color:var(--color-border)] last:border-0',
                        m.status === 'revoked' && 'opacity-60',
                      )}
                    >
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-2.5">
                          <Avatar name={name} />
                          <span className="flex min-w-0 flex-col">
                            <span className="flex items-center gap-1.5 font-medium text-[color:var(--color-foreground)]">
                              {name}
                              {isYou ? (
                                <span className="rounded-full bg-[color:var(--color-blush-500)]/15 px-1.5 py-0.5 font-mono text-[9px] tracking-[0.1em] text-[color:var(--color-blush-300)] uppercase">
                                  Vous
                                </span>
                              ) : null}
                            </span>
                            <span className="text-xs text-[color:var(--color-muted-foreground)]">
                              {ROLE_SUB[m.role]}
                            </span>
                          </span>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-[color:var(--color-muted-foreground)]">
                        <span className="flex flex-col gap-0.5">
                          {m.email ? (
                            <span className="inline-flex items-center gap-1.5">
                              <Mail className="h-3 w-3" strokeWidth={1.8} />
                              {m.email}
                            </span>
                          ) : null}
                          {m.phone ? (
                            <span className="inline-flex items-center gap-1.5 font-mono">
                              <Phone className="h-3 w-3" strokeWidth={1.8} />
                              {m.phone}
                            </span>
                          ) : null}
                          {!m.email && !m.phone ? '—' : null}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {canManage && !isOwner && m.status === 'active' ? (
                          <RoleSelect
                            role={m.role}
                            onChange={(r) =>
                              run(
                                () => changeMemberRoleAction(m._id, r),
                                () =>
                                  setMembers((p) =>
                                    p.map((x) => (x._id === m._id ? { ...x, role: r } : x)),
                                  ),
                              )
                            }
                          />
                        ) : (
                          <span className="inline-flex items-center gap-1.5">
                            <RolePill role={m.role} />
                            {isOwner ? (
                              <Lock
                                className="h-3 w-3 text-[color:var(--color-muted-foreground)]"
                                strokeWidth={1.9}
                                aria-label="Le propriétaire détient l’organisation"
                              />
                            ) : null}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill status={m.status} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        {canManage && !isOwner ? (
                          <RowActions
                            status={m.status}
                            onRevoke={() => {
                              if (confirm(`Révoquer l’accès de ${name} ?`))
                                run(
                                  () => revokeMemberAction(m._id),
                                  () =>
                                    setMembers((p) =>
                                      p.map((x) =>
                                        x._id === m._id ? { ...x, status: 'revoked' } : x,
                                      ),
                                    ),
                                );
                            }}
                            onReactivate={() =>
                              run(
                                () => reactivateMemberAction(m._id),
                                () =>
                                  setMembers((p) =>
                                    p.map((x) =>
                                      x._id === m._id ? { ...x, status: 'active' } : x,
                                    ),
                                  ),
                              )
                            }
                          />
                        ) : isOwner ? (
                          <Lock
                            className="ml-auto h-3.5 w-3.5 text-[color:var(--color-muted-foreground)]"
                            strokeWidth={1.85}
                            aria-label="Le propriétaire ne peut pas être révoqué"
                          />
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <RolesTab counts={members} />
      )}
    </div>
  );
}

function RoleSelect({
  role,
  onChange,
}: {
  role: Role;
  onChange: (r: Exclude<Role, 'owner'>) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="focus-ring inline-flex items-center gap-1"
      >
        <RolePill role={role} />
        <ChevronDown
          className="h-3 w-3 text-[color:var(--color-muted-foreground)]"
          strokeWidth={2}
          aria-hidden
        />
      </button>
      {open ? (
        <>
          <div className="fixed inset-0 z-10" aria-hidden onClick={() => setOpen(false)} />
          <div
            role="menu"
            className="absolute top-full left-0 z-20 mt-1 flex w-56 flex-col rounded-xl border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface-elevated)] p-1 shadow-[var(--shadow-popover)]"
          >
            {ASSIGNABLE_ROLES.map((r) => (
              <button
                key={r}
                type="button"
                role="menuitem"
                onClick={() => {
                  onChange(r);
                  setOpen(false);
                }}
                className="flex items-start gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-[color:var(--color-surface)]"
              >
                <span
                  className={cn(
                    'mt-0.5 h-3.5 w-3.5 flex-shrink-0',
                    r === role ? 'text-[color:var(--color-blush-300)]' : 'text-transparent',
                  )}
                >
                  <Check className="h-3.5 w-3.5" strokeWidth={2.4} />
                </span>
                <span className="flex flex-col">
                  <span className="text-sm text-[color:var(--color-foreground)]">
                    {ROLE_LABEL[r]}
                  </span>
                  <span className="text-[11px] text-[color:var(--color-muted-foreground)]">
                    {ROLE_SUB[r]}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

function RowActions({
  status,
  onRevoke,
  onReactivate,
}: {
  status: MemberStatus;
  onRevoke: () => void;
  onReactivate: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Actions"
        className="focus-ring rounded-lg p-1.5 text-[color:var(--color-muted-foreground)] hover:bg-[color:var(--color-surface-elevated)] hover:text-[color:var(--color-foreground)]"
      >
        <MoreVertical className="h-4 w-4" strokeWidth={2} />
      </button>
      {open ? (
        <>
          <div className="fixed inset-0 z-10" aria-hidden onClick={() => setOpen(false)} />
          <div
            role="menu"
            className="absolute top-full right-0 z-20 mt-1 flex w-44 flex-col rounded-xl border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface-elevated)] p-1 shadow-[var(--shadow-popover)]"
          >
            {status === 'active' ? (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  onRevoke();
                  setOpen(false);
                }}
                className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm text-[color:var(--color-danger)] hover:bg-[color:var(--color-surface)]"
                data-testid="revoke-member"
              >
                <Ban className="h-3.5 w-3.5" strokeWidth={1.85} />
                Révoquer l’accès
              </button>
            ) : status === 'revoked' ? (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  onReactivate();
                  setOpen(false);
                }}
                className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm text-[color:var(--color-foreground)] hover:bg-[color:var(--color-surface)]"
              >
                <UserCheck className="h-3.5 w-3.5" strokeWidth={1.85} />
                Réactiver l’accès
              </button>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}

function InviteCard({
  organizationId,
  onClose,
  onInvited,
}: {
  organizationId: string;
  onClose: () => void;
  onInvited: () => void;
}) {
  const [channel, setChannel] = useState<'email' | 'whatsapp'>('email');
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(formData: FormData) {
    setError(null);
    setLink(null);
    start(async () => {
      const r = await inviteMemberAction(organizationId, formData);
      if (r.ok) {
        setLink(
          `${typeof window !== 'undefined' ? window.location.origin : ''}/pro/invite/${r.inviteToken}`,
        );
        onInvited();
      } else {
        setError(errLabel(r.error));
      }
    });
  }

  if (link) {
    return (
      <div
        className="flex flex-col gap-3 rounded-2xl border border-[color:var(--color-sage-500)]/40 bg-[color:var(--color-surface)] p-5"
        data-testid="invite-success"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-[color:var(--color-foreground)]">
          <Check className="h-4 w-4 text-[color:var(--color-sage-500)]" strokeWidth={2.2} />
          C’est envoyé !
        </span>
        <span className="text-xs text-[color:var(--color-muted-foreground)]">
          Partagez ce lien d’invitation (valable 7 jours) :
        </span>
        <div className="flex items-center gap-2 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface-elevated)] px-3 py-2">
          <code className="min-w-0 flex-1 truncate font-mono text-xs text-[color:var(--color-foreground)]">
            {link}
          </code>
          <button
            type="button"
            onClick={() => navigator.clipboard?.writeText(link)}
            aria-label="Copier le lien"
            className="focus-ring flex-shrink-0 rounded-md p-1 text-[color:var(--color-muted-foreground)] hover:text-[color:var(--color-foreground)]"
          >
            <Copy className="h-3.5 w-3.5" strokeWidth={1.85} />
          </button>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => setLink(null)}>
            Inviter quelqu’un d’autre
          </Button>
          <Button type="button" variant="primary" size="sm" onClick={onClose}>
            Terminé
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      action={submit}
      className="flex flex-col gap-3 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5"
      data-testid="invite-form"
    >
      <div className="flex items-center justify-between">
        <h2 className="font-display text-base text-[color:var(--color-foreground)] italic">
          Inviter un membre
        </h2>
        <span className="inline-flex rounded-lg border border-[color:var(--color-border)] p-0.5">
          {(['email', 'whatsapp'] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setChannel(c)}
              aria-pressed={channel === c}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs',
                channel === c
                  ? 'bg-[color:var(--color-surface-elevated)] text-[color:var(--color-foreground)]'
                  : 'text-[color:var(--color-muted-foreground)]',
              )}
            >
              {c === 'email' ? 'E-mail' : 'WhatsApp'}
            </button>
          ))}
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        {channel === 'email' ? (
          <Input name="email" type="email" placeholder="collegue@studio.fr" aria-label="E-mail" />
        ) : (
          <Input
            name="phone"
            type="tel"
            placeholder="+33 6 12 34 56 78"
            aria-label="Numéro WhatsApp"
          />
        )}
        <Select name="role" defaultValue="planner">
          <SelectTrigger
            aria-label="Rôle"
            className="focus-ring h-10 rounded-lg border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface-elevated)] px-3 text-sm text-[color:var(--color-foreground)]"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ASSIGNABLE_ROLES.map((r) => (
              <SelectItem key={r} value={r}>
                {ROLE_LABEL[r]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-[color:var(--color-danger)]">
          {error}
        </p>
      ) : null}
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] text-[color:var(--color-muted-foreground)]">
          Invitation valable 7 jours.
        </span>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Annuler
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={pending}
            data-testid="submit-invite"
          >
            <Send className="h-3.5 w-3.5" strokeWidth={1.9} aria-hidden />
            {pending ? 'Envoi…' : 'Envoyer l’invitation'}
          </Button>
        </div>
      </div>
    </form>
  );
}

function RolesTab({ counts }: { counts: MemberItem[] }) {
  const roleCount = (r: Role) =>
    counts.filter((m) => m.role === r && m.status !== 'revoked').length;
  return (
    <div className="flex flex-col gap-6">
      {/* Role cards */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {(['owner', 'admin', 'planner', 'viewer'] as Role[]).map((r) => {
          const Icon = ROLE_ICON[r];
          const t = ROLE_TINT[r];
          return (
            <div
              key={r}
              className="flex flex-col gap-2 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4"
            >
              <span
                className="flex h-9 w-9 items-center justify-center rounded-xl"
                style={{ background: t.bg, color: t.fg }}
              >
                <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} aria-hidden />
              </span>
              <span className="font-display text-lg text-[color:var(--color-foreground)] italic">
                {ROLE_LABEL[r]}
              </span>
              <span className="font-mono text-[9px] tracking-[0.14em] text-[color:var(--color-muted-foreground)] uppercase">
                {ROLE_SUB[r]}
              </span>
              <p className="text-[13px] leading-relaxed text-[color:var(--color-ink-700)]">
                {ROLE_DESC[r]}
              </p>
              <span className="mt-auto pt-1 font-mono text-[10px] text-[color:var(--color-muted-foreground)]">
                {roleCount(r)} membre{roleCount(r) > 1 ? 's' : ''}
                {r === 'owner' ? ' · unique' : ''}
              </span>
            </div>
          );
        })}
      </div>

      {/* Permission matrix */}
      <div className="flex items-baseline gap-2.5">
        <h2 className="font-display text-xl text-[color:var(--color-foreground)] italic">
          Matrice des permissions
        </h2>
        <span className="font-mono text-[10px] tracking-[0.16em] text-[color:var(--color-muted-foreground)] uppercase">
          {CAPABILITIES.length} capacités
        </span>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)]">
        <table className="w-full min-w-[700px] border-collapse">
          <thead>
            <tr className="border-b border-[color:var(--color-border)]">
              <th className="px-4 py-3 text-left font-mono text-[10px] font-medium tracking-[0.14em] text-[color:var(--color-muted-foreground)] uppercase">
                Capacité
              </th>
              {(['owner', 'admin', 'planner', 'viewer'] as Role[]).map((r) => {
                const Icon = ROLE_ICON[r];
                const t = ROLE_TINT[r];
                return (
                  <th key={r} className="px-3 py-3 align-bottom">
                    <span className="flex flex-col items-center gap-1.5">
                      <span
                        className="flex h-7 w-7 items-center justify-center rounded-lg"
                        style={{ background: t.bg, color: t.fg }}
                      >
                        <Icon className="h-4 w-4" strokeWidth={1.85} aria-hidden />
                      </span>
                      <span className="text-[11px] font-medium text-[color:var(--color-foreground)]">
                        {ROLE_LABEL[r]}
                      </span>
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {CAPABILITIES.map((cap) => (
              <tr
                key={cap.key}
                className={cn(
                  'border-b border-[color:var(--color-border)] last:border-0',
                  cap.critical && 'bg-[color:var(--color-danger)]/5',
                )}
              >
                <td
                  className={cn(
                    'px-4 py-3.5 text-sm',
                    cap.critical
                      ? 'text-[color:var(--color-danger)]'
                      : 'text-[color:var(--color-ink-700)]',
                  )}
                >
                  {cap.label}
                </td>
                {(['owner', 'admin', 'planner', 'viewer'] as Role[]).map((r) => (
                  <td key={r} className="px-3 py-3.5 text-center">
                    {cap.allow[r] ? (
                      <span className="mx-auto inline-flex h-6 w-6 items-center justify-center rounded-lg bg-[color:var(--color-sage-500)]/15 text-[color:var(--color-sage-500)]">
                        <Check className="h-3.5 w-3.5" strokeWidth={2.6} aria-label="Autorisé" />
                      </span>
                    ) : (
                      <span
                        className="text-[color:var(--color-muted-foreground)]"
                        aria-label="Refusé"
                      >
                        —
                      </span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-[color:var(--color-muted-foreground)]">
        Les permissions sont héritées : un Admin peut tout ce que peut un Planner, et un Planner
        tout ce que peut un Lecteur.
      </p>
    </div>
  );
}
