/**
 * Questions RSVP personnalisables — modèle partagé (couple / agence ⇄ invité).
 *
 * Source de vérité **pure** (aucun import Convex / React) des règles qui
 * gouvernent :
 *  - la config stockée sur `events.rsvpConfig` (toggles + labels des champs
 *    built-in, et questions custom typées) ;
 *  - les réponses stockées sur `guests.customAnswers`.
 *
 * Utilisée côté éditeur (couple/agence), côté formulaire invité, côté server
 * action et — via un miroir convex-local — côté mutation Convex (le bundler
 * Convex ne suit pas les imports app-side, cf. `convex/lib/entitlements.ts`).
 * Garder les deux en phase.
 */

export type QuestionType =
  | 'short_text'
  | 'long_text'
  | 'single_choice'
  | 'multi_choice'
  | 'boolean';

export const QUESTION_TYPES: readonly QuestionType[] = [
  'short_text',
  'long_text',
  'single_choice',
  'multi_choice',
  'boolean',
];

/** Types qui exigent une liste d'options (choix). */
export const CHOICE_TYPES: ReadonlySet<QuestionType> = new Set<QuestionType>([
  'single_choice',
  'multi_choice',
]);

export interface RsvpQuestion {
  /** Identifiant stable (généré côté éditeur via `crypto.randomUUID()`). */
  id: string;
  type: QuestionType;
  label: string;
  /** Options pour `single_choice` / `multi_choice`. */
  options?: string[];
  required?: boolean;
  /** Ne demander la question que si l'invité est « présent ». */
  onlyIfAttending?: boolean;
}

export interface RsvpConfig {
  askDietary?: boolean;
  dietaryLabel?: string;
  askNotes?: boolean;
  notesLabel?: string;
  askPlusOnes?: boolean;
  customQuestions?: RsvpQuestion[];
}

/** Config avec valeurs par défaut résolues (built-in affichés par défaut). */
export interface NormalizedRsvpConfig {
  askDietary: boolean;
  dietaryLabel?: string;
  askNotes: boolean;
  notesLabel?: string;
  askPlusOnes: boolean;
  customQuestions: RsvpQuestion[];
}

export interface CustomAnswer {
  questionId: string;
  values: string[];
}

/* -------------------------------------------------------------------------- */
/*  Limites (anti-abus + cohérence UI)                                         */
/* -------------------------------------------------------------------------- */

export const MAX_CUSTOM_QUESTIONS = 10;
export const MAX_QUESTION_LABEL = 120;
export const MAX_OPTION_LABEL = 80;
export const MAX_OPTIONS = 12;
export const MAX_SHORT_ANSWER = 200;
export const MAX_LONG_ANSWER = 500;

const BOOLEAN_VALUES: ReadonlySet<string> = new Set(['yes', 'no']);

/* -------------------------------------------------------------------------- */
/*  Normalisation lecture (config → UI / rendu)                                */
/* -------------------------------------------------------------------------- */

function isValidQuestionShape(q: unknown): q is RsvpQuestion {
  if (!q || typeof q !== 'object') return false;
  const candidate = q as Partial<RsvpQuestion>;
  if (typeof candidate.id !== 'string' || candidate.id.length === 0) return false;
  if (typeof candidate.label !== 'string' || candidate.label.trim().length === 0) return false;
  if (
    typeof candidate.type !== 'string' ||
    !QUESTION_TYPES.includes(candidate.type as QuestionType)
  )
    return false;
  if (CHOICE_TYPES.has(candidate.type as QuestionType)) {
    if (!Array.isArray(candidate.options) || candidate.options.length === 0) return false;
  }
  return true;
}

/**
 * Résout les valeurs par défaut de la config (champs built-in affichés tant
 * qu'ils ne sont pas explicitement désactivés) et écarte les questions custom
 * mal formées. Sûr pour un rendu direct.
 */
export function normalizeRsvpConfig(config?: RsvpConfig | null): NormalizedRsvpConfig {
  return {
    askDietary: config?.askDietary ?? true,
    dietaryLabel: nonEmpty(config?.dietaryLabel),
    askNotes: config?.askNotes ?? true,
    notesLabel: nonEmpty(config?.notesLabel),
    askPlusOnes: config?.askPlusOnes ?? true,
    customQuestions: (config?.customQuestions ?? []).filter(isValidQuestionShape),
  };
}

function nonEmpty(s?: string): string | undefined {
  const t = s?.trim();
  return t && t.length > 0 ? t : undefined;
}

/* -------------------------------------------------------------------------- */
/*  Sanitisation écriture (éditeur → stockage)                                 */
/* -------------------------------------------------------------------------- */

/**
 * Nettoie une config soumise par l'éditeur avant persistance :
 *  - clampe les labels, dédoublonne / clampe les options des choix,
 *  - écarte les questions sans id / label / (options pour un choix),
 *  - plafonne le nombre de questions.
 * Ne fabrique jamais d'id : une question sans id valide est écartée (l'éditeur
 * en génère un via `crypto.randomUUID()`).
 */
