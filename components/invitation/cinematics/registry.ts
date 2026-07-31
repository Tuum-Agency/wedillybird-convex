/**
 * Registre des cinématiques d'ouverture d'invitation.
 *
 * Données pures (importables côté serveur comme côté client) — les
 * composants eux-mêmes sont chargés dynamiquement par `player.tsx` pour ne
 * pas alourdir le bundle des invités : seul le thème choisi est téléchargé.
 *
 * `seal` (le sceau v3) reste le défaut historique : tout event sans champ
 * `invitationCinematic` continue de jouer exactement la même ouverture.
 * Le CHOIX d'un autre thème est réservé Premium/Pro (`cinematicInvitation`).
 */
import type { MusicTrackId } from '@/lib/invitation/music';

export const CINEMATIC_IDS = [
  'seal',
  'fairepart',
  'royal',
  'floral',
  'cake',
  'voyage',
  'theatre',
  'etoiles',
  'lanternes',
  'rivage',
  'feux',
  'deco',
  'jardin-japonais',
] as const;
export type CinematicId = (typeof CINEMATIC_IDS)[number];

export const DEFAULT_CINEMATIC: CinematicId = 'seal';

/**
 * Cinématiques actuellement PROPOSÉES au public (pickers couple + agence,
 * bento landing). Les univers absents de cette liste restent dans le code
 * (rendus par `player.tsx`, validés côté serveur, accessibles via
 * `?cinematic=` en preview) mais sont retirés des surfaces de choix.
 * Ré-exposer un univers = rajouter son id ici, rien d'autre à modifier.
 *
 * `seal` est le défaut, seul univers accessible sans Premium. `floral` est le
 * premier univers rouvert après la réduction au sceau : sa description i18n
 * décrit bien la version en plaque vidéo (rose qui éclot → arche fleurie).
 *
 * ⚠️ Avant d'en rouvrir d'autres : `theatre` et `voyage` appellent des clés
 * i18n absentes des 7 locales (`actOne`, `passDate`, `passGate`, `passSeat`)
 * et planteront au runtime. Contrôler avec l'audit de complétude i18n du skill
 * `invitation-cinematic` — la validation de parité ne les détecte pas.
 */
export const AVAILABLE_CINEMATIC_IDS: readonly CinematicId[] = ['seal', 'floral'];

export function isCinematicId(value: unknown): value is CinematicId {
  return typeof value === 'string' && (CINEMATIC_IDS as readonly string[]).includes(value);
}

/** Normalise une valeur stockée/URL vers un id valide (défaut : sceau). */
export function asCinematicId(value: unknown): CinematicId {
  return isCinematicId(value) ? value : DEFAULT_CINEMATIC;
}

export interface CinematicMeta {
  id: CinematicId;
  /** Piste suggérée quand le couple active la musique depuis ce thème. */
  suggestedTrackId: MusicTrackId;
  /** Scène sombre (utile aux pickers pour le rendu des vignettes). */
  dark: boolean;
}

export const CINEMATIC_META: Record<CinematicId, CinematicMeta> = {
  seal: { id: 'seal', suggestedTrackId: 'aurore', dark: false },
  fairepart: { id: 'fairepart', suggestedTrackId: 'aurore', dark: false },
  royal: { id: 'royal', suggestedTrackId: 'celebration', dark: true },
  floral: { id: 'floral', suggestedTrackId: 'jardin', dark: false },
  cake: { id: 'cake', suggestedTrackId: 'celebration', dark: true },
  voyage: { id: 'voyage', suggestedTrackId: 'envol', dark: true },
  theatre: { id: 'theatre', suggestedTrackId: 'harmonie', dark: true },
  etoiles: { id: 'etoiles', suggestedTrackId: 'harmonie', dark: true },
  lanternes: { id: 'lanternes', suggestedTrackId: 'aurore', dark: true },
  rivage: { id: 'rivage', suggestedTrackId: 'envol', dark: false },
  feux: { id: 'feux', suggestedTrackId: 'celebration', dark: true },
  deco: { id: 'deco', suggestedTrackId: 'harmonie', dark: true },
  'jardin-japonais': { id: 'jardin-japonais', suggestedTrackId: 'jardin', dark: false },
};
