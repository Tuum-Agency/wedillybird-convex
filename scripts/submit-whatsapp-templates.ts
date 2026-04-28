#!/usr/bin/env -S pnpm tsx
/**
 * Script ops — soumet les templates WhatsApp à Meta Business Manager.
 *
 * Usage :
 *   WHATSAPP_ACCESS_TOKEN=EAAxxx WHATSAPP_WABA_ID=123456 \
 *     pnpm tsx scripts/submit-whatsapp-templates.ts [--dry-run] [--template <name>]
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
 *   - --dry-run     : simule sans appeler Meta (affiche les payloads JSON)
 *   - --template X  : ne soumet QUE le template nommé X (utile pour test ciblé)
 *
 * Le script est idempotent : avant chaque soumission il interroge l'API
 * Meta pour vérifier si un template avec le même nom existe déjà (peu importe
 * son status). Si oui : skip silencieux. Sinon : POST /message_templates.
 *
 * Templates soumis :
 *   - 5x wedding_invitation_<style> (catégorie MARKETING)
 *   - template_status_update (catégorie UTILITY) — notif au couple sur
 *     validation/refus d'un template custom
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

const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const WABA_ID = process.env.WHATSAPP_WABA_ID;
const GRAPH_VERSION = process.env.WHATSAPP_GRAPH_VERSION ?? 'v23.0';
const APP_BASE_URL = (process.env.APP_BASE_URL ?? 'https://wedillybird.com').replace(/\/$/, '');

// Parsing CLI args minimaliste — pas de dépendance pour rester ops-friendly.
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run') || process.env.DRY_RUN === '1';
const templateFlagIdx = args.indexOf('--template');
const ONLY_TEMPLATE = templateFlagIdx >= 0 ? args[templateFlagIdx + 1] : undefined;

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

/**
 * Construit le payload Meta pour un template d'invitation.
 * Body avec 4 vars + 1 bouton URL dynamique vers `/i/{{1}}` (token).
 */
function buildInvitationTemplate(
  name: string,
  bodyText: string,
  ctaLabel: string,
): MetaTemplateBody {
  // Exemples de valeurs réalistes que Meta utilise pour valider le template.
  // Doivent matcher le nombre de placeholders dans le body : {{1}}…{{4}}.
  const sampleVars = [
    'Aminata',
    'Mamadou & Marie',
    '30 avril 2026',
    'On compte sur toi pour ce grand jour !',
  ];

  return {
    name,
    category: 'MARKETING',
    language: 'fr',
    components: [
      {
        type: 'BODY',
        text: bodyText,
        example: { body_text: [sampleVars] },
      },
      {
        type: 'BUTTONS',
        buttons: [
          {
            type: 'URL',
            text: ctaLabel,
            url: `${APP_BASE_URL}/i/{{1}}`,
            example: [`${APP_BASE_URL}/i/abc123`],
          },
        ],
      },
    ],
  };
}

/**
 * Template UTILITY `template_status_update` — notif au couple sur
 * validation/refus de leur template custom (cf.
 * convex/whatsappTemplateNotifications.ts).
 *
 * Variables :
 *   {{1}} = prénom du destinataire
 *   {{2}} = nom du template concerné
 *   {{3}} = verbe de status ("validé" / "refusé" / "désactivé" / "suspendu")
 *   {{4}} = call-to-action ou raison de refus (chaîne libre, 1-200 chars)
 */
function buildTemplateStatusUpdate(): MetaTemplateBody {
  const bodyText =
    "Bonjour {{1}},\n\nVotre template WhatsApp « {{2}} » a été {{3}} par WhatsApp.\n\n{{4}}\n\nL'équipe Wedillybird.";

  const sampleVars = [
    'Aminata',
    'wedding_invitation_warm',
    'validé',
    'Vous pouvez maintenant utiliser ce template pour vos invitations.',
  ];

  return {
    name: 'template_status_update',
    category: 'UTILITY',
    language: 'fr',
    components: [
      {
        type: 'BODY',
        text: bodyText,
        example: { body_text: [sampleVars] },
      },
    ],
  };
}

