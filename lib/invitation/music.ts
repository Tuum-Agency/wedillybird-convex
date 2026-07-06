/**
 * Bibliothèque musicale des invitations — pistes ORIGINALES Wedillybird,
 * composées et rendues par `scripts/generate-invitation-music.mjs`
 * (synthèse maison → aucune licence tierce, usage commercial libre).
 *
 * Les fichiers vivent dans `public/audio/invitation/*.m4a` (AAC ~1 Mo,
 * pensés pour boucler avec une respiration). Les libellés utilisateur
 * vivent dans i18n (`InvitationDesign.tracks.*`) — ici, données pures.
 *
 * La musique personnalisée (upload du couple) ne passe pas par ce
 * manifeste : elle est stockée sur S3 (`audio/{eventId}/…`) et servie via
 * CloudFront — voir `convex/invitationAudio.ts`.
 */
export const MUSIC_TRACK_IDS = ['aurore', 'jardin', 'celebration', 'envol', 'harmonie'] as const;
export type MusicTrackId = (typeof MUSIC_TRACK_IDS)[number];

export function isMusicTrackId(value: unknown): value is MusicTrackId {
  return typeof value === 'string' && (MUSIC_TRACK_IDS as readonly string[]).includes(value);
}

/** URL publique (asset Next) d'une piste de la bibliothèque. */
export function musicTrackSrc(id: MusicTrackId): string {
  return `/audio/invitation/${id}.m4a`;
}

/** Musique résolue telle que la page publique la consomme. */
export interface ResolvedInvitationMusic {
  url: string;
  /** Titre à annoncer (nom de fichier du couple ou libellé i18n côté picker). */
  title?: string;
}

/**
 * Résout le champ `invitationMusic` d'un event vers une URL jouable.
 * `customUrl` est fournie par la query Convex (CloudFront) pour `custom`.
 */
export function resolveInvitationMusic(
  music:
    | { source: 'library' | 'custom'; trackId?: string; title?: string; customUrl?: string }
    | null
    | undefined,
): ResolvedInvitationMusic | null {
  if (!music) return null;
  if (music.source === 'library' && isMusicTrackId(music.trackId)) {
    return { url: musicTrackSrc(music.trackId) };
  }
  if (music.source === 'custom' && music.customUrl) {
    return { url: music.customUrl, title: music.title };
  }
  return null;
}
