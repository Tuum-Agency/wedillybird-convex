'use client';

import { Cinematic2 } from './cinematic2';

/**
 * Cinématique d'ouverture invitation — auto-play plein écran.
 *
 * Quand un invité ouvre son lien WhatsApp/SMS, il reçoit l'ouverture
 * cinématique 2.5D (enveloppe de papeterie qui s'ouvre en profondeur réelle,
 * sceau de cire qui se fend, doublure champagne, carte qui émerge, prénoms en
 * Bodoni, fleurons + compte à rebours). Implémentation : {@link Cinematic2}.
 *
 * L'API (props + `onComplete`) est conservée pour {@link InvitationShell} :
 * `onComplete` est appelé à la fin de la séquence ou au « Passer ».
 * `prefers-reduced-motion` → saut direct à l'état apaisé.
 */
export interface CinematicOpeningProps {
  partnerA: string;
  partnerB: string;
  formattedDate: string;
  venueName?: string;
  /** Couleur d'accent du couple — sceau de cire + accents. Fallback blush. */
  accentColor?: string;
  /** Date de l'événement (epoch ms ou ISO) — compte à rebours d'apaisement. */
  eventDate?: number | string;
  /** Callback déclenché quand la cinématique se termine OU est passée. */
  onComplete: () => void;
}

export function CinematicOpening({
  partnerA,
  partnerB,
  formattedDate,
  venueName,
  accentColor,
  eventDate,
  onComplete,
}: CinematicOpeningProps) {
  return (
    <Cinematic2
      live
      partnerA={partnerA}
      partnerB={partnerB}
      formattedDate={formattedDate}
      venueName={venueName}
      accentColor={accentColor}
      eventDate={eventDate}
      onDone={onComplete}
    />
  );
}
