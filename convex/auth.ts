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
import { sendWhatsAppCloudTemplate } from './lib/whatsappCloud';
import { isValidEmail, normalizeEmail } from './lib/email';

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

    const templateName = process.env.WHATSAPP_OTP_TEMPLATE ?? 'otp_code';

    // Refactor R2 : utilise le helper unifié sendWhatsAppCloudTemplate.
    // Sécurité F-04 : le helper court-circuite Meta UNIQUEMENT si
    // `E2E_MODE === '1'`. Hors E2E, en absence de credentials, il
    // retourne `{ ok: false, error: 'WHATSAPP_NOT_CONFIGURED' }` —
    // pas de log silencieux qui exposerait l'OTP en prod.
    const result = await sendWhatsAppCloudTemplate({
      to: normalized,
      templateName,
      components: [
        { type: 'body', parameters: [{ type: 'text', text: code }] },
        {
          type: 'button',
          sub_type: 'url',
          index: '0',
          parameters: [{ type: 'text', text: code }],
        },
      ],
    });

    if (!result.ok) {
      if (result.error === 'WHATSAPP_NOT_CONFIGURED') {
        throw new Error('WHATSAPP_NOT_CONFIGURED');
      }
      throw new Error('WHATSAPP_SEND_FAILED');
    }
    if (result.mock) {
      console.info(`[whatsapp:mock] OTP ${code} -> ${normalized}`);
      return { phone: normalized, channel: 'whatsapp' as const, provider: 'mock' as const };
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

/* -------------------------------------------------------------------------- */
/*  Link verifications — ajouter un identifiant (phone OU email) à un user    */
/*  existant. OTP 6 digits envoyés via WhatsApp ou SES.                       */
/* -------------------------------------------------------------------------- */

const LINK_EXPIRY_MS = 10 * 60 * 1000;
const MAX_LINK_ATTEMPTS = 5;
const MAX_LINKS_PER_HOUR = 5;
const LINK_RATE_WINDOW_MS = 60 * 60 * 1000;

export const requestLinkPhone = action({
  args: {
    userId: v.id('users'),
    phone: v.string(),
    ipAddress: v.optional(v.string()),
  },
  handler: async (ctx, { userId, phone, ipAddress }) => {
    const normalized = normalizePhone(phone);
    if (!normalized || !isValidE164(normalized)) {
      throw new Error('INVALID_PHONE');
    }

    const conflict = await ctx.runQuery(internal.auth._userByPhone, { phone: normalized });
    if (conflict && conflict._id !== userId) {
      throw new Error('PHONE_TAKEN');
    }
    if (conflict && conflict._id === userId) {
      throw new Error('ALREADY_LINKED');
    }

    const rateOk = await ctx.runQuery(internal.auth._checkLinkRate, {
      userId,
      targetKind: 'phone' as const,
    });
    if (!rateOk) {
      throw new Error('RATE_LIMITED');
    }

    const code = generateOtpCode();
    const codeHash = await hashOtp(code, normalized);

    await ctx.runMutation(internal.auth._saveLinkVerification, {
      userId,
      targetKind: 'phone' as const,
      targetValue: normalized,
      codeHash,
      ipAddress,
    });

    const templateName = process.env.WHATSAPP_OTP_TEMPLATE ?? 'otp_code';

    // Refactor R2 + sécurité F-04 : helper unifié, court-circuit STRICT
    // sur E2E_MODE === '1', sinon throw si credentials absents.
    const result = await sendWhatsAppCloudTemplate({
      to: normalized,
      templateName,
      components: [
        { type: 'body', parameters: [{ type: 'text', text: code }] },
        {
          type: 'button',
          sub_type: 'url',
          index: '0',
          parameters: [{ type: 'text', text: code }],
        },
      ],
    });

    if (!result.ok) {
      if (result.error === 'WHATSAPP_NOT_CONFIGURED') {
        throw new Error('WHATSAPP_NOT_CONFIGURED');
      }
      throw new Error('WHATSAPP_SEND_FAILED');
    }
    if (result.mock) {
      console.info(`[whatsapp:mock] LINK ${code} -> ${normalized}`);
    }
    return { phone: normalized, channel: 'whatsapp' as const, provider: 'meta_cloud' as const };
  },
});

export const verifyLinkPhone = mutation({
  args: {
    userId: v.id('users'),
    phone: v.string(),
    code: v.string(),
  },
  handler: async (ctx, { userId, phone, code }) => {
    const normalized = normalizePhone(phone);
    if (!normalized || !isValidE164(normalized)) {
      throw new Error('INVALID_PHONE');
    }
    if (!/^\d{6}$/.test(code)) {
      throw new Error('INVALID_CODE');
    }

    const now = Date.now();
    const verification = await ctx.db
      .query('linkVerifications')
      .withIndex('by_user_kind', (q) => q.eq('userId', userId).eq('targetKind', 'phone'))
      .filter((q) =>
        q.and(q.eq(q.field('targetValue'), normalized), q.eq(q.field('consumedAt'), undefined)),
      )
      .order('desc')
      .first();

    if (!verification) throw new Error('NO_ACTIVE_LINK');
    if (verification.expiresAt < now) throw new Error('LINK_EXPIRED');
    if (verification.attempts >= MAX_LINK_ATTEMPTS) throw new Error('TOO_MANY_ATTEMPTS');

    const valid = await verifyOtpHash(code, normalized, verification.codeHash);
    await ctx.db.patch(verification._id, { attempts: verification.attempts + 1 });
    if (!valid) throw new Error('INVALID_CODE');

    // Race-condition defense : revérifier qu'aucun autre user n'a pris ce
    // phone entre le request et le verify.
    const conflict = await ctx.db
      .query('users')
      .withIndex('by_phone', (q) => q.eq('phone', normalized))
      .first();
    if (conflict && conflict._id !== userId) {
      throw new Error('PHONE_TAKEN');
    }

    await ctx.db.patch(verification._id, { consumedAt: now });
    await ctx.db.patch(userId, { phone: normalized, lastSeenAt: now });
    return { ok: true as const };
  },
});

export const requestLinkEmail = action({
  args: {
    userId: v.id('users'),
    email: v.string(),
    ipAddress: v.optional(v.string()),
  },
  handler: async (ctx, { userId, email, ipAddress }) => {
    const normalized = normalizeEmail(email);
    if (!isValidEmail(normalized)) {
      throw new Error('INVALID_EMAIL');
    }

    const conflict = await ctx.runQuery(internal.auth._userByEmail, { email: normalized });
    if (conflict && conflict._id !== userId) {
      throw new Error('EMAIL_TAKEN');
    }
    if (conflict && conflict._id === userId) {
      throw new Error('ALREADY_LINKED');
    }

    const rateOk = await ctx.runQuery(internal.auth._checkLinkRate, {
      userId,
      targetKind: 'email' as const,
    });
    if (!rateOk) {
      throw new Error('RATE_LIMITED');
    }

    const code = generateOtpCode();
    const codeHash = await hashOtp(code, normalized);

    await ctx.runMutation(internal.auth._saveLinkVerification, {
      userId,
      targetKind: 'email' as const,
      targetValue: normalized,
      codeHash,
      ipAddress,
    });

    await ctx.runAction(internal.emailActions.sendLinkCodeEmail, {
      to: normalized,
      code,
      ipAddress,
    });

    return { email: normalized };
  },
});

export const verifyLinkEmail = mutation({
  args: {
    userId: v.id('users'),
    email: v.string(),
    code: v.string(),
  },
  handler: async (ctx, { userId, email, code }) => {
    const normalized = normalizeEmail(email);
    if (!isValidEmail(normalized)) {
      throw new Error('INVALID_EMAIL');
    }
    if (!/^\d{6}$/.test(code)) {
      throw new Error('INVALID_CODE');
    }

    const now = Date.now();
    const verification = await ctx.db
      .query('linkVerifications')
      .withIndex('by_user_kind', (q) => q.eq('userId', userId).eq('targetKind', 'email'))
      .filter((q) =>
        q.and(q.eq(q.field('targetValue'), normalized), q.eq(q.field('consumedAt'), undefined)),
      )
      .order('desc')
      .first();

    if (!verification) throw new Error('NO_ACTIVE_LINK');
    if (verification.expiresAt < now) throw new Error('LINK_EXPIRED');
    if (verification.attempts >= MAX_LINK_ATTEMPTS) throw new Error('TOO_MANY_ATTEMPTS');

    const valid = await verifyOtpHash(code, normalized, verification.codeHash);
    await ctx.db.patch(verification._id, { attempts: verification.attempts + 1 });
    if (!valid) throw new Error('INVALID_CODE');

    const conflict = await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', normalized))
      .first();
    if (conflict && conflict._id !== userId) {
      throw new Error('EMAIL_TAKEN');
    }

    await ctx.db.patch(verification._id, { consumedAt: now });
    await ctx.db.patch(userId, { email: normalized, lastSeenAt: now });
    return { ok: true as const };
  },
});

export const _userByPhone = internalQuery({
  args: { phone: v.string() },
  handler: async (ctx, { phone }) => {
    return ctx.db
      .query('users')
      .withIndex('by_phone', (q) => q.eq('phone', phone))
      .first();
  },
});

export const _userByEmail = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    return ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', email))
      .first();
  },
});

