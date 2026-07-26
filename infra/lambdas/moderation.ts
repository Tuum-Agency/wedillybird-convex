import type { S3Event, S3EventRecord, SNSEvent } from 'aws-lambda';
import {
  RekognitionClient,
  DetectModerationLabelsCommand,
  DetectTextCommand,
  DetectLabelsCommand,
  DescribeCollectionCommand,
  CreateCollectionCommand,
  IndexFacesCommand,
  type ModerationLabel,
  type TextDetection,
  type Label,
  type FaceRecord,
} from '@aws-sdk/client-rekognition';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { createHmac } from 'node:crypto';

/* -------------------------------------------------------------------------- */
/*  Modération multi-couches                                                   */
/* -------------------------------------------------------------------------- */
/* Couche 1 : `DetectModerationLabels` (Rekognition) — catégories explicit     */
/* nudity / violence / drugs / etc., seuils strict 75 % et lenient 90 %.       */
/* Couche 2 : `DetectText` (Rekognition) + blacklist mots-clés FR + EN —       */
/* bloque les illustrations anatomiques / médicales avec légendes explicites.  */
/* Couche 3 : `DetectLabels` (Rekognition) — si l'image est une illustration   */
/* / dessin / schéma, on ne l'approuve PAS auto. On envoie `manual_review`,   */
/* l'owner doit décider lui-même via le bouton "Approuver" de la galerie.      */
/* Couche 4 : OpenAI Moderation API (`omni-moderation-latest`) — gratuite,     */
/* multimodale, conçue pour la modération de contenu. Elle se déclenche après  */
/* les 3 couches Rekognition pour un dernier double-check sémantique. Active   */
/* uniquement si `OPENAI_API_KEY` est défini côté env Lambda — sinon skip      */
/* silencieux et on garde le verdict Rekognition tel quel.                     */
/* -------------------------------------------------------------------------- */

// Couvre TOUS les niveaux de hiérarchie Rekognition Moderation : top-level
// (catégories parent) ET sub-labels. Rekognition retourne les deux dans le
// même array — on doit blacklister les deux pour ne rien laisser passer.
// cf. https://docs.aws.amazon.com/rekognition/latest/dg/moderation.html
const REJECT_LABELS_STRICT = new Set([
  // Top-level parents
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
  // Sub-labels Explicit
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
  // Sub-labels Violence
  'Graphic Violence',
  'Weapon Violence',
  'Weapons',
  'Self-Harm',
  'Corpses',
  // Sub-labels Drugs
  'Drug Products',
  'Drug Use',
  'Pills',
  'Drug Paraphernalia',
  'Tobacco Products',
  'Smoking',
  // Sub-labels Hate / Self injury
  'Nazi Party',
  'White Supremacy',
  'Extremist',
  'Hanging',
]);
const REJECT_LABELS_LENIENT = new Set([
  // Plus tolérant car risque de faux positifs (robes de mariée décolletées,
  // mariages en plage, champagne en gros plan, etc.).
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
const REJECT_THRESHOLD_STRICT = 75;
const REJECT_THRESHOLD_LENIENT = 90;

// Blacklist OCR. Tous en minuscule, comparaison sans accent. Match au mot
// entier (boundary), pour éviter de flagger "essex" pour "sex" ou "anal" dans
// "national". Couvre FR + EN + quelques expressions courantes.
const OCR_BLACKLIST_KEYWORDS: ReadonlyArray<string> = [
  // FR — anatomie sexuelle explicite
  'penis',
  'vagin',
  'vulve',
  'clitoris',
  'testicule',
  'sperme',
  'anus',
  'erection',
  'masturbation',
  'fellation',
  'cunnilingus',
  // FR — argot
  'bite',
  'queue',
  'chatte',
  'chibre',
  'baise',
  'baiser',
  'sodomie',
  'pute',
  'putain',
  'salope',
  'enculer',
  'enculee',
  'enculé',
  // EN — anatomie sexuelle / argot
  'penis',
  'vagina',
  'vulva',
  'clitoris',
  'testicle',
  'semen',
  'cock',
  'dick',
  'pussy',
  'cunt',
  'tits',
  'boobs',
  'nipple',
  'anal',
  'fuck',
  'fucking',
  'whore',
  'slut',
  // Drogues / substances
  'cocaine',
  'cocaïne',
  'heroin',
  'heroine',
  'cannabis',
  'weed',
  // Termes médicaux génériques (peuvent indiquer un schéma médical)
  'urethral',
  'urethre',
  'urètre',
];
// Labels DetectLabels qui suggèrent une illustration et NON une photo. Si
// présents avec confiance >= 70 %, l'image n'est pas auto-approuvée.
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
const ILLUSTRATION_THRESHOLD = 70;

// Rekognition is not available in eu-west-3 (Paris); use eu-west-1 (Ireland).
// Bucket lives in eu-west-3, so we GetObject in-region then pass Bytes inline.
const rekognition = new RekognitionClient({
  region: process.env.REKOGNITION_REGION ?? 'eu-west-1',
});
const s3 = new S3Client({});

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    if (Buffer.isBuffer(chunk)) chunks.push(chunk);
    else if (typeof chunk === 'string') chunks.push(Buffer.from(chunk));
    else chunks.push(Buffer.from(chunk as Uint8Array));
  }
  return Buffer.concat(chunks);
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var ${name}`);
  return value;
}

/** Normalise un texte OCR en minuscule sans accents, pour le matching blacklist. */
function normalizeForMatching(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function findBlacklistMatch(ocrText: string): string | null {
  const haystack = normalizeForMatching(ocrText);
  for (const raw of OCR_BLACKLIST_KEYWORDS) {
    const needle = normalizeForMatching(raw);
    // Match au mot entier (boundary) pour éviter les faux positifs.
    const re = new RegExp(`\\b${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (re.test(haystack)) return raw;
  }
  return null;
}

