'use client';

// Route de DEV jetable — prévisualisation de la cinématique « Jardin japonais ».
// Les prénoms viennent des props (partnerA/partnerB) → éditables par couple :
// changez-les ci-dessous, la plaque vidéo (sans texte) reste la même.
// À SUPPRIMER après vérification visuelle (ne pas commiter).
import { CinematicPlayer } from '@/components/invitation/cinematics/player';

export default function DevCinePage() {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'oklch(10% 0.01 285)' }}>
      <CinematicPlayer
        live
        cinematic="jardin-japonais"
        partnerA="Élise"
        partnerB="Kenji"
        formattedDate="12 septembre 2026"
        venueName="Jardin Albert-Kahn"
        eventDate="2026-09-12T16:00:00Z"
      />
    </div>
  );
}
