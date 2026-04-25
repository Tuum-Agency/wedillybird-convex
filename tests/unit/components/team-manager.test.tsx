import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const inviteMock = vi.fn();
const revokeMock = vi.fn();
const refreshMock = vi.fn();

vi.mock('@/app/[locale]/(app)/pro/actions', () => ({
  inviteMemberAction: (organizationId: string, formData: FormData) =>
    inviteMock(organizationId, formData),
  revokeMemberAction: (membershipId: string) => revokeMock(membershipId),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: refreshMock, push: vi.fn() }),
}));

vi.mock('next-intl', () => ({
  useTranslations: (namespace?: string) => (key: string) => `${namespace ?? 'T'}.${key}`,
}));

import { TeamManager, type MemberItem } from '@/components/pro/team-manager';

const ORG_ID = 'org_1';

const ownerMember: MemberItem = {
  _id: 'm_1',
  role: 'owner',
  status: 'active',
  fullName: 'Alice',
  phone: '+33611111111',
  invitedAt: 0,
  acceptedAt: 0,
};
const plannerMember: MemberItem = {
  _id: 'm_2',
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
  phone: '+33633333333',
  invitedAt: 0,
};

beforeEach(() => {
  inviteMock.mockReset();
  revokeMock.mockReset();
  refreshMock.mockReset();
});

describe('TeamManager', () => {
  it('hides invite form when user cannot manage', () => {
    render(
      <TeamManager
        organizationId={ORG_ID}
        canManage={false}
        initialMembers={[ownerMember, plannerMember]}
      />,
    );
    expect(screen.queryByTestId('invite-form')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('member-row')).toHaveLength(2);
  });

  it('shows invite form for managers and submits with role + phone', async () => {
    inviteMock.mockResolvedValue({ ok: true, inviteToken: 'TOKEN_ABC' });
    const user = userEvent.setup();
    render(<TeamManager organizationId={ORG_ID} canManage={true} initialMembers={[ownerMember]} />);

    await user.type(screen.getByLabelText('Pro.phoneLabel'), '+33644444444');
    await user.selectOptions(screen.getByLabelText('Pro.roleLabel'), 'admin');
    await user.click(screen.getByTestId('submit-invite'));

    await waitFor(() => expect(inviteMock).toHaveBeenCalledTimes(1));
    const [orgId, formData] = inviteMock.mock.calls[0]!;
    expect(orgId).toBe(ORG_ID);
    expect(formData.get('phone')).toBe('+33644444444');
    expect(formData.get('role')).toBe('admin');

    await screen.findByTestId('invite-success');
    expect(screen.getByText(/TOKEN_ABC/)).toBeInTheDocument();
    expect(refreshMock).toHaveBeenCalled();
  });

  it('shows error when action returns INVALID_PHONE', async () => {
    inviteMock.mockResolvedValue({ ok: false, error: 'INVALID_PHONE' });
    const user = userEvent.setup();
    render(<TeamManager organizationId={ORG_ID} canManage={true} initialMembers={[ownerMember]} />);

    await user.type(screen.getByLabelText('Pro.phoneLabel'), 'bad');
    await user.click(screen.getByTestId('submit-invite'));

    expect(await screen.findByRole('alert')).toHaveTextContent(/invalid_phone/);
  });

  it('does not show revoke button for owner row, but shows for planner', () => {
    render(
      <TeamManager
        organizationId={ORG_ID}
        canManage={true}
        initialMembers={[ownerMember, plannerMember]}
      />,
    );
    const rows = screen.getAllByTestId('member-row');
    expect(rows).toHaveLength(2);
    const revokeButtons = screen.getAllByTestId('revoke-member');
    expect(revokeButtons).toHaveLength(1);
  });

  it('hides revoke button for revoked members', () => {
    render(
      <TeamManager
        organizationId={ORG_ID}
        canManage={true}
        initialMembers={[ownerMember, { ...plannerMember, status: 'revoked' }]}
      />,
    );
    expect(screen.queryByTestId('revoke-member')).not.toBeInTheDocument();
  });

  it('triggers revoke action and refreshes router on success', async () => {
    revokeMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(
      <TeamManager
        organizationId={ORG_ID}
        canManage={true}
        initialMembers={[ownerMember, plannerMember]}
      />,
    );

    await user.click(screen.getByTestId('revoke-member'));

    await waitFor(() => expect(revokeMock).toHaveBeenCalledWith('m_2'));
    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
  });

  it('renders pending status for invited members', () => {
    render(
      <TeamManager
        organizationId={ORG_ID}
        canManage={true}
        initialMembers={[ownerMember, pendingMember]}
      />,
    );
    const pendingRow = screen.getAllByTestId('member-row')[1];
    expect(pendingRow).toHaveAttribute('data-status', 'pending');
  });
});