interface ModerationDecision {
  decision: 'approved' | 'rejected' | 'manual_review';
  topLabel?: string;
  topConfidence?: number;
  ocrFlaggedKeyword?: string;
  contentLabels?: string[];
  reviewReason?: string;
}

function decideFromModerationLabels(
  labels: readonly ModerationLabel[],
): { rejected: false } | { rejected: true; topLabel: string; topConfidence: number } {
  for (const label of labels) {
    if (!label.Name || label.Confidence === undefined) continue;
    if (REJECT_LABELS_STRICT.has(label.Name) && label.Confidence >= REJECT_THRESHOLD_STRICT) {
      return { rejected: true, topLabel: label.Name, topConfidence: label.Confidence };
    }
    if (REJECT_LABELS_LENIENT.has(label.Name) && label.Confidence >= REJECT_THRESHOLD_LENIENT) {
      return { rejected: true, topLabel: label.Name, topConfidence: label.Confidence };
    }
  }
  return { rejected: false };
}

function topModerationLabel(labels: readonly ModerationLabel[]): {
  name?: string;
  confidence?: number;
} {
  let topLabel: string | undefined;
  let topConfidence = 0;
  for (const label of labels) {
    if (!label.Name || label.Confidence === undefined) continue;
    if (label.Confidence > topConfidence) {
      topConfidence = label.Confidence;
      topLabel = label.Name;
    }
  }
  return topLabel ? { name: topLabel, confidence: topConfidence } : {};
}

function joinOcrText(detections: readonly TextDetection[] | undefined): string {
  if (!detections) return '';
  return detections
    .filter((d) => d.Type === 'LINE' && d.DetectedText)
    .map((d) => d.DetectedText as string)
    .join(' ');
}

function detectIllustration(labels: readonly Label[] | undefined): string[] {
  if (!labels) return [];
  const matched: string[] = [];
  for (const label of labels) {
    if (!label.Name || label.Confidence === undefined) continue;
    if (ILLUSTRATION_LABELS.has(label.Name) && label.Confidence >= ILLUSTRATION_THRESHOLD) {
      matched.push(label.Name);
    }
  }
  return matched;
}

interface OpenAIVerdict {
  flagged: boolean;
  topCategory?: string;
  topScore?: number;
}

/**
 * Catégories OpenAI considérées comme bloquantes pour une galerie de mariage.
 * `harassment` et `harassment/threatening` exclus volontairement (texte/insulte
 * dans une légende n'est pas pertinent ici, et l'API peut sur-flag des phrases
 * humoristiques). `self-harm` couvre déjà les cas critiques.
 */
const OPENAI_REJECT_CATEGORIES = new Set([
  'sexual',
  'sexual/minors',
  'violence',
  'violence/graphic',
  'hate',
  'hate/threatening',
  'self-harm',
  'self-harm/intent',
  'self-harm/instructions',
  'illicit',
  'illicit/violent',
]);

