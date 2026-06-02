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
  requestMagicLink: makeFunctionReference<
    'action',
    { email: string; ipAddress?: string; locale?: string },
    { email: string }
  >('auth:requestMagicLink'),
  verifyMagicLink: makeFunctionReference<
    'mutation',
    { email: string; token: string },
    { userId: string; sessionToken: string; email: string }
  >('auth:verifyMagicLink'),
  currentUser: makeFunctionReference<
    'query',
    { userId: string },
    {
      _id: string;
      phone?: string;
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
    { userId: string; fullName: string; role: 'couple' | 'pro'; email: string },
    { ok: true }
  >('users:completeOnboarding'),
  userByPhone: makeFunctionReference<
    'query',
    { phone: string },
    {
      _id: string;
      phone?: string;
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
      pendingPlanTier?: 'essential' | 'premium';
      organizationId?: string;
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
  orgPublishQuotaStatus: makeFunctionReference<
    'query',
    { eventId: string; requesterId: string },
    | { applicable: false }
    | { applicable: true; quota: number; activeEventCount: number; atQuota: boolean }
  >('events:orgPublishQuotaStatus'),

  // --- Plan de table / seating (feature Premium + Pro) ---
  createTable: makeFunctionReference<
    'mutation',
    { eventId: string; requesterId: string; name?: string; capacity?: number },
    { tableId: string }
  >('seating:createTable'),
  updateTable: makeFunctionReference<
    'mutation',
    {
      tableId: string;
      requesterId: string;
      name?: string;
      capacity?: number;
      shape?: 'round' | 'rect';
      posX?: number;
      posY?: number;
    },
    { ok: true }
  >('seating:updateTable'),
  deleteTable: makeFunctionReference<
    'mutation',
    { tableId: string; requesterId: string },
    { ok: true; unassigned: number }
  >('seating:deleteTable'),
  assignSeat: makeFunctionReference<
    'mutation',
    {
      eventId: string;
      guestId: string;
      memberIndex: number;
      tableId: string | null;
      requesterId: string;
    },
    { ok: true }
  >('seating:assignSeat'),
  autoAssignGuests: makeFunctionReference<
    'mutation',
    { eventId: string; requesterId: string },
    { assigned: number; tablesCreated: number }
  >('seating:autoAssignGuests'),
  getSeatingPlan: makeFunctionReference<
    'query',
    { eventId: string; requesterId: string },
    {
      tables: Array<{
        _id: string;
        name: string;
        capacity: number;
        shape?: 'round' | 'rect';
        posX?: number;
        posY?: number;
        order: number;
        assigned: Array<{
          _id: string;
          guestId: string;
          memberIndex: number;
          fullName: string;
          hostName?: string;
          seats: number;
          plusOnesNames: string[];
          category?: string;
        }>;
        occupancy: number;
        overCapacity: boolean;
      }>;
      unassigned: Array<{
        _id: string;
        guestId: string;
        memberIndex: number;
        fullName: string;
        hostName?: string;
        seats: number;
        plusOnesNames: string[];
        category?: string;
      }>;
      stats: {
        tableCount: number;
        totalCapacity: number;
        seatedSeats: number;
        unassignedSeats: number;
        attendingParties: number;
      };
    }
  >('seating:getSeatingPlan'),
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
      planTier: 'essential' | 'premium' | undefined;
      pendingPlanTier?: 'essential' | 'premium';
      maxGuests: number;
      venue?: { name: string; address: string; lat?: number; lng?: number };
      updatedAt: number;
    }>
  >('events:listByOwner'),
  updateEventMessagingConfig: makeFunctionReference<
    'mutation',
    {
      eventId: string;
      requesterId: string;
      templateStyle?: 'classic' | 'warm' | 'african' | 'minimal' | 'festive';
      personalMessage?: string;
      preferredChannel?: 'whatsapp' | 'email' | 'both';
      customTemplateId?: string;
      clearCustomTemplate?: boolean;
      templateNotifyChannel?: 'whatsapp' | 'email' | 'both';
    },
    { ok: true }
  >('events:updateMessagingConfig'),
  updateEvent: makeFunctionReference<
    'mutation',
    {
      eventId: string;
      requesterId: string;
      title?: string;
      partnerA?: string;
      partnerB?: string;
      eventDate?: number;
      timezone?: string;
      venue?: { name: string; address: string };
      clearVenue?: boolean;
      theme?: { primaryColor: string; accentColor: string; fontFamily: string };
    },
    { ok: true }
  >('events:update'),
  reconcileEventMaxGuests: makeFunctionReference<
    'mutation',
    { eventId: string; requesterId: string },
    {
      ok: true;
      changed: boolean;
      planTier?: 'essential' | 'premium' | undefined;
      maxGuests?: number;
    }
  >('events:reconcileMaxGuests'),
  getEventById: makeFunctionReference<
    'query',
    { eventId: string; requesterId: string },
    {
      _id: string;
      ownerId: string;
      organizationId?: string;
      slug: string;
      title: string;
      coupleNames: { partnerA: string; partnerB: string };
      eventDate: number;
      timezone: string;
      venue?: { name: string; address: string; lat?: number; lng?: number };
      theme?: { primaryColor: string; accentColor: string; fontFamily: string };
      status: 'draft' | 'active' | 'archived' | 'cancelled';
      planTier: 'essential' | 'premium' | undefined;
      pendingPlanTier?: 'essential' | 'premium';
      maxGuests: number;
      galleryExpiresAt?: number;
      messagingConfig?: {
        templateStyle: 'classic' | 'warm' | 'african' | 'minimal' | 'festive';
        personalMessage?: string;
        preferredChannel: 'whatsapp' | 'email' | 'both';
        customTemplateId?: string;
        templateNotifyChannel?: 'whatsapp' | 'email' | 'both';
      };
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
    {
      total: number;
      attending: number;
      declined: number;
      pending: number;
      maybe: number;
      invited: number;
      withPhone: number;
    }
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
  createOwnerS3UploadUrl: makeFunctionReference<
    'action',
    { eventId: string; requesterId: string; contentType: string },
    { uploadUrl: string; s3Key: string }
  >('photosActions:createOwnerS3UploadUrl'),
  createGuestS3UploadUrl: makeFunctionReference<
    'action',
    { token: string; contentType: string },
    { uploadUrl: string; s3Key: string }
  >('photosActions:createGuestS3UploadUrl'),
  confirmOwnerUpload: makeFunctionReference<
    'mutation',
    {
      eventId: string;
      requesterId: string;
      s3Key: string;
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
      s3Key: string;
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
      variants?: { thumb?: string; medium?: string; large?: string };
      status: 'pending' | 'approved' | 'rejected';
      uploaderName?: string;
      uploadedByGuestToken?: boolean;
      width?: number;
      height?: number;
      sizeBytes: number;
      contentType: string;
      createdAt: number;
      moderationReason?: string;
      moderationDecision?: 'approved' | 'rejected' | 'manual_review';
    }>
  >('photos:listForOwner'),
  listApprovedPhotosForGuest: makeFunctionReference<
    'query',
    { token: string },
    Array<{
      _id: string;
      url: string | null;
      variants?: { thumb?: string; medium?: string; large?: string };
      status?: 'pending' | 'approved' | 'rejected';
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
  searchPhotosByFace: makeFunctionReference<
    'action',
    {
      eventId: string;
      selfieBase64: string;
      requesterId?: string;
      guestToken?: string;
    },
    | { ok: true; photoIds: string[]; matchCount: number }
    | {
        ok: false;
        error:
          | 'NO_FACE_DETECTED'
          | 'NO_COLLECTION_YET'
          | 'FORBIDDEN'
          | 'INVALID_TOKEN'
          | 'RATE_LIMITED'
          | 'UNKNOWN';
      }
  >('photos:searchPhotosByFace'),
  archiveEvent: makeFunctionReference<
    'mutation',
    { eventId: string; requesterId: string },
    { ok: true; alreadyArchived: boolean }
  >('events:archive'),
  recordPaymentIntent: makeFunctionReference<
    'mutation',
    {
      userId: string;
      eventId: string;
      plan: 'essential' | 'premium';
      currency: 'EUR' | 'USD' | 'XOF' | 'MAD' | 'TND';
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
      currency: 'EUR' | 'USD' | 'XOF' | 'MAD' | 'TND';
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
      currency: 'EUR' | 'USD' | 'XOF' | 'MAD' | 'TND';
      amountMinor: number;
      provider: 'stripe' | 'cinetpay' | 'mock';
      status: 'pending' | 'succeeded' | 'failed' | 'cancelled';
      createdAt: number;
    }>
  >('payments:listByEvent'),
  getPaymentForInvoice: makeFunctionReference<
    'query',
    { paymentId: string; requesterId: string },
    {
      payment: {
        _id: string;
        userId: string;
        eventId: string;
        plan: 'essential' | 'premium';
        currency: 'EUR' | 'USD' | 'XOF' | 'MAD' | 'TND';
        amountMinor: number;
        provider: 'stripe' | 'cinetpay' | 'mock';
        status: 'pending' | 'succeeded' | 'failed' | 'cancelled';
        createdAt: number;
        updatedAt: number;
      };
      event: { _id: string; title: string } | null;
      customer: {
        fullName?: string;
        email?: string;
        phone?: string;
        locale?: string;
      } | null;
    }
  >('paymentsInvoice:getForInvoice'),
  createOrganization: makeFunctionReference<
    'mutation',
    {
      ownerId: string;
      name: string;
      primaryColor?: string;
      accentColor?: string;
    },
    { id: string; slug: string }
  >('organizations:create'),
  myOrganization: makeFunctionReference<
    'query',
    { userId: string },
    {
      _id: string;
      name: string;
      slug: string;
      primaryColor?: string;
      accentColor?: string;
      logoUrl: string | null;
      stripeCustomerId?: string;
      subscriptionTier?: 'starter' | 'business' | 'agency';
      subscriptionStatus?: 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid';
      subscriptionPeriodEnd?: number;
      myRole: 'owner' | 'admin' | 'planner' | 'viewer';
    } | null
  >('organizations:myOrganization'),
  findOrgBySlug: makeFunctionReference<
    'query',
    { slug: string },
    {
      _id: string;
      name: string;
      slug: string;
      primaryColor?: string;
      accentColor?: string;
      logoUrl: string | null;
    } | null
  >('organizations:findBySlug'),
  findPublicEventBySlug: makeFunctionReference<
    'query',
    { orgSlug: string; eventSlug: string },
    {
      _id: string;
      slug: string;
      title: string;
      coupleNames: { partnerA: string; partnerB: string };
      eventDate: number;
      timezone: string;
      venue?: { name: string; address: string; lat?: number; lng?: number };
      theme?: { primaryColor: string; accentColor: string; fontFamily: string };
    } | null
  >('events:findPublicEventBySlug'),
  updateOrgBranding: makeFunctionReference<
    'mutation',
    {
      organizationId: string;
      requesterId: string;
      name?: string;
      primaryColor?: string;
      accentColor?: string;
      logoStorageId?: string;
    },
    { ok: true }
  >('organizations:updateBranding'),
  generateOrgLogoUploadUrl: makeFunctionReference<
    'mutation',
    { organizationId: string; requesterId: string },
    { uploadUrl: string }
  >('organizations:generateLogoUploadUrl'),
  setOrgLogo: makeFunctionReference<
    'mutation',
    { organizationId: string; requesterId: string; logoStorageId: string },
    { ok: true }
  >('organizations:setLogo'),
  clearOrgLogo: makeFunctionReference<
    'mutation',
    { organizationId: string; requesterId: string },
    { ok: true; alreadyEmpty?: boolean }
  >('organizations:clearLogo'),
  getOrganization: makeFunctionReference<
    'query',
    { organizationId: string; requesterId: string },
    {
      _id: string;
      name: string;
      slug: string;
      primaryColor?: string;
      accentColor?: string;
      logoUrl: string | null;
      subscriptionTier?: 'starter' | 'business' | 'agency';
      subscriptionStatus?: 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid';
      myRole: 'owner' | 'admin' | 'planner' | 'viewer';
    }
  >('organizations:getById'),
  listOrgEvents: makeFunctionReference<
    'query',
    { organizationId: string; requesterId: string },
    Array<{
      _id: string;
      title: string;
      slug: string;
      coupleNames: { partnerA: string; partnerB: string };
      eventDate: number;
      timezone: string;
      status: 'draft' | 'active' | 'archived' | 'cancelled';
      planTier: 'essential' | 'premium' | undefined;
      maxGuests: number;
      ownerId: string;
    }>
  >('organizations:listEvents'),
  listOrgMembers: makeFunctionReference<
    'query',
    { organizationId: string; requesterId: string },
    Array<{
      _id: string;
      role: 'owner' | 'admin' | 'planner' | 'viewer';
      status: 'pending' | 'active' | 'revoked';
      fullName?: string;
      phone?: string;
      email?: string;
      invitedAt: number;
      acceptedAt?: number;
    }>
  >('organizations:listMembers'),
  inviteOrgMember: makeFunctionReference<
    'mutation',
    {
      organizationId: string;
      requesterId: string;
      phone?: string;
      email?: string;
      role: 'admin' | 'planner' | 'viewer';
    },
    { id: string; inviteToken: string }
  >('organizations:invite'),
  acceptOrgInvite: makeFunctionReference<
    'mutation',
    { token: string; userId: string },
    { ok: true; organizationId: string }
  >('organizations:acceptInvite'),
  revokeOrgMembership: makeFunctionReference<
    'mutation',
    { membershipId: string; requesterId: string },
    { ok: true }
  >('organizations:revokeMembership'),
  // Public webhook bridge (validates `CONVEX_WEBHOOK_SECRET`). La mutation
  // sous-jacente `organizations:updateSubscription` est passée en
  // `internalMutation` pour fix F-01 (audit avril 2026) — on ne peut plus
  // l'appeler depuis le client.
  updateOrgSubscriptionFromWebhook: makeFunctionReference<
    'mutation',
    {
      webhookSecret: string;
      organizationId: string;
      stripeCustomerId?: string;
      stripeSubscriptionId?: string;
      subscriptionTier?: 'starter' | 'business' | 'agency';
      subscriptionStatus?: 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid';
      subscriptionPeriodEnd?: number;
    },
    { ok: true }
  >('organizations:updateSubscriptionFromWebhook'),
  findOrgByStripeSubscription: makeFunctionReference<
    'query',
    { stripeSubscriptionId: string },
    {
      _id: string;
      name: string;
      ownerId: string;
      stripeCustomerId?: string;
      subscriptionTier?: 'starter' | 'business' | 'agency';
      subscriptionStatus?: 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid';
    } | null
  >('organizations:findByStripeSubscription'),
  markPaygPurchase: makeFunctionReference<
    'mutation',
    {
      organizationId: string;
      requesterId: string;
      stripeSessionId: string;
      amountMinor: number;
      currency: 'EUR' | 'USD' | 'XOF' | 'MAD' | 'TND';
    },
    { ok: true; alreadyApplied: boolean }
  >('paygPurchases:markPurchase'),
  getPaygCreditsByOrganization: makeFunctionReference<
    'query',
    { organizationId: string; requesterId: string },
    { credits: number } | null
  >('paygPurchases:getCreditsByOrganization'),
  listPaygPurchasesByOrganization: makeFunctionReference<
    'query',
    { organizationId: string; requesterId: string },
    Array<{
      _id: string;
      amountMinor: number;
      currency: 'EUR' | 'USD' | 'XOF' | 'MAD' | 'TND';
      stripeSessionId: string;
      createdAt: number;
    }>
  >('paygPurchases:listByOrganization'),
  getUserById: makeFunctionReference<
    'query',
    { userId: string },
    {
      _id: string;
      phone?: string;
      email?: string;
      fullName?: string;
      role: 'couple' | 'pro' | 'guest' | 'admin';
    } | null
  >('users:getById'),
  newsletterSubscribe: makeFunctionReference<
    'mutation',
    { email: string; source?: string; ipAddress?: string },
    { id: string; alreadyActive: boolean; reactivated: boolean }
  >('newsletter:subscribe'),
  broadcastInvitations: makeFunctionReference<
    'action',
    { eventId: string; requesterId: string },
    { sent: number; failed: number; skipped: number; total: number; style: string; mock: boolean }
  >('invitationActions:broadcast'),
  requestLinkPhone: makeFunctionReference<
    'action',
    { userId: string; phone: string; ipAddress?: string },
    { phone: string; channel: 'whatsapp'; provider: 'meta_cloud' | 'mock' }
  >('auth:requestLinkPhone'),
  verifyLinkPhone: makeFunctionReference<
    'mutation',
    { userId: string; phone: string; code: string },
    { ok: true }
  >('auth:verifyLinkPhone'),
  requestLinkEmail: makeFunctionReference<
    'action',
    { userId: string; email: string; ipAddress?: string },
    { email: string }
  >('auth:requestLinkEmail'),
  verifyLinkEmail: makeFunctionReference<
    'mutation',
    { userId: string; email: string; code: string },
    { ok: true }
  >('auth:verifyLinkEmail'),
  // ---- WhatsApp custom templates ----
  createWhatsappTemplate: makeFunctionReference<
    'mutation',
    {
      eventId: string;
      requesterId: string;
      bodyText: string;
      ctaLabel: string;
      nameHint?: string;
    },
    { id: string; name: string }
  >('whatsappTemplates:create'),
  updateWhatsappTemplateDraft: makeFunctionReference<
    'mutation',
    {
      templateId: string;
      requesterId: string;
      bodyText?: string;
      ctaLabel?: string;
    },
    { ok: true }
  >('whatsappTemplates:updateDraft'),
  submitWhatsappTemplateToMeta: makeFunctionReference<
    'action',
    { templateId: string; requesterId: string },
    { ok: boolean; mock?: boolean; metaTemplateId?: string; error?: string }
  >('whatsappTemplates:submitToMeta'),
  listWhatsappTemplatesByEvent: makeFunctionReference<
    'query',
    { eventId: string; requesterId: string },
    Array<{
      _id: string;
      name: string;
      bodyText: string;
      ctaLabel: string;
      ctaUrlPattern: string;
      status: 'draft' | 'pending' | 'approved' | 'rejected' | 'paused' | 'disabled';
      metaTemplateId?: string;
      rejectionReason?: string;
      submittedAt?: number;
      reviewedAt?: number;
      createdAt: number;
      updatedAt: number;
    }>
  >('whatsappTemplates:listByEvent'),
  applyWhatsappTemplateWebhook: makeFunctionReference<
    'mutation',
    {
      metaTemplateId: string;
      metaName?: string;
      status: string;
      reason?: string;
    },
    { ok: true; status: string; changed: boolean } | { ok: false; error: 'TEMPLATE_NOT_FOUND' }
  >('whatsappTemplates:applyWebhookStatusUpdate'),
  dispatchTemplateNotifications: makeFunctionReference<
    'action',
    Record<string, never>,
    { dispatched: number; skipped: number }
  >('whatsappTemplateNotifications:dispatchPendingNotifications'),

  // ---- Admin dashboard ----
  adminDashboardKpi: makeFunctionReference<
    'query',
    { adminId: string },
    {
      totalUsers: number;
      usersByRole: { couple: number; pro: number; guest: number; admin: number };
      totalEvents: number;
      activeEvents: number;
      paidEvents: number;
      conversionRate: number;
      totalRevenueMinor: number;
      mrrMinor: number;
      failedPaymentsCount: number;
      failedPaymentsAmountMinor: number;
      activeSubscriptions: number;
      revenueByMonth: Record<string, number>;
      usersByMonth: Record<string, { couple: number; pro: number; guest: number }>;
      revenueByCurrency: Record<string, number>;
      revenueByProvider: Record<string, number>;
    }
  >('admin:dashboardKpi'),
  adminListUsers: makeFunctionReference<
    'query',
    { adminId: string },
    Array<{
      _id: string;
      phone?: string;
      email?: string;
      fullName?: string;
      role: 'couple' | 'pro' | 'guest' | 'admin';
      planTier?: string;
      createdAt: number;
      lastSeenAt?: number;
    }>
  >('admin:listUsers'),
  adminListAllEvents: makeFunctionReference<
    'query',
    { adminId: string },
    Array<{
      _id: string;
      title: string;
      coupleNames: { partnerA: string; partnerB: string };
      eventDate: number;
      timezone: string;
      status: 'draft' | 'active' | 'archived' | 'cancelled';
      planTier?: string;
      maxGuests: number;
      ownerName: string | null;
      ownerEmail: string | null;
      organizationId?: string;
      createdAt: number;
      updatedAt: number;
    }>
  >('admin:listAllEvents'),
  adminListAllPayments: makeFunctionReference<
    'query',
    { adminId: string },
    Array<{
      _id: string;
      plan: 'essential' | 'premium';
      currency: 'EUR' | 'USD' | 'XOF' | 'MAD' | 'TND';
      amountMinor: number;
      provider: 'stripe' | 'cinetpay' | 'mock';
      status: 'pending' | 'succeeded' | 'failed' | 'cancelled';
      failureReason?: string;
      userName: string | null;
      userEmail: string | null;
      eventId: string;
      createdAt: number;
      updatedAt: number;
    }>
  >('admin:listAllPayments'),
  adminListAllOrganizations: makeFunctionReference<
    'query',
    { adminId: string },
    Array<{
      _id: string;
      name: string;
      slug: string;
      subscriptionTier?: string;
      subscriptionStatus?: string;
      subscriptionPeriodEnd?: number;
      paygCredits?: number;
      ownerName: string | null;
      ownerEmail: string | null;
      createdAt: number;
    }>
  >('admin:listAllOrganizations'),
  adminListPendingPhotos: makeFunctionReference<
    'query',
    { adminId: string },
    Array<{
      _id: string;
      eventId: string;
      s3Key?: string;
      status: string;
      sizeBytes: number;
      contentType: string;
      uploaderName?: string;
      variants?: { thumb?: string; medium?: string; large?: string };
      createdAt: number;
    }>
  >('admin:listPendingPhotos'),
  adminListAllWhatsappTemplates: makeFunctionReference<
    'query',
    { adminId: string },
    Array<{
      _id: string;
      eventId: string;
      name: string;
      bodyText: string;
      ctaLabel: string;
      status: string;
      rejectionReason?: string;
      submittedAt?: number;
      reviewedAt?: number;
      createdAt: number;
    }>
  >('admin:listAllWhatsappTemplates'),
  adminListNewsletterSubscribers: makeFunctionReference<
    'query',
    { adminId: string },
    Array<{
      _id: string;
      email: string;
      status: 'active' | 'unsubscribed';
      source?: string;
      subscribedAt: number;
      unsubscribedAt?: number;
    }>
  >('admin:listNewsletterSubscribers'),
  adminListAuditLog: makeFunctionReference<
    'query',
    { adminId: string },
    Array<{
      _id: string;
      adminName: string | null;
      adminEmail: string | null;
      action: string;
      targetType: string;
      targetId: string;
      details?: string;
      createdAt: number;
    }>
  >('admin:listAuditLog'),
  adminSuspendUser: makeFunctionReference<
    'mutation',
    { adminId: string; targetUserId: string },
    { ok: true }
  >('admin:suspendUser'),
  adminChangeUserRole: makeFunctionReference<
    'mutation',
    { adminId: string; targetUserId: string; newRole: 'couple' | 'pro' | 'guest' | 'admin' },
    { ok: true }
  >('admin:changeUserRole'),
  adminUpdateEventStatus: makeFunctionReference<
    'mutation',
    {
      adminId: string;
      eventId: string;
      newStatus: 'draft' | 'active' | 'archived' | 'cancelled';
    },
    { ok: true }
  >('admin:updateEventStatus'),
  adminModeratePhoto: makeFunctionReference<
    'mutation',
    { adminId: string; photoId: string; decision: 'approved' | 'rejected' },
    { ok: true }
  >('admin:adminModeratePhoto'),
  adminDeleteEvent: makeFunctionReference<
    'mutation',
    { adminId: string; eventId: string },
    { ok: true }
  >('admin:deleteEvent'),
} satisfies Record<
  string,
  FunctionReference<'query' | 'mutation' | 'action', 'public', Args, unknown>
>;
