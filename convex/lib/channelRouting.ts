/**
 * Routage canal par pays — décide si un destinataire reçoit ses messages
 * (OTP, invitation, reminders) via SMS (Twilio) ou WhatsApp (Meta Cloud).
 *
 * Stratégie de lancement (cf. `.context/pricing-v2.md` + ciblage US-first) :
 *  - US / Canada (`+1`) → SMS : l'adoption WhatsApp y est faible (~25 %).
 *  - Reste du monde     → WhatsApp : canal dominant, déjà intégré, coût quasi nul.
 *
 * Le routage se fait sur l'indicatif du NUMÉRO DESTINATAIRE (E.164), jamais
 * sur le pays du compte : un invité `+1` d'un couple français reçoit un SMS,
 * une invitée `+221` d'un couple US reçoit un WhatsApp.
 *
 * Ajouter un pays SMS = ajouter son indicatif à `SMS_COUNTRY_CODES`
 * (env var, ex. `SMS_COUNTRY_CODES="+1,+44"`). Sans override, seul `+1` est
 * routé vers le SMS. Aucun changement de code requis pour étendre la liste.
 */

export type MessageChannel = 'sms' | 'whatsapp';

/** Indicatifs routés vers le SMS par défaut. `+1` = NANP (US + Canada). */
const DEFAULT_SMS_COUNTRY_CODES = ['+1'];

/**
 * Liste des indicatifs routés vers le SMS. Lue depuis `SMS_COUNTRY_CODES`
 * (CSV) si défini, sinon `DEFAULT_SMS_COUNTRY_CODES`.
 */
export function getSmsCountryCodes(): string[] {
  const raw = process.env.SMS_COUNTRY_CODES;
  if (!raw) return DEFAULT_SMS_COUNTRY_CODES;
  const parsed = raw
    .split(',')
    .map((code) => code.trim())
    .filter(Boolean);
  return parsed.length > 0 ? parsed : DEFAULT_SMS_COUNTRY_CODES;
}

/**
 * Résout le canal d'envoi pour un numéro E.164.
 *
 * Match sur le préfixe d'indicatif le plus long d'abord — robuste si un jour
 * on distingue un sous-indicatif (`+1242`) d'un indicatif parent (`+1`).
 * Tout numéro qui ne matche aucun indicatif SMS retombe sur WhatsApp.
 */
export function resolveChannel(phoneE164: string): MessageChannel {
  const codes = getSmsCountryCodes()
    .slice()
    .sort((a, b) => b.length - a.length);
  for (const code of codes) {
    if (phoneE164.startsWith(code)) return 'sms';
  }
  return 'whatsapp';
}
