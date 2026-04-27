#!/usr/bin/env -S pnpm tsx
/**
 * Script ops — soumet les templates WhatsApp à Meta Business Manager.
 *
 * Usage :
 *   WHATSAPP_ACCESS_TOKEN=EAAxxx WHATSAPP_WABA_ID=123456 \
 *     pnpm tsx scripts/submit-whatsapp-templates.ts
 *
 * Variables d'environnement requises :
 *   - WHATSAPP_ACCESS_TOKEN : token avec scope `whatsapp_business_management`
 *   - WHATSAPP_WABA_ID : ID du WhatsApp Business Account (pas le phone number ID)
 *
 * Variables optionnelles :
 *   - WHATSAPP_GRAPH_VERSION : default "v23.0"
 *   - APP_BASE_URL : default "https://wedillybird.com" (pour le bouton CTA URL)
 *   - DRY_RUN=1 : simule sans appeler Meta (affiche les payloads)
 *
 * Le script soumet :
 *   - 5 templates wedding_invitation_* (catégorie MARKETING)
 *
 * Chaque soumission entre en status PENDING — la validation Meta prend
 * 24-48h. Les templates approuvés/rejetés sont visibles dans
 * Business Manager → WhatsApp Manager → Templates de message.
 *
 * Pour les templates rsvp_reminder_* + team_invitation, ajouter ici quand
 * leurs body texts seront finalisés (cf. BACKLOG section "Templates
 * WhatsApp Cloud API").
 */

import { INVITATION_STYLES } from '../lib/whatsapp/templates';

const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const WABA_ID = process.env.WHATSAPP_WABA_ID;
const GRAPH_VERSION = process.env.WHATSAPP_GRAPH_VERSION ?? 'v23.0';
const APP_BASE_URL = (process.env.APP_BASE_URL ?? 'https://wedillybird.com').replace(/\/$/, '');
const DRY_RUN = process.env.DRY_RUN === '1';

if (!DRY_RUN) {
  if (!ACCESS_TOKEN) {
    console.error('❌ WHATSAPP_ACCESS_TOKEN is required (or set DRY_RUN=1)');
    process.exit(1);
  }
  if (!WABA_ID) {
    console.error('❌ WHATSAPP_WABA_ID is required (or set DRY_RUN=1)');
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
 * Body avec 5 vars + 1 bouton URL dynamique vers `/i/{{1}}` (token).
 */
function buildInvitationTemplate(
  name: string,
  bodyText: string,
  ctaLabel: string,
): MetaTemplateBody {
  // Exemples de valeurs réalistes que Meta utilise pour valider le template.
  // Doivent matcher le nombre de placeholders dans le body.
  const sampleVars = [
    'Aminata',
    'Mamadou & Marie',
    '30 avril 2026',
    `${APP_BASE_URL}/i/abc123`,
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

  const templates: MetaTemplateBody[] = Object.values(INVITATION_STYLES).map((style) =>
    buildInvitationTemplate(style.metaTemplateName, style.bodyText, style.ctaLabel),
  );

  for (const template of templates) {
    await submitTemplate(template);
  }

  console.log('\n✨ Terminé. Surveille la validation dans Business Manager → WhatsApp Manager.');
  console.log('   (Validation typique : 24-48 h)');
}

main().catch((err) => {
  console.error('❌ Erreur fatale:', err);
  process.exit(1);
});
