import { v } from 'convex/values';
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from './_generated/server';
import { internal } from './_generated/api';
import type { Doc, Id } from './_generated/dataModel';

const MAX_BYTES_PER_UPLOAD = 15 * 1024 * 1024;
const ALLOWED_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

async function assertEventOwnership(
  ctx: MutationCtx | QueryCtx,
  eventId: Id<'events'>,
  userId: Id<'users'>,
): Promise<Doc<'events'>> {
  const event = await ctx.db.get(eventId);
  if (!event) throw new Error('EVENT_NOT_FOUND');
  if (event.ownerId !== userId) throw new Error('FORBIDDEN');
  return event;
}

async function resolveEventForToken(
  ctx: QueryCtx | MutationCtx,
  token: string,
): Promise<Doc<'events'>> {
  const guest = await ctx.db
    .query('guests')
    .withIndex('by_qr_token', (q) => q.eq('qrCodeToken', token))
    .first();
  if (!guest) throw new Error('INVITATION_NOT_FOUND');
  const event = await ctx.db.get(guest.eventId);
  if (!event) throw new Error('EVENT_NOT_FOUND');
  if (event.status === 'cancelled' || event.status === 'archived') {
    throw new Error('EVENT_CLOSED');
  }
  return event;
}

function cdnDomain(): string {
  const domain = process.env.CLOUDFRONT_DOMAIN;
  if (!domain) throw new Error('Missing CLOUDFRONT_DOMAIN env var on Convex deployment');
  return domain;
}

async function resolvePhotoUrl(ctx: QueryCtx, photo: Doc<'photos'>): Promise<string | null> {
  if (photo.s3Key) return `https://${cdnDomain()}/${photo.s3Key}`;
  if (photo.storageId) return await ctx.storage.getUrl(photo.storageId);
  return null;
}

function assertUploadShape(sizeBytes: number, contentType: string): void {
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0 || sizeBytes > MAX_BYTES_PER_UPLOAD) {
    throw new Error('INVALID_SIZE');
  }
  if (!ALLOWED_CONTENT_TYPES.includes(contentType)) {
    throw new Error('INVALID_CONTENT_TYPE');
  }
}

/* -------------------------------------------------------------------------- */
/*  Internal helpers used by Node actions (createOwnerS3UploadUrl, etc.)      */
/* -------------------------------------------------------------------------- */

export const assertOwnerCanUpload = internalQuery({
  args: { eventId: v.id('events'), requesterId: v.id('users') },
  handler: async (ctx, { eventId, requesterId }) => {
    await assertEventOwnership(ctx, eventId, requesterId);
    return { ok: true as const };
  },
});

export const assertGuestCanUpload = internalQuery({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const event = await resolveEventForToken(ctx, token);
    return { eventId: event._id };
  },
});

/* -------------------------------------------------------------------------- */
/*  Confirm upload (called after PUT to S3 succeeded)                         */
/* -------------------------------------------------------------------------- */

export const confirmOwnerUpload = mutation({
  args: {
    eventId: v.id('events'),
    requesterId: v.id('users'),
    s3Key: v.string(),
    sizeBytes: v.number(),
    contentType: v.string(),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await assertEventOwnership(ctx, args.eventId, args.requesterId);
    assertUploadShape(args.sizeBytes, args.contentType);

    const id = await ctx.db.insert('photos', {
      eventId: args.eventId,
      s3Key: args.s3Key,
      uploadedBy: args.requesterId,
      status: 'approved',
      sizeBytes: args.sizeBytes,
      contentType: args.contentType,
      width: args.width,
      height: args.height,
      moderatedAt: Date.now(),
      moderatedBy: args.requesterId,
      createdAt: Date.now(),
    });
    return { id };
  },
});

export const confirmGuestUpload = mutation({
  args: {
    token: v.string(),
    s3Key: v.string(),
    sizeBytes: v.number(),
    contentType: v.string(),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    uploaderName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const event = await resolveEventForToken(ctx, args.token);
    assertUploadShape(args.sizeBytes, args.contentType);

    const id = await ctx.db.insert('photos', {
      eventId: event._id,
      s3Key: args.s3Key,
      uploadedByGuestToken: args.token,
      uploaderName: args.uploaderName?.trim().slice(0, 120) || undefined,
      status: 'pending',
      sizeBytes: args.sizeBytes,
      contentType: args.contentType,
      width: args.width,
      height: args.height,
      createdAt: Date.now(),
    });
    return { id };
  },
});