/**
 * Appelle l'OpenAI Moderation API multimodale (`omni-moderation-latest`).
 * Endpoint gratuit conçu pour la modération de contenu — meilleur que les
 * VLM généralistes sur ce cas d'usage parce qu'il est entraîné spécifiquement
 * pour ça et ne refuse jamais d'analyser. Skip silencieux si la clé n'est pas
 * configurée (rollout progressif).
 *
 * cf. https://platform.openai.com/docs/guides/moderation
 */
async function checkOpenAIModeration(
  bytes: Buffer,
  contentType: string,
): Promise<OpenAIVerdict | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const dataUrl = `data:${contentType};base64,${bytes.toString('base64')}`;
  let response: Response;
  try {
    response = await fetch('https://api.openai.com/v1/moderations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'omni-moderation-latest',
        input: [{ type: 'image_url', image_url: { url: dataUrl } }],
      }),
    });
  } catch (err) {
    console.warn(`OpenAI moderation network error: ${err instanceof Error ? err.message : err}`);
    return null;
  }

  if (!response.ok) {
    console.warn(`OpenAI moderation HTTP ${response.status}: ${await response.text()}`);
    return null;
  }

  const json = (await response.json()) as {
    results?: Array<{
      flagged?: boolean;
      categories?: Record<string, boolean>;
      category_scores?: Record<string, number>;
    }>;
  };
  const result = json.results?.[0];
  if (!result) return null;
  if (!result.flagged) return { flagged: false };

  // Trouver la catégorie bloquante avec le score le plus haut.
  let topCategory: string | undefined;
  let topScore = 0;
  for (const [category, isFlagged] of Object.entries(result.categories ?? {})) {
    if (!isFlagged) continue;
    if (!OPENAI_REJECT_CATEGORIES.has(category)) continue;
    const score = result.category_scores?.[category] ?? 0;
    if (score > topScore) {
      topScore = score;
      topCategory = category;
    }
  }
  // Si l'image est flagged mais sur des catégories qu'on ignore (harassment
  // pur sans contenu visuel choquant), on ne bloque pas.
  if (!topCategory) return { flagged: false };
  return { flagged: true, topCategory, topScore };
}

function decide(
  moderationLabels: readonly ModerationLabel[],
  ocrText: string,
  detectedLabels: readonly Label[] | undefined,
  openaiVerdict: OpenAIVerdict | null,
): ModerationDecision {
  // Couche 1 : moderation labels stricts.
  const modVerdict = decideFromModerationLabels(moderationLabels);
  if (modVerdict.rejected) {
    return {
      decision: 'rejected',
      topLabel: modVerdict.topLabel,
      topConfidence: modVerdict.topConfidence,
      reviewReason: `Catégorie inappropriée détectée : ${modVerdict.topLabel}`,
    };
  }

  // Couche 2 : OCR + blacklist mots-clés.
  const blacklistHit = findBlacklistMatch(ocrText);
  if (blacklistHit) {
    return {
      decision: 'rejected',
      ocrFlaggedKeyword: blacklistHit,
      reviewReason: `Mot-clé inapproprié détecté dans l'image : « ${blacklistHit} »`,
    };
  }

  // Couche 4 : OpenAI Moderation API (priorité haute, sémantique fiable même
  // sur les illustrations). On la check AVANT la détection illustration parce
  // qu'OpenAI tranche mieux qu'un fallback "manual_review" — si elle dit OK,
  // on peut approuver même sur une illustration.
  if (openaiVerdict?.flagged) {
    const scorePct = openaiVerdict.topScore ? Math.round(openaiVerdict.topScore * 100) : 0;
    return {
      decision: 'rejected',
      reviewReason: `OpenAI Moderation : catégorie « ${openaiVerdict.topCategory} » détectée (${scorePct} %).`,
      contentLabels: openaiVerdict.topCategory ? [openaiVerdict.topCategory] : undefined,
    };
  }

  // Couche 3 : illustration → pas d'auto-approbation. (Si OpenAI a tourné et
  // n'a rien flag, on saute cette étape — OpenAI tranche mieux qu'un manual
  // review forcé.)
  if (openaiVerdict === null) {
    const illustrations = detectIllustration(detectedLabels);
    if (illustrations.length > 0) {
      return {
        decision: 'manual_review',
        contentLabels: illustrations,
        reviewReason: `Image détectée comme illustration (${illustrations.join(', ')}) — modération automatique non fiable, validation manuelle requise.`,
      };
    }
  }

  // Tout passe → approved.
  const top = topModerationLabel(moderationLabels);
  return { decision: 'approved', topLabel: top.name, topConfidence: top.confidence };
}

