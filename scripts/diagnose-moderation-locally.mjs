#!/usr/bin/env node
/**
 * Diagnostic local du pipeline de modération photo.
 *
 * Usage :
 *   node scripts/diagnose-moderation-locally.mjs <chemin/vers/image.jpg>
 *
 * Le script appelle Rekognition (DetectModerationLabels + DetectText +
 * DetectLabels) sur l'image et applique la MÊME logique de décision que
 * `infra/lambdas/moderation.ts`. Aucun appel S3, aucun callback Convex —
 * le but est uniquement de répondre à la question : "qu'est-ce que la
 * couche Rekognition + verdict aurait dit sur CETTE image ?"
 *
 * Prérequis : credentials AWS dans l'env (AWS_PROFILE ou variables
 * AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY) avec la perm
 * `rekognition:DetectModerationLabels`, `DetectText`, `DetectLabels`
 * sur la region eu-west-1.
 *
 * Si tu obtiens AccessDenied : ton profil AWS local n'a pas les perms
 * Rekognition. Le Lambda prod, lui, les a via son rôle IAM dédié — donc
 * un AccessDenied ici ne dit rien sur l'état du Lambda prod, c'est
 * juste que ton user local ne peut pas appeler Rekognition.
 */

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: node scripts/diagnose-moderation-locally.mjs <image-path>');
  process.exit(1);
}

const REKOGNITION_REGION = process.env.REKOGNITION_REGION ?? 'eu-west-1';

const REJECT_LABELS_STRICT = new Set([
  'Explicit',
  'Violence',
  'Visually Disturbing',
  'Hate Symbols',
  'Drugs & Tobacco',
  'Drugs',
  'Tobacco',
  'Rude Gestures',
  'Gambling',
  'Self Injury',
  'Explicit Nudity',
  'Nudity',
  'Sexual Activity',
  'Graphic Male Nudity',
  'Graphic Female Nudity',
  'Sexual Situations',
  'Adult Toys',
  'Sex Toys',
  'Naked Genitals',
  'Erections',
  'Lustful',
  'Graphic Violence',
  'Weapon Violence',
  'Weapons',
  'Self-Harm',
  'Corpses',
  'Drug Products',
  'Drug Use',
  'Pills',
  'Drug Paraphernalia',
  'Tobacco Products',
  'Smoking',
  'Nazi Party',
  'White Supremacy',
  'Extremist',
  'Hanging',
]);
const REJECT_LABELS_LENIENT = new Set([
  'Non-Explicit Nudity of Intimate parts and Kissing',
  'Suggestive',
  'Partial Nudity',
  'Implied Nudity',
  'Bare Back',
  'Female Swimwear Or Underwear',
  'Male Swimwear Or Underwear',
  'Swimwear or Underwear',
  'Revealing Clothes',
  'Obstructed Intimate Parts',
  'Obstructed Female Nipple',
  'Kissing on the Lips',
]);
const ILLUSTRATION_LABELS = new Set([
  'Drawing',
  'Illustration',
  'Cartoon',
  'Diagram',
  'Sketch',
  'Doodle',
  'Anime',
  'Comics',
]);
const REJECT_THRESHOLD_STRICT = 75;
const REJECT_THRESHOLD_LENIENT = 90;
const ILLUSTRATION_THRESHOLD = 70;

const absPath = resolve(filePath);
const bytes = await readFile(absPath);
console.log(`→ file: ${absPath}`);
console.log(`→ size: ${(bytes.length / 1024).toFixed(1)} KB`);
console.log(`→ region: ${REKOGNITION_REGION}`);
console.log('');

let RekognitionClient, DetectModerationLabelsCommand, DetectTextCommand, DetectLabelsCommand;
try {
  ({
    RekognitionClient,
    DetectModerationLabelsCommand,
    DetectTextCommand,
    DetectLabelsCommand,
  } = await import('@aws-sdk/client-rekognition'));
} catch {
  console.error('Missing @aws-sdk/client-rekognition. Run: pnpm add -w @aws-sdk/client-rekognition');
  process.exit(1);
}

