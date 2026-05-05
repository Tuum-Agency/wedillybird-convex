/**
 * Traductions des templates WhatsApp Cloud API pour soumission Meta multi-langue.
 *
 * Cette table contient les bodies + CTA labels des 10 templates Meta dans les
 * 6 langues non-FR (en, es, it, pt, de, ar). Le FR reste défini ailleurs :
 *   - Invitations (5 styles) → `INVITATION_STYLES` dans `lib/whatsapp/templates.ts`
 *   - Templates utility (5) → fonctions `build*()` dans
 *     `scripts/submit-whatsapp-templates.ts`
 *
 * Le script de soumission lit ces traductions et soumet à Meta une version
 * par langue (même `name`, `language` différent — c'est le pattern canonique
 * Meta : un template logique, plusieurs traductions).
 *
 * Toute modification ici nécessite une re-soumission Meta + nouvelle
 * validation 24-48h. Les bodies doivent matcher EXACTEMENT le texte soumis.
 *
 * Placeholders Meta `{{1}}`, `{{2}}`, etc. à préserver tels quels — Meta
 * valide leur cohérence lors de la soumission (sample vars passés en regard).
 *
 * Codes langue Meta : ISO 639-1 simples sauf pour PT qui exige une variante
 * régionale explicite. Les autres langues n'ont qu'une variante côté Meta
 * (fr, en, es, it, de, ar — pas de fr_FR ou de_DE requis en 2026).
 */

import type { Locale } from '@/i18n/routing';
import type { InvitationStyleId } from './templates';

/**
 * Mapping locale app → code langue Meta WhatsApp.
 * Meta exige `pt_PT` ou `pt_BR` (pas de `pt` générique). Notre marché PT cible
 * l'Europe (cf. PR2 — traduction PT-PT, pas brésilien). Les autres langues
 * acceptent leur code 2-lettres tel quel.
 */
export const META_LANG_CODE: Record<Locale, string> = {
  fr: 'fr',
  en: 'en',
  es: 'es',
  it: 'it',
  pt: 'pt_PT',
  de: 'de',
  ar: 'ar',
};

export type NonFrLocale = Exclude<Locale, 'fr'>;

interface TemplateTranslation {
  body: string;
  /** CTA label du bouton URL (max 25 chars Meta). Optionnel pour templates sans bouton. */
  cta?: string;
}

/* -------------------------------------------------------------------------- */
/*  INVITATIONS — 5 styles × 6 langues                                         */
/*  Variables : {{1}}=prénom invité, {{2}}=couple, {{3}}=date, {{4}}=mot perso */
/* -------------------------------------------------------------------------- */

export const INVITATION_TRANSLATIONS: Record<
  InvitationStyleId,
  Record<NonFrLocale, TemplateTranslation>
