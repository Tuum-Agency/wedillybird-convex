/**
 * États US + provinces/territoires canadiens — champ « État/province du
 * mariage » (`events.weddingState`, Lane T3, F7). Sert à (a) déclarer la
 * juridiction du mariage et (b) faire jouer le geofence biométrique
 * (`BIOMETRIC_BANNED_STATE_CODES` — IL/TX/WA).
 *
 * Labels **non traduits** : ce sont des noms propres, identiques dans toutes
 * les locales du produit (même convention que `TIMEZONES` dans
 * `components/events/event-create-wizard.tsx` — libellés techniques hors
 * next-intl). Les codes suivent la convention posée par `convex/schema.ts` :
 * bruts 2-lettres USPS pour les États US (« IL »), préfixés `CA-` pour les
 * provinces/territoires canadiens (« CA-QC ») afin de ne jamais collisionner
 * avec un code d'État US (la Californie est « CA »).
 *
 * Miroir app-side de `convex/lib/biometricConsent.ts:BIOMETRIC_BANNED_STATES`
 * (le bundler Convex ne suit pas les imports app-side) — garder synchronisé.
 */

export interface RegionOption {
  id: string;
  label: string;
}

/** Valeur du `<Select>` représentant « hors États-Unis / Canada » — jamais persistée telle quelle (mappée vers `undefined`). Radix interdit la valeur `""` sur un `SelectItem`. */
export const NOT_APPLICABLE_STATE_ID = 'NONE';

export const US_STATES: readonly RegionOption[] = [
  { id: 'AL', label: 'Alabama' },
  { id: 'AK', label: 'Alaska' },
  { id: 'AZ', label: 'Arizona' },
  { id: 'AR', label: 'Arkansas' },
  { id: 'CA', label: 'California' },
  { id: 'CO', label: 'Colorado' },
  { id: 'CT', label: 'Connecticut' },
  { id: 'DE', label: 'Delaware' },
  { id: 'DC', label: 'District of Columbia' },
  { id: 'FL', label: 'Florida' },
  { id: 'GA', label: 'Georgia' },
  { id: 'HI', label: 'Hawaii' },
  { id: 'ID', label: 'Idaho' },
  { id: 'IL', label: 'Illinois' },
  { id: 'IN', label: 'Indiana' },
  { id: 'IA', label: 'Iowa' },
  { id: 'KS', label: 'Kansas' },
  { id: 'KY', label: 'Kentucky' },
  { id: 'LA', label: 'Louisiana' },
  { id: 'ME', label: 'Maine' },
  { id: 'MD', label: 'Maryland' },
  { id: 'MA', label: 'Massachusetts' },
  { id: 'MI', label: 'Michigan' },
  { id: 'MN', label: 'Minnesota' },
  { id: 'MS', label: 'Mississippi' },
  { id: 'MO', label: 'Missouri' },
  { id: 'MT', label: 'Montana' },
  { id: 'NE', label: 'Nebraska' },
  { id: 'NV', label: 'Nevada' },
  { id: 'NH', label: 'New Hampshire' },
  { id: 'NJ', label: 'New Jersey' },
  { id: 'NM', label: 'New Mexico' },
  { id: 'NY', label: 'New York' },
  { id: 'NC', label: 'North Carolina' },
  { id: 'ND', label: 'North Dakota' },
  { id: 'OH', label: 'Ohio' },
  { id: 'OK', label: 'Oklahoma' },
  { id: 'OR', label: 'Oregon' },
  { id: 'PA', label: 'Pennsylvania' },
  { id: 'RI', label: 'Rhode Island' },
  { id: 'SC', label: 'South Carolina' },
  { id: 'SD', label: 'South Dakota' },
  { id: 'TN', label: 'Tennessee' },
  { id: 'TX', label: 'Texas' },
  { id: 'UT', label: 'Utah' },
  { id: 'VT', label: 'Vermont' },
  { id: 'VA', label: 'Virginia' },
  { id: 'WA', label: 'Washington' },
  { id: 'WV', label: 'West Virginia' },
  { id: 'WI', label: 'Wisconsin' },
  { id: 'WY', label: 'Wyoming' },
];

export const CA_PROVINCES: readonly RegionOption[] = [
  { id: 'CA-AB', label: 'Alberta' },
  { id: 'CA-BC', label: 'British Columbia' },
  { id: 'CA-MB', label: 'Manitoba' },
  { id: 'CA-NB', label: 'New Brunswick' },
  { id: 'CA-NL', label: 'Newfoundland and Labrador' },
  { id: 'CA-NS', label: 'Nova Scotia' },
  { id: 'CA-NT', label: 'Northwest Territories' },
  { id: 'CA-NU', label: 'Nunavut' },
  { id: 'CA-ON', label: 'Ontario' },
  { id: 'CA-PE', label: 'Prince Edward Island' },
  { id: 'CA-QC', label: 'Québec' },
  { id: 'CA-SK', label: 'Saskatchewan' },
  { id: 'CA-YT', label: 'Yukon' },
];

/**
 * Codes `weddingState` où l'opt-in reco-faciale est refusé côté serveur
 * (`convex/events.ts:setFaceSearchEnabled`). Dupliqué depuis
 * `convex/lib/biometricConsent.ts` — usage UI uniquement (griser/expliquer le
 * toggle) ; l'autorité reste la mutation Convex.
 */
export const BIOMETRIC_BANNED_STATE_CODES: ReadonlySet<string> = new Set(['IL', 'TX', 'WA']);
