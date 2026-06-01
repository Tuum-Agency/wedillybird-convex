/**
 * Entitlements par formule — quelles features « gated » sont accessibles selon
 * le tier de l'event.
 *
 * Règle (miroir de `lib/payments/plans.ts:PREMIUM_EXTRA_FEATURES`) : ces features
 * sont réservées à **Premium** côté particuliers — **Essentiel ne les a pas**.
 * Les events **Pro** (rattachés à une orga abonnée) embarquent l'intégralité des
 * features Premium par event (« Tout Premium inclus »).
 *
 * Volontairement **convex-local** (pas d'import `lib/payments`) : le bundler
 * Convex ne suit pas les imports app-side. On duplique la règle ici — garder en
 * phase avec `PREMIUM_EXTRA_FEATURES`.
 */
export type GatedFeature =
  | 'faceSearch'
  | 'galleryZipDownload'
  | 'pdfAlbumFinal'
  | 'cinematicInvitation';

/** Features Premium-only (absentes d'Essentiel). */
const PREMIUM_ONLY: ReadonlySet<GatedFeature> = new Set<GatedFeature>([
  'faceSearch',
  'galleryZipDownload',
  'pdfAlbumFinal',
  'cinematicInvitation',
]);

/**
 * Un event a-t-il accès à une feature gated ?
 *
 * Précédence `planTier` > `organizationId` (cohérent avec `decidePublishGate` :
 * le plan particulier prime). Un event pur Pro (planTier absent, orga présente)
 * a toutes les features Premium. Un event ni payé ni rattaché → aucune.
 */
export function eventHasFeature(
  event: { planTier?: 'essential' | 'premium'; organizationId?: unknown },
  feature: GatedFeature,
): boolean {
  if (event.planTier === 'premium') return true;
  if (event.planTier === 'essential') return !PREMIUM_ONLY.has(feature);
  if (event.organizationId) return true; // event pro → toutes les features Premium
  return false; // event non payé (ni plan ni orga)
}

/**
 * Quota d'events actifs simultanés par tier Pro (grille v2 : 5/20/50).
 * `null` = pas de tier connu → aucun quota appliqué côté publish gate.
 */
export function eventQuotaForTier(
  tier: 'starter' | 'business' | 'agency' | undefined,
): number | null {
  switch (tier) {
    case 'starter':
      return 5;
    case 'business':
      return 20;
    case 'agency':
      return 50;
    default:
      return null;
  }
}
