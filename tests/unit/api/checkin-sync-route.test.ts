import { describe, expect, it, vi, beforeEach } from 'vitest';

const getSessionMock = vi.fn();
const mutationMock = vi.fn();

vi.mock('@/lib/auth/session', () => ({
  getSession: () => getSessionMock(),
}));

vi.mock('@/lib/auth/convex-server', () => ({
  getConvexServerClient: () => ({ mutation: (...args: unknown[]) => mutationMock(...args) }),
  convexApi: { checkInByToken: 'guests:checkInByToken' as unknown },
}));

import { POST } from '@/app/api/checkin/sync/route';

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/checkin/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  getSessionMock.mockReset();
  mutationMock.mockReset();
});

describe('POST /api/checkin/sync', () => {
  it('returns 401 when not authenticated', async () => {
    getSessionMock.mockResolvedValueOnce(null);
    const res = await POST(makeRequest({ eventId: 'evt_1', checkIns: [{ qrCodeToken: 'TK1' }] }));
    expect(res.status).toBe(401);
  });

  it('returns 400 on invalid body', async () => {
    getSessionMock.mockResolvedValueOnce({ userId: 'u1', phone: '+33', issuedAt: 0 });
    const res = await POST(makeRequest({ eventId: 'evt_1' }));
    expect(res.status).toBe(400);
  });

  it('passes through ok and failed entries', async () => {
    getSessionMock.mockResolvedValueOnce({ userId: 'u1', phone: '+33', issuedAt: 0 });
    mutationMock
      .mockResolvedValueOnce({
        ok: true,
        alreadyCheckedIn: false,
        checkedInAt: 100,
        guest: {
          _id: 'g1',
          fullName: 'A',
          plusOnesAllowed: 0,
          rsvpStatus: 'attending',
        },
      })
      .mockRejectedValueOnce(new Error('GUEST_NOT_FOUND'));

    const res = await POST(
      makeRequest({
        eventId: 'evt_1',
        checkIns: [{ qrCodeToken: 'TK1' }, { qrCodeToken: 'TK2' }],
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: string[]; failed: Array<{ token: string }> };
    expect(body.ok).toEqual(['TK1']);
    expect(body.failed).toEqual([{ token: 'TK2', error: 'GUEST_NOT_FOUND' }]);
  });

  it('aborts with 403 when convex returns FORBIDDEN', async () => {
    getSessionMock.mockResolvedValueOnce({ userId: 'u1', phone: '+33', issuedAt: 0 });
    mutationMock.mockRejectedValueOnce(new Error('FORBIDDEN'));

    const res = await POST(makeRequest({ eventId: 'evt_1', checkIns: [{ qrCodeToken: 'TK1' }] }));
    expect(res.status).toBe(403);
  });

  it('treats already-checked-in as ok (idempotent)', async () => {
    getSessionMock.mockResolvedValueOnce({ userId: 'u1', phone: '+33', issuedAt: 0 });
    mutationMock.mockResolvedValueOnce({
      ok: true,
      alreadyCheckedIn: true,
      checkedInAt: 50,
      guest: {
        _id: 'g1',
        fullName: 'A',
        plusOnesAllowed: 0,
        rsvpStatus: 'attending',
      },
    });

    const res = await POST(makeRequest({ eventId: 'evt_1', checkIns: [{ qrCodeToken: 'TK1' }] }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: string[] };
    expect(body.ok).toEqual(['TK1']);
  });
});