export const _checkLinkRate = internalQuery({
  args: {
    userId: v.id('users'),
    targetKind: v.union(v.literal('phone'), v.literal('email')),
  },
  handler: async (ctx, { userId, targetKind }) => {
    const windowStart = Date.now() - LINK_RATE_WINDOW_MS;
    const recent = await ctx.db
      .query('linkVerifications')
      .withIndex('by_user_kind_expires', (q) =>
        q.eq('userId', userId).eq('targetKind', targetKind).gte('expiresAt', windowStart),
      )
      .collect();
    return recent.length < MAX_LINKS_PER_HOUR;
  },
});

export const _saveLinkVerification = internalMutation({
  args: {
    userId: v.id('users'),
    targetKind: v.union(v.literal('phone'), v.literal('email')),
    targetValue: v.string(),
    codeHash: v.string(),
    ipAddress: v.optional(v.string()),
  },
  handler: async (ctx, { userId, targetKind, targetValue, codeHash, ipAddress }) => {
    const now = Date.now();
    return ctx.db.insert('linkVerifications', {
      userId,
      targetKind,
      targetValue,
      codeHash,
      attempts: 0,
      expiresAt: now + LINK_EXPIRY_MS,
      createdAt: now,
      ...(ipAddress ? { ipAddress } : {}),
    });
  },
});