/* -------------------------------------------------------------------------- */
/*  Listing                                                                    */
/* -------------------------------------------------------------------------- */

export const listForOwner = query({
  args: {
    eventId: v.id('events'),
    requesterId: v.id('users'),
    status: v.optional(v.union(v.literal('pending'), v.literal('approved'), v.literal('rejected'))),
  },
  handler: async (ctx, { eventId, requesterId, status }) => {
    await assertEventOwnership(ctx, eventId, requesterId);
    const rows = status
      ? await ctx.db
          .query('photos')
          .withIndex('by_event_status', (q) => q.eq('eventId', eventId).eq('status', status))
          .order('desc')
          .collect()
      : await ctx.db
          .query('photos')
          .withIndex('by_event', (q) => q.eq('eventId', eventId))
          .order('desc')
          .collect();

    return Promise.all(
      rows.map(async (p) => ({
        _id: p._id,
        url: await resolvePhotoUrl(ctx, p),
        status: p.status,
        uploaderName: p.uploaderName,
        uploadedByGuestToken: p.uploadedByGuestToken ? true : undefined,
        width: p.width,
        height: p.height,
        sizeBytes: p.sizeBytes,
        contentType: p.contentType,
        createdAt: p.createdAt,
      })),
    );
  },
});

export const listApprovedForGuest = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const event = await resolveEventForToken(ctx, token);
    const rows = await ctx.db
      .query('photos')
      .withIndex('by_event_status', (q) => q.eq('eventId', event._id).eq('status', 'approved'))
      .order('desc')
      .collect();

    return Promise.all(
      rows.map(async (p) => ({
        _id: p._id,
        url: await resolvePhotoUrl(ctx, p),
        uploaderName: p.uploaderName,
        width: p.width,
        height: p.height,
        createdAt: p.createdAt,
      })),
    );
  },
});

/* -------------------------------------------------------------------------- */
/*  Moderation + deletion                                                     */
/* -------------------------------------------------------------------------- */

export const moderate = mutation({
  args: {
    photoId: v.id('photos'),
    requesterId: v.id('users'),
    decision: v.union(v.literal('approved'), v.literal('rejected')),
  },
  handler: async (ctx, { photoId, requesterId, decision }) => {
    const photo = await ctx.db.get(photoId);
    if (!photo) throw new Error('PHOTO_NOT_FOUND');
    await assertEventOwnership(ctx, photo.eventId, requesterId);
    await ctx.db.patch(photoId, {
      status: decision,
      moderatedAt: Date.now(),
      moderatedBy: requesterId,
    });
    return { ok: true as const };
  },
});

export const remove = mutation({
  args: { photoId: v.id('photos'), requesterId: v.id('users') },
  handler: async (ctx, { photoId, requesterId }) => {
    const photo = await ctx.db.get(photoId);
    if (!photo) throw new Error('PHOTO_NOT_FOUND');
    await assertEventOwnership(ctx, photo.eventId, requesterId);

    if (photo.s3Key) {
      await ctx.scheduler.runAfter(0, internal.photosActions.deleteS3Object, {
        s3Key: photo.s3Key,
      });
    } else if (photo.storageId) {
      await ctx.storage.delete(photo.storageId);
    }
    await ctx.db.delete(photoId);
    return { ok: true as const };
  },
});

/* -------------------------------------------------------------------------- */
/*  Internal mutations for Lambda callbacks (Phase 5: moderation, variants)   */
/* -------------------------------------------------------------------------- */

export const internalMarkModerated = internalMutation({
  args: {
    s3Key: v.string(),
    decision: v.union(v.literal('approved'), v.literal('rejected')),
  },
  handler: async (ctx, { s3Key, decision }) => {
    const photo = await ctx.db
      .query('photos')
      .withIndex('by_s3_key', (q) => q.eq('s3Key', s3Key))
      .first();
    if (!photo) return { ok: false as const, error: 'PHOTO_NOT_FOUND' };
    await ctx.db.patch(photo._id, {
      status: decision,
      moderatedAt: Date.now(),
    });
    return { ok: true as const };
  },
});
