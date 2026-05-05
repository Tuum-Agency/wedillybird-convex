#!/usr/bin/env -S pnpm tsx
/**
 * Script ops — soumet les templates WhatsApp à Meta Business Manager.
 *
 * Usage :
 *   WHATSAPP_ACCESS_TOKEN=EAAxxx WHATSAPP_WABA_ID=123456 \
 *     pnpm tsx scripts/submit-whatsapp-templates.ts [--dry-run] [--template <name>] [--language <code>]
 *
 * Variables d'environnement requises :
 *   - WHATSAPP_ACCESS_TOKEN : token avec scope `whatsapp_business_management`
 *   - WHATSAPP_WABA_ID : ID du WhatsApp Business Account (pas le phone number ID)
 *
 * Variables optionnelles :
 *   - WHATSAPP_GRAPH_VERSION : default "v23.0"
 *   - APP_BASE_URL : default "https://wedillybird.com" (pour le bouton CTA URL)
 *
 * Flags :
 *   - --dry-run        : simule sans appeler Meta (affiche les payloads JSON)
 *   - --template X     : ne soumet QUE le template nommé X (utile pour test ciblé)
 *   - --language CODE  : ne soumet QUE pour la locale CODE (fr, en, es, it, pt, de, ar)
 *
 * Le script est idempotent : avant chaque soumission il interroge l'API
 * Meta pour vérifier si un template avec le même couple (name, language)
 * existe déjà. Si oui : skip silencieux. Sinon : POST /message_templates.
 *
 * Templates soumis (× 7 langues = 70 soumissions au total) :
 *   - 5x wedding_invitation_<style> (catégorie MARKETING)
 *   - template_status_update (UTILITY) — notif au couple sur validation/refus
 *   - team_invitation (UTILITY) — pro invite collaborateur
 *   - rsvp_reminder_d7 (UTILITY) — rappel J-7 invité
 *   - rsvp_reminder_d1 (UTILITY) — rappel J-1 invité
 *   - rsvp_confirmation (UTILITY) — accusé réception RSVP
 *
 * Chaque soumission entre en status PENDING — la validation Meta prend
 * 24-48h. Les templates approuvés/rejetés sont visibles dans
 * Business Manager → WhatsApp Manager → Templates de message.
 */

import { INVITATION_STYLES } from '../lib/whatsapp/templates';
import {
  INVITATION_TRANSLATIONS,
  META_LANG_CODE,
  RSVP_CONFIRMATION_TRANSLATIONS,
  RSVP_REMINDER_D1_TRANSLATIONS,
  RSVP_REMINDER_D7_TRANSLATIONS,
  TEAM_INVITATION_TRANSLATIONS,
  TEMPLATE_STATUS_UPDATE_TRANSLATIONS,
  type NonFrLocale,
} from '../lib/whatsapp/template-translations';
import { routing, type Locale } from '../i18n/routing';

const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const WABA_ID = process.env.WHATSAPP_WABA_ID;
const GRAPH_VERSION = process.env.WHATSAPP_GRAPH_VERSION ?? 'v23.0';
const APP_BASE_URL = (process.env.APP_BASE_URL ?? 'https://wedillybird.com').replace(/\/$/, '');

// Parsing CLI args minimaliste — pas de dépendance pour rester ops-friendly.
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run') || process.env.DRY_RUN === '1';
const templateFlagIdx = args.indexOf('--template');
const ONLY_TEMPLATE = templateFlagIdx >= 0 ? args[templateFlagIdx + 1] : undefined;
const languageFlagIdx = args.indexOf('--language');
const ONLY_LANGUAGE =
  languageFlagIdx >= 0 ? (args[languageFlagIdx + 1] as Locale | undefined) : undefined;

if (ONLY_LANGUAGE && !routing.locales.includes(ONLY_LANGUAGE)) {
  console.error(
    `❌ --language "${ONLY_LANGUAGE}" invalide. Valeurs acceptées : ${routing.locales.join(', ')}`,
  );
  process.exit(1);
}

if (!DRY_RUN) {
  if (!ACCESS_TOKEN) {
    console.error('❌ WHATSAPP_ACCESS_TOKEN is required (or set --dry-run)');
    process.exit(1);
  }
  if (!WABA_ID) {
    console.error('❌ WHATSAPP_WABA_ID is required (or set --dry-run)');
    process.exit(1);
  }
}