function signPayload(secret: string, timestamp: string, body: string): string {
  return createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
}

async function callbackConvex(payload: {
  s3Key: string;
  decision: 'approved' | 'rejected' | 'manual_review';
  topLabel?: string;
  topConfidence?: number;
  labels: Array<{ name: string; confidence: number }>;
  ocrText?: string;
  ocrFlaggedKeyword?: string;
  contentLabels?: string[];
  reviewReason?: string;
}): Promise<void> {
  const url = `${requireEnv('CONVEX_SITE_URL')}/lambda/photo-moderation-callback`;
  const secret = requireEnv('LAMBDA_CALLBACK_SECRET');
  const body = JSON.stringify(payload);
  const timestamp = String(Date.now());
  const signature = signPayload(secret, timestamp, body);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-wedillybird-signature': signature,
      'x-wedillybird-timestamp': timestamp,
    },
    body,
  });
  if (!response.ok) {
    throw new Error(`Convex callback failed: ${response.status} ${await response.text()}`);
  }
}

/* -------------------------------------------------------------------------- */
/*  Face indexing (Rekognition Faces)                                          */
/* -------------------------------------------------------------------------- */
/* Pour chaque photo `approved`, on extrait jusqu'à 5 visages via IndexFaces  */
/* et on POST le résultat à Convex via un callback distinct (HMAC). Ces       */
/* visages permettent ensuite à un invité de retrouver ses photos en envoyant */
/* un selfie (`SearchFacesByImage`).                                          */
/*                                                                            */
/* L'opération est best-effort : si elle échoue (collection absente,          */
/* network, IAM, etc.), on log et on ne bloque PAS le pipeline modération —   */
/* la photo reste `approved`, juste pas indexée.                              */
/* -------------------------------------------------------------------------- */

const COLLECTION_ID_PREFIX = 'wb-event-';

/** Extrait l'eventId depuis la convention de nommage S3 `incoming/{eventId}/{uuid}.{ext}`. */
function extractEventIdFromS3Key(s3Key: string): string | null {
  const parts = s3Key.split('/');
  if (parts.length < 3 || parts[0] !== 'incoming') return null;
  const eventId = parts[1];
  return eventId && eventId.length > 0 ? eventId : null;
}

/** Calcule un nom de Face Collection conforme aux contraintes Rekognition (alphanumérique, _, -, point, max 255). */
function collectionIdForEvent(eventId: string): string {
  return `${COLLECTION_ID_PREFIX}${eventId}`;
}

/**
 * Vérifie si la collection Rekognition existe pour cet event ; sinon la crée.
 * Idempotent : si une concurrent invocation crée la collection en même temps,
 * Rekognition renvoie ResourceAlreadyExistsException qu'on ignore.
 */
async function ensureFaceCollection(collectionId: string): Promise<void> {
  try {
    await rekognition.send(new DescribeCollectionCommand({ CollectionId: collectionId }));
    return;
  } catch (err) {
    const name = (err as { name?: string }).name;
    if (name !== 'ResourceNotFoundException') {
      // Autre erreur (IAM, réseau) — on relance, le caller catch et log.
      throw err;
    }
  }
  try {
    await rekognition.send(new CreateCollectionCommand({ CollectionId: collectionId }));
  } catch (err) {
    const name = (err as { name?: string }).name;
    if (name === 'ResourceAlreadyExistsException') return;
    throw err;
  }
}

interface IndexedFace {
  faceId: string;
  boundingBox?: { width: number; height: number; left: number; top: number };
  confidence?: number;
}

function mapFaceRecord(record: FaceRecord): IndexedFace | null {
  const faceId = record.Face?.FaceId;
  if (!faceId) return null;
  const bb = record.Face?.BoundingBox;
  const boundingBox =
    bb &&
    bb.Width !== undefined &&
    bb.Height !== undefined &&
    bb.Left !== undefined &&
    bb.Top !== undefined
      ? { width: bb.Width, height: bb.Height, left: bb.Left, top: bb.Top }
      : undefined;
  return {
    faceId,
    boundingBox,
    confidence: record.Face?.Confidence,
  };
}

