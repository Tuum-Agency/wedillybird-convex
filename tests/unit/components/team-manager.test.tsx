import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const inviteMock = vi.fn();
const revokeMock = vi.fn();
const changeRoleMock = vi.fn();
const cancelMock = vi.fn();
const resendMock = vi.fn();
const reactivateMock = vi.fn();
const refreshMock = vi.fn();

vi.mock('@/app/[locale]/(app)/pro/actions', () => ({
  inviteMemberAction: (o: string, f: FormData) => inviteMock(o, f),
  revokeMemberAction: (id: string) => revokeMock(id),
  changeMemberRoleAction: (id: string, r: string) => changeRoleMock(id, r),
  cancelInviteAction: (id: string) => cancelMock(id),
  resendInviteAction: (id: string) => resendMock(id),
  reactivateMemberAction: (id: string) => reactivateMock(id),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: refreshMock, push: vi.fn() }),
}));

import { TeamManager, type MemberItem } from '@/components/pro/team-manager';

const ORG_ID = 'org_1';
const BASE = {
  organizationId: ORG_ID,
  currentUserId: 'u_owner',
  myRole: 'owner' as const,
  tier: 'business' as const,
};

const ownerMember: MemberItem = {
  _id: 'm_1',
  userId: 'u_owner',
  role: 'owner',
  status: 'active',
  fullName: 'Alice',
  phone: '+33611111111',
  invitedAt: 0,
  acceptedAt: 0,
};
const plannerMember: MemberItem = {
  _id: 'm_2',
  userId: 'u_bob',
  role: 'planner',
  status: 'active',
  fullName: 'Bob',
  phone: '+33622222222',
  invitedAt: 0,
  acceptedAt: 0,
};
const pendingMember: MemberItem = {
  _id: 'm_3',
  role: 'viewer',
  status: 'pending',
  email: 'invite@studio.fr',
  invitedAt: 0,
};

beforeEach(() => {
  inviteMock.mockReset();
  revokeMock.mockReset();
  changeRoleMock.mockReset();
  cancelMock.mockReset();
  resendMock.mockReset();
  reactivateMock.mockReset();
  refreshMock.mockReset();
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});

describe('TeamManager', () => {
  it('cache l’invitation pour les non-managers, liste les membres', () => {
    render(
      <TeamManager
        {...BASE}
        canManage={false}
        myRole="planner"
        initialMembers={[ownerMember, plannerMember]}
      />,
    );
    expect(screen.queryByTestId('open-invite')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('member-row')).toHaveLength(2);
  });

  it('invite via le formulaire (e-mail + rôle) et affiche le lien', async () => {
    inviteMock.mockResolvedValue({ ok: true, inviteToken: 'TOKEN_ABC' });
    const user = userEvent.setup();
    render(<TeamManager {...BASE} canManage initialMembers={[ownerMember]} />);
    await user.click(screen.getByTestId('open-invite'));
    await user.type(screen.getByLabelText('E-mail'), 'collegue@studio.fr');
    await user.click(screen.getByLabelText('Rôle'));
    await user.click(await screen.findByRole('option', { name: 'Admin' }));
    await user.click(screen.getByTestId('submit-invite'));

    await waitFor(() => expect(inviteMock).toHaveBeenCalledTimes(1));
    const [orgId, formData] = inviteMock.mock.calls[0]!;
    expect(orgId).toBe(ORG_ID);
    expect(formData.get('email')).toBe('collegue@studio.fr');
    expect(formData.get('role')).toBe('admin');

    await screen.findByTestId('invite-success');
    expect(screen.getByText(/TOKEN_ABC/)).toBeInTheDocument();
  });

  it('affiche une erreur quand l’invitation échoue', async () => {
    inviteMock.mockResolvedValue({ ok: false, error: 'INVALID_PHONE' });
    const user = userEvent.setup();
    render(<TeamManager {...BASE} canManage initialMembers={[ownerMember]} />);
    await user.click(screen.getByTestId('open-invite'));
    await user.type(screen.getByLabelText('E-mail'), 'x@y.fr');
    await user.click(screen.getByTestId('submit-invite'));
    expect(await screen.findByRole('alert')).toHaveTextContent(/invalide/i);
  });

  it('le propriétaire n’a pas de menu d’actions ; le planner oui', async () => {
    const user = userEvent.setup();
    render(<TeamManager {...BASE} canManage initialMembers={[ownerMember, plannerMember]} />);
    expect(screen.getAllByTestId('member-row')).toHaveLength(2);
    const actionBtns = screen.getAllByLabelText('Actions'); // owner = cadenas, planner = menu
    expect(actionBtns).toHaveLength(1);
    await user.click(actionBtns[0]!);
    expect(screen.getByTestId('revoke-member')).toBeInTheDocument();
  });

  it('révoque un membre (avec confirmation) et rafraîchit', async () => {
    revokeMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<TeamManager {...BASE} canManage initialMembers={[ownerMember, plannerMember]} />);
    await user.click(screen.getByLabelText('Actions'));
    await user.click(screen.getByTestId('revoke-member'));
    await waitFor(() => expect(revokeMock).toHaveBeenCalledWith('m_2'));
    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
  });

  it('liste les invitations en attente dans une section dédiée', () => {
    render(<TeamManager {...BASE} canManage initialMembers={[ownerMember, pendingMember]} />);
    expect(screen.getByText(/Invitations en attente · 1/)).toBeInTheDocument();
    // la table ne contient que les membres actifs/révoqués → owner seul
    expect(screen.getAllByTestId('member-row')).toHaveLength(1);
  });

  it('affiche la matrice de permissions dans l’onglet Rôles', async () => {
    const user = userEvent.setup();
    render(<TeamManager {...BASE} canManage initialMembers={[ownerMember]} />);
    await user.click(screen.getByRole('tab', { name: /Rôles & permissions/ }));
    expect(screen.getByText('Supprimer l’organisation')).toBeInTheDocument();
  });
});
