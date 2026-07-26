/**
 * Autorité de délégation du questionnaire RSVP (agence ⇄ couple) — logique pure,
 * testable sans harnais Convex (le repo n'utilise pas convex-test).
 *
 * Règles :
 *  - Le **couple rattaché** (collaborateur rôle `couple`) ne peut modifier que
 *    si l'agence l'a autorisé (`previousCoupleCanEdit === true`).
 *  - Seul le **propriétaire** (l'agence, ou le couple solo qui possède l'event)
 *    peut changer le flag de délégation ; tout autre acteur conserve la valeur
 *    existante.
 *  - Le personnel d'agence non-propriétaire (co_owner / planner) peut éditer
 *    mais ne bascule pas le flag.
 */
export interface RsvpConfigWriteDecision {
  /** L'écriture est-elle autorisée ? */
  allowed: boolean;
  /** Valeur de `coupleCanEdit` à persister (ignorée si `allowed` est faux). */
  coupleCanEdit: boolean;
}

export function decideRsvpConfigWrite(input: {
  /** Le demandeur est-il le propriétaire de l'event ? */
  isOwner: boolean;
  /** Le demandeur est-il un couple rattaché (collaborateur rôle `couple`) ? */
  isDelegateCouple: boolean;
  /** Valeur actuelle du flag de délégation. */
  previousCoupleCanEdit: boolean | undefined;
  /** Valeur soumise par le demandeur (prise en compte pour le propriétaire seul). */
  incomingCoupleCanEdit: boolean | undefined;
}): RsvpConfigWriteDecision {
  const prev = input.previousCoupleCanEdit ?? false;

  // Couple rattaché non autorisé → refus (il ne peut pas non plus s'auto-accorder).
  if (input.isDelegateCouple && prev !== true) {
    return { allowed: false, coupleCanEdit: prev };
  }

  // Seul le propriétaire pilote le flag ; les autres conservent l'existant.
  const coupleCanEdit = input.isOwner ? (input.incomingCoupleCanEdit ?? prev) : prev;
  return { allowed: true, coupleCanEdit };
}
