import { v } from 'convex/values';
import { action, internalMutation, internalQuery, mutation, query } from './_generated/server';
import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import {
  MAGIC_LINK_EXPIRY_MS,
  MAGIC_LINK_RATE_WINDOW_MS,
  MAX_MAGIC_LINKS_PER_HOUR,
  generateMagicToken,
  hashMagicToken,
  verifyMagicTokenHash,
} from './lib/magicLink';
import {
  MAX_ATTEMPTS,
  MAX_OTP_PER_HOUR,
  OTP_EXPIRY_MS,
  RATE_WINDOW_MS,
  generateOtpCode,
  hashOtp,
  verifyOtpHash,
} from './lib/otp';
import { isValidE164, normalizePhone } from './lib/phone';

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export const requestOtp = action({
  args: {
    phone: v.string(),
    ipAddress: v.optional(v.string()),
  },
  handler: async (ctx, { phone, ipAddress }) => {
    const normalized = normalizePhone(phone);
    if (!normalized || !isValidE164(normalized)) {
      throw new Error('INVALID_PHONE');
    }

    const rateOk = await ctx.runQuery(internal.auth._checkRate, {
      phone: normalized,
    });
    if (!rateOk) {
      throw new Error('RATE_LIMITED');
    }

    const code = generateOtpCode();
    const codeHash = await hashOtp(code, normalized);

    await ctx.runMutation(internal.auth._saveOtpSession, {
      phone: normalized,
      codeHash,
      ipAddress,
    });

    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const templateName = process.env.WHATSAPP_OTP_TEMPLATE ?? 'otp_code';
    const graphVersion = process.env.WHATSAPP_GRAPH_VERSION ?? 'v23.0';

    if (!accessToken || !phoneNumberId) {
      console.info(`[whatsapp:mock] OTP ${code} -> ${normalized}`);
      return { phone: normalized, channel: 'whatsapp' as const, provider: 'mock' as const };
    }

    const url = `https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: normalized.replace(/^\+/, ''),
        type: 'template',
        template: {
          name: templateName,
          language: { code: 'fr' },
          components: [
            { type: 'body', parameters: [{ type: 'text', text: code }] },
            {
              type: 'button',
              sub_type: 'url',
              index: '0',
              parameters: [{ type: 'text', text: code }],
            },
          ],
        },
      }),
    });

    if (!res.ok) {
      throw new Error('WHATSAPP_SEND_FAILED');
    }

    return { phone: normalized, channel: 'whatsapp' as const, provider: 'meta_cloud' as const };
  },
});

export const verifyOtp = mutation({
  args: {
    phone: v.string(),
    code: v.string(),
  },
  handler: async (ctx, { phone, code }) => {
    const normalized = normalizePhone(phone);
    if (!normalized || !isValidE164(normalized)) {
      throw new Error('INVALID_PHONE');
    }

    if (!/^\d{6}$/.test(code)) {
      throw new Error('INVALID_CODE');
    }

    const now = Date.now();

    const session = await ctx.db
      .query('otpSessions')
      .withIndex('by_phone', (q) => q.eq('phone', normalized))
      .filter((q) => q.eq(q.field('consumedAt'), undefined))
      .order('desc')
      .first();

    if (!session) {
      throw new Error('NO_ACTIVE_OTP');
    }

    if (session.expiresAt < now) {
      throw new Error('OTP_EXPIRED');
    }

    if (session.attempts >= MAX_ATTEMPTS) {
      throw new Error('TOO_MANY_ATTEMPTS');
    }

    const valid = await verifyOtpHash(code, normalized, session.codeHash);
    await ctx.db.patch(session._id, { attempts: session.attempts + 1 });

    if (!valid) {
      throw new Error('INVALID_CODE');
    }

    await ctx.db.patch(session._id, { consumedAt: now });

    let userId: Id<'users'>;
    const existing = await ctx.db
      .query('users')
      .withIndex('by_phone', (q) => q.eq('phone', normalized))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { lastSeenAt: now });
      userId = existing._id;
    } else {
      userId = await ctx.db.insert('users', {
        phone: normalized,
        locale: 'fr',
        role: 'couple',
        createdAt: now,
        lastSeenAt: now,
      });
    }

    const sessionToken = crypto.randomUUID();
    return { userId, sessionToken, phone: normalized };
  },
});

export const currentUser = query({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId);
    if (!user) return null;
    const { phone, email, fullName, avatarUrl, role, locale, planTier, createdAt, lastSeenAt } =
      user;
    return {
      _id: user._id,
      phone,
      email,
      fullName,
      avatarUrl,
      role,
      locale,
      planTier,
      createdAt,
      lastSeenAt,
    };
  },
});

export const userByPhone = query({
  args: { phone: v.string() },
  handler: async (ctx, { phone }) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_phone', (q) => q.eq('phone', phone))
      .first();
    if (!user) return null;
    return {
      _id: user._id,
      phone: user.phone,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      locale: user.locale,
    };
  },
});

/* -------------------------------------------------------------------------- */
/*  Email Magic Link — fallback auth pour les utilisateurs sans WhatsApp.     */
/*  Pattern miroir de requestOtp/verifyOtp avec un token long single-use.     */
/* -------------------------------------------------------------------------- */

export const requestMagicLink = action({
  args: {
    email: v.string(),
    ipAddress: v.optional(v.string()),
  },
  handler: async (ctx, { email, ipAddress }) => {
    const normalized = normalizeEmail(email);
    if (!isValidEmail(normalized)) {
      throw new Error('INVALID_EMAIL');
    }

    const rateOk = await ctx.runQuery(internal.auth._checkMagicLinkRate, {
      email: normalized,
    });
    if (!rateOk) {
      throw new Error('RATE_LIMITED');
    }

    const token = generateMagicToken();
    const tokenHash = await hashMagicToken(token, normalized);

    await ctx.runMutation(internal.auth._saveMagicLinkSession, {
      email: normalized,
      tokenHash,
      ipAddress,
    });

    // Envoi via SES (driver mock en dev). On délègue à emailActions pour
    // que le SES client soit instancié dans un node action.
    await ctx.runAction(internal.emailActions.sendMagicLinkEmail, {
      to: normalized,
      token,
      ipAddress,
    });

    return { email: normalized };
  },
});

export const verifyMagicLink = mutation({
  args: {
    email: v.string(),
    token: v.string(),
  },
  handler: async (ctx, { email, token }) => {
    const normalized = normalizeEmail(email);
    if (!isValidEmail(normalized)) {
      throw new Error('INVALID_EMAIL');
    }
    if (!/^[a-f0-9]{64}$/.test(token)) {
      throw new Error('INVALID_TOKEN');
    }

    const now = Date.now();

    const session = await ctx.db
      .query('magicLinkSessions')
      .withIndex('by_email', (q) => q.eq('email', normalized))
      .filter((q) => q.eq(q.field('consumedAt'), undefined))
      .order('desc')
      .first();

    if (!session) {
      throw new Error('NO_ACTIVE_LINK');
    }

    if (session.expiresAt < now) {
      throw new Error('LINK_EXPIRED');
    }

    const valid = await verifyMagicTokenHash(token, normalized, session.tokenHash);

    if (!valid) {
      throw new Error('INVALID_TOKEN');
    }

    await ctx.db.patch(session._id, { consumedAt: now });

    let userId: Id<'users'>;
    const existing = await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', normalized))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { lastSeenAt: now });
      userId = existing._id;
    } else {
      userId = await ctx.db.insert('users', {
        email: normalized,
        locale: 'fr',
        role: 'couple',
        createdAt: now,
        lastSeenAt: now,
      });
    }

    const sessionToken = crypto.randomUUID();
    return { userId, sessionToken, email: normalized };
  },
});

export const _checkMagicLinkRate = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const windowStart = Date.now() - MAGIC_LINK_RATE_WINDOW_MS;
    const recent = await ctx.db
      .query('magicLinkSessions')
      .withIndex('by_email_expires', (q) => q.eq('email', email).gte('expiresAt', windowStart))
      .collect();
    return recent.length < MAX_MAGIC_LINKS_PER_HOUR;
  },
});

export const _saveMagicLinkSession = internalMutation({
  args: {
    email: v.string(),
    tokenHash: v.string(),
    ipAddress: v.optional(v.string()),
  },
  handler: async (ctx, { email, tokenHash, ipAddress }) => {
    const now = Date.now();
    return ctx.db.insert('magicLinkSessions', {
      email,
      tokenHash,
      expiresAt: now + MAGIC_LINK_EXPIRY_MS,
      createdAt: now,
      ...(ipAddress ? { ipAddress } : {}),
    });
  },
});

export const _checkRate = internalQuery({
  args: { phone: v.string() },
  handler: async (ctx, { phone }) => {
    const windowStart = Date.now() - RATE_WINDOW_MS;
    const recent = await ctx.db
      .query('otpSessions')
      .withIndex('by_phone_expires', (q) => q.eq('phone', phone).gte('expiresAt', windowStart))
      .collect();
    return recent.length < MAX_OTP_PER_HOUR;
  },
});

export const _saveOtpSession = internalMutation({
  args: {
    phone: v.string(),
    codeHash: v.string(),
    ipAddress: v.optional(v.string()),
  },
  handler: async (ctx, { phone, codeHash, ipAddress }) => {
    const now = Date.now();
    return ctx.db.insert('otpSessions', {
      phone,
      codeHash,
      channel: 'whatsapp' as const,
      attempts: 0,
      expiresAt: now + OTP_EXPIRY_MS,
      createdAt: now,
      ...(ipAddress ? { ipAddress } : {}),
    });
  },
});