export function sanitizeRsvpConfig(config?: RsvpConfig | null): RsvpConfig {
  const questions: RsvpQuestion[] = [];
  for (const raw of config?.customQuestions ?? []) {
    if (questions.length >= MAX_CUSTOM_QUESTIONS) break;
    const cleaned = sanitizeQuestion(raw);
    if (cleaned) questions.push(cleaned);
  }
  return {
    askDietary: config?.askDietary ?? true,
    dietaryLabel: nonEmpty(config?.dietaryLabel)?.slice(0, MAX_QUESTION_LABEL),
    askNotes: config?.askNotes ?? true,
    notesLabel: nonEmpty(config?.notesLabel)?.slice(0, MAX_QUESTION_LABEL),
    askPlusOnes: config?.askPlusOnes ?? true,
    customQuestions: questions,
  };
}

function sanitizeQuestion(raw: unknown): RsvpQuestion | null {
  if (!raw || typeof raw !== 'object') return null;
  const q = raw as Partial<RsvpQuestion>;
  if (typeof q.id !== 'string' || q.id.trim().length === 0) return null;
  if (typeof q.type !== 'string' || !QUESTION_TYPES.includes(q.type as QuestionType)) return null;
  const label = typeof q.label === 'string' ? q.label.trim().slice(0, MAX_QUESTION_LABEL) : '';
  if (label.length === 0) return null;

  const type = q.type as QuestionType;
  const out: RsvpQuestion = { id: q.id.trim(), type, label };

  if (CHOICE_TYPES.has(type)) {
    const options = dedupeOptions(q.options);
    if (options.length === 0) return null;
    out.options = options;
  }
  if (q.required === true) out.required = true;
  if (q.onlyIfAttending === true) out.onlyIfAttending = true;
  return out;
}

function dedupeOptions(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of raw) {
    if (typeof v !== 'string') continue;
    const t = v.trim().slice(0, MAX_OPTION_LABEL);
    if (t.length === 0 || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= MAX_OPTIONS) break;
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/*  Sanitisation réponses (invité → stockage)                                  */
/* -------------------------------------------------------------------------- */

export interface SanitizeAnswersResult {
  answers: CustomAnswer[];
  /** questionId → clé d'erreur i18n (`Invitation.errors.*`). */
  errors: Record<string, string>;
}

/**
 * Valide + nettoie les réponses custom d'un invité contre la config de l'event.
 * Autorité serveur : écarte les questions inconnues, force l'appartenance aux
 * options, clampe le texte, saute les questions `onlyIfAttending` quand
 * l'invité n'est pas présent, et signale les questions `required` non répondues.
 */
export function sanitizeCustomAnswers(
  config: RsvpConfig | null | undefined,
  rawAnswers: ReadonlyArray<{ questionId: string; values: string[] }>,
  attending: boolean,
): SanitizeAnswersResult {
  const normalized = normalizeRsvpConfig(config);
  const byId = new Map(rawAnswers.map((a) => [a.questionId, a.values ?? []]));
  const answers: CustomAnswer[] = [];
  const errors: Record<string, string> = {};

  for (const q of normalized.customQuestions) {
    // Question conditionnelle non applicable → ignorée (ni valeur, ni erreur).
    if (q.onlyIfAttending && !attending) continue;

    const values = cleanAnswerValues(q, byId.get(q.id) ?? []);
    if (values.length > 0) {
      answers.push({ questionId: q.id, values });
    } else if (q.required) {
      errors[q.id] = 'answerRequired';
    }
  }

  return { answers, errors };
}

function cleanAnswerValues(q: RsvpQuestion, raw: string[]): string[] {
  const values = Array.isArray(raw) ? raw : [];
  switch (q.type) {
    case 'short_text': {
      const t = (values[0] ?? '').trim().slice(0, MAX_SHORT_ANSWER);
      return t ? [t] : [];
    }
    case 'long_text': {
      const t = (values[0] ?? '').trim().slice(0, MAX_LONG_ANSWER);
      return t ? [t] : [];
    }
    case 'boolean': {
      const t = (values[0] ?? '').trim().toLowerCase();
      return BOOLEAN_VALUES.has(t) ? [t] : [];
    }
    case 'single_choice': {
      const opts = q.options ?? [];
      const picked = values.find((v) => opts.includes(v.trim()));
      return picked ? [picked.trim()] : [];
    }
    case 'multi_choice': {
      const opts = q.options ?? [];
      const seen = new Set<string>();
      const out: string[] = [];
      for (const v of values) {
        const t = v.trim();
        if (opts.includes(t) && !seen.has(t)) {
          seen.add(t);
          out.push(t);
        }
      }
      return out;
    }
    default:
      return [];
  }
}
