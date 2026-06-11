/**
 * Messagerie — réglages par défaut de l'agence (canal, expéditeur, template,
 * relances). Types purs + valeurs par défaut, partagés UI + tests.
 */

export const MSG_CHANNELS = [
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'sms', label: 'SMS' },
  { key: 'auto', label: 'Auto' },
] as const;
export type MsgChannel = (typeof MSG_CHANNELS)[number]['key'];

export const MSG_TEMPLATE_OPTS = [
  { key: 'editorial', label: 'Éditorial' },
  { key: 'classic', label: 'Classique' },
  { key: 'modern', label: 'Moderne' },
  { key: 'festive', label: 'Festif' },
  { key: 'sober', label: 'Sobre' },
] as const;
export type MsgTemplate = (typeof MSG_TEMPLATE_OPTS)[number]['key'];

export interface MessagingDefaults {
  channel: MsgChannel;
  senderName: string;
  defaultTemplate: MsgTemplate;
  reminderJ7: boolean;
  reminderJ1: boolean;
}

export function isMsgChannel(v: unknown): v is MsgChannel {
  return v === 'whatsapp' || v === 'sms' || v === 'auto';
}
export function isMsgTemplate(v: unknown): v is MsgTemplate {
  return (MSG_TEMPLATE_OPTS as readonly { key: string }[]).some((t) => t.key === v);
}

/** Réglages messagerie par défaut (nom d'expéditeur = nom de l'agence). */
export function defaultMessaging(orgName: string): MessagingDefaults {
  return {
    channel: 'whatsapp',
    senderName: orgName,
    defaultTemplate: 'editorial',
    reminderJ7: true,
    reminderJ1: true,
  };
}

/** Fusionne les réglages stockés (partiels) avec les valeurs par défaut. */
export function mergeMessaging(
  orgName: string,
  stored?: Partial<MessagingDefaults> | null,
): MessagingDefaults {
  const base = defaultMessaging(orgName);
  if (!stored) return base;
  return {
    channel: isMsgChannel(stored.channel) ? stored.channel : base.channel,
    senderName: stored.senderName?.trim() ? stored.senderName : base.senderName,
    defaultTemplate: isMsgTemplate(stored.defaultTemplate)
      ? stored.defaultTemplate
      : base.defaultTemplate,
    reminderJ7: stored.reminderJ7 ?? base.reminderJ7,
    reminderJ1: stored.reminderJ1 ?? base.reminderJ1,
  };
}
