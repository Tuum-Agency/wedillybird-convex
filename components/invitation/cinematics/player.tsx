'use client';

import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';
import { Cinematic2, type Cinematic2Props } from '../cinematic2';
import { asCinematicId, type CinematicId } from './registry';
import type { CinematicSceneProps } from './shared';

/**
 * Sélectionne et rend la cinématique choisie par le couple/l'agence.
 *
 * Chaque thème est chargé dynamiquement : l'invité ne télécharge que le
 * thème de SON invitation. `seal` (défaut) est le composant v3 historique,
 * importé statiquement — c'est le chemin le plus fréquent.
 */
const THEMES: Record<Exclude<CinematicId, 'seal'>, ComponentType<CinematicSceneProps>> = {
  floral: dynamic(() => import('./floral').then((m) => m.CinematicFloral)),
  cake: dynamic(() => import('./cake').then((m) => m.CinematicCake)),
  voyage: dynamic(() => import('./voyage').then((m) => m.CinematicVoyage)),
  theatre: dynamic(() => import('./theatre').then((m) => m.CinematicTheatre)),
};

export type CinematicPlayerProps = CinematicSceneProps & {
  /** Id de cinématique (`invitationCinematic` de l'event) — défaut sceau. */
  cinematic?: string | null;
  /** Skin du thème sceau uniquement (compat v3). */
  skin?: Cinematic2Props['skin'];
};

export function CinematicPlayer({ cinematic, skin, ...props }: CinematicPlayerProps) {
  const id = asCinematicId(cinematic);
  if (id === 'seal') return <Cinematic2 {...props} skin={skin} />;
  const Theme = THEMES[id];
  return <Theme {...props} />;
}
