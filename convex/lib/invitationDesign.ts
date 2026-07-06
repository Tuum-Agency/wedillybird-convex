/**
 * Personnalisation de l'invitation publique — cinématique + musique.
 *
 * Volontairement **convex-local** (pas d'import `lib/` app-side : le bundler
 * Convex ne suit pas ces imports). Miroirs à garder en phase :
 *  - `components/invitation/cinematics/registry.ts` (CINEMATIC_IDS)
 *  - `lib/invitation/music.ts` (MUSIC_TRACK_IDS)
 */
import { eventHasFeature } from './entitlements';

export const CINEMATIC_IDS = ['seal', 'floral', 'cake', 'voyage', 'theatre'] as const;
export type CinematicId = (typeof CINEMATIC_IDS)[number];

export const MUSIC_TRACK_IDS = ['aurore', 'jardin', 'celebration', 'envol', 'harmonie'] as const;

export function isCinematicId(value: unknown): value is CinematicId {
  return typeof value === 'string' && (CINEMATIC_IDS as readonly string[]).includes(value);
}

export function isLibraryTrackId(value: unknown): boolean {
  return typeof value === 'string' && (MUSIC_TRACK_IDS as readonly string[]).includes(value);
}

export interface StoredInvitationMusic {
  source: 'library' | 'custom';
  trackId?: string;
  s3Key?: string;
  title?: string;
}

/** URL CloudFront d'une clé S3 — null si l'env n'est pas configurée. */
export function cdnUrl(s3Key: string): string | null {
  const domain = process.env.CLOUDFRONT_DOMAIN;
  return domain ? `https://${domain}/${s3Key}` : null;
}

/**
 * Projection client de la musique : jamais la clé S3 brute, mais l'URL
 * CloudFront résolue (source custom) ou l'id de piste (bibliothèque).
 */
export function musicForClient(music: StoredInvitationMusic | undefined | null): {
  source: 'library' | 'custom';
  trackId?: string;
  title?: string;
  customUrl?: string;
} | null {
  if (!music) return null;
  if (music.source === 'library') {
    if (!isLibraryTrackId(music.trackId)) return null;
    return { source: 'library', trackId: music.trackId };
  }
  if (!music.s3Key) return null;
  const customUrl = cdnUrl(music.s3Key);
  if (!customUrl) return null;
  return { source: 'custom', title: music.title, customUrl };
}

/**
 * Valide une demande de personnalisation et applique le gating Premium/Pro :
 * le sceau (défaut) reste ouvert à tous ; choisir un AUTRE thème ou une
 * musique requiert la feature `cinematicInvitation` (Premium particuliers,
 * incluse sur tous les events Pro). Lève des erreurs codées (mapError côté
 * server actions).
 */
export function assertInvitationDesignAllowed(
  event: {
    _id: unknown;
    planTier?: 'essential' | 'premium';
    organizationId?: unknown;
  },
  args: { cinematic?: string; music?: StoredInvitationMusic },
): void {
  if (args.cinematic !== undefined && !isCinematicId(args.cinematic)) {
    throw new Error('INVALID_CINEMATIC');
  }
  if (args.music !== undefined) {
    if (args.music.source === 'library' && !isLibraryTrackId(args.music.trackId)) {
      throw new Error('INVALID_MUSIC_TRACK');
    }
    if (args.music.source === 'custom') {
      const key = args.music.s3Key ?? '';
      // La clé doit vivre sous le préfixe audio/{eventId}/ (hors modération
      // Lambda `incoming/`, et impossible de pointer le fichier d'un autre event).
      if (!key.startsWith(`audio/${String(event._id)}/`)) throw new Error('INVALID_MUSIC_KEY');
    }
  }
  const wantsPremium =
    (args.cinematic !== undefined && args.cinematic !== 'seal') || args.music !== undefined;
  if (wantsPremium && !eventHasFeature(event, 'cinematicInvitation')) {
    throw new Error('FEATURE_LOCKED');
  }
}
