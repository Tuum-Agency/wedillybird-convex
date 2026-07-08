import 'server-only';
import { ConvexHttpClient } from 'convex/browser';
import { makeFunctionReference, type FunctionReference } from 'convex/server';
import type { BudgetCurrency } from '@/lib/currency';

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

/** Union des statuts d'un devis/facture (cf. `lib/pro/quotes.ts`). */
type QuoteDocStatus =
  | 'draft'
  | 'sent'
  | 'accepted'
  | 'refused'
  | 'expired'
  | 'partial'
  | 'paid'
  | 'overdue';

/** Union des statuts d'un contrat (cf. `lib/pro/contracts.ts`). */
type ContractStatus = 'draft' | 'sent' | 'signed_client' | 'countersigned' | 'active' | 'cancelled';

export const convexApi = {
  requestOtp: makeFunctionReference<'action', { phone: string; ipAddress?: string }>(
    'auth:requestOtp',
  ),
  verifyOtp: makeFunctionReference<
    'mutation',
    { phone: string; code: string },
    { userId: string; sessionToken: string; phone: string; isNewUser: boolean }
  >('auth:verifyOtp'),
  requestMagicLink: makeFunctionReference<
    'action',
    { email: string; ipAddress?: string; locale?: string },
    { email: string }
  >('auth:requestMagicLink'),
  verifyMagicLink: makeFunctionReference<
    'mutation',
    { email: string; token: string },
    { userId: string; sessionToken: string; email: string; isNewUser: boolean }
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
    {
      userId: string;
      fullName: string;
      role: 'couple' | 'pro';
      email: string;
      preferredCurrency?: BudgetCurrency;
    },
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
      currency?: BudgetCurrency;
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
      shape?: 'round' | 'oval' | 'rect' | 'square';
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
    {
      eventId: string;
      requesterId: string;
      mode?: 'unplaced' | 'all';
      settings?: {
        groupByCategory?: boolean;
        keepGroupsTogether?: boolean;
        balanceTables?: boolean;
        createTables?: boolean;
      };
    },
    { assigned: number; tablesCreated: number; unplaced: number }
  >('seating:autoAssignGuests'),
  getSeatingPlan: makeFunctionReference<
    'query',
    { eventId: string; requesterId: string },
    {
      tables: Array<{
        _id: string;
        name: string;
        capacity: number;
        shape?: 'round' | 'oval' | 'rect' | 'square';
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
      invitationCinematic?: string;
      invitationMusic?: {
        source: 'library' | 'custom';
        trackId?: string;
        s3Key?: string;
        title?: string;
      };
      clearInvitationMusic?: boolean;
      invitationPhoto?: { s3Key: string; width?: number; height?: number };
      clearInvitationPhoto?: boolean;
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
      hdUpsellPurchasedAt?: number;
      invitationCinematic?: string;
      invitationMusic?: {
        source: 'library' | 'custom';
        trackId?: string;
        s3Key?: string;
        title?: string;
      };
      invitationPhoto?: { s3Key: string; width?: number; height?: number };
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
  // ---- Espace couple (mariages d'agence) ----
  linkCouple: makeFunctionReference<
    'mutation',
    { eventId: string; requesterId: string; phone: string },
    { ok: true; userId: string; alreadyLinked: boolean }
  >('events:linkCouple'),
  unlinkCouple: makeFunctionReference<
    'mutation',
    { eventId: string; requesterId: string },
    { ok: true }
  >('events:unlinkCouple'),
  coupleLinks: makeFunctionReference<
    'query',
    { eventId: string; requesterId: string },
    Array<{ userId: string; phone: string; invitedAt: number }>
  >('events:coupleLinks'),
  coupleOverview: makeFunctionReference<
    'query',
    { eventId: string; requesterId: string },
    {
      _id: string;
      title: string;
      coupleNames: { partnerA: string; partnerB: string };
      eventDate: number;
      timezone: string;
      venue: { name: string; address: string } | null;
      status: string;
      guestStats: {
        total: number;
        attending: number;
        declined: number;
        maybe: number;
        pending: number;
        expectedHeadcount: number;
      };
    }
  >('events:coupleOverview'),
  listMineAsCouple: makeFunctionReference<
    'query',
    { userId: string },
    Array<{
      _id: string;
      title: string;
      coupleNames: { partnerA: string; partnerB: string };
      eventDate: number;
      venue: { name: string; address: string } | null;
      status: string;
    }>
  >('events:listMineAsCouple'),
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

  /* ============ Espace couple self-serve (/mon-mariage) ============ */
  coupleSpaceBundle: makeFunctionReference<
    'query',
    { requesterId: string },
    import('@/lib/mon-mariage/types').MmBundle | null
  >('coupleSpace:bundle'),
  coupleAddVendor: makeFunctionReference<
    'mutation',
    {
      eventId: string;
      requesterId: string;
      name: string;
      category: string;
      status: 'a_contacter' | 'contacte' | 'devis' | 'reserve' | 'paye';
      amountMinor: number;
      paidMinor: number;
      contact?: string;
      email?: string;
      note?: string;
      attachments?: Array<{ name: string; kind: string }>;
    },
    string
  >('coupleSpace:addVendor'),
  coupleUpdateVendor: makeFunctionReference<
    'mutation',
    {
      vendorId: string;
      requesterId: string;
      name?: string;
      category?: string;
      status?: 'a_contacter' | 'contacte' | 'devis' | 'reserve' | 'paye';
      amountMinor?: number;
      paidMinor?: number;
      contact?: string;
      email?: string;
      note?: string;
      attachments?: Array<{ name: string; kind: string }>;
    },
    null
  >('coupleSpace:updateVendor'),
  coupleRemoveVendor: makeFunctionReference<
    'mutation',
    { vendorId: string; requesterId: string },
    null
  >('coupleSpace:removeVendor'),
  coupleAddPayment: makeFunctionReference<
    'mutation',
    {
      eventId: string;
      requesterId: string;
      vendorId?: string;
      vendorName: string;
      category: string;
      kind: 'deposit' | 'balance' | 'other';
      dueDate: number;
      amountMinor: number;
    },
    string
  >('coupleSpace:addPayment'),
  coupleSetPaymentPaid: makeFunctionReference<
    'mutation',
    {
      paymentId: string;
      requesterId: string;
      paidMinor: number;
      paidAt?: number;
      attachments?: Array<{ name: string; kind: string }>;
    },
    null
  >('coupleSpace:setPaymentPaid'),
  coupleRemovePayment: makeFunctionReference<
    'mutation',
    { paymentId: string; requesterId: string },
    null
  >('coupleSpace:removePayment'),
  coupleSetBudgetEnvelope: makeFunctionReference<
    'mutation',
    { eventId: string; requesterId: string; budgetEnvelopeMinor: number },
    null
  >('coupleSpace:setBudgetEnvelope'),
  coupleEnsureDefaultPlanning: makeFunctionReference<
    'mutation',
    { eventId: string; requesterId: string },
    { seeded: boolean }
  >('coupleSpace:ensureDefaultPlanning'),
  coupleAddPhase: makeFunctionReference<
    'mutation',
    { eventId: string; requesterId: string; label: string; sub?: string },
    string
  >('coupleSpace:addPhase'),
  coupleAddTask: makeFunctionReference<
    'mutation',
    { phaseId: string; requesterId: string; label: string; dueDate?: number },
    string
  >('coupleSpace:addTask'),
  coupleSetTaskStatus: makeFunctionReference<
    'mutation',
    { taskId: string; requesterId: string; status: 'todo' | 'doing' | 'done' },
    null
  >('coupleSpace:setTaskStatus'),
  coupleRemoveTask: makeFunctionReference<
    'mutation',
    { taskId: string; requesterId: string },
    null
  >('coupleSpace:removeTask'),
  coupleSaveRoom: makeFunctionReference<
    'mutation',
    {
      eventId: string;
      requesterId: string;
      name: string;
      widthM: number;
      lengthM: number;
      floor: 'parquet' | 'marble' | 'carpet' | 'grass' | 'concrete';
      elements: Array<{
        id: string;
        kind:
          | 'dancefloor'
          | 'stage'
          | 'dj'
          | 'bar'
          | 'buffet'
          | 'cake'
          | 'photobooth'
          | 'gifts'
          | 'guestbook'
          | 'entrance'
          | 'arch'
          | 'plant';
        x: number;
        y: number;
        w: number;
        h: number;
        rotation: number;
        label?: string;
      }>;
    },
    string
  >('coupleSpace:saveRoom'),
  coupleUpsertTable: makeFunctionReference<
    'mutation',
    {
      eventId: string;
      requesterId: string;
      tableId?: string;
      name: string;
      shape: 'round' | 'oval' | 'rect' | 'square' | 'imperial' | 'sweetheart' | 'head';
      capacity: number;
      x: number;
      y: number;
      rotation: number;
      honor?: boolean;
      notes?: string;
    },
    string
  >('coupleSpace:upsertTable'),
  coupleRemoveTable: makeFunctionReference<
    'mutation',
    { tableId: string; requesterId: string },
    null
  >('coupleSpace:removeTable'),
  coupleAssignGuestTable: makeFunctionReference<
    'mutation',
    { guestId: string; requesterId: string; tableId: string | null },
    null
  >('coupleSpace:assignGuestTable'),
  coupleSetInvitationDesign: makeFunctionReference<
    'mutation',
    {
      eventId: string;
      requesterId: string;
      cinematic?: string;
      music?: {
        source: 'library' | 'custom';
        trackId?: string;
        s3Key?: string;
        title?: string;
      };
      clearMusic?: boolean;
      photo?: { s3Key: string; width?: number; height?: number };
      clearPhoto?: boolean;
    },
    null
  >('coupleSpace:setInvitationDesign'),
  createInvitationMusicUploadUrl: makeFunctionReference<
    'action',
    { eventId: string; requesterId: string; contentType: string },
    { uploadUrl: string; s3Key: string }
  >('invitationAudio:createInvitationMusicUploadUrl'),
  createInvitationPhotoUploadUrl: makeFunctionReference<
    'action',
    { eventId: string; requesterId: string; contentType: string },
    { uploadUrl: string; s3Key: string }
  >('invitationAudio:createInvitationPhotoUploadUrl'),
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
        invitationCinematic?: string;
        invitationMusic: {
          source: 'library' | 'custom';
          trackId?: string;
          title?: string;
          customUrl?: string;
        } | null;
        invitationPhoto: { url: string; width?: number; height?: number } | null;
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
      provider: 'stripe' | 'mock';
      providerSessionId: string;
      affiliateId?: string;
    },
    { id: string }
  >('payments:recordIntent'),
  getAffiliateByCode: makeFunctionReference<
    'query',
    { code: string },
    {
      id: string;
      code: string;
      kind: 'referral' | 'partner';
      rewardType: 'credit' | 'cash';
      buyerDiscountBps: number;
    } | null
  >('affiliate:getAffiliateByCode'),
  createAffiliate: makeFunctionReference<
    'mutation',
    {
      adminId: string;
      code: string;
      kind: 'referral' | 'partner';
      rewardType: 'credit' | 'cash';
      rateBps: number;
      buyerDiscountBps: number;
      ownerUserId?: string;
      ownerEmail?: string;
      displayName?: string;
    },
    { id: string; code: string }
  >('affiliate:createAffiliate'),
  setAffiliateStatus: makeFunctionReference<
    'mutation',
    { adminId: string; affiliateId: string; status: 'active' | 'disabled' },
    null
  >('affiliate:setAffiliateStatus'),
  listAffiliates: makeFunctionReference<
    'query',
    { adminId: string },
    Array<{
      id: string;
      code: string;
      kind: 'referral' | 'partner';
      rewardType: 'credit' | 'cash';
      rateBps: number;
      buyerDiscountBps: number;
      ownerEmail: string | null;
      displayName: string | null;
      status: 'active' | 'disabled';
      createdAt: number;
    }>
  >('affiliate:listAffiliates'),
  listReferrals: makeFunctionReference<
    'query',
    {
      adminId: string;
      status?: 'pending' | 'vested' | 'paid' | 'credited' | 'reversed';
    },
    Array<{
      id: string;
      affiliateId: string;
      code: string;
      status: 'pending' | 'vested' | 'paid' | 'credited' | 'reversed';
      rewardType: 'credit' | 'cash';
      rewardMinor: number;
      netMinor: number;
      currency: string;
      vestsAt: number;
      createdAt: number;
    }>
  >('affiliate:listReferrals'),
  previewCreditApplication: makeFunctionReference<
    'query',
    { userId: string; currency: string; orderMinor: number },
    { appliedMinor: number; referralIds: string[] }
  >('affiliate:previewCreditApplication'),
  registerCreditApplication: makeFunctionReference<
    'mutation',
    { userId: string; sourceSessionId: string; currency: string; referralIds: string[] },
    { appliedMinor: number }
  >('affiliate:registerCreditApplication'),
  referralForUser: makeFunctionReference<
    'query',
    { userId: string; currency: string },
    { code: string | null; availableMinor: number }
  >('affiliate:referralForUser'),
  ensureReferralCode: makeFunctionReference<
    'mutation',
    { userId: string },
    { affiliateId: string; code: string }
  >('affiliate:ensureReferralCode'),
  findPaymentBySession: makeFunctionReference<
    'query',
    { provider: 'stripe' | 'mock'; providerSessionId: string },
    {
      _id: string;
      userId: string;
      eventId: string;
      kind?: 'plan' | 'post_event_upsell';
      plan?: 'essential' | 'premium';
      currency: 'EUR' | 'USD' | 'XOF' | 'MAD' | 'TND';
      amountMinor: number;
      provider: 'stripe' | 'mock';
      providerSessionId: string;
      providerEventId?: string;
      status: 'pending' | 'succeeded' | 'failed' | 'cancelled';
    } | null
  >('payments:findBySession'),
  requestPhotoBook: makeFunctionReference<
    'mutation',
    {
      eventId: string;
      requesterId: string;
      recipientName: string;
      addressLine1: string;
      addressLine2?: string;
      city: string;
      postalCode: string;
      country: string;
      notes?: string;
    },
    { id: string; status: 'requested' }
  >('photoBooks:request'),
  getPhotoBookOrder: makeFunctionReference<
    'query',
    { eventId: string; requesterId: string },
    {
      _id: string;
      status: 'requested' | 'in_production' | 'shipped' | 'cancelled';
      recipientName: string;
      city: string;
      country: string;
      createdAt: number;
    } | null
  >('photoBooks:getForEvent'),
  applyPostEventUpsell: makeFunctionReference<
    'mutation',
    {
      webhookSecret: string;
      eventId: string;
      requesterId: string;
      provider: 'stripe' | 'mock';
      providerSessionId: string;
      amountMinor: number;
      currency: 'EUR' | 'USD' | 'XOF' | 'MAD' | 'TND';
    },
    { ok: true; alreadyApplied: boolean }
  >('payments:applyPostEventUpsell'),
  markPaymentSucceeded: makeFunctionReference<
    'mutation',
    {
      provider: 'stripe' | 'mock';
      providerSessionId: string;
      providerEventId: string;
    },
    { ok: true; alreadyApplied: boolean }
  >('payments:markSucceeded'),
  markPaymentFailed: makeFunctionReference<
    'mutation',
    {
      provider: 'stripe' | 'mock';
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
      kind?: 'plan' | 'post_event_upsell';
      plan?: 'essential' | 'premium';
      currency: 'EUR' | 'USD' | 'XOF' | 'MAD' | 'TND';
      amountMinor: number;
      provider: 'stripe' | 'mock';
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
        provider: 'stripe' | 'mock';
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
      currency?: BudgetCurrency;
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
      currency: BudgetCurrency | null;
      logoUrl: string | null;
      customDomain?: string;
      senderEmail?: string;
      whiteLabelFull: boolean;
      notificationPrefs: {
        rsvp?: { email: boolean; app: boolean };
        payment?: { email: boolean; app: boolean };
        newLead?: { email: boolean; app: boolean };
        taskDue?: { email: boolean; app: boolean };
        weeklyDigest?: { email: boolean; app: boolean };
      } | null;
      messagingDefaults: {
        channel: 'whatsapp' | 'sms' | 'auto';
        senderName: string;
        defaultTemplate: 'editorial' | 'classic' | 'modern' | 'festive' | 'sober';
        reminderJ7: boolean;
        reminderJ1: boolean;
      } | null;
      stripeCustomerId?: string;
      subscriptionTier?: 'starter' | 'business' | 'agency';
      subscriptionStatus?: 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid';
      subscriptionPeriodEnd?: number;
      myRole: 'owner' | 'admin' | 'planner' | 'viewer';
    } | null
  >('organizations:myOrganization'),
  updateNotificationPrefs: makeFunctionReference<
    'mutation',
    {
      organizationId: string;
      requesterId: string;
      prefs: Record<
        'rsvp' | 'payment' | 'newLead' | 'taskDue' | 'weeklyDigest',
        { email: boolean; app: boolean }
      >;
    },
    { ok: true }
  >('organizations:updateNotificationPrefs'),
  updateMessagingDefaults: makeFunctionReference<
    'mutation',
    {
      organizationId: string;
      requesterId: string;
      defaults: {
        channel: 'whatsapp' | 'sms' | 'auto';
        senderName: string;
        defaultTemplate: 'editorial' | 'classic' | 'modern' | 'festive' | 'sober';
        reminderJ7: boolean;
        reminderJ1: boolean;
      };
    },
    { ok: true }
  >('organizations:updateMessagingDefaults'),
  updateWhiteLabel: makeFunctionReference<
    'mutation',
    {
      organizationId: string;
      requesterId: string;
      customDomain?: string;
      senderEmail?: string;
      whiteLabelFull?: boolean;
    },
    { ok: true }
  >('organizations:updateWhiteLabel'),
  setPaymentsSettings: makeFunctionReference<
    'mutation',
    {
      organizationId: string;
      requesterId: string;
      mode?: 'byop' | 'manual';
    },
    { ok: true }
  >('organizations:setPaymentsSettings'),
  proCockpit: makeFunctionReference<
    'query',
    { userId: string },
    {
      org: {
        _id: string;
        name: string;
        slug: string;
        primaryColor?: string;
        logoUrl: string | null;
        subscriptionTier?: 'starter' | 'business' | 'agency';
        subscriptionStatus?: 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid';
        subscriptionPeriodEnd?: number;
        paygCredits: number;
      };
      myRole: 'owner' | 'admin' | 'planner' | 'viewer';
      usage: {
        activeEvents: number;
        storageBytes: number;
        whatsappMessagesThisMonth: number;
        seatsUsed: number;
      };
      kpis: {
        activeWeddings: number;
        pendingRsvp: number;
        totalEvents: number;
        draftEvents: number;
        weekDeadlines: number;
        weddingsThisMonth: number;
        respondedLast7: number;
        collectedMinor: number;
        paidInvoicesCount: number;
      };
      kpiTrends: {
        weddings: number[];
        rsvp: number[];
        tasksDone: number[];
        revenue: number[];
      };
      upcoming: Array<{
        _id: string;
        partnerA: string;
        partnerB: string;
        eventDate: number;
        timezone: string;
        venue?: string;
        daysUntil: number;
        rsvpAttending: number;
        rsvpTotal: number;
        status: 'draft' | 'active' | 'archived' | 'cancelled';
      }>;
      pipeline: Array<{
        stage: 'lead' | 'contacted' | 'quote' | 'booked' | 'in_progress' | 'delivered';
        count: number;
      }>;
      deadlines: Array<{
        _id: string;
        title: string;
        dueDate: number;
        daysUntil: number;
        eventId: string;
        coupleLabel: string;
      }>;
      overdueTasks: number;
      recentActivity: Array<{
        kind: 'client' | 'task' | 'event' | 'event_draft';
        label: string;
        daysAgo: number;
      }>;
      rsvpTrend: number[];
    } | null
  >('pro:cockpit'),
  // ---- CRM clients (Business+) ----
  clientsListByOrg: makeFunctionReference<
    'query',
    { organizationId: string; requesterId: string },
    Array<{
      _id: string;
      partnerA: string;
      partnerB?: string;
      phone?: string;
      email?: string;
      whatsapp?: string;
      stage: 'lead' | 'contacted' | 'quote' | 'booked' | 'in_progress' | 'delivered';
      source?: string;
      weddingDate?: number;
      venue?: string;
      budgetMinor?: number;
      budgetBookedMinor?: number;
      assigneeId?: string;
      assigneeName?: string;
      notes?: string;
      eventId?: string;
      lastContactAt?: number;
      createdAt: number;
      updatedAt: number;
    }>
  >('clients:listByOrg'),
  clientNotesByClient: makeFunctionReference<
    'query',
    { clientId: string; requesterId: string },
    Array<{
      _id: string;
      type: 'note' | 'status' | 'call' | 'email' | 'payment';
      text: string;
      authorName?: string;
      createdAt: number;
    }> | null
  >('clients:notesByClient'),
  createClient: makeFunctionReference<
    'mutation',
    {
      organizationId: string;
      requesterId: string;
      partnerA: string;
      partnerB?: string;
      phone?: string;
      email?: string;
      whatsapp?: string;
      stage?: 'lead' | 'contacted' | 'quote' | 'booked' | 'in_progress' | 'delivered';
      source?: string;
      weddingDate?: number;
      venue?: string;
      budgetMinor?: number;
      budgetBookedMinor?: number;
      assigneeId?: string;
      notes?: string;
    },
    { id: string }
  >('clients:create'),
  updateClient: makeFunctionReference<
    'mutation',
    {
      clientId: string;
      requesterId: string;
      partnerA?: string;
      partnerB?: string;
      phone?: string;
      email?: string;
      whatsapp?: string;
      stage?: 'lead' | 'contacted' | 'quote' | 'booked' | 'in_progress' | 'delivered';
      source?: string;
      weddingDate?: number;
      venue?: string;
      budgetMinor?: number;
      budgetBookedMinor?: number;
      assigneeId?: string;
      clearAssignee?: boolean;
      notes?: string;
    },
    { ok: true }
  >('clients:update'),
  addClientNote: makeFunctionReference<
    'mutation',
    { clientId: string; requesterId: string; text: string },
    { ok: true }
  >('clients:addClientNote'),
  updateClientStage: makeFunctionReference<
    'mutation',
    {
      clientId: string;
      requesterId: string;
      stage: 'lead' | 'contacted' | 'quote' | 'booked' | 'in_progress' | 'delivered';
    },
    { ok: true }
  >('clients:updateStage'),
  removeClient: makeFunctionReference<
    'mutation',
    { clientId: string; requesterId: string },
    { ok: true }
  >('clients:remove'),
  convertClientToWedding: makeFunctionReference<
    'mutation',
    { clientId: string; requesterId: string },
    { eventId: string; alreadyConverted: boolean }
  >('clients:convertToWedding'),
  // ---- Budget (lecture tous tiers, édition Business+) ----
  budgetListByEvent: makeFunctionReference<
    'query',
    { eventId: string; requesterId: string },
    {
      eventId: string;
      coupleNames: { partnerA: string; partnerB: string };
      envelopeMinor: number;
      lines: Array<{
        _id: string;
        category: string;
        label: string;
        vendorName?: string;
        plannedMinor: number;
        paidMinor: number;
        dueDate?: number;
        createdAt: number;
        updatedAt: number;
        payments: Array<{
          _id: string;
          amountMinor: number;
          method: 'transfer' | 'card' | 'cash' | 'check' | 'online' | 'other';
          status: 'succeeded' | 'pending' | 'failed';
          paidAt: number;
          note?: string;
          proofFileName?: string;
          proofUrl: string | null;
          provider?: 'stripe' | 'mock';
          checkoutUrl?: string;
          createdAt: number;
        }>;
      }>;
    } | null
  >('budget:listByEvent'),
  createBudgetLine: makeFunctionReference<
    'mutation',
    {
      eventId: string;
      requesterId: string;
      category: string;
      label: string;
      vendorName?: string;
      plannedMinor: number;
      paidMinor?: number;
      dueDate?: number;
    },
    { id: string }
  >('budget:createLine'),
  updateBudgetLine: makeFunctionReference<
    'mutation',
    {
      lineId: string;
      requesterId: string;
      category?: string;
      label?: string;
      vendorName?: string;
      plannedMinor?: number;
      dueDate?: number;
      clearDueDate?: boolean;
    },
    { ok: true }
  >('budget:updateLine'),
  removeBudgetLine: makeFunctionReference<
    'mutation',
    { lineId: string; requesterId: string },
    { ok: true }
  >('budget:removeLine'),
  setBudgetEnvelope: makeFunctionReference<
    'mutation',
    { eventId: string; requesterId: string; envelopeMinor: number },
    { ok: true }
  >('budget:setEnvelope'),
  addBudgetPayment: makeFunctionReference<
    'mutation',
    {
      lineId: string;
      requesterId: string;
      amountMinor: number;
      method: 'transfer' | 'card' | 'cash' | 'check' | 'other';
      paidAt?: number;
      note?: string;
      proofStorageId?: string;
      proofFileName?: string;
    },
    { id: string }
  >('budget:addPayment'),
  removeBudgetPayment: makeFunctionReference<
    'mutation',
    { paymentId: string; requesterId: string },
    { ok: true }
  >('budget:removePayment'),
  generateBudgetProofUploadUrl: makeFunctionReference<
    'mutation',
    { lineId: string; requesterId: string },
    { uploadUrl: string }
  >('budget:generateProofUploadUrl'),
  createBudgetOnlinePaymentIntent: makeFunctionReference<
    'mutation',
    { lineId: string; requesterId: string; amountMinor: number; note?: string },
    {
      id: string;
      eventId: string;
      label: string;
      vendorName?: string;
      connectAccountId: string | null;
    }
  >('budget:createOnlinePaymentIntent'),
  attachBudgetOnlineSession: makeFunctionReference<
    'mutation',
    { paymentId: string; requesterId: string; providerSessionId: string; checkoutUrl: string },
    { ok: true }
  >('budget:attachOnlineSession'),
  markBudgetOnlinePaymentSucceeded: makeFunctionReference<
    'mutation',
    {
      webhookSecret: string;
      paymentId: string;
      providerSessionId: string;
      stripeConnectAccountId?: string;
      receiptUrl?: string;
    },
    { ok: true; alreadyApplied: boolean }
  >('budget:markOnlinePaymentSucceeded'),
  markBudgetOnlinePaymentFailed: makeFunctionReference<
    'mutation',
    { webhookSecret: string; paymentId: string; providerSessionId: string },
    { ok: true; alreadyApplied: boolean }
  >('budget:markOnlinePaymentFailed'),
  // ---- Liens de paiement génériques (facture / libre) ----
  createPaymentLinkIntent: makeFunctionReference<
    'mutation',
    {
      organizationId: string;
      requesterId: string;
      kind: 'invoice' | 'free';
      invoiceDocId?: string;
      invoiceMilestoneIndex?: number;
      amountMinor?: number;
      description?: string;
      clientName?: string;
    },
    { id: string; connectAccountId: string; description: string; amountMinor: number }
  >('paymentLinks:createIntent'),
  attachPaymentLinkSession: makeFunctionReference<
    'mutation',
    { paymentLinkId: string; requesterId: string; providerSessionId: string; checkoutUrl: string },
    { ok: true }
  >('paymentLinks:attachSession'),
  removePaymentLink: makeFunctionReference<
    'mutation',
    { paymentLinkId: string; requesterId: string },
    { ok: true }
  >('paymentLinks:remove'),
  markPaymentLinkSucceeded: makeFunctionReference<
    'mutation',
    {
      webhookSecret: string;
      paymentLinkId: string;
      providerSessionId: string;
      stripeConnectAccountId?: string;
      receiptUrl?: string;
    },
    { ok: true; alreadyApplied: boolean }
  >('paymentLinks:markSucceeded'),
  markPaymentLinkFailed: makeFunctionReference<
    'mutation',
    { webhookSecret: string; paymentLinkId: string; providerSessionId: string },
    { ok: true; alreadyApplied: boolean }
  >('paymentLinks:markFailed'),
  listPaymentLinks: makeFunctionReference<
    'query',
    { organizationId: string; requesterId: string },
    Array<{
      _id: string;
      kind: 'invoice' | 'free';
      amountMinor: number;
      description: string;
      clientName?: string;
      status: 'pending' | 'succeeded' | 'failed';
      checkoutUrl?: string;
      receiptUrl?: string;
      createdAt: number;
      paidAt?: number;
    }>
  >('paymentLinks:listByOrg'),
  listPaymentLinksForEvent: makeFunctionReference<
    'query',
    { eventId: string; requesterId: string },
    Array<{
      _id: string;
      amountMinor: number;
      currency: string;
      description: string;
      status: 'pending' | 'succeeded' | 'failed';
      checkoutUrl?: string;
      receiptUrl?: string;
      createdAt: number;
      paidAt?: number;
    }>
  >('paymentLinks:listForEvent'),
  // ---- Rétroplanning (tous tiers) ----
  planningListByEvent: makeFunctionReference<
    'query',
    { eventId: string; requesterId: string },
    {
      eventId: string;
      coupleNames: { partnerA: string; partnerB: string };
      eventDate: number;
      tasks: Array<{
        _id: string;
        phase: 'm12' | 'm6' | 'm3' | 'm1' | 'd7' | 'dday' | 'after';
        title: string;
        done: boolean;
        status: 'todo' | 'doing' | 'done';
        notes?: string;
        subtasks: Array<{ label: string; done: boolean }>;
        dueDate?: number;
        assigneeId?: string;
        priority?: 'low' | 'normal' | 'high';
        order: number;
      }>;
    } | null
  >('planning:listByEvent'),
  createPlanningTask: makeFunctionReference<
    'mutation',
    {
      eventId: string;
      requesterId: string;
      phase: 'm12' | 'm6' | 'm3' | 'm1' | 'd7' | 'dday' | 'after';
      title: string;
      dueDate?: number;
      assigneeId?: string;
      priority?: 'low' | 'normal' | 'high';
    },
    { id: string }
  >('planning:createTask'),
  createPlanningTasks: makeFunctionReference<
    'mutation',
    {
      eventId: string;
      requesterId: string;
      tasks: Array<{ phase: 'm12' | 'm6' | 'm3' | 'm1' | 'd7' | 'dday' | 'after'; title: string }>;
    },
    { created: number }
  >('planning:createTasks'),
  togglePlanningTask: makeFunctionReference<
    'mutation',
    { taskId: string; requesterId: string; done: boolean },
    { ok: true }
  >('planning:toggleTask'),
  setPlanningTaskStatus: makeFunctionReference<
    'mutation',
    { taskId: string; requesterId: string; status: 'todo' | 'doing' | 'done' },
    { ok: true }
  >('planning:setTaskStatus'),
  setPlanningSubtasks: makeFunctionReference<
    'mutation',
    { taskId: string; requesterId: string; subtasks: Array<{ label: string; done: boolean }> },
    { ok: true }
  >('planning:setSubtasks'),
  updatePlanningTask: makeFunctionReference<
    'mutation',
    {
      taskId: string;
      requesterId: string;
      title?: string;
      phase?: 'm12' | 'm6' | 'm3' | 'm1' | 'd7' | 'dday' | 'after';
      notes?: string;
      clearNotes?: boolean;
      dueDate?: number;
      clearDueDate?: boolean;
      assigneeId?: string;
      clearAssignee?: boolean;
      priority?: 'low' | 'normal' | 'high';
    },
    { ok: true }
  >('planning:updateTask'),
  removePlanningTask: makeFunctionReference<
    'mutation',
    { taskId: string; requesterId: string },
    { ok: true }
  >('planning:removeTask'),
  planningListTemplates: makeFunctionReference<
    'query',
    { organizationId: string; requesterId: string },
    Array<{
      _id: string;
      name: string;
      tasks: Array<{ phase: 'm12' | 'm6' | 'm3' | 'm1' | 'd7' | 'dday' | 'after'; title: string }>;
      createdAt: number;
    }>
  >('planning:listTemplates'),
  planningSaveTemplateFromEvent: makeFunctionReference<
    'mutation',
    { eventId: string; requesterId: string; name: string },
    { id: string; count: number }
  >('planning:saveTemplateFromEvent'),
  planningApplyTemplate: makeFunctionReference<
    'mutation',
    { eventId: string; requesterId: string; templateId: string },
    { created: number }
  >('planning:applyTemplate'),
  planningDeleteTemplate: makeFunctionReference<
    'mutation',
    { templateId: string; requesterId: string },
    { ok: true }
  >('planning:deleteTemplate'),
  // ---- Prestataires (annuaire, tous tiers ; Starter ≤ 25) ----
  vendorsListByOrg: makeFunctionReference<
    'query',
    { organizationId: string; requesterId: string },
    Array<{
      _id: string;
      name: string;
      category: string;
      location?: string;
      phone?: string;
      email?: string;
      whatsapp?: string;
      website?: string;
      priceRange?: number;
      rating?: number;
      notes?: string;
      createdAt: number;
      updatedAt: number;
    }>
  >('vendors:listByOrg'),
  createVendor: makeFunctionReference<
    'mutation',
    {
      organizationId: string;
      requesterId: string;
      name: string;
      category: string;
      location?: string;
      phone?: string;
      email?: string;
      whatsapp?: string;
      website?: string;
      priceRange?: number;
      rating?: number;
      notes?: string;
    },
    { id: string }
  >('vendors:create'),
  updateVendor: makeFunctionReference<
    'mutation',
    {
      vendorId: string;
      requesterId: string;
      name?: string;
      category?: string;
      location?: string;
      phone?: string;
      email?: string;
      whatsapp?: string;
      website?: string;
      priceRange?: number;
      rating?: number;
      notes?: string;
    },
    { ok: true }
  >('vendors:update'),
  removeVendor: makeFunctionReference<
    'mutation',
    { vendorId: string; requesterId: string },
    { ok: true }
  >('vendors:remove'),
  vendorListEngagementsByOrg: makeFunctionReference<
    'query',
    { organizationId: string; requesterId: string },
    Array<{
      _id: string;
      vendorId: string;
      eventId: string;
      status: 'contacted' | 'quoted' | 'booked' | 'confirmed';
      plannedMinor?: number;
      budgetLineId: string | null;
      vendorName: string;
      vendorCategory: string;
      vendorRating?: number;
      createdAt: number;
    }>
  >('vendors:listEngagementsByOrg'),
  vendorAttach: makeFunctionReference<
    'mutation',
    {
      organizationId: string;
      requesterId: string;
      vendorId: string;
      eventId: string;
      status: 'contacted' | 'quoted' | 'booked' | 'confirmed';
      plannedMinor?: number;
      createBudgetLine?: boolean;
    },
    { id: string; budgetLineCreated: boolean }
  >('vendors:attachVendor'),
  vendorSetEngagementStatus: makeFunctionReference<
    'mutation',
    {
      engagementId: string;
      requesterId: string;
      status: 'contacted' | 'quoted' | 'booked' | 'confirmed';
    },
    { ok: true }
  >('vendors:setEngagementStatus'),
  vendorDetach: makeFunctionReference<
    'mutation',
    { engagementId: string; requesterId: string },
    { ok: true }
  >('vendors:detachVendor'),
  // ---- Analytics consolidé (Agency) ----
  proAnalytics: makeFunctionReference<
    'query',
    { userId: string },
    {
      events: { total: number; active: number; draft: number; archived: number };
      clients: {
        total: number;
        byStage: Record<
          'lead' | 'contacted' | 'quote' | 'booked' | 'in_progress' | 'delivered',
          number
        >;
        bookedCount: number;
        conversionRate: number;
        pipelineBudgetMinor: number;
      };
      budget: { plannedMinor: number; paidMinor: number };
    } | null
  >('analytics:consolidated'),
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
  orgConnectStatus: makeFunctionReference<
    'query',
    { organizationId: string; requesterId: string },
    {
      accountId: string | null;
      chargesEnabled: boolean;
      payoutsEnabled: boolean;
      detailsSubmitted: boolean;
    }
  >('organizations:connectStatus'),
  setConnectAccount: makeFunctionReference<
    'mutation',
    { organizationId: string; requesterId: string; stripeConnectAccountId: string },
    { ok: true }
  >('organizations:setConnectAccount'),
  updateConnectStatus: makeFunctionReference<
    'mutation',
    {
      organizationId: string;
      requesterId: string;
      chargesEnabled: boolean;
      detailsSubmitted: boolean;
      payoutsEnabled: boolean;
    },
    { ok: true }
  >('organizations:updateConnectStatus'),
  disconnectStripeAccount: makeFunctionReference<
    'mutation',
    { organizationId: string; requesterId: string },
    { ok: true }
  >('organizations:disconnectStripeAccount'),
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
      venue?: string;
    }>
  >('organizations:listEvents'),
  listOrgMembers: makeFunctionReference<
    'query',
    { organizationId: string; requesterId: string },
    Array<{
      _id: string;
      userId?: string;
      role: 'owner' | 'admin' | 'planner' | 'viewer';
      status: 'pending' | 'active' | 'revoked';
      fullName?: string;
      phone?: string;
      email?: string;
      invitedAt: number;
      acceptedAt?: number;
    }>
  >('organizations:listMembers'),
  transferOrgOwnership: makeFunctionReference<
    'mutation',
    { organizationId: string; requesterId: string; newOwnerUserId: string },
    { ok: true }
  >('organizations:transferOwnership'),
  deleteOrganization: makeFunctionReference<
    'mutation',
    { organizationId: string; requesterId: string; confirmName: string },
    { ok: true }
  >('organizations:deleteOrganization'),
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
  updateMemberRole: makeFunctionReference<
    'mutation',
    { membershipId: string; requesterId: string; role: 'admin' | 'planner' | 'viewer' },
    { ok: true }
  >('organizations:updateMemberRole'),
  cancelOrgInvite: makeFunctionReference<
    'mutation',
    { membershipId: string; requesterId: string },
    { ok: true }
  >('organizations:cancelInvite'),
  resendOrgInvite: makeFunctionReference<
    'mutation',
    { membershipId: string; requesterId: string },
    { ok: true; inviteToken: string }
  >('organizations:resendInvite'),
  reactivateOrgMember: makeFunctionReference<
    'mutation',
    { membershipId: string; requesterId: string },
    { ok: true }
  >('organizations:reactivateMember'),
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
  newsletterUnsubscribe: makeFunctionReference<
    'mutation',
    { email: string },
    { ok: true; found: boolean }
  >('newsletter:unsubscribe'),
  newsletterListCampaigns: makeFunctionReference<
    'query',
    { adminId: string },
    Array<{
      _id: string;
      subject: string;
      status: 'sending' | 'sent' | 'failed';
      totalRecipients: number;
      sentCount: number;
      failedCount: number;
      createdAt: number;
      sentAt?: number;
    }>
  >('newsletter:listCampaigns'),
  newsletterSendCampaign: makeFunctionReference<
    'action',
    { adminId: string; subject: string; bodyText: string; testEmail?: string },
    | { ok: true; test: true; recipient: string }
    | { ok: true; test: false; campaignId: string; sentCount: number; failedCount: number }
    | { ok: false; error: string }
  >('emailActions:sendNewsletterCampaign'),
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
      netRevenueMinor: number;
      totalRefundedMinor: number;
      refundedPaymentsCount: number;
      mrrMinor: number;
      failedPaymentsCount: number;
      failedPaymentsAmountMinor: number;
      activeSubscriptions: number;
      pastDueSubscriptions: number;
      canceledSubscriptions: number;
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
      kind?: 'plan' | 'post_event_upsell';
      plan?: 'essential' | 'premium';
      currency: 'EUR' | 'USD' | 'XOF' | 'MAD' | 'TND';
      amountMinor: number;
      provider: 'stripe' | 'mock';
      status: 'pending' | 'succeeded' | 'failed' | 'cancelled' | 'refunded' | 'partially_refunded';
      failureReason?: string;
      refundedAmountMinor?: number;
      refundedAt?: number;
      userName: string | null;
      userEmail: string | null;
      eventId: string;
      createdAt: number;
      updatedAt: number;
    }>
  >('admin:listAllPayments'),
  adminListPhotoBookOrders: makeFunctionReference<
    'query',
    { adminId: string },
    Array<{
      _id: string;
      eventId: string;
      eventTitle: string | null;
      status: 'requested' | 'in_production' | 'shipped' | 'cancelled';
      recipientName: string;
      addressLine1: string;
      addressLine2?: string;
      city: string;
      postalCode: string;
      country: string;
      notes?: string;
      ownerName: string | null;
      ownerEmail: string | null;
      createdAt: number;
      updatedAt: number;
    }>
  >('admin:listPhotoBookOrders'),
  adminUpdatePhotoBookStatus: makeFunctionReference<
    'mutation',
    {
      adminId: string;
      orderId: string;
      status: 'requested' | 'in_production' | 'shipped' | 'cancelled';
    },
    { ok: true; status: 'requested' | 'in_production' | 'shipped' | 'cancelled' }
  >('admin:updatePhotoBookStatus'),
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
      hasStripeSubscription?: boolean;
      hasStripeCustomer?: boolean;
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
  adminGetPaymentRefundInfo: makeFunctionReference<
    'query',
    { adminId: string; paymentId: string },
    {
      _id: string;
      provider: 'stripe' | 'mock';
      providerSessionId: string;
      status: 'pending' | 'succeeded' | 'failed' | 'cancelled' | 'refunded' | 'partially_refunded';
      currency: string;
      amountMinor: number;
      refundedAmountMinor: number;
    }
  >('admin:getPaymentRefundInfo'),
  adminMarkPaymentRefunded: makeFunctionReference<
    'mutation',
    { adminId: string; paymentId: string; refundAmountMinor: number; stripeRefundId?: string },
    { ok: true; status: 'refunded' | 'partially_refunded' }
  >('admin:markPaymentRefunded'),
  adminGetOrgSubscriptionInfo: makeFunctionReference<
    'query',
    { adminId: string; organizationId: string },
    {
      _id: string;
      name: string;
      stripeSubscriptionId: string | null;
      stripeCustomerId: string | null;
      subscriptionTier: string | null;
      subscriptionStatus: string | null;
      subscriptionPeriodEnd: number | null;
    }
  >('admin:getOrgSubscriptionInfo'),
  adminMarkSubscriptionCanceled: makeFunctionReference<
    'mutation',
    { adminId: string; organizationId: string; mode: 'period_end' | 'immediate' },
    { ok: true }
  >('admin:markSubscriptionCanceled'),
  adminMarkSubscriptionReactivated: makeFunctionReference<
    'mutation',
    { adminId: string; organizationId: string },
    { ok: true }
  >('admin:markSubscriptionReactivated'),
  adminLogAction: makeFunctionReference<
    'mutation',
    {
      adminId: string;
      action: string;
      targetType: 'coupon' | 'discount' | 'subscription' | 'organization';
      targetId: string;
      details?: string;
    },
    { ok: true }
  >('admin:logAction'),
  adminPlatformAnalytics: makeFunctionReference<
    'query',
    { adminId: string; now?: number },
    {
      funnel: {
        couplesSignedUp: number;
        eventsCreated: number;
        eventsPublished: number;
        checkoutStarted: number;
        paid: number;
      };
      checkout: {
        intentsStarted: number;
        byStatus: {
          pending: number;
          succeeded: number;
          failed: number;
          cancelled: number;
          refunded: number;
        };
        abandonmentRate: number;
      };
      timing: { medianCheckoutMinutes: number; medianCreateToPayHours: number };
      seasonality: {
        eventsByEventMonth: Record<string, number>;
        eventsByCreatedMonth: Record<string, number>;
        eventsByWeekday: number[];
        upcoming: { next30: number; next60: number; next90: number };
      };
      mix: {
        planMix: { essential: number; premium: number };
        proTierMix: { starter: number; business: number; agency: number };
        avgGuests: number;
        aovMinor: number;
      };
      trend: {
        paidLast30: number;
        paidPrev30: number;
        revenueLast30Minor: number;
        revenuePrev30Minor: number;
        newEventsLast30: number;
        newEventsPrev30: number;
      };
      subscriptions: {
        byStatus: {
          active: number;
          trialing: number;
          past_due: number;
          canceled: number;
          unpaid: number;
        };
        mrrByTierMinor: { starter: number; business: number; agency: number };
      };
    }
  >('admin:platformAnalytics'),

  // ----- Devis & Factures (module Finances) -----
  quotesListByOrg: makeFunctionReference<
    'query',
    { organizationId: string; requesterId: string },
    {
      docs: Array<{
        _id: string;
        type: 'quote' | 'invoice';
        number: string;
        clientId?: string;
        clientName: string;
        eventId?: string;
        status: QuoteDocStatus;
        lineItems: Array<{ label: string; qty: number; unitPriceMinor: number }>;
        discountMinor?: number;
        discountPct?: number;
        taxRate?: number;
        schedule?: Array<{ label: string; amountMinor: number; dueDate?: number; paid: boolean }>;
        issueDate: number;
        dueDate?: number;
        notes?: string;
        createdAt: number;
        updatedAt: number;
      }>;
      clients: Array<{ _id: string; name: string }>;
      weddings: Array<{ _id: string; coupleNames: string; date: number }>;
    }
  >('quotes:listByOrg'),
  quotesGetById: makeFunctionReference<
    'query',
    { docId: string; requesterId: string },
    {
      doc: {
        _id: string;
        type: 'quote' | 'invoice';
        number: string;
        clientId?: string;
        clientName: string;
        eventId?: string;
        status: QuoteDocStatus;
        lineItems: Array<{ label: string; qty: number; unitPriceMinor: number }>;
        discountMinor?: number;
        discountPct?: number;
        taxRate?: number;
        schedule?: Array<{ label: string; amountMinor: number; dueDate?: number; paid: boolean }>;
        issueDate: number;
        dueDate?: number;
        notes?: string;
        createdAt: number;
        updatedAt: number;
      };
      activity: Array<{ _id: string; label: string; icon: string; createdAt: number }>;
    } | null
  >('quotes:getById'),
  quotesCreate: makeFunctionReference<
    'mutation',
    {
      organizationId: string;
      requesterId: string;
      type: 'quote' | 'invoice';
      clientId?: string;
      clientName?: string;
      eventId?: string;
      lineItems: Array<{ label: string; qty: number; unitPriceMinor: number }>;
      discountMinor?: number;
      discountPct?: number;
      taxRate?: number;
      schedule?: Array<{ label: string; amountMinor: number; dueDate?: number; paid: boolean }>;
      dueDate?: number;
      notes?: string;
      status?: QuoteDocStatus;
    },
    { id: string; number: string }
  >('quotes:create'),
  quotesUpdate: makeFunctionReference<
    'mutation',
    {
      docId: string;
      requesterId: string;
      clientId?: string;
      eventId?: string;
      lineItems?: Array<{ label: string; qty: number; unitPriceMinor: number }>;
      discountMinor?: number;
      discountPct?: number;
      taxRate?: number;
      schedule?: Array<{ label: string; amountMinor: number; dueDate?: number; paid: boolean }>;
      dueDate?: number;
      notes?: string;
    },
    { ok: true }
  >('quotes:update'),
  quotesUpdateStatus: makeFunctionReference<
    'mutation',
    { docId: string; requesterId: string; status: QuoteDocStatus },
    { ok: true }
  >('quotes:updateStatus'),
  quotesRecordSchedulePayment: makeFunctionReference<
    'mutation',
    { docId: string; requesterId: string; index: number },
    { ok: true; status: string }
  >('quotes:recordSchedulePayment'),
  quotesConvertToInvoice: makeFunctionReference<
    'mutation',
    { docId: string; requesterId: string },
    { id: string; number: string }
  >('quotes:convertToInvoice'),
  quotesRemove: makeFunctionReference<
    'mutation',
    { docId: string; requesterId: string },
    { ok: true }
  >('quotes:remove'),

  // ----- Paiements agence (module Finances) -----
  paymentsOverview: makeFunctionReference<
    'query',
    { organizationId: string; requesterId: string },
    {
      allowed: boolean;
      invoices: Array<{
        _id: string;
        number: string;
        clientName: string;
        eventId?: string;
        status: QuoteDocStatus;
        schedule: Array<{ label: string; amountMinor: number; dueDate?: number; paid: boolean }>;
      }>;
      account: {
        mode: 'byop' | 'manual';
        payoutSchedule: 'daily' | 'weekly' | 'manual';
        connected: boolean;
        country: 'FR';
      };
    }
  >('payments:overview'),

  // ----- Contrats (module Finances) -----
  contractsListByOrg: makeFunctionReference<
    'query',
    { organizationId: string; requesterId: string },
    {
      contracts: Array<{
        _id: string;
        number: string;
        clientId?: string;
        clientName: string;
        eventId?: string;
        quoteId?: string;
        status: ContractStatus;
        sections: Array<{ title: string; body: string }>;
        totalMinor: number;
        jurisdiction?: string;
        sentAt?: number;
        signedAt?: number;
        countersignedAt?: number;
        createdAt: number;
        updatedAt: number;
      }>;
      clients: Array<{ _id: string; name: string }>;
      weddings: Array<{ _id: string; coupleNames: string; eventDate?: number; venue?: string }>;
    }
  >('contracts:listByOrg'),
  contractsGetById: makeFunctionReference<
    'query',
    { contractId: string; requesterId: string },
    {
      contract: {
        _id: string;
        number: string;
        clientId?: string;
        clientName: string;
        eventId?: string;
        quoteId?: string;
        status: ContractStatus;
        sections: Array<{ title: string; body: string }>;
        totalMinor: number;
        jurisdiction?: string;
        sentAt?: number;
        signedAt?: number;
        countersignedAt?: number;
        createdAt: number;
        updatedAt: number;
      };
      audit: Array<{ _id: string; event: string; by?: string; ip?: string; createdAt: number }>;
    } | null
  >('contracts:getById'),
  contractsCreate: makeFunctionReference<
    'mutation',
    {
      organizationId: string;
      requesterId: string;
      clientId?: string;
      clientName?: string;
      eventId?: string;
      quoteId?: string;
      totalMinor: number;
      sections: Array<{ title: string; body: string }>;
      jurisdiction?: string;
    },
    { id: string; number: string }
  >('contracts:create'),
  contractsAdvance: makeFunctionReference<
    'mutation',
    { contractId: string; requesterId: string },
    { ok: true; status: ContractStatus }
  >('contracts:advance'),
  contractsUpdate: makeFunctionReference<
    'mutation',
    {
      contractId: string;
      requesterId: string;
      sections?: Array<{ title: string; body: string }>;
      totalMinor?: number;
      jurisdiction?: string;
    },
    { ok: true }
  >('contracts:update'),
  contractsSetStatus: makeFunctionReference<
    'mutation',
    { contractId: string; requesterId: string; status: ContractStatus },
    { ok: true }
  >('contracts:setStatus'),
  contractsRemove: makeFunctionReference<
    'mutation',
    { contractId: string; requesterId: string },
    { ok: true }
  >('contracts:remove'),
} satisfies Record<
  string,
  FunctionReference<'query' | 'mutation' | 'action', 'public', Args, unknown>
>;