/**
 * Template UTILITY `team_invitation` — un pro invite un collaborateur à
 * rejoindre son organisation.
 *
 * Variables :
 *   {{1}} = prénom du collaborateur invité
 *   {{2}} = nom de l'inviteur (ex: "Mamadou")
 *   {{3}} = nom de l'organisation
 * Bouton URL : `${APP_BASE_URL}/pro/invite/{{1}}` où {{1}} bouton = token.
 */
function buildTeamInvitation(): MetaTemplateBody {
  const bodyText =
    "Bonjour {{1}},\n\n{{2}} vous invite à rejoindre l'équipe « {{3}} » sur Wedillybird.\n\nCliquez sur le bouton ci-dessous pour accepter l'invitation.";

  return {
    name: 'team_invitation',
    category: 'UTILITY',
    language: 'fr',
    components: [
      {
        type: 'BODY',
        text: bodyText,
        example: {
          body_text: [['Aminata', 'Mamadou', 'Studio Wedillybird']],
        },
      },
      {
        type: 'BUTTONS',
        buttons: [
          {
            type: 'URL',
            text: "Rejoindre l'équipe",
            url: `${APP_BASE_URL}/pro/invite/{{1}}`,
            example: [`${APP_BASE_URL}/pro/invite/team-token-abc123`],
          },
        ],
      },
    ],
  };
}

/**
 * Template UTILITY `rsvp_reminder_d7` — rappel J-7 envoyé aux invités qui
 * n'ont pas confirmé leur présence.
 *
 * Variables :
 *   {{1}} = prénom de l'invité
 *   {{2}} = prénoms du couple
 *   {{3}} = date du mariage formatée
 * Bouton URL : `${APP_BASE_URL}/i/{{1}}` (token de l'invité).
 */
function buildRsvpReminderD7(): MetaTemplateBody {
  const bodyText =
    "Bonjour {{1}},\n\nLe mariage de {{2}} approche : c'est dans 7 jours, le {{3}}.\n\nMerci de confirmer votre présence dès maintenant pour aider les mariés à finaliser le plan de table.";

  return {
    name: 'rsvp_reminder_d7',
    category: 'UTILITY',
    language: 'fr',
    components: [
      {
        type: 'BODY',
        text: bodyText,
        example: {
          body_text: [['Aminata', 'Mamadou & Marie', '30 avril 2026']],
        },
      },
      {
        type: 'BUTTONS',
        buttons: [
          {
            type: 'URL',
            text: 'Confirmer ma présence',
            url: `${APP_BASE_URL}/i/{{1}}`,
            example: [`${APP_BASE_URL}/i/abc123`],
          },
        ],
      },
    ],
  };
}

/**
 * Template UTILITY `rsvp_reminder_d1` — rappel J-1 (veille du mariage).
 *
 * Variables :
 *   {{1}} = prénom de l'invité
 *   {{2}} = prénoms du couple
 *   {{3}} = lieu du mariage
 * Bouton URL : `${APP_BASE_URL}/i/{{1}}`.
 */
function buildRsvpReminderD1(): MetaTemplateBody {
  const bodyText =
    "Bonjour {{1}},\n\nLe grand jour de {{2}} est demain ! Rendez-vous à {{3}}.\n\nRetrouvez les détails et l'horaire sur votre invitation personnalisée.";

  return {
    name: 'rsvp_reminder_d1',
    category: 'UTILITY',
    language: 'fr',
    components: [
      {
        type: 'BODY',
        text: bodyText,
        example: {
          body_text: [['Aminata', 'Mamadou & Marie', 'Domaine des Roses, Versailles']],
        },
      },
      {
        type: 'BUTTONS',
        buttons: [
          {
            type: 'URL',
            text: "Voir l'invitation",
            url: `${APP_BASE_URL}/i/{{1}}`,
            example: [`${APP_BASE_URL}/i/abc123`],
          },
        ],
      },
    ],
  };
}