const client = new RekognitionClient({ region: REKOGNITION_REGION });

console.log('▸ DetectModerationLabels…');
const modResp = await client
  .send(new DetectModerationLabelsCommand({ Image: { Bytes: bytes }, MinConfidence: 50 }))
  .catch((err) => {
    console.error('  ✗ FAILED:', err.name, err.message);
    process.exit(1);
  });
const moderationLabels = modResp.ModerationLabels ?? [];
console.log(`  ${moderationLabels.length} label(s)`);
for (const l of moderationLabels) {
  console.log(`    - ${l.Name} (${l.Confidence?.toFixed(1)}%)`);
}

console.log('▸ DetectText…');
const txtResp = await client
  .send(new DetectTextCommand({ Image: { Bytes: bytes } }))
  .catch((err) => {
    console.error('  ✗ FAILED:', err.name, err.message);
    process.exit(1);
  });
const ocrText = (txtResp.TextDetections ?? [])
  .filter((d) => d.Type === 'LINE' && d.DetectedText)
  .map((d) => d.DetectedText)
  .join(' ');
console.log(`  OCR: "${ocrText.slice(0, 200)}"`);

console.log('▸ DetectLabels…');
const lblResp = await client
  .send(new DetectLabelsCommand({ Image: { Bytes: bytes }, MaxLabels: 30, MinConfidence: 50 }))
  .catch((err) => {
    console.error('  ✗ FAILED:', err.name, err.message);
    process.exit(1);
  });
const labels = lblResp.Labels ?? [];
const top = [...labels]
  .sort((a, b) => (b.Confidence ?? 0) - (a.Confidence ?? 0))
  .slice(0, 8);
console.log(`  ${labels.length} label(s), top 8 :`);
for (const l of top) {
  console.log(`    - ${l.Name} (${l.Confidence?.toFixed(1)}%)`);
}

const illustrations = labels
  .filter((l) => l.Name && ILLUSTRATION_LABELS.has(l.Name) && (l.Confidence ?? 0) >= ILLUSTRATION_THRESHOLD)
  .map((l) => l.Name);

let rejectedTop = null;
for (const label of moderationLabels) {
  if (!label.Name || label.Confidence === undefined) continue;
  if (REJECT_LABELS_STRICT.has(label.Name) && label.Confidence >= REJECT_THRESHOLD_STRICT) {
    rejectedTop = { name: label.Name, confidence: label.Confidence, severity: 'strict' };
    break;
  }
  if (REJECT_LABELS_LENIENT.has(label.Name) && label.Confidence >= REJECT_THRESHOLD_LENIENT) {
    rejectedTop = { name: label.Name, confidence: label.Confidence, severity: 'lenient' };
    break;
  }
}

console.log('');
console.log('━━ VERDICT ━━');
if (rejectedTop) {
  console.log(`✗ rejected (${rejectedTop.severity}) — ${rejectedTop.name} @ ${rejectedTop.confidence.toFixed(1)}%`);
} else if (illustrations.length > 0) {
  console.log(
    `⚠ manual_review — illustration détectée : ${illustrations.join(', ')} (OpenAI Moderation API non checkée localement)`,
  );
} else {
  console.log('✓ approved (côté Rekognition + heuristiques — OpenAI Moderation API non checkée localement)');
}

console.log('');
console.log('Note : ce diagnostic ne couvre PAS :');
console.log(' - Le callback HMAC vers Convex (testable en lançant `pnpm convex:dev` + ce script)');
console.log(' - Le trigger S3 → Lambda (à vérifier dans AWS Console)');
console.log(' - Les env vars Lambda CONVEX_SITE_URL / LAMBDA_CALLBACK_SECRET');
console.log(' - Le routage Convex `/lambda/photo-moderation-callback` (déjà OK si `convex:deploy` a été lancé)');