/* -------------------------------------------------------------------------- */
/*  E2E test helpers — réservés aux tests Playwright. Tous les chemins ici    */
/*  vérifient `process.env.E2E_MODE === '1'` côté Convex et lèvent une        */
/*  erreur sinon. Ne JAMAIS activer `E2E_MODE` en prod.                       */
/* -------------------------------------------------------------------------- */

/**
 * Pendant E2E uniquement : génère un OTP de linking phone, le persiste en
 * base, et retourne le code en clair pour que le test puisse appeler
 * `verifyLinkPhone` ensuite. Aucun envoi WhatsApp réel — court-circuit total.
 */
export const _e2eIssueLinkPhoneCode = action({
  args: {
    userId: v.id('users'),
    phone: v.string(),
  },
  handler: async (ctx, { userId, phone }) => {
    if (process.env.E2E_MODE !== '1') {
      throw new Error('E2E_MODE_DISABLED');
    }
    const normalized = normalizePhone(phone);
    if (!normalized || !isValidE164(normalized)) {
      throw new Error('INVALID_PHONE');
    }

    const conflict = await ctx.runQuery(internal.auth._userByPhone, { phone: normalized });
    if (conflict && conflict._id !== userId) {
      throw new Error('PHONE_TAKEN');
    }
    if (conflict && conflict._id === userId) {
      throw new Error('ALREADY_LINKED');
    }

    const code = generateOtpCode();
    const codeHash = await hashOtp(code, normalized);

    await ctx.runMutation(internal.auth._saveLinkVerification, {
      userId,
      targetKind: 'phone' as const,
      targetValue: normalized,
      codeHash,
    });

    return { phone: normalized, code };
  },
});

/**
 * Pendant E2E uniquement : génère un OTP de linking email, le persiste en
 * base, et retourne le code en clair. Pas d'envoi SES réel.
 */
export const _e2eIssueLinkEmailCode = action({
  args: {
    userId: v.id('users'),
    email: v.string(),
  },
  handler: async (ctx, { userId, email }) => {
    if (process.env.E2E_MODE !== '1') {
      throw new Error('E2E_MODE_DISABLED');
    }
    const normalized = normalizeEmail(email);
    if (!isValidEmail(normalized)) {
      throw new Error('INVALID_EMAIL');
    }

    const conflict = await ctx.runQuery(internal.auth._userByEmail, { email: normalized });
    if (conflict && conflict._id !== userId) {
      throw new Error('EMAIL_TAKEN');
    }
    if (conflict && conflict._id === userId) {
      throw new Error('ALREADY_LINKED');
    }

    const code = generateOtpCode();
    const codeHash = await hashOtp(code, normalized);

    await ctx.runMutation(internal.auth._saveLinkVerification, {
      userId,
      targetKind: 'email' as const,
      targetValue: normalized,
      codeHash,
    });

    return { email: normalized, code };
  },
});
