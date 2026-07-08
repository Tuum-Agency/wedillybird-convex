/**
 * Identité visuelle partagée des cinématiques — source de vérité unique pour
 * les vignettes dégradées de chaque thème. Réutilisée par :
 *  - le modal « Personnaliser l'invitation » (couple, `mon-mariage`) ;
 *  - la galerie des univers sur la landing publique.
 *
 * Données pures (chaînes CSS) → importable côté serveur comme côté client, sans
 * screenshot à charger. Chaque dégradé évoque l'ambiance de la scène ; le flag
 * `dark` (dans {@link CINEMATIC_META}) indique s'il faut poser un texte clair.
 */
import type { CinematicId } from './registry';

/** Vignette dégradée (135°) évoquant chaque scène. */
export const THEME_SWATCH: Record<CinematicId, string> = {
  seal: 'linear-gradient(135deg, oklch(96% 0.02 84), oklch(88% 0.055 24))',
  fairepart: 'linear-gradient(135deg, oklch(95% 0.03 60), oklch(84% 0.08 24))',
  floral: 'linear-gradient(135deg, oklch(97% 0.015 140), oklch(88% 0.055 18))',
  cake: 'linear-gradient(135deg, oklch(30% 0.035 55), oklch(84% 0.06 22))',
  voyage: 'linear-gradient(135deg, oklch(72% 0.06 262), oklch(92% 0.05 70))',
  theatre: 'linear-gradient(135deg, oklch(22% 0.03 290), oklch(42% 0.12 18))',
  etoiles: 'linear-gradient(135deg, oklch(16% 0.03 268), oklch(38% 0.05 280))',
  lanternes: 'linear-gradient(135deg, oklch(24% 0.04 290), oklch(62% 0.11 52))',
  rivage: 'linear-gradient(135deg, oklch(76% 0.075 210), oklch(90% 0.03 78))',
  feux: 'linear-gradient(135deg, oklch(14% 0.022 278), oklch(60% 0.1 82))',
  deco: 'linear-gradient(135deg, oklch(13% 0.008 80), oklch(66% 0.09 84))',
  neige: 'linear-gradient(135deg, oklch(90% 0.02 240), oklch(72% 0.035 235))',
};
