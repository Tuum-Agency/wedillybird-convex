/**
 * Programme d'affiliation / parrainage — logique PURE (testable sans Convex).
 *
 * Décisions actées par le conseil (llm-council 2026-07) encodées ici :
 *  - Deux marchés : `referral` (client-parrain → CRÉDIT, zéro KYC, 100 % auto)
 *    et `partner` (créateur/planner invité → CASH, payout différé).
 *  - Récompense = % du NET encaissé (après remise), en basis points entiers
 *    (jamais de flottant sur de l'argent).
 *  - Garde-fou marge : remise filleul + commission affilié ne s'empilent JAMAIS
 *    au-delà d'un plafond (sinon le plancher de marge Essentiel casse — vérifié
 *    par le fact-check du conseil sur un cumul -10 % + 20 %).
 *  - Vesting = date de l'event (le remboursement « event non envoyé » court
 *    jusqu'au mariage, booké des mois à l'avance), avec un plancher J+7.
 *  - Anti-self-referral : un affilié ne peut pas toucher sur son propre achat.
 *
 * Volontairement convex-local (pas d'import `lib/` app-side : le bundler Convex
 * ne suit pas ces imports).
 */

export type AffiliateKind = 'referral' | 'partner';
export type RewardType = 'credit' | 'cash';
export type ReferralStatus = 'pending' | 'vested' | 'paid' | 'credited' | 'reversed';

/** Commission par défaut : 20,00 % (2000 bps). Ancre standard SaaS/creator. */
export const DEFAULT_RATE_BPS = 2000;

/**
 * Plafond de la somme (remise filleul + commission affilié), en bps. À 25 %
 * cumulés max : autorise « 0 % remise + 20 % commission » (défaut) et le split
 * « 10 % remise + 15 % commission », mais BLOQUE « 10 % + 20 % » qui casserait
 * la marge Essentiel (COGS ≤ 15 %). Money-safe par construction.
 */
export const MAX_COMBINED_BPS = 2500;

/** Plancher de rétention minimal avant qu'une récompense soit acquise. */
export const MIN_VEST_FLOOR_MS = 7 * 24 * 60 * 60 * 1000; // J+7

/* ------------------------------ calcul récompense ------------------------------ */

/**
 * Récompense en centimes = rate(bps) × net / 10000, arrondie à l'entier.
 * Base = NET encaissé (après remise). Bornée ≥ 0.
 */
export function rewardMinor(netMinor: number, rateBps: number): number {
  if (!Number.isFinite(netMinor) || !Number.isFinite(rateBps)) return 0;
  if (netMinor <= 0 || rateBps <= 0) return 0;
  return Math.round((netMinor * rateBps) / 10000);
}

export interface RewardConfig {
  /** Commission versée à l'affilié (bps). */
  rateBps: number;
  /** Remise offerte au filleul (bps ; 0 = pas de remise). */
  buyerDiscountBps: number;
}

/**
 * Vrai si la config respecte le garde-fou marge : les deux taux ≥ 0 et leur
 * somme ≤ MAX_COMBINED_BPS. C'est LA règle qui empêche le cumul destructeur de
 * marge (remise + pleine commission) que le conseil a écarté.
 */
export function isRewardConfigSafe(c: RewardConfig): boolean {
  return (
    Number.isInteger(c.rateBps) &&
    Number.isInteger(c.buyerDiscountBps) &&
    c.rateBps >= 0 &&
    c.buyerDiscountBps >= 0 &&
    c.rateBps + c.buyerDiscountBps <= MAX_COMBINED_BPS
  );
}

/* ------------------------------ vesting ------------------------------ */

/**
 * Date à laquelle la récompense devient « acquise » (payable/créditable) :
 * la DATE DE L'EVENT (fin du risque de remboursement « event non envoyé »),
 * avec un plancher `purchasedAt + J+7`. Les chargebacks (jusqu'à ~120 j) sont
 * gérés séparément par reversal, pas par un hold plus long.
 */
