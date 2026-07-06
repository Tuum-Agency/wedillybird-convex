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

export const CINEMATIC_IDS = ['seal', 'floral', 'cake', 'voyage', 'theatre'] as const;
export type CinematicId = (typeof CINEMATIC_IDS)[number];

export const DEFAULT_CINEMATIC: CinematicId = 'seal';

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
  floral: { id: 'floral', suggestedTrackId: 'jardin', dark: false },
  cake: { id: 'cake', suggestedTrackId: 'celebration', dark: false },
  voyage: { id: 'voyage', suggestedTrackId: 'envol', dark: true },
  theatre: { id: 'theatre', suggestedTrackId: 'harmonie', dark: true },
};