async function indexFacesForPhoto(
  collectionId: string,
  bytes: Buffer,
  s3Key: string,
): Promise<IndexedFace[]> {
  const result = await rekognition.send(
    new IndexFacesCommand({
      CollectionId: collectionId,
      Image: { Bytes: bytes },
      ExternalImageId: s3Key.replace(/[^a-zA-Z0-9_.\-:]/g, '_').slice(0, 255),
      MaxFaces: 5,
      QualityFilter: 'AUTO',
      DetectionAttributes: ['DEFAULT'],
    }),
  );
  const records = result.FaceRecords ?? [];
  const indexed: IndexedFace[] = [];
  for (const r of records) {
    const f = mapFaceRecord(r);
    if (f) indexed.push(f);
  }
  return indexed;
}

async function callbackFacesConvex(payload: {
  s3Key: string;
  collectionId: string;
  faces: IndexedFace[];
}): Promise<void> {
  const url = `${requireEnv('CONVEX_SITE_URL')}/lambda/photo-faces-callback`;
  const secret = requireEnv('LAMBDA_CALLBACK_SECRET');
  const body = JSON.stringify(payload);
  const timestamp = String(Date.now());
  const signature = signPayload(secret, timestamp, body);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-wedillybird-signature': signature,
      'x-wedillybird-timestamp': timestamp,
    },
    body,
  });
  if (!response.ok) {
    throw new Error(`Convex faces callback failed: ${response.status} ${await response.text()}`);
  }
}

/**
 * Vrai gate d'INDEXATION biométrique (Lane T3, F7) : interroge Convex pour
 * savoir si le couple a explicitement opt-in la reco-faciale sur cet event
 * (`events.faceSearchEnabled`), AVANT tout `IndexFacesCommand`. Signé HMAC
 * comme les autres callbacks de ce fichier.
 *
 * **Fail-closed** : toute erreur (réseau, HTTP non-2xx, JSON invalide) est
 * traitée comme `false` — en cas de doute, on n'indexe JAMAIS. C'est le
 * comportement inverse de tous les autres callbacks best-effort de ce
 * fichier (qui avalent l'erreur pour ne pas bloquer un pipeline déjà commité)
 * parce qu'ici la conséquence d'un faux `true` serait d'indexer des visages
 * sans consentement — le risque juridique (BIPA) prime sur la continuité du
 * pipeline.
 */
async function isFaceSearchEnabled(eventId: string): Promise<boolean> {
  try {
    const url = `${requireEnv('CONVEX_SITE_URL')}/lambda/face-search-enabled`;
    const secret = requireEnv('LAMBDA_CALLBACK_SECRET');
    const body = JSON.stringify({ eventId });
    const timestamp = String(Date.now());
    const signature = signPayload(secret, timestamp, body);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-wedillybird-signature': signature,
        'x-wedillybird-timestamp': timestamp,
      },
      body,
    });
    if (!response.ok) {
      console.warn(`[faces] face-search-enabled check HTTP ${response.status} for ${eventId}`);
      return false;
    }
    const json = (await response.json()) as { enabled?: boolean };
    return json.enabled === true;
  } catch (err) {
    console.warn(
      `[faces] face-search-enabled check errored for ${eventId}: ${err instanceof Error ? err.message : err}`,
    );
    return false;
  }
}

/**
 * Indexe une photo approuvée dans la Face Collection de l'event puis POST le
 * résultat à Convex. Best-effort (hors gate opt-in) : toute exception est
 * logguée et avalée pour ne pas bloquer le pipeline (la modération est déjà
 * commitée à ce stade).
 */
async function indexAndCallbackFaces(s3Key: string, bytes: Buffer): Promise<void> {
  try {
    const eventId = extractEventIdFromS3Key(s3Key);
    if (!eventId) {
      console.warn(`[faces] cannot extract eventId from s3Key=${s3Key}, skipping`);
      return;
    }

    // Gate opt-in (Lane T3, F7) — AVANT tout appel Rekognition IndexFaces.
    // Défaut OFF côté Convex : un event qui n'a jamais activé la feature (ou
    // dont le check échoue) n'est JAMAIS indexé.
    const enabled = await isFaceSearchEnabled(eventId);
    if (!enabled) {
      console.log(`[faces] face search disabled for event=${eventId}, skipping IndexFaces`);
      return;
    }

    const collectionId = collectionIdForEvent(eventId);
    await ensureFaceCollection(collectionId);
    const faces = await indexFacesForPhoto(collectionId, bytes, s3Key);
    await callbackFacesConvex({ s3Key, collectionId, faces });
    console.log(`[faces] indexed ${faces.length} face(s) for ${s3Key} → ${collectionId}`);
  } catch (err) {
    console.warn(
      `[faces] indexing failed for ${s3Key}: ${err instanceof Error ? err.message : err}`,
    );
  }
}