export function vestsAt(eventDateMs: number, purchasedAtMs: number): number {
  const floor = purchasedAtMs + MIN_VEST_FLOOR_MS;
  if (!Number.isFinite(eventDateMs)) return floor;
  return Math.max(eventDateMs, floor);
}

/** Une ligne `pending` devient `vested` quand l'horloge dépasse `vestsAt`. */
export function isVestable(
  ref: { status: ReferralStatus; vestsAt: number },
  nowMs: number,
): boolean {
  return ref.status === 'pending' && nowMs >= ref.vestsAt;
}

/** Statut terminal de versement selon le type de récompense. */
export function settledStatusFor(rewardType: RewardType): ReferralStatus {
  return rewardType === 'credit' ? 'credited' : 'paid';
}

/** Un reversal (remboursement/litige) n'est possible que si non encore terminal. */
export function canReverse(status: ReferralStatus): boolean {
  return status === 'pending' || status === 'vested';
}

/* ------------------------------ anti-fraude ------------------------------ */

/**
 * Vrai si l'achat est un self-referral (l'affilié touche sur son propre achat).
 * Compare l'utilisateur ET l'email (normalisé). À compléter côté appelant par
 * d'autres signaux (fingerprint carte, IP) hors de cette fonction pure.
 */
export function isSelfReferral(input: {
  affiliateOwnerUserId?: string | null;
  buyerUserId?: string | null;
  affiliateEmail?: string | null;
  buyerEmail?: string | null;
}): boolean {
  const { affiliateOwnerUserId, buyerUserId, affiliateEmail, buyerEmail } = input;
  if (affiliateOwnerUserId && buyerUserId && affiliateOwnerUserId === buyerUserId) {
    return true;
  }
  const a = affiliateEmail?.trim().toLowerCase();
  const b = buyerEmail?.trim().toLowerCase();
  if (a && b && a === b) return true;
  return false;
}

/* ------------------------------ code ------------------------------ */

/** Normalise un code affilié : majuscules, A-Z0-9 uniquement, ≤ 24 car. */
export function normalizeAffiliateCode(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 24);
}

export function isValidAffiliateCode(code: string): boolean {
  return /^[A-Z0-9]{3,24}$/.test(code);
}

/**
 * Code de parrainage déterministe à partir d'un id + tentative (en cas de
 * collision, l'appelant réessaie avec attempt+1). Hash djb2 → base36, préfixe
 * `WB`, borné ≤ 10 car. Toujours un code valide (A-Z0-9, ≥ 3 car).
 */
export function generateReferralCode(seed: string, attempt = 0): string {
  let h = 5381;
  const s = `${seed}#${attempt}`;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  const base = h
    .toString(36)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  return `WB${base || '0'}`.slice(0, 10);
}

/* --------------------------- application du crédit --------------------------- */

/**
 * Sélection FIFO des récompenses `vested` (crédit) à consommer pour une
 * commande. Récompenses ENTIÈRES (atomiques — une ligne de ledger est créditée
 * ou non), on n'en prend une que si le cumul reste ≤ `orderMinor`. Garantit que
 * le coupon appliqué == crédit réellement consommé (aucune perte pour le
 * parrain, aucune sur-remise pour nous). `rewards` supposé trié (FIFO).
 */
export function selectReferralsToConsume(
  rewards: ReadonlyArray<{ id: string; rewardMinor: number }>,
  orderMinor: number,
): { referralIds: string[]; consumedMinor: number } {
  if (!Number.isFinite(orderMinor) || orderMinor <= 0) {
    return { referralIds: [], consumedMinor: 0 };
  }
  let consumedMinor = 0;
  const referralIds: string[] = [];
  for (const r of rewards) {
    if (!Number.isFinite(r.rewardMinor) || r.rewardMinor <= 0) continue;
    if (consumedMinor + r.rewardMinor <= orderMinor) {
      consumedMinor += r.rewardMinor;
      referralIds.push(r.id);
    }
  }
  return { referralIds, consumedMinor };
}