/**
 * Template UTILITY `rsvp_confirmation` — accusé de réception envoyé après
 * que l'invité a répondu à son RSVP.
 *
 * Variables :
 *   {{1}} = prénom de l'invité
 *   {{2}} = statut RSVP (« présent·e », « absent·e », « peut-être »)
 *   {{3}} = prénoms du couple
 */
function buildRsvpConfirmation(): MetaTemplateBody {
  const bodyText =
    'Bonjour {{1}},\n\nNous avons bien enregistré votre réponse : {{2}}. {{3}} en sont informé·e·s.\n\nMerci pour votre retour — à très vite !';

  return {
    name: 'rsvp_confirmation',
    category: 'UTILITY',
    language: 'fr',
    components: [
      {
        type: 'BODY',
        text: bodyText,
        example: {
          body_text: [['Aminata', 'présent·e', 'Mamadou & Marie']],
        },
      },
    ],
  };
}

/**
 * Vérifie si un template avec ce `name` existe déjà côté WABA (peu importe
 * son status : APPROVED / PENDING / REJECTED). Permet l'idempotence du
 * script. Renvoie `true` si un template existe (skip), `false` sinon.
 *
 * En mode --dry-run : skip silencieux du check (on ne tape pas l'API).
 */
async function templateExists(name: string): Promise<boolean> {
  if (DRY_RUN) return false;

  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${WABA_ID}/message_templates?name=${encodeURIComponent(
    name,
  )}&fields=name,status&limit=10`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
    },
  });

  if (!res.ok) {
    // Si l'API renvoie une erreur, on ne bloque pas — on tente la soumission
    // et Meta refusera si conflit. C'est plus prudent que de skipper à tort.
    console.warn(
      `   ⚠️  Lookup template "${name}" failed (HTTP ${res.status}) — proceeding with submit attempt.`,
    );
    return false;
  }

  const data = (await res.json()) as {
    data?: Array<{ name: string; status: string }>;
  };

  const match = data.data?.find((t) => t.name === name);
  if (match) {
    console.log(`   ⏭  Skipped — already exists (status=${match.status})`);
    return true;
  }
  return false;
}

async function submitTemplate(payload: MetaTemplateBody): Promise<void> {
  console.log(`\n📤 Submitting "${payload.name}" (${payload.category})...`);

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

  if (await templateExists(payload.name)) {
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

async function main(): Promise<void> {
  console.log('🚀 Soumission des templates WhatsApp à Meta Business Manager');
  console.log(`   Graph version: ${GRAPH_VERSION}`);
  console.log(`   WABA ID:       ${WABA_ID ?? '(dry-run)'}`);
  console.log(`   Base URL:      ${APP_BASE_URL}`);
  if (DRY_RUN) console.log('   ⚠️  DRY_RUN mode — aucun appel API Meta');
  if (ONLY_TEMPLATE) console.log(`   🎯  Filtre: template="${ONLY_TEMPLATE}" uniquement`);

  const templates: MetaTemplateBody[] = [
    ...Object.values(INVITATION_STYLES).map((style) =>
      buildInvitationTemplate(style.metaTemplateName, style.bodyText, style.ctaLabel),
    ),
    buildTemplateStatusUpdate(),
    buildTeamInvitation(),
    buildRsvpReminderD7(),
    buildRsvpReminderD1(),
    buildRsvpConfirmation(),
  ];

  const filtered = ONLY_TEMPLATE ? templates.filter((t) => t.name === ONLY_TEMPLATE) : templates;

  if (ONLY_TEMPLATE && filtered.length === 0) {
    console.error(
      `\n❌ Aucun template nommé "${ONLY_TEMPLATE}". Templates disponibles :\n   - ${templates
        .map((t) => t.name)
        .join('\n   - ')}`,
    );
    process.exit(1);
  }

  for (const template of filtered) {
    await submitTemplate(template);
  }

  console.log('\n✨ Terminé. Surveille la validation dans Business Manager → WhatsApp Manager.');
  console.log('   (Validation typique : 24-48 h)');
}

main().catch((err) => {
  console.error('❌ Erreur fatale:', err);
  process.exit(1);
});
