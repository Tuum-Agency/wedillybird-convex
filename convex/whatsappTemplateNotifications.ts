/**
 * Dispatcher de notifications pour les changements d'état des templates
 * WhatsApp custom (cf. table `whatsappTemplates` + module
 * `convex/whatsappTemplates.ts`).
 *
 * Appelé par :
 *  1. Le webhook `app/api/webhooks/whatsapp/route.ts` après chaque event
 *     `message_template_status_update` (déclenchement immédiat).
 *  2. Le cron `dispatch whatsapp template notifications` toutes les 5 min
 *     (rattrapage si webhook indisponible).
 *
 * Idempotence garantie par le champ `notifiedAt` sur le row template :
 * une fois notifié, on ne renotifie pas. La query `_listToNotify` filtre
 * sur `notifiedAt === undefined` et `status ∈ {approved, rejected, disabled, paused}`.
 *
 * Canaux supportés (event.messagingConfig.templateNotifyChannel) :
 *  - 'email' (défaut) — SES via `lib/email`
 *  - 'whatsapp' — template Meta `template_status_update` (UTILITY)
 *  - 'both' — les deux, indépendamment
 *
 * Les échecs (template Meta non encore validé, email non délivrable) ne
 * bloquent pas la marque `notifiedAt` : on tente best-effort, on log, et on
 * passe au suivant. Les status pertinents sont des transitions terminales
 * (approved/rejected/disabled) ou semi-terminales (paused) — pas la peine de
 * spammer si le client n'arrive pas tout de suite à recevoir.
 */

'use node';

import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import { action } from './_generated/server';
import { internal } from './_generated/api';
import { renderWhatsappTemplateStatusEmail } from '../lib/email/templates';
import type { TemplateStatusKind } from '../lib/email/templates';
import type { Id } from './_generated/dataModel';
import { sendWhatsAppCloudTemplate } from './lib/whatsappCloud';
import { getServerTranslator, resolveLocale } from '../lib/i18n/server-translator';

type NotifyChannel = 'whatsapp' | 'email' | 'both';

interface NotifyRow {
  templateId: Id<'whatsappTemplates'>;
  ownerId: Id<'users'>;
  eventId: Id<'events'>;
  name: string;
  status: 'approved' | 'rejected' | 'disabled' | 'paused' | 'pending' | 'draft';
  rejectionReason?: string;
  ownerFullName: string;
  ownerEmail?: string;
  ownerPhone?: string;
  ownerLocale?: string;
  eventTitle: string;
  templateNotifyChannel: NotifyChannel;
}

let cachedSes: SESv2Client | null = null;
function sesClient(): SESv2Client {
  if (cachedSes) return cachedSes;
  const region = process.env.AWS_REGION;
  const key = process.env.AWS_ACCESS_KEY_ID;
  const secret = process.env.AWS_SECRET_ACCESS_KEY;
  if (!region || !key || !secret) {
    throw new Error('SES_CREDENTIALS_MISSING');
  }
  cachedSes = new SESv2Client({
    region,
    credentials: { accessKeyId: key, secretAccessKey: secret },
  });
  return cachedSes;
}

const STATUS_VERB_KEY: Record<
  TemplateStatusKind,
  'verbApproved' | 'verbRejected' | 'verbDisabled' | 'verbPaused'
> = {
  approved: 'verbApproved',
  rejected: 'verbRejected',
  disabled: 'verbDisabled',
  paused: 'verbPaused',
};

function buildEventUrl(eventId: string, locale: string): string {
  const base = (
    process.env.APP_BASE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    'https://wedillybird.com'
  ).replace(/\/$/, '');
  return `${base}/${locale}/events/${eventId}/messaging`;
}