> = {
  classic: {
    en: {
      body: 'Hello {{1}},\n\n{{2}} are honoured to invite you to their wedding on {{3}}.\n\n{{4}}\n\nKindly confirm your attendance by tapping the button below.',
      cta: 'Confirm attendance',
    },
    es: {
      body: 'Hola {{1}},\n\n{{2}} tienen el honor de invitarte a su boda el {{3}}.\n\n{{4}}\n\nTe agradeceríamos que confirmaras tu asistencia pulsando el botón a continuación.',
      cta: 'Confirmar asistencia',
    },
    it: {
      body: "Buongiorno {{1}},\n\n{{2}} hanno l'onore di invitarti al loro matrimonio il {{3}}.\n\n{{4}}\n\nTi chiediamo gentilmente di confermare la tua presenza toccando il pulsante qui sotto.",
      cta: 'Conferma presenza',
    },
    pt: {
      body: 'Olá {{1}},\n\n{{2}} têm a honra de o(a) convidar para o seu casamento a {{3}}.\n\n{{4}}\n\nAgradecemos que confirme a sua presença ao tocar no botão abaixo.',
      cta: 'Confirmar presença',
    },
    de: {
      body: 'Hallo {{1}},\n\n{{2}} laden dich herzlich zu ihrer Hochzeit am {{3}} ein.\n\n{{4}}\n\nBitte bestätige deine Teilnahme über den Button unten.',
      cta: 'Teilnahme bestätigen',
    },
    ar: {
      body: 'مرحبًا {{1}}،\n\nيتشرّف {{2}} بدعوتك لحضور حفل زفافهما في {{3}}.\n\n{{4}}\n\nيُرجى تأكيد حضورك بالضغط على الزر أدناه.',
      cta: 'تأكيد الحضور',
    },
  },

  warm: {
    en: {
      body: "Hey {{1}}!\n\n{{2}} are getting married on {{3}} and we'd love to have you there.\n\n{{4}}\n\nReply to the invitation below — can't wait to celebrate with you.",
      cta: 'Reply',
    },
    es: {
      body: '¡Hola {{1}}!\n\n{{2}} se casan el {{3}} y nos encantaría tenerte con nosotros.\n\n{{4}}\n\nResponde a la invitación de abajo, ¡tenemos muchas ganas de verte!',
      cta: 'Responder',
    },
    it: {
      body: 'Ciao {{1}}!\n\n{{2}} si sposano il {{3}} e ci farebbe piacere averti con noi.\n\n{{4}}\n\nRispondi qui sotto — non vediamo l’ora di festeggiare con te.',
      cta: 'Rispondi',
    },
    pt: {
      body: 'Olá {{1}}!\n\n{{2}} casam-se a {{3}} e adoraríamos contar contigo.\n\n{{4}}\n\nResponde já ao convite abaixo — mal podemos esperar para te ver.',
      cta: 'Responder',
    },
    de: {
      body: 'Hey {{1}}!\n\n{{2}} heiraten am {{3}} und würden sich riesig freuen, dich dabei zu haben.\n\n{{4}}\n\nAntworte auf die Einladung unten — wir freuen uns auf dich.',
      cta: 'Antworten',
    },
    ar: {
      body: 'مرحبًا {{1}}!\n\nسيحتفل {{2}} بزفافهما في {{3}}، ويسعدنا أن تكون معنا.\n\n{{4}}\n\nردّ على الدعوة أدناه — نتطلّع لرؤيتك.',
      cta: 'الرد على الدعوة',
    },
  },

  african: {
    en: {
      body: 'Dear {{1}},\n\nWith joy and blessings, {{2}} celebrate their union on {{3}}. Your presence will be our greatest blessing.\n\n{{4}}\n\nKindly confirm your attendance below.',
      cta: 'Confirm attendance',
    },
    es: {
      body: 'Querido(a) {{1}},\n\nCon alegría y bendiciones, {{2}} celebran su unión el {{3}}. Tu presencia será nuestra mayor bendición.\n\n{{4}}\n\nPor favor, confirma tu asistencia a continuación.',
      cta: 'Confirmar asistencia',
    },
    it: {
      body: 'Carissimo(a) {{1}},\n\nCon gioia e benedizioni, {{2}} celebrano la loro unione il {{3}}. La tua presenza sarà la nostra più grande benedizione.\n\n{{4}}\n\nTi preghiamo di confermare la tua presenza qui sotto.',
      cta: 'Conferma presenza',
    },
    pt: {
      body: 'Caro(a) {{1}},\n\nCom alegria e bênçãos, {{2}} celebram a sua união a {{3}}. A tua presença será a nossa maior bênção.\n\n{{4}}\n\nConfirma a tua presença abaixo, por favor.',
      cta: 'Confirmar presença',
    },
    de: {
      body: 'Liebe·r {{1}},\n\nMit Freude und Segen feiern {{2}} ihre Verbindung am {{3}}. Deine Anwesenheit wird unser größter Segen sein.\n\n{{4}}\n\nBitte bestätige deine Teilnahme unten.',
      cta: 'Teilnahme bestätigen',
    },
    ar: {
      body: 'عزيزي/عزيزتي {{1}}،\n\nبالفرح والبركات، يحتفل {{2}} بزواجهما في {{3}}. حضوركم سيكون أعظم بركة لنا.\n\n{{4}}\n\nيُرجى تأكيد حضوركم أدناه.',
      cta: 'تأكيد الحضور',
    },
  },

  minimal: {
    en: {
      body: 'Save the date, {{1}}.\n\n{{2}}\non {{3}}\n\n{{4}}\n\nPlease reply to this invitation.',
      cta: 'View invitation',
    },
    es: {
      body: 'Reserva la fecha, {{1}}.\n\n{{2}}\nel {{3}}\n\n{{4}}\n\nPor favor, responde a esta invitación.',
      cta: 'Ver invitación',
    },
    it: {
      body: 'Save the date, {{1}}.\n\n{{2}}\nil {{3}}\n\n{{4}}\n\nTi preghiamo di rispondere a questo invito.',
      cta: "Vedi l'invito",
    },
    pt: {
      body: 'Reserva a data, {{1}}.\n\n{{2}}\na {{3}}\n\n{{4}}\n\nResponde, por favor, a este convite.',
      cta: 'Ver convite',
    },
    de: {
      body: 'Save the date, {{1}}.\n\n{{2}}\nam {{3}}\n\n{{4}}\n\nBitte antworte auf diese Einladung.',
      cta: 'Einladung ansehen',
    },
    ar: {
      body: 'احفظ التاريخ، {{1}}.\n\n{{2}}\nفي {{3}}\n\n{{4}}\n\nيُرجى الرد على هذه الدعوة.',
      cta: 'عرض الدعوة',
    },
  },

  festive: {
    en: {
      body: "🎉 {{1}}, big news!\n\n{{2}} are saying YES on {{3}} and we absolutely want to celebrate this day with you.\n\n{{4}}\n\nHead to the invitation to confirm you'll be there.",
      cta: "I'm celebrating!",
    },
    es: {
      body: '🎉 {{1}}, ¡tenemos una gran noticia!\n\n{{2}} se dan el SÍ el {{3}} y queremos celebrar este día contigo.\n\n{{4}}\n\nEntra en la invitación para confirmar tu asistencia.',
      cta: '¡Voy a la fiesta!',
    },
    it: {
      body: '🎉 {{1}}, una grande notizia!\n\n{{2}} si dicono SÌ il {{3}} e vogliamo assolutamente festeggiare questo giorno con te.\n\n{{4}}\n\nVai sull’invito per confermare la tua presenza.',
      cta: 'Ci sarò!',
    },
    pt: {
      body: '🎉 {{1}}, grande notícia!\n\n{{2}} dizem SIM a {{3}} e queremos mesmo celebrar este dia contigo.\n\n{{4}}\n\nVai ao convite para confirmar a tua presença.',
      cta: 'Vou festejar!',
    },
    de: {
      body: '🎉 {{1}}, große Neuigkeiten!\n\n{{2}} sagen am {{3}} JA und wir wollen unbedingt mit dir feiern.\n\n{{4}}\n\nÖffne die Einladung, um deine Teilnahme zu bestätigen.',
      cta: 'Ich feiere mit!',
    },
    ar: {
      body: '🎉 {{1}}، لدينا خبر سعيد!\n\nيقول {{2}} «نعم» في {{3}}، ونتمنّى أن نحتفل بهذا اليوم معك.\n\n{{4}}\n\nادخل إلى الدعوة لتأكيد حضورك.',
      cta: 'سأحتفل معكم!',
    },
  },
};

