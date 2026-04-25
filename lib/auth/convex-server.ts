import 'server-only';
import { ConvexHttpClient } from 'convex/browser';
import { makeFunctionReference, type FunctionReference } from 'convex/server';

let cachedClient: ConvexHttpClient | null = null;

export function getConvexServerClient(): ConvexHttpClient {
  if (cachedClient) return cachedClient;
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) {
    throw new Error('NEXT_PUBLIC_CONVEX_URL is not set');
  }
  cachedClient = new ConvexHttpClient(url);
  return cachedClient;
}

type Args = Record<string, unknown>;

export const convexApi = {
  requestOtp: makeFunctionReference<'action', { phone: string; ipAddress?: string }>(
    'auth:requestOtp',
  ),
  verifyOtp: makeFunctionReference<
    'mutation',
    { phone: string; code: string },
    { userId: string; sessionToken: string; phone: string }
  >('auth:verifyOtp'),
  currentUser: makeFunctionReference<
    'query',
    { userId: string },
    {
      _id: string;
      phone: string;
      email?: string;
      fullName?: string;
      avatarUrl?: string;
      role: 'couple' | 'pro' | 'guest' | 'admin';
      locale: 'fr';
      planTier?: string;
      createdAt: number;
      lastSeenAt?: number;
    } | null
  >('auth:currentUser'),
  completeOnboarding: makeFunctionReference<
    'mutation',
    { userId: string; fullName: string; role: 'couple' | 'pro'; email?: string },
    { ok: true }
  >('users:completeOnboarding'),
  userByPhone: makeFunctionReference<
    'query',
    { phone: string },
    {
      _id: string;
      phone: string;
      email?: string;
      fullName?: string;
      role: 'couple' | 'pro' | 'guest' | 'admin';
      locale: 'fr';
    } | null
  >('auth:userByPhone'),
  createEvent: makeFunctionReference<
    'mutation',
    {
      ownerId: string;
      title: string;
      partnerA: string;
      partnerB: string;
      eventDate: number;
      timezone: string;
      venue?: { name: string; address: string };
      theme?: { primaryColor: string; accentColor: string; fontFamily: string };
    },
    { id: string; slug: string }
  >('events:create'),
  publishEvent: makeFunctionReference<
    'mutation',
    { eventId: string; requesterId: string },
    { ok: true; status: 'draft' | 'active' | 'archived' | 'cancelled' }
  >('events:publish'),
  unpublishEvent: makeFunctionReference<
    'mutation',
    { eventId: string; requesterId: string },
    { ok: true; status: 'draft' | 'active' | 'archived' | 'cancelled' }
  >('events:unpublish'),
  listEventsByOwner: makeFunctionReference<
    'query',
    { ownerId: string },
    Array<{
      _id: string;
      slug: string;
      title: string;
      coupleNames: { partnerA: string; partnerB: string };
      eventDate: number;
      timezone: string;
      status: 'draft' | 'active' | 'archived' | 'cancelled';
      planTier: 'free' | 'essential' | 'premium';
      maxGuests: number;
      venue?: { name: string; address: string; lat?: number; lng?: number };
      updatedAt: number;
    }>
  >('events:listByOwner'),
  getEventById: makeFunctionReference<
    'query',
    { eventId: string; requesterId: string },
    {
      _id: string;
      ownerId: string;
      slug: string;
      title: string;
      coupleNames: { partnerA: string; partnerB: string };
      eventDate: number;
      timezone: string;
      venue?: { name: string; address: string; lat?: number; lng?: number };
      theme?: { primaryColor: string; accentColor: string; fontFamily: string };
      status: 'draft' | 'active' | 'archived' | 'cancelled';
      planTier: 'free' | 'essential' | 'premium';
      maxGuests: number;
      updatedAt: number;
    } | null
  >('events:getById'),
  addGuest: makeFunctionReference<
    'mutation',
    {
      eventId: string;
      requesterId: string;
      fullName: string;
      phone?: string;
      email?: string;
      category?: string;
      plusOnesAllowed: number;
      notes?: string;
    },
    { id: string; qrCodeToken: string }
  >('guests:add'),
  updateGuest: makeFunctionReference<
    'mutation',
    {
      guestId: string;
      requesterId: string;
      fullName?: string;
      phone?: string;
      email?: string;
      category?: string;
      plusOnesAllowed?: number;
      notes?: string;
    },
    { ok: true }
  >('guests:update'),
  removeGuest: makeFunctionReference<
    'mutation',
    { guestId: string; requesterId: string },
    { ok: true }
  >('guests:remove'),
  listGuestsByEvent: makeFunctionReference<
    'query',
    { eventId: string; requesterId: string },
    Array<{
      _id: string;
      fullName: string;
      phone?: string;
      email?: string;
      category?: string;
      plusOnesAllowed: number;
      rsvpStatus: 'pending' | 'attending' | 'declined' | 'maybe';
      invitationSentAt?: number;
      notes?: string;
      qrCodeToken: string;
      createdAt: number;
      updatedAt: number;
    }>
  >('guests:listByEvent'),
  countGuestsByEvent: makeFunctionReference<
    'query',
    { eventId: string; requesterId: string },
    { total: number; attending: number; declined: number; pending: number; maybe: number }
  >('guests:countByEvent'),
  getGuestByToken: makeFunctionReference<
    'query',
    { token: string },
    {
      guest: {
        _id: string;
        fullName: string;
        plusOnesAllowed: number;
        rsvpStatus: 'pending' | 'attending' | 'declined' | 'maybe';
        rsvpRespondedAt?: number;
        plusOnesNames?: string[];
        dietaryRestrictions?: string;
        notes?: string;
      };
      event: {
        _id: string;
        title: string;
        coupleNames: { partnerA: string; partnerB: string };
        eventDate: number;
        timezone: string;
        venue?: { name: string; address: string; lat?: number; lng?: number };
        theme?: { primaryColor: string; accentColor: string; fontFamily: string };
      };
    } | null
  >('guests:getByToken'),
  submitRsvp: makeFunctionReference<
    'mutation',
    {
      token: string;
      rsvpStatus: 'attending' | 'declined' | 'maybe';
      plusOnesNames?: string[];
      dietaryRestrictions?: string;
      notes?: string;
    },
    { ok: true }
  >('rsvps:submit'),
  listGuestsForCheckIn: makeFunctionReference<
    'query',
    { eventId: string; requesterId: string },
    Array<{
      _id: string;
      fullName: string;
      category?: string;
      plusOnesAllowed: number;
      rsvpStatus: 'pending' | 'attending' | 'declined' | 'maybe';
      qrCodeToken: string;
      checkedInAt?: number;
    }>
  >('guests:listForCheckIn'),
  checkInByToken: makeFunctionReference<
    'mutation',
    { token: string; eventId: string; requesterId: string },
    {
      ok: true;
      alreadyCheckedIn: boolean;
      checkedInAt: number;
      guest: {
        _id: string;
        fullName: string;
        category?: string;
        plusOnesAllowed: number;
        rsvpStatus: 'pending' | 'attending' | 'declined' | 'maybe';
      };
    }
  >('guests:checkInByToken'),
  undoCheckIn: makeFunctionReference<
    'mutation',
    { guestId: string; requesterId: string },
    { ok: true }
  >('guests:undoCheckIn'),
  createOwnerUploadUrl: makeFunctionReference<
    'mutation',
    { eventId: string; requesterId: string },
    { uploadUrl: string }
  >('photos:createOwnerUploadUrl'),
  createGuestUploadUrl: makeFunctionReference<'mutation', { token: string }, { uploadUrl: string }>(
    'photos:createGuestUploadUrl',
  ),
  confirmOwnerUpload: makeFunctionReference<
    'mutation',
    {
      eventId: string;
      requesterId: string;
      storageId: string;
      sizeBytes: number;
      contentType: string;
      width?: number;
      height?: number;
    },
    { id: string }
  >('photos:confirmOwnerUpload'),
  confirmGuestUpload: makeFunctionReference<
    'mutation',
    {
      token: string;
      storageId: string;
      sizeBytes: number;
      contentType: string;
      width?: number;
      height?: number;
      uploaderName?: string;
    },
    { id: string }
  >('photos:confirmGuestUpload'),
  listPhotosForOwner: makeFunctionReference<
    'query',
    {
      eventId: string;
      requesterId: string;
      status?: 'pending' | 'approved' | 'rejected';
    },
    Array<{
      _id: string;
      url: string | null;
      status: 'pending' | 'approved' | 'rejected';
      uploaderName?: string;
      uploadedByGuestToken?: boolean;
      width?: number;
      height?: number;
      sizeBytes: number;
      contentType: string;
      createdAt: number;
    }>
  >('photos:listForOwner'),
  listApprovedPhotosForGuest: makeFunctionReference<
    'query',
    { token: string },
    Array<{
      _id: string;
      url: string | null;
      uploaderName?: string;
      width?: number;
      height?: number;
      createdAt: number;
    }>
  >('photos:listApprovedForGuest'),
  moderatePhoto: makeFunctionReference<
    'mutation',
    { photoId: string; requesterId: string; decision: 'approved' | 'rejected' },
    { ok: true }
  >('photos:moderate'),
  removePhoto: makeFunctionReference<
    'mutation',
    { photoId: string; requesterId: string },
    { ok: true }
  >('photos:remove'),
  recordPaymentIntent: makeFunctionReference<
    'mutation',
    {
      userId: string;
      eventId: string;
      plan: 'essential' | 'premium';
      currency: 'EUR' | 'XOF' | 'MAD' | 'TND';
      amountMinor: number;
      provider: 'stripe' | 'cinetpay' | 'mock';
      providerSessionId: string;
    },
    { id: string }
  >('payments:recordIntent'),
  findPaymentBySession: makeFunctionReference<
    'query',
    { provider: 'stripe' | 'cinetpay' | 'mock'; providerSessionId: string },
    {
      _id: string;
      userId: string;
      eventId: string;
      plan: 'essential' | 'premium';
      currency: 'EUR' | 'XOF' | 'MAD' | 'TND';
      amountMinor: number;
      provider: 'stripe' | 'cinetpay' | 'mock';
      providerSessionId: string;
      providerEventId?: string;
      status: 'pending' | 'succeeded' | 'failed' | 'cancelled';
    } | null
  >('payments:findBySession'),
  markPaymentSucceeded: makeFunctionReference<
    'mutation',
    {
      provider: 'stripe' | 'cinetpay' | 'mock';
      providerSessionId: string;
      providerEventId: string;
    },
    { ok: true; alreadyApplied: boolean }
  >('payments:markSucceeded'),
  markPaymentFailed: makeFunctionReference<
    'mutation',
    {
      provider: 'stripe' | 'cinetpay' | 'mock';
      providerSessionId: string;
      providerEventId: string;
      status: 'failed' | 'cancelled';
      failureReason?: string;
    },
    { ok: true; alreadyApplied: boolean }
  >('payments:markFailed'),
  listPaymentsByEvent: makeFunctionReference<
    'query',
    { eventId: string; requesterId: string },
    Array<{
      _id: string;
      plan: 'essential' | 'premium';
      currency: 'EUR' | 'XOF' | 'MAD' | 'TND';
      amountMinor: number;
      provider: 'stripe' | 'cinetpay' | 'mock';
      status: 'pending' | 'succeeded' | 'failed' | 'cancelled';
      createdAt: number;
    }>
  >('payments:listByEvent'),
} satisfies Record<
  string,
  FunctionReference<'query' | 'mutation' | 'action', 'public', Args, unknown>
>;