async function sendEmailNotification(
  to: string,
  recipientName: string,
  templateName: string,
  eventTitle: string,
  eventId: string,
  status: TemplateStatusKind,
  rejectionReason: string | undefined,
  locale: string | undefined,
): Promise<{ ok: boolean; error?: string }> {
  const resolvedLocale = resolveLocale(locale);
  const rendered = renderWhatsappTemplateStatusEmail({
    recipientName,
    templateName,
    eventTitle,
    status,
    rejectionReason,
    ctaUrl: buildEventUrl(eventId, resolvedLocale),
    locale: resolvedLocale,
  });

  const driver = process.env.EMAIL_DRIVER ?? 'ses';
  if (driver === 'mock') {
    console.log(`[email:mock] template-status → ${to} | ${rendered.subject}`);
    return { ok: true };
  }

  const fromAddress = process.env.SES_FROM_ADDRESS;
  if (!fromAddress) {
    return { ok: false, error: 'SES_FROM_ADDRESS missing' };
  }

  try {
    const command = new SendEmailCommand({
      FromEmailAddress: fromAddress,
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
    await sesClient().send(command);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'unknown' };
  }
}

async function sendWhatsappNotification(
  toPhoneE164: string,
  recipientName: string,
  templateName: string,
  status: TemplateStatusKind,
  rejectionReason: string | undefined,
  locale: string | undefined,
): Promise<{ ok: boolean; error?: string }> {
  const notifyTemplateName =
    process.env.WHATSAPP_TEMPLATE_STATUS_TEMPLATE ?? 'template_status_update';

  const t = getServerTranslator(locale);
  const verb = t(
    `Emails.whatsappTemplateStatus.${STATUS_VERB_KEY[status]}` as 'Emails.whatsappTemplateStatus.verbApproved',
  );

  const reasonOrCta =
    status === 'approved'
      ? t('WhatsApp.templateStatus.approvedHint')
      : rejectionReason
        ? t('WhatsApp.templateStatus.rejectedReason', { reason: rejectionReason })
        : t('WhatsApp.templateStatus.adjustHint');

  const result = await sendWhatsAppCloudTemplate({
    to: toPhoneE164,
    templateName: notifyTemplateName,
    components: [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: recipientName },
          { type: 'text', text: templateName },
          { type: 'text', text: verb },
          { type: 'text', text: reasonOrCta },
        ],
      },
    ],
  });

  if (result.ok) {
    if (result.mock) {
      console.info('[whatsappTemplateNotifications:mock] skip whatsapp send (no creds)');
    }
    return { ok: true };
  }

  // 132001 = template not registered/approved on this WABA. On ne fait
  // pas remonter d'erreur dure — c'est attendu tant que Meta n'a pas
  // validé `template_status_update`. Le helper ne nous expose plus le
  // code numérique, on matche sur le message — best effort.
  const errorMessage = result.error ?? '';
  if (errorMessage.includes('132001') || result.httpStatus === 132001) {
    console.warn(
      '[whatsappTemplateNotifications] template_status_update not yet validated by Meta',
    );
    return { ok: true };
  }
  return { ok: false, error: errorMessage || 'unknown' };
}

/**
 * Action publique appelée par le webhook après une mise à jour de status,
 * ou par le cron toutes les 5 minutes en rattrapage. Idempotente.
 *
 * La query interne `_listToNotify` vit dans `whatsappTemplates.ts` (runtime
 * Convex standard) parce que les fichiers `'use node'` ne peuvent contenir
 * que des actions.
 */
export const dispatchPendingNotifications = action({
  args: {},
  handler: async (ctx): Promise<{ dispatched: number; skipped: number }> => {
    const rows: NotifyRow[] = await ctx.runQuery(internal.whatsappTemplates._listToNotify, {});

    let dispatched = 0;
    let skipped = 0;

    for (const row of rows) {
      // Sécurité : seuls les statuts terminaux sont notifiables.
      if (
        row.status !== 'approved' &&
        row.status !== 'rejected' &&
        row.status !== 'disabled' &&
        row.status !== 'paused'
      ) {
        skipped += 1;
        continue;
      }
      const status: TemplateStatusKind = row.status;
      const channel = row.templateNotifyChannel;
      const wantEmail = channel === 'email' || channel === 'both';
      const wantWhatsapp = channel === 'whatsapp' || channel === 'both';

      let attempted = false;

      if (wantEmail && row.ownerEmail) {
        attempted = true;
        const r = await sendEmailNotification(
          row.ownerEmail,
          row.ownerFullName,
          row.name,
          row.eventTitle,
          row.eventId,
          status,
          row.rejectionReason,
          row.ownerLocale,
        );
        if (!r.ok) {
          console.error(
            `[whatsappTemplateNotifications] email failed for ${row.templateId}: ${r.error}`,
          );
        }
      }

      if (wantWhatsapp && row.ownerPhone) {
        attempted = true;
        const r = await sendWhatsappNotification(
          row.ownerPhone,
          row.ownerFullName,
          row.name,
          status,
          row.rejectionReason,
          row.ownerLocale,
        );
        if (!r.ok) {
          console.error(
            `[whatsappTemplateNotifications] whatsapp failed for ${row.templateId}: ${r.error}`,
          );
        }
      }

      if (!attempted) {
        skipped += 1;
        continue;
      }

      // Marque notifié même si certains canaux ont échoué : on ne re-tente
      // pas pour éviter le spam. La trace est dans les logs.
      await ctx.runMutation(internal.whatsappTemplates.markNotified, {
        templateId: row.templateId,
      });
      dispatched += 1;
    }

    return { dispatched, skipped };
  },
});