/* -------------------------------------------------------------------------- */
/*  TEMPLATES UTILITY — 5 templates × 6 langues                                */
/* -------------------------------------------------------------------------- */

/**
 * `template_status_update` — notif au couple sur validation/refus de leur
 * template custom. Variables :
 *   {{1}} = prénom destinataire, {{2}} = nom du template,
 *   {{3}} = verbe de status, {{4}} = call-to-action ou raison
 */
export const TEMPLATE_STATUS_UPDATE_TRANSLATIONS: Record<NonFrLocale, TemplateTranslation> = {
  en: {
    body: 'Hello {{1}},\n\nYour WhatsApp template "{{2}}" has been {{3}} by WhatsApp.\n\n{{4}}\n\nThe Wedillybird team.',
  },
  es: {
    body: 'Hola {{1}},\n\nTu plantilla de WhatsApp "{{2}}" ha sido {{3}} por WhatsApp.\n\n{{4}}\n\nEl equipo de Wedillybird.',
  },
  it: {
    body: 'Ciao {{1}},\n\nIl tuo template WhatsApp "{{2}}" è stato {{3}} da WhatsApp.\n\n{{4}}\n\nIl team Wedillybird.',
  },
  pt: {
    body: 'Olá {{1}},\n\nO teu modelo WhatsApp "{{2}}" foi {{3}} pelo WhatsApp.\n\n{{4}}\n\nA equipa Wedillybird.',
  },
  de: {
    body: 'Hallo {{1}},\n\nDeine WhatsApp-Vorlage „{{2}}" wurde von WhatsApp {{3}}.\n\n{{4}}\n\nDein Wedillybird-Team.',
  },
  ar: {
    body: 'مرحبًا {{1}}،\n\nقامت WhatsApp بـ{{3}} قالبك "{{2}}".\n\n{{4}}\n\nفريق Wedillybird.',
  },
};