interface MetaTemplateBody {
  name: string;
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  language: string;
  components: Array<
    | {
        type: 'BODY';
        text: string;
        example: { body_text: string[][] };
      }
    | {
        type: 'BUTTONS';
        buttons: Array<{
          type: 'URL';
          text: string;
          url: string;
          example?: string[];
        }>;
      }
  >;
}

/* -------------------------------------------------------------------------- */
/*  Bodies FR canoniques pour les templates UTILITY                            */
/*  (les bodies invitations FR sont dans INVITATION_STYLES)                    */
/* -------------------------------------------------------------------------- */

const FR_TEMPLATE_STATUS_UPDATE_BODY =
  "Bonjour {{1}},\n\nVotre template WhatsApp « {{2}} » a été {{3}} par WhatsApp.\n\n{{4}}\n\nL'équipe Wedillybird.";

const FR_TEAM_INVITATION_BODY =
  "Bonjour {{1}},\n\n{{2}} vous invite à rejoindre l'équipe « {{3}} » sur Wedillybird.\n\nCliquez sur le bouton ci-dessous pour accepter l'invitation.";
const FR_TEAM_INVITATION_CTA = "Rejoindre l'équipe";

const FR_RSVP_REMINDER_D7_BODY =
  "Bonjour {{1}},\n\nLe mariage de {{2}} approche : c'est dans 7 jours, le {{3}}.\n\nMerci de confirmer votre présence dès maintenant pour aider les mariés à finaliser le plan de table.";
const FR_RSVP_REMINDER_D7_CTA = 'Confirmer ma présence';

const FR_RSVP_REMINDER_D1_BODY =
  "Bonjour {{1}},\n\nLe grand jour de {{2}} est demain ! Rendez-vous à {{3}}.\n\nRetrouvez les détails et l'horaire sur votre invitation personnalisée.";
const FR_RSVP_REMINDER_D1_CTA = "Voir l'invitation";

const FR_RSVP_CONFIRMATION_BODY =
  'Bonjour {{1}},\n\nNous avons bien enregistré votre réponse : {{2}}. {{3}} en sont informé·e·s.\n\nMerci pour votre retour — à très vite !';

/* -------------------------------------------------------------------------- */
/*  Builders multi-langue                                                      */
/* -------------------------------------------------------------------------- */

function metaLang(locale: Locale): string {
  return META_LANG_CODE[locale];
}

/**
 * Body + CTA d'un template d'invitation pour une locale donnée.
 * FR vient d'INVITATION_STYLES (source canonique), les autres de
 * INVITATION_TRANSLATIONS.
 */
function getInvitationContent(
  styleId: keyof typeof INVITATION_STYLES,
  locale: Locale,
): { body: string; cta: string } {
  if (locale === 'fr') {
    const style = INVITATION_STYLES[styleId];
    return { body: style.bodyText, cta: style.ctaLabel };
  }
  const translation = INVITATION_TRANSLATIONS[styleId][locale as NonFrLocale];
  return { body: translation.body, cta: translation.cta ?? INVITATION_STYLES[styleId].ctaLabel };
}

function buildInvitationTemplate(
  styleId: keyof typeof INVITATION_STYLES,
  locale: Locale,
): MetaTemplateBody {
  const { body, cta } = getInvitationContent(styleId, locale);
  const sampleVars = [
    'Aminata',
    'Mamadou & Marie',
    '30 avril 2026',
    'On compte sur toi pour ce grand jour !',
  ];

  return {
    name: INVITATION_STYLES[styleId].metaTemplateName,
    category: 'MARKETING',
    language: metaLang(locale),
    components: [
      {
        type: 'BODY',
        text: body,
        example: { body_text: [sampleVars] },
      },
      {
        type: 'BUTTONS',
        buttons: [
          {
            type: 'URL',
            text: cta,
            url: `${APP_BASE_URL}/i/{{1}}`,
            example: [`${APP_BASE_URL}/i/abc123`],
          },
        ],
      },
    ],
  };
}

function buildTemplateStatusUpdate(locale: Locale): MetaTemplateBody {
  const body =
    locale === 'fr'
      ? FR_TEMPLATE_STATUS_UPDATE_BODY
      : TEMPLATE_STATUS_UPDATE_TRANSLATIONS[locale as NonFrLocale].body;

  const sampleVars = [
    'Aminata',
    'wedding_invitation_warm',
    'validé',
    'Vous pouvez maintenant utiliser ce template pour vos invitations.',
  ];

  return {
    name: 'template_status_update',
    category: 'UTILITY',
    language: metaLang(locale),
    components: [
      {
        type: 'BODY',
        text: body,
        example: { body_text: [sampleVars] },
      },
    ],
  };
}

