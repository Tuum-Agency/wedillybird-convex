import { describe, expect, it, vi, beforeEach } from 'vitest';

const getSessionMock = vi.fn();
const queryMock = vi.fn();

vi.mock('@/lib/auth/session', () => ({
  getSession: () => getSessionMock(),
}));

vi.mock('@/lib/auth/convex-server', () => ({
  getConvexServerClient: () => ({ query: queryMock }),
  convexApi: {
    getEventById: 'events:getById',
    listPhotosForOwner: 'photos:listForOwner',
  },
}));

import { GET } from '@/app/[locale]/(app)/events/[eventId]/gallery/download-zip/route';

const params = (eventId: string) => Promise.resolve({ eventId, locale: 'fr' });

beforeEach(() => {
  getSessionMock.mockReset();
  queryMock.mockReset();
});

describe('GET /events/[eventId]/gallery/download-zip', () => {
  it('returns 401 when no session is present', async () => {
    getSessionMock.mockResolvedValue(null);

    const res = await GET(new Request('https://test/'), { params: params('evt_1') });

    expect(res.status).toBe(401);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('returns 403 when the requester is not the owner', async () => {
    getSessionMock.mockResolvedValue({ userId: 'usr_intruder', issuedAt: 0 });
    queryMock.mockImplementation((ref: string) => {
      if (ref === 'events:getById') {
        return Promise.reject(new Error('FORBIDDEN'));
      }
      return Promise.resolve(null);
    });

    const res = await GET(new Request('https://test/'), { params: params('evt_1') });

    expect(res.status).toBe(403);
  });

  it('returns 404 when the event has no approved photos', async () => {
    getSessionMock.mockResolvedValue({ userId: 'usr_owner', issuedAt: 0 });
    queryMock.mockImplementation((ref: string) => {
      if (ref === 'events:getById') {
        return Promise.resolve({ _id: 'evt_1', slug: 'camille-hugo' });
      }
      if (ref === 'photos:listForOwner') {
        return Promise.resolve([]);
      }
      return Promise.resolve(null);
    });

    const res = await GET(new Request('https://test/'), { params: params('evt_1') });

    expect(res.status).toBe(404);
  });

  it('returns 200 with a ZIP attachment when approved photos exist', async () => {
    getSessionMock.mockResolvedValue({ userId: 'usr_owner', issuedAt: 0 });
    queryMock.mockImplementation((ref: string) => {
      if (ref === 'events:getById') {
        return Promise.resolve({ _id: 'evt_1', slug: 'camille-hugo' });
      }
      if (ref === 'photos:listForOwner') {
        return Promise.resolve([
          {
            _id: 'photo_a',
            url: 'https://media.example/photo_a.jpg',
            status: 'approved',
            uploaderName: 'Camille',
            contentType: 'image/jpeg',
            createdAt: 1,
            sizeBytes: 10,
          },
        ]);
      }
      return Promise.resolve(null);
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), {
          status: 200,
          headers: { 'Content-Type': 'image/jpeg' },
        }),
      ),
    );

    const res = await GET(new Request('https://test/'), { params: params('evt_1') });

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/zip');
    expect(res.headers.get('Content-Disposition')).toContain(
      'attachment; filename="camille-hugo-photos.zip"',
    );
    // Drain the stream so we know the body was readable.
    const arrayBuffer = await res.arrayBuffer();
    expect(arrayBuffer.byteLength).toBeGreaterThan(0);
  });
});