/**
 * `team_invitation` — pro invite collaborateur. Variables :
 *   {{1}} = prénom invité, {{2}} = nom inviteur, {{3}} = nom organisation
 */
export const TEAM_INVITATION_TRANSLATIONS: Record<NonFrLocale, TemplateTranslation> = {
  en: {
    body: 'Hello {{1}},\n\n{{2}} invites you to join the "{{3}}" team on Wedillybird.\n\nTap the button below to accept the invitation.',
    cta: 'Join the team',
  },
  es: {
    body: 'Hola {{1}},\n\n{{2}} te invita a unirte al equipo "{{3}}" en Wedillybird.\n\nPulsa el botón a continuación para aceptar la invitación.',
    cta: 'Unirme al equipo',
  },
  it: {
    body: 'Ciao {{1}},\n\n{{2}} ti invita a unirti al team "{{3}}" su Wedillybird.\n\nTocca il pulsante qui sotto per accettare l’invito.',
    cta: 'Unisciti al team',
  },
  pt: {
    body: 'Olá {{1}},\n\n{{2}} convida-te a juntar-te à equipa "{{3}}" na Wedillybird.\n\nToca no botão abaixo para aceitar o convite.',
    cta: 'Juntar-me à equipa',
  },
  de: {
    body: 'Hallo {{1}},\n\n{{2}} lädt dich ein, dem Team „{{3}}" auf Wedillybird beizutreten.\n\nTippe auf den Button unten, um die Einladung anzunehmen.',
    cta: 'Team beitreten',
  },
  ar: {
    body: 'مرحبًا {{1}}،\n\nيدعوك {{2}} للانضمام إلى فريق "{{3}}" على Wedillybird.\n\nاضغط على الزر أدناه لقبول الدعوة.',
    cta: 'الانضمام إلى الفريق',
  },
};

/**
 * `rsvp_reminder_d7` — rappel J-7 invité. Variables :
 *   {{1}} = prénom invité, {{2}} = couple, {{3}} = date formatée
 */
export const RSVP_REMINDER_D7_TRANSLATIONS: Record<NonFrLocale, TemplateTranslation> = {
  en: {
    body: "Hello {{1}},\n\n{{2}}'s wedding is coming up: it's in 7 days, on {{3}}.\n\nPlease confirm your attendance now to help the couple finalise the seating plan.",
    cta: 'Confirm attendance',
  },
  es: {
    body: 'Hola {{1}},\n\nLa boda de {{2}} se acerca: es dentro de 7 días, el {{3}}.\n\nPor favor, confirma tu asistencia ahora para ayudar a los novios a finalizar la distribución de las mesas.',
    cta: 'Confirmar asistencia',
  },
  it: {
    body: 'Ciao {{1}},\n\nIl matrimonio di {{2}} si avvicina: tra 7 giorni, il {{3}}.\n\nTi chiediamo di confermare la tua presenza per aiutare gli sposi a finalizzare il piano dei tavoli.',
    cta: 'Conferma presenza',
  },
  pt: {
    body: 'Olá {{1}},\n\nO casamento de {{2}} está a chegar: é daqui a 7 dias, a {{3}}.\n\nConfirma já a tua presença para ajudar os noivos a finalizar o plano de mesas.',
    cta: 'Confirmar presença',
  },
  de: {
    body: 'Hallo {{1}},\n\nDie Hochzeit von {{2}} steht kurz bevor: in 7 Tagen, am {{3}}.\n\nBitte bestätige jetzt deine Teilnahme, damit das Paar die Tischordnung finalisieren kann.',
    cta: 'Teilnahme bestätigen',
  },
  ar: {
    body: 'مرحبًا {{1}}،\n\nيقترب موعد زفاف {{2}}: بعد 7 أيام، في {{3}}.\n\nيُرجى تأكيد حضورك الآن لمساعدة العروسين على إنهاء ترتيب الطاولات.',
    cta: 'تأكيد الحضور',
  },
};