function buildTeamInvitation(locale: Locale): MetaTemplateBody {
  const body =
    locale === 'fr'
      ? FR_TEAM_INVITATION_BODY
      : TEAM_INVITATION_TRANSLATIONS[locale as NonFrLocale].body;
  const cta =
    locale === 'fr'
      ? FR_TEAM_INVITATION_CTA
      : (TEAM_INVITATION_TRANSLATIONS[locale as NonFrLocale].cta ?? FR_TEAM_INVITATION_CTA);

  return {
    name: 'team_invitation',
    category: 'UTILITY',
    language: metaLang(locale),
    components: [
      {
        type: 'BODY',
        text: body,
        example: {
          body_text: [['Aminata', 'Mamadou', 'Studio Wedillybird']],
        },
      },
      {
        type: 'BUTTONS',
        buttons: [
          {
            type: 'URL',
            text: cta,
            url: `${APP_BASE_URL}/pro/invite/{{1}}`,
            example: [`${APP_BASE_URL}/pro/invite/team-token-abc123`],
          },
        ],
      },
    ],
  };
}

function buildRsvpReminderD7(locale: Locale): MetaTemplateBody {
  const body =
    locale === 'fr'
      ? FR_RSVP_REMINDER_D7_BODY
      : RSVP_REMINDER_D7_TRANSLATIONS[locale as NonFrLocale].body;
  const cta =
    locale === 'fr'
      ? FR_RSVP_REMINDER_D7_CTA
      : (RSVP_REMINDER_D7_TRANSLATIONS[locale as NonFrLocale].cta ?? FR_RSVP_REMINDER_D7_CTA);

  return {
    name: 'rsvp_reminder_d7',
    category: 'UTILITY',
    language: metaLang(locale),
    components: [
      {
        type: 'BODY',
        text: body,
        example: {
          body_text: [['Aminata', 'Mamadou & Marie', '30 avril 2026']],
        },
      },
      {
        type: 'BUTTONS',
        buttons: [
          {
            type: 'URL',
            text: cta,
            url: `${APP_BASE_URL}/i/{{1}}`,
            example: [`${APP_BASE_URL}/i/abc123`],
          },
        ],
      },
    ],
  };
}

function buildRsvpReminderD1(locale: Locale): MetaTemplateBody {
  const body =
    locale === 'fr'
      ? FR_RSVP_REMINDER_D1_BODY
      : RSVP_REMINDER_D1_TRANSLATIONS[locale as NonFrLocale].body;
  const cta =
    locale === 'fr'
      ? FR_RSVP_REMINDER_D1_CTA
      : (RSVP_REMINDER_D1_TRANSLATIONS[locale as NonFrLocale].cta ?? FR_RSVP_REMINDER_D1_CTA);

  return {
    name: 'rsvp_reminder_d1',
    category: 'UTILITY',
    language: metaLang(locale),
    components: [
      {
        type: 'BODY',
        text: body,
        example: {
          body_text: [['Aminata', 'Mamadou & Marie', 'Domaine des Roses, Versailles']],
        },
      },
      {
        type: 'BUTTONS',
        buttons: [
          {
            type: 'URL',
            text: cta,
            url: `${APP_BASE_URL}/i/{{1}}`,
            example: [`${APP_BASE_URL}/i/abc123`],
          },
        ],
      },
    ],
  };
}

function buildRsvpConfirmation(locale: Locale): MetaTemplateBody {
  const body =
    locale === 'fr'
      ? FR_RSVP_CONFIRMATION_BODY
      : RSVP_CONFIRMATION_TRANSLATIONS[locale as NonFrLocale].body;

  return {
    name: 'rsvp_confirmation',
    category: 'UTILITY',
    language: metaLang(locale),
    components: [
      {
        type: 'BODY',
        text: body,
        example: {
          body_text: [['Aminata', 'présent·e', 'Mamadou & Marie']],
        },
      },
    ],
  };
}

/* -------------------------------------------------------------------------- */
/*  Soumission Meta                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Vérifie si un template avec ce couple (name, language) existe déjà côté
 * WABA. Permet l'idempotence du script. Renvoie `true` si un template existe
 * (skip), `false` sinon.
 *
 * En mode --dry-run : skip silencieux du check (on ne tape pas l'API).
 */
