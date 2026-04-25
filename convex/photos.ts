import { v } from 'convex/values';
import { mutation, query, type MutationCtx, type QueryCtx } from './_generated/server';
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

export const createOwnerUploadUrl = mutation({
  args: { eventId: v.id('events'), requesterId: v.id('users') },
  handler: async (ctx, { eventId, requesterId }) => {
    await assertEventOwnership(ctx, eventId, requesterId);
    const uploadUrl = await ctx.storage.generateUploadUrl();
    return { uploadUrl };
  },
});

export const createGuestUploadUrl = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    await resolveEventForToken(ctx, token);
    const uploadUrl = await ctx.storage.generateUploadUrl();
    return { uploadUrl };
  },
});

export const confirmOwnerUpload = mutation({
  args: {
    eventId: v.id('events'),
    requesterId: v.id('users'),
    storageId: v.id('_storage'),
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
      storageId: args.storageId,
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
    storageId: v.id('_storage'),
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
      storageId: args.storageId,
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
        url: await ctx.storage.getUrl(p.storageId),
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
        url: await ctx.storage.getUrl(p.storageId),
        uploaderName: p.uploaderName,
        width: p.width,
        height: p.height,
        createdAt: p.createdAt,
      })),
    );
  },
});

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
    await ctx.storage.delete(photo.storageId);
    await ctx.db.delete(photoId);
    return { ok: true as const };
  },
});

function assertUploadShape(sizeBytes: number, contentType: string): void {
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0 || sizeBytes > MAX_BYTES_PER_UPLOAD) {
    throw new Error('INVALID_SIZE');
  }
  if (!ALLOWED_CONTENT_TYPES.includes(contentType)) {
    throw new Error('INVALID_CONTENT_TYPE');
  }
}
