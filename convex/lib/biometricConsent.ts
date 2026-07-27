/**
 * Geofence + consentement biométrique (reco-faciale) — Lane T3 (F7).
 *
 * Décision de périmètre (2026-07-25, plan de lancement) : la reco-faciale
 * reste au catalogue (différenciateur réel vs Pressed Love) mais passe
 * OFF par défaut, opt-in explicite **par event**, avec :
 *  - exclusion DURE et permanente pour l'Illinois (BIPA — private right of
 *    action + dommages statutaires par personne, seul État qui peut tuer une
 *    EI FR sans trésorerie) ;
 *  - exclusion de prudence pour le Texas et Washington (lois biométriques
 *    state-level, tant qu'un avocat n'a pas tranché) ;
 *  - persistance du consentement (horodatage + version de notice + user).
 *
 * Ceci n'est PAS un avis juridique — à faire valider par un avocat US
 * spécialisé privacy/biométrie avant tout lancement à volume significatif ou
 * en Illinois.
 *
 * Volontairement **convex-local** (pas d'import `lib/geo`) : le bundler
 * Convex ne suit pas les imports app-side (même convention que
 * `convex/lib/entitlements.ts`). `lib/geo/regions.ts` (app-side) duplique la
 * liste `BIOMETRIC_BANNED_STATE_CODES` — garder les deux en phase.
 */

/** Codes `weddingState` (US bruts 2-lettres) où l'opt-in reco-faciale est refusé. */
export const BIOMETRIC_BANNED_STATES: ReadonlySet<string> = new Set(['IL', 'TX', 'WA']);

/**
 * Version de la notice de consentement présentée au couple lors de l'opt-in
 * (UI `FaceSearchPrivacy.consentNoticeBody` + `Legal.privacy.biometricsBody`).
 * Incrémenter (date ISO `YYYY-MM-DD`) à chaque changement matériel du texte —
 * persisté sur `events.faceSearchConsent.noticeVersion` pour traçabilité
 * juridique (« quelle version de la notice ce couple a-t-il acceptée ? »).
 */
export const FACE_SEARCH_NOTICE_VERSION = '2026-07-25';

export type FaceSearchOptInDecision =
  | { ok: true }
  | { ok: false; error: 'STATE_BANNED' | 'STATE_REQUIRED' };

/**
 * Décision pure (testable sans environnement Convex) : l'event peut-il activer
 * la recherche de photos par visage compte tenu de son `weddingState` déclaré ?
 *
 * **Fail-closed sur juridiction non déclarée.** Pour opter, le couple DOIT
 * avoir déclaré sa juridiction : un État US, une province CA, ou explicitement
 * « hors US/Canada » (sentinelle `NONE`, persistée). Un `weddingState`
 * vide/absent (le défaut) est REFUSÉ (`STATE_REQUIRED`) — sinon un mariage
 * réellement en Illinois échapperait au geofence en laissant simplement le
 * champ vide. La normalisation (trim) est faite ici.
 */
export function decideFaceSearchOptIn(weddingState: string | undefined): FaceSearchOptInDecision {
  const declared = weddingState?.trim();
  if (!declared) {
    return { ok: false, error: 'STATE_REQUIRED' as const };
  }
  if (BIOMETRIC_BANNED_STATES.has(declared)) {
    return { ok: false, error: 'STATE_BANNED' as const };
  }
  return { ok: true as const };
}