async function templateExists(name: string, language: string): Promise<boolean> {
  if (DRY_RUN) return false;

  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${WABA_ID}/message_templates?name=${encodeURIComponent(
    name,
  )}&fields=name,status,language&limit=20`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
    },
  });

  if (!res.ok) {
    console.warn(
      `   ⚠️  Lookup template "${name}/${language}" failed (HTTP ${res.status}) — proceeding with submit attempt.`,
    );
    return false;
  }

  const data = (await res.json()) as {
    data?: Array<{ name: string; status: string; language: string }>;
  };

  const match = data.data?.find((t) => t.name === name && t.language === language);
  if (match) {
    console.log(`   ⏭  Skipped — already exists (status=${match.status})`);
    return true;
  }
  return false;
}

async function submitTemplate(payload: MetaTemplateBody): Promise<void> {
  console.log(`\n📤 Submitting "${payload.name}" [${payload.language}] (${payload.category})...`);

  if (DRY_RUN) {
    console.log('   [dry-run] Payload:');
    console.log(
      JSON.stringify(payload, null, 2)
        .split('\n')
        .map((l) => `   ${l}`)
        .join('\n'),
    );
    return;
  }

  if (await templateExists(payload.name, payload.language)) {
    return;
  }

  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${WABA_ID}/message_templates`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = (await res.json()) as {
    id?: string;
    status?: string;
    category?: string;
    error?: { message: string; code: number; error_subcode?: number };
  };

  if (!res.ok || data.error) {
    console.error(`   ❌ FAILED — ${data.error?.message ?? `HTTP ${res.status}`}`);
    if (data.error?.error_subcode) {
      console.error(`      error_subcode: ${data.error.error_subcode}`);
    }
    return;
  }

  console.log(`   ✅ Submitted — id=${data.id} status=${data.status ?? 'PENDING'}`);
}

function buildAllTemplatesForLocale(locale: Locale): MetaTemplateBody[] {
  return [
    ...(Object.keys(INVITATION_STYLES) as Array<keyof typeof INVITATION_STYLES>).map((styleId) =>
      buildInvitationTemplate(styleId, locale),
    ),
    buildTemplateStatusUpdate(locale),
    buildTeamInvitation(locale),
    buildRsvpReminderD7(locale),
    buildRsvpReminderD1(locale),
    buildRsvpConfirmation(locale),
  ];
}

async function main(): Promise<void> {
  const localesToSubmit: ReadonlyArray<Locale> = ONLY_LANGUAGE ? [ONLY_LANGUAGE] : routing.locales;

  console.log('🚀 Soumission des templates WhatsApp à Meta Business Manager');
  console.log(`   Graph version: ${GRAPH_VERSION}`);
  console.log(`   WABA ID:       ${WABA_ID ?? '(dry-run)'}`);
  console.log(`   Base URL:      ${APP_BASE_URL}`);
  console.log(`   Locales:       ${localesToSubmit.join(', ')}`);
  if (DRY_RUN) console.log('   ⚠️  DRY_RUN mode — aucun appel API Meta');
  if (ONLY_TEMPLATE) console.log(`   🎯  Filtre: template="${ONLY_TEMPLATE}" uniquement`);

  const allTemplates: MetaTemplateBody[] = [];
  for (const locale of localesToSubmit) {
    allTemplates.push(...buildAllTemplatesForLocale(locale));
  }

  const filtered = ONLY_TEMPLATE
    ? allTemplates.filter((t) => t.name === ONLY_TEMPLATE)
    : allTemplates;

  if (ONLY_TEMPLATE && filtered.length === 0) {
    const uniqueNames = [...new Set(allTemplates.map((t) => t.name))].sort();
    console.error(
      `\n❌ Aucun template nommé "${ONLY_TEMPLATE}". Templates disponibles :\n   - ${uniqueNames.join(
        '\n   - ',
      )}`,
    );
    process.exit(1);
  }

  console.log(`   Total à soumettre : ${filtered.length} payload(s)\n`);

  for (const template of filtered) {
    await submitTemplate(template);
  }

  console.log('\n✨ Terminé. Surveille la validation dans Business Manager → WhatsApp Manager.');
  console.log('   (Validation typique : 24-48 h par template par langue)');
}

main().catch((err) => {
  console.error('❌ Erreur fatale:', err);
  process.exit(1);
});
