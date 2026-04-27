'use node';

import { v } from 'convex/values';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import { internal } from './_generated/api';
import { internalAction } from './_generated/server';
import {
  renderGuestReminder,
  renderLinkCode,
  renderMagicLink,
  renderProNotification,
  renderStripeInvoice,
  type ProNotificationKind,
} from '../lib/email/templates';
import type { EmailRendered } from '../lib/email/types';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var ${name} on Convex deployment`);
  return value;
}

let cachedSes: SESv2Client | null = null;
function sesClient(): SESv2Client {
  cachedSes ??= new SESv2Client({
    region: requireEnv('AWS_REGION'),
    credentials: {
      accessKeyId: requireEnv('AWS_ACCESS_KEY_ID'),
      secretAccessKey: requireEnv('AWS_SECRET_ACCESS_KEY'),
    },
  });
  return cachedSes;
}

type DispatchOutcome = { ok: true; messageId: string } | { ok: false; error: string };

async function dispatch(to: string, rendered: EmailRendered): Promise<DispatchOutcome> {
  const driver = process.env.EMAIL_DRIVER ?? 'ses';

  // Mode E2E : force le mock même si SES est configuré côté env Convex. Idem
  // que pour WhatsApp (cf. `auth:requestOtp`) — évite l'envoi réel pendant
  // les tests Playwright.
  if (process.env.E2E_MODE === '1' || driver === 'mock') {
    const messageId = `mock-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    console.log(`[email:mock] → ${to} | ${rendered.subject} | id=${messageId}`);
    return { ok: true, messageId };
  }

  const command = new SendEmailCommand({
    FromEmailAddress: requireEnv('SES_FROM_ADDRESS'),
    Destination: { ToAddresses: [to] },
    ConfigurationSetName: process.env.SES_CONFIGURATION_SET || undefined,
    Content: {
      Simple: {
        Subject: { Data: rendered.subject, Charset: 'UTF-8' },
        Body: {
          Html: { Data: rendered.html, Charset: 'UTF-8' },
          Text: { Data: rendered.text, Charset: 'UTF-8' },
        },
      },
    },
  });
  try {
    const response = await sesClient().send(command);
    return { ok: true, messageId: response.MessageId ?? 'unknown' };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/* -------------------------------------------------------------------------- */
/*  Guest reminders                                                            */
/* -------------------------------------------------------------------------- */

export const sendGuestReminder = internalAction({
  args: {
    guestId: v.id('guests'),
    to: v.string(),
    guestName: v.string(),
    eventTitle: v.string(),
    eventDate: v.string(),
    invitationUrl: v.string(),
    daysUntilEvent: v.number(),
    tier: v.union(v.literal('d7'), v.literal('d1')),
  },
  handler: async (ctx, args) => {
    const rendered = renderGuestReminder({
      guestName: args.guestName,
      eventTitle: args.eventTitle,
      eventDate: args.eventDate,
      invitationUrl: args.invitationUrl,
      daysUntilEvent: args.daysUntilEvent,
    });
    const result = await dispatch(args.to, rendered);
    if (result.ok) {
      await ctx.runMutation(internal.guests.markReminderSent, {
        guestId: args.guestId,
        tier: args.tier,
      });
    } else {
      console.error(
        `[email] failed to send guest reminder ${args.tier} to ${args.to}: ${result.error}`,
      );
    }
    return result;
  },
});

/* -------------------------------------------------------------------------- */
/*  Pro notifications (team member added, payment received, etc.)              */
/* -------------------------------------------------------------------------- */

/* -------------------------------------------------------------------------- */
/*  Magic Link email (fallback auth)                                           */
/* -------------------------------------------------------------------------- */

export const sendLinkCodeEmail = internalAction({
  args: {
    to: v.string(),
    code: v.string(),
    ipAddress: v.optional(v.string()),
  },
  handler: async (_ctx, { to, code, ipAddress }) => {
    const rendered = renderLinkCode({
      code,
      expiresInMinutes: 10,
      requestIp: ipAddress,
    });
    const result = await dispatch(to, rendered);
    if (!result.ok) {
      console.error(`[email] failed to send link code to ${to}: ${result.error}`);
    }
    return result;
  },
});

export const sendMagicLinkEmail = internalAction({
  args: {
    to: v.string(),
    token: v.string(),
    ipAddress: v.optional(v.string()),
  },
  handler: async (_ctx, { to, token, ipAddress }) => {
    const baseUrl = process.env.APP_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? '';
    const verifyUrl = `${baseUrl.replace(/\/$/, '')}/api/auth/magic-link/verify?email=${encodeURIComponent(
      to,
    )}&token=${encodeURIComponent(token)}`;

    const rendered = renderMagicLink({
      verifyUrl,
      expiresInMinutes: 15,
      requestIp: ipAddress,
    });
    const result = await dispatch(to, rendered);
    if (!result.ok) {
      console.error(`[email] failed to send magic link to ${to}: ${result.error}`);
    }
    return result;
  },
});

export const sendProNotification = internalAction({
  args: {
    to: v.string(),
    recipientName: v.string(),
    organizationName: v.string(),
    kind: v.union(
      v.literal('team-member-added'),
      v.literal('payment-received'),
      v.literal('subscription-renewed'),
      v.literal('subscription-failed'),
      v.literal('payg-credit-activated'),
    ),
    detail: v.string(),
    ctaLabel: v.optional(v.string()),
    ctaUrl: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    const rendered = renderProNotification({
      recipientName: args.recipientName,
      organizationName: args.organizationName,
      kind: args.kind as ProNotificationKind,
      detail: args.detail,
      ctaLabel: args.ctaLabel,
      ctaUrl: args.ctaUrl,
    });
    const result = await dispatch(args.to, rendered);
    if (!result.ok) {
      console.error(
        `[email] failed to send pro notification ${args.kind} to ${args.to}: ${result.error}`,
      );
    }
    return result;
  },
});

/* -------------------------------------------------------------------------- */
/*  Stripe invoice receipts                                                    */
/* -------------------------------------------------------------------------- */

export const sendStripeInvoice = internalAction({
  args: {
    to: v.string(),
    recipientName: v.string(),
    organizationName: v.string(),
    invoiceNumber: v.string(),
    amountFormatted: v.string(),
    periodLabel: v.string(),
    invoiceUrl: v.string(),
    pdfUrl: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    const rendered = renderStripeInvoice({
      recipientName: args.recipientName,
      organizationName: args.organizationName,
      invoiceNumber: args.invoiceNumber,
      amountFormatted: args.amountFormatted,
      periodLabel: args.periodLabel,
      invoiceUrl: args.invoiceUrl,
      pdfUrl: args.pdfUrl,
    });
    const result = await dispatch(args.to, rendered);
    if (!result.ok) {
      console.error(
        `[email] failed to send stripe invoice ${args.invoiceNumber} to ${args.to}: ${result.error}`,
      );
    }
    return result;
  },
});
