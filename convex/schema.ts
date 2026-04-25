import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  users: defineTable({
    phone: v.string(),
    email: v.optional(v.string()),
    fullName: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    locale: v.union(v.literal('fr')),
    role: v.union(v.literal('couple'), v.literal('pro'), v.literal('guest'), v.literal('admin')),
    planTier: v.optional(
      v.union(
        v.literal('free'),
        v.literal('essential'),
        v.literal('premium'),
        v.literal('starter'),
        v.literal('business'),
        v.literal('agency'),
      ),
    ),
    stripeCustomerId: v.optional(v.string()),
    cinetpayCustomerId: v.optional(v.string()),
    createdAt: v.number(),
    lastSeenAt: v.optional(v.number()),
  })
    .index('by_phone', ['phone'])
    .index('by_email', ['email']),

  organizations: defineTable({
    ownerId: v.id('users'),
    name: v.string(),
    slug: v.string(),
    logoStorageId: v.optional(v.id('_storage')),
    primaryColor: v.optional(v.string()),
    accentColor: v.optional(v.string()),
    stripeCustomerId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),
    subscriptionTier: v.optional(
      v.union(v.literal('starter'), v.literal('business'), v.literal('agency')),
    ),
    subscriptionStatus: v.optional(
      v.union(
        v.literal('trialing'),
        v.literal('active'),
        v.literal('past_due'),
        v.literal('canceled'),
        v.literal('unpaid'),
      ),
    ),
    subscriptionPeriodEnd: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_owner', ['ownerId'])
    .index('by_slug', ['slug'])
    .index('by_stripe_customer', ['stripeCustomerId'])
    .index('by_stripe_subscription', ['stripeSubscriptionId']),

  organizationMemberships: defineTable({
    organizationId: v.id('organizations'),
    userId: v.optional(v.id('users')),
    invitedPhone: v.optional(v.string()),
    invitedEmail: v.optional(v.string()),
    role: v.union(
      v.literal('owner'),
      v.literal('admin'),
      v.literal('planner'),
      v.literal('viewer'),
    ),
    status: v.union(v.literal('pending'), v.literal('active'), v.literal('revoked')),
    inviteToken: v.optional(v.string()),
    invitedBy: v.id('users'),
    invitedAt: v.number(),
    acceptedAt: v.optional(v.number()),
  })
    .index('by_organization', ['organizationId'])
    .index('by_user', ['userId'])
    .index('by_invite_token', ['inviteToken'])
    .index('by_org_user', ['organizationId', 'userId']),

  events: defineTable({
    ownerId: v.id('users'),
    organizationId: v.optional(v.id('organizations')),
    slug: v.string(),
    title: v.string(),
    coupleNames: v.object({
      partnerA: v.string(),
      partnerB: v.string(),
    }),
    eventDate: v.number(),
    timezone: v.string(),
    venue: v.optional(
      v.object({
        name: v.string(),
        address: v.string(),
        lat: v.optional(v.number()),
        lng: v.optional(v.number()),
      }),
    ),
    coverImageKey: v.optional(v.string()),
    theme: v.optional(
      v.object({
        primaryColor: v.string(),
        accentColor: v.string(),
        fontFamily: v.string(),
      }),
    ),
    status: v.union(
      v.literal('draft'),
      v.literal('active'),
      v.literal('archived'),
      v.literal('cancelled'),
    ),
    planTier: v.union(v.literal('free'), v.literal('essential'), v.literal('premium')),
    maxGuests: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_owner', ['ownerId'])
    .index('by_slug', ['slug'])
    .index('by_status', ['status'])
    .index('by_organization', ['organizationId']),

  guests: defineTable({
    eventId: v.id('events'),
    fullName: v.string(),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    category: v.optional(v.string()),
    plusOnesAllowed: v.number(),
    plusOnesNames: v.optional(v.array(v.string())),
    rsvpStatus: v.union(
      v.literal('pending'),
      v.literal('attending'),
      v.literal('declined'),
      v.literal('maybe'),
    ),
    rsvpRespondedAt: v.optional(v.number()),
    dietaryRestrictions: v.optional(v.string()),
    notes: v.optional(v.string()),
    qrCodeToken: v.string(),
    checkedInAt: v.optional(v.number()),
    checkedInBy: v.optional(v.id('users')),
    invitationSentAt: v.optional(v.number()),
    invitationChannel: v.optional(
      v.union(v.literal('whatsapp'), v.literal('email'), v.literal('sms')),
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_event', ['eventId'])
    .index('by_event_rsvp', ['eventId', 'rsvpStatus'])
    .index('by_qr_token', ['qrCodeToken'])
    .index('by_phone', ['phone']),

  eventCollaborators: defineTable({
    eventId: v.id('events'),
    userId: v.id('users'),
    role: v.union(
      v.literal('co_owner'),
      v.literal('planner'),
      v.literal('scanner'),
      v.literal('viewer'),
    ),
    invitedBy: v.id('users'),
    invitedAt: v.number(),
    acceptedAt: v.optional(v.number()),
  })
    .index('by_event', ['eventId'])
    .index('by_user', ['userId'])
    .index('by_event_user', ['eventId', 'userId']),

  payments: defineTable({
    userId: v.id('users'),
    eventId: v.id('events'),
    plan: v.union(v.literal('essential'), v.literal('premium')),
    currency: v.union(v.literal('EUR'), v.literal('XOF'), v.literal('MAD'), v.literal('TND')),
    amountMinor: v.number(),
    provider: v.union(v.literal('stripe'), v.literal('cinetpay'), v.literal('mock')),
    providerSessionId: v.string(),
    providerEventId: v.optional(v.string()),
    status: v.union(
      v.literal('pending'),
      v.literal('succeeded'),
      v.literal('failed'),
      v.literal('cancelled'),
    ),
    failureReason: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_user', ['userId'])
    .index('by_event', ['eventId'])
    .index('by_session', ['provider', 'providerSessionId']),

  photos: defineTable({
    eventId: v.id('events'),
    // Exactly one of storageId (legacy Convex storage) or s3Key (current AWS S3) is set.
    storageId: v.optional(v.id('_storage')),
    s3Key: v.optional(v.string()),
    uploadedBy: v.optional(v.id('users')),
    uploadedByGuestToken: v.optional(v.string()),
    uploaderName: v.optional(v.string()),
    status: v.union(v.literal('pending'), v.literal('approved'), v.literal('rejected')),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    sizeBytes: v.number(),
    contentType: v.string(),
    moderatedAt: v.optional(v.number()),
    moderatedBy: v.optional(v.id('users')),
    moderation: v.optional(
      v.object({
        source: v.union(v.literal('rekognition'), v.literal('manual')),
        decision: v.union(v.literal('approved'), v.literal('rejected')),
        topLabel: v.optional(v.string()),
        topConfidence: v.optional(v.number()),
        labels: v.optional(v.array(v.object({ name: v.string(), confidence: v.number() }))),
        decidedAt: v.number(),
      }),
    ),
    createdAt: v.number(),
  })
    .index('by_event', ['eventId'])
    .index('by_event_status', ['eventId', 'status'])
    .index('by_guest_token', ['uploadedByGuestToken'])
    .index('by_s3_key', ['s3Key']),

  otpSessions: defineTable({
    phone: v.string(),
    codeHash: v.string(),
    channel: v.union(v.literal('whatsapp'), v.literal('sms')),
    attempts: v.number(),
    expiresAt: v.number(),
    consumedAt: v.optional(v.number()),
    createdAt: v.number(),
    ipAddress: v.optional(v.string()),
  })
    .index('by_phone', ['phone'])
    .index('by_phone_expires', ['phone', 'expiresAt']),
});