/**
 * `rsvp_reminder_d1` — rappel J-1. Variables :
 *   {{1}} = prénom invité, {{2}} = couple, {{3}} = lieu
 */
export const RSVP_REMINDER_D1_TRANSLATIONS: Record<NonFrLocale, TemplateTranslation> = {
  en: {
    body: "Hello {{1}},\n\n{{2}}'s big day is tomorrow! See you at {{3}}.\n\nFind all the details and timings on your personalised invitation.",
    cta: 'View invitation',
  },
  es: {
    body: 'Hola {{1}},\n\n¡El gran día de {{2}} es mañana! Nos vemos en {{3}}.\n\nEncuentra todos los detalles y horarios en tu invitación personalizada.',
    cta: 'Ver invitación',
  },
  it: {
    body: 'Ciao {{1}},\n\nIl gran giorno di {{2}} è domani! Ci vediamo a {{3}}.\n\nTrovi tutti i dettagli e gli orari sul tuo invito personalizzato.',
    cta: "Vedi l'invito",
  },
  pt: {
    body: 'Olá {{1}},\n\nO grande dia de {{2}} é amanhã! Encontramo-nos em {{3}}.\n\nVê todos os detalhes e horários no teu convite personalizado.',
    cta: 'Ver convite',
  },
  de: {
    body: 'Hallo {{1}},\n\nDer große Tag von {{2}} ist morgen! Wir sehen uns in {{3}}.\n\nAlle Details und Uhrzeiten findest du auf deiner persönlichen Einladung.',
    cta: 'Einladung ansehen',
  },
  ar: {
    body: 'مرحبًا {{1}}،\n\nيوم زفاف {{2}} غدًا! نراكم في {{3}}.\n\nجميع التفاصيل والأوقات على دعوتك الشخصية.',
    cta: 'عرض الدعوة',
  },
};

/**
 * `rsvp_confirmation` — accusé réception RSVP. Variables :
 *   {{1}} = prénom invité, {{2}} = statut RSVP, {{3}} = couple
 */
export const RSVP_CONFIRMATION_TRANSLATIONS: Record<NonFrLocale, TemplateTranslation> = {
  en: {
    body: 'Hello {{1}},\n\nWe have recorded your reply: {{2}}. {{3}} have been notified.\n\nThank you for your response — see you soon!',
  },
  es: {
    body: 'Hola {{1}},\n\nHemos registrado tu respuesta: {{2}}. {{3}} han sido informados.\n\nGracias por tu respuesta. ¡Hasta pronto!',
  },
  it: {
    body: 'Ciao {{1}},\n\nAbbiamo registrato la tua risposta: {{2}}. {{3}} sono stati informati.\n\nGrazie per il tuo riscontro — a presto!',
  },
  pt: {
    body: 'Olá {{1}},\n\nRegistámos a tua resposta: {{2}}. {{3}} foram informados.\n\nObrigado pelo retorno — até breve!',
  },
  de: {
    body: 'Hallo {{1}},\n\nWir haben deine Antwort erfasst: {{2}}. {{3}} wurden benachrichtigt.\n\nDanke für deine Rückmeldung — bis bald!',
  },
  ar: {
    body: 'مرحبًا {{1}}،\n\nسجّلنا ردّك: {{2}}. وتمّ إخطار {{3}}.\n\nشكرًا على ردّك — إلى اللقاء قريبًا!',
  },
};
