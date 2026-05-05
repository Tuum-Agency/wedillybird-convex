import type { Locale } from '../../../i18n/routing';
import { getServerTranslator } from '../../i18n/server-translator';
import type { EmailRendered } from '../types';
import { button, escapeHtml, htmlLayout, paragraph } from './_layout';

export type TemplateStatusKind = 'approved' | 'rejected' | 'disabled' | 'paused';

export interface WhatsappTemplateStatusInput {
  recipientName: string;
  templateName: string;
  eventTitle: string;
  status: TemplateStatusKind;
  rejectionReason?: string;
  ctaUrl?: string;
  locale?: Locale | string;
}

const SUBJECT_KEY: Record<TemplateStatusKind, string> = {
  approved: 'subjectApproved',
  rejected: 'subjectRejected',
  disabled: 'subjectDisabled',
  paused: 'subjectPaused',
};

const VERB_KEY: Record<TemplateStatusKind, string> = {
  approved: 'verbApproved',
  rejected: 'verbRejected',
  disabled: 'verbDisabled',
  paused: 'verbPaused',
};

const LEAD_KEY: Record<TemplateStatusKind, string> = {
  approved: 'leadApproved',
  rejected: 'leadRejected',
  disabled: 'leadDisabled',
  paused: 'leadPaused',
};

export function renderWhatsappTemplateStatusEmail(
  input: WhatsappTemplateStatusInput,
): EmailRendered {
  const { recipientName, templateName, eventTitle, status, rejectionReason, ctaUrl, locale } =
    input;
  const t = getServerTranslator(locale);

  const subject = t(
    `Emails.whatsappTemplateStatus.${SUBJECT_KEY[status]}` as 'Emails.whatsappTemplateStatus.subjectApproved',
  );
  const verb = t(
    `Emails.whatsappTemplateStatus.${VERB_KEY[status]}` as 'Emails.whatsappTemplateStatus.verbApproved',
  );
  const lead = t(
    `Emails.whatsappTemplateStatus.${LEAD_KEY[status]}` as 'Emails.whatsappTemplateStatus.leadApproved',
    {
      eventTitle,
    },
  );

  const reasonBlock =
    (status === 'rejected' || status === 'disabled' || status === 'paused') && rejectionReason
      ? `<div style="margin:16px 0;padding:14px 16px;background:#fdf3ee;border-left:3px solid #c68567;border-radius:6px;font-size:14px;line-height:1.5;color:#533a26;"><strong>${escapeHtml(t('Emails.whatsappTemplateStatus.reasonLabel'))}</strong><br/>${escapeHtml(rejectionReason)}</div>`
      : '';

  const ctaLabel =
    status === 'approved'
      ? t('Emails.whatsappTemplateStatus.ctaApproved')
      : t('Emails.whatsappTemplateStatus.ctaAdjust');

  const html = htmlLayout({
    preheader: t('Emails.whatsappTemplateStatus.preheader', { templateName, verb }),
    body:
      paragraph(t('Emails.common.greeting', { name: recipientName })) +
      paragraph(lead) +
      `<p style="margin:0 0 16px 0;">${escapeHtml(t('Emails.whatsappTemplateStatus.templateLabel'))} <em style="font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:14px;">${escapeHtml(templateName)}</em></p>` +
      reasonBlock +
      (ctaUrl ? button(ctaLabel, ctaUrl) : ''),
    footer: t('Emails.whatsappTemplateStatus.footer'),
    locale,
  });

  const text = [
    t('Emails.common.greeting', { name: recipientName }),
    '',
    lead,
    '',
    t('Emails.whatsappTemplateStatus.textTemplate', { templateName }),
    ...(reasonBlock && rejectionReason
      ? ['', t('Emails.whatsappTemplateStatus.textReason', { reason: rejectionReason })]
      : []),
    ...(ctaUrl ? ['', ctaUrl] : []),
    '',
    t('Emails.common.signature'),
  ].join('\n');

  return { subject, html, text };
}