/**
 * Fan-out S3 → SNS → Lambda : l'event reçu est un SNSEvent qui enveloppe
 * l'event S3 (un topic SNS permet modération ET variants sur le même préfixe
 * `incoming/`, ce que la notification S3 directe interdit). On déballe chaque
 * message SNS (JSON de l'event S3) en records S3. Compat si un event S3 direct
 * arrive (ancien câblage).
 */
function extractS3Records(event: SNSEvent | S3Event): S3EventRecord[] {
  const records = (event as { Records?: unknown[] }).Records ?? [];
  if (records.length > 0 && (records[0] as { Sns?: unknown }).Sns) {
    return (event as SNSEvent).Records.flatMap((r) => {
      try {
        return (JSON.parse(r.Sns.Message) as S3Event).Records ?? [];
      } catch {
        return [];
      }
    });
  }
  return (event as S3Event).Records ?? [];
}

export const handler = async (event: SNSEvent | S3Event): Promise<void> => {
  for (const record of extractS3Records(event)) {
    const bucket = record.s3.bucket.name;
    const s3Key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));

    if (!s3Key.startsWith('incoming/')) {
      console.log(`skip non-incoming key: ${s3Key}`);
      continue;
    }

    console.log(`moderating s3://${bucket}/${s3Key}`);
    const object = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: s3Key }));
    if (!object.Body) {
      throw new Error(`s3 object body missing for ${s3Key}`);
    }
    const bytes = await streamToBuffer(object.Body as NodeJS.ReadableStream);

    // Déduit le content-type depuis l'extension (cf. convex/photosActions.ts
    // qui ne stocke que jpg/png/webp dans `incoming/`).
    const contentType = s3Key.endsWith('.png')
      ? 'image/png'
      : s3Key.endsWith('.webp')
        ? 'image/webp'
        : 'image/jpeg';

    // Trois appels Rekognition + un appel OpenAI Moderation en parallèle.
    // Coût total : ~0,003 $/image (Rekognition) + 0 $ (OpenAI Moderation API).
    const [moderationResult, textResult, labelsResult, openaiVerdict] = await Promise.all([
      rekognition.send(
        new DetectModerationLabelsCommand({ Image: { Bytes: bytes }, MinConfidence: 50 }),
      ),
      rekognition.send(new DetectTextCommand({ Image: { Bytes: bytes } })),
      rekognition.send(
        new DetectLabelsCommand({ Image: { Bytes: bytes }, MaxLabels: 30, MinConfidence: 50 }),
      ),
      checkOpenAIModeration(bytes, contentType),
    ]);

    const moderationLabels = moderationResult.ModerationLabels ?? [];
    const ocrText = joinOcrText(textResult.TextDetections);
    const labels = labelsResult.Labels ?? [];

    const verdict = decide(moderationLabels, ocrText, labels, openaiVerdict);

    await callbackConvex({
      s3Key,
      decision: verdict.decision,
      topLabel: verdict.topLabel,
      topConfidence: verdict.topConfidence,
      labels: moderationLabels
        .filter((l): l is ModerationLabel & { Name: string; Confidence: number } =>
          Boolean(l.Name && l.Confidence !== undefined),
        )
        .map((l) => ({ name: l.Name, confidence: l.Confidence })),
      ocrText: ocrText || undefined,
      ocrFlaggedKeyword: verdict.ocrFlaggedKeyword,
      contentLabels: verdict.contentLabels,
      reviewReason: verdict.reviewReason,
    });
    console.log(
      `decision=${verdict.decision} top=${verdict.topLabel ?? 'none'}@${verdict.topConfidence ?? 0} ocr="${ocrText.slice(0, 80)}" reason="${verdict.reviewReason ?? ''}"`,
    );

    // Face indexing — uniquement après que la modération a tranché `approved`.
    // Best-effort : un échec ici (collection, IAM, network) est loggué mais ne
    // bloque pas le pipeline modération qui a déjà commit son verdict.
    if (verdict.decision === 'approved') {
      await indexAndCallbackFaces(s3Key, bytes);
    }
  }
};
