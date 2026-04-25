/**
 * Wedillybird — Motion presets v2 (avril 2026, redesign foundations).
 *
 * Source: .context/redesign-direction.md section "8 patterns canoniques".
 *
 * Stack: Motion (ex-Framer Motion) pour 95 % de l'app. GSAP scroll-driven
 * réservé à la landing `/` et à la page invitation `/i/<token>` (cinématique).
 *
 * Tous les presets respectent `prefers-reduced-motion` : si l'utilisateur l'a
 * activé, les animations sont raccourcies à ~10 ms (cf. globals.css `@media`).
 * Les presets ci-dessous restent valides — Motion lit la prefs lui-même via
 * son hook `useReducedMotion()` côté composants client.
 */

import { cubicBezier } from 'motion/react';
import type { Variants, Transition } from 'motion/react';

/* -------------------------------------------------------------------------- */
/*  Easings (alignés sur les CSS variables --ease-* de globals.css)            */
/* -------------------------------------------------------------------------- */

// Motion v12 attend des Easing (string | function), donc on instancie une
// cubic-bezier function. Les valeurs miroitent les CSS `--ease-*` de globals.
export const EASE_OUT_QUINT = cubicBezier(0.22, 1, 0.36, 1);
export const EASE_OUT_EXPO = cubicBezier(0.16, 1, 0.3, 1);
export const EASE_SPRING = cubicBezier(0.34, 1.56, 0.64, 1);

// Tuples bruts conservés pour les tests qui assertent les valeurs canoniques.
export const EASE_OUT_QUINT_VALUES = [0.22, 1, 0.36, 1] as const;
export const EASE_OUT_EXPO_VALUES = [0.16, 1, 0.3, 1] as const;
export const EASE_SPRING_VALUES = [0.34, 1.56, 0.64, 1] as const;

/* -------------------------------------------------------------------------- */
/*  Pattern 1 — Page transitions (250 ms ease-out)                            */
/*  Pas de spring sur les navigations critiques mobile (motion sickness en    */
/*  webview WhatsApp). Cross-fade simple.                                     */
/* -------------------------------------------------------------------------- */

export const pageTransition: Transition = {
  duration: 0.25,
  ease: EASE_OUT_QUINT,
};

export const pageVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: pageTransition },
  exit: {
    opacity: 0,
    transition: { duration: 0.18, ease: EASE_OUT_QUINT },
  },
};

/* -------------------------------------------------------------------------- */
/*  Pattern 2 — Hover desktop (lift + shadow, 150 ms)                         */
/*  À utiliser uniquement avec `@media (hover: hover)` — pas de hover sur     */
/*  mobile pour éviter les états bloqués.                                     */
/* -------------------------------------------------------------------------- */

export const hoverLift = {
  whileHover: {
    y: -2,
    transition: { duration: 0.15, ease: EASE_OUT_QUINT },
  },
  whileTap: { y: 0, scale: 0.99 },
};

/* -------------------------------------------------------------------------- */
/*  Pattern 3 — Scroll reveals (landing, ~16 px slide + fade, stagger 60 ms)  */
/*  Combiner avec `viewport={{ once: true, margin: '-15%' }}` sur le parent.  */
/* -------------------------------------------------------------------------- */

export const scrollReveal: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.55,
      ease: EASE_OUT_QUINT,
    },
  },
};

export const scrollRevealParent: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
};

/* -------------------------------------------------------------------------- */
/*  Pattern 4 — State changes (RSVP, button success, mutation success)         */
/*  Spring légère + scale 1.02 → 1 pour donner un feedback tactile.           */
/* -------------------------------------------------------------------------- */

export const successPop: Variants = {
  initial: { scale: 0.92, opacity: 0 },
  animate: {
    scale: 1,
    opacity: 1,
    transition: {
      type: 'spring',
      stiffness: 220,
      damping: 18,
      mass: 0.8,
    },
  },
};

/* -------------------------------------------------------------------------- */
/*  Pattern 5 — Skeleton loaders (shimmer brand 1.6 s)                        */
/*  Le shimmer en lui-même est en CSS pur (`shimmer` utility) ; ce preset     */
/*  expose le timing pour les loaders Motion-driven (List skeleton, etc.).    */
/* -------------------------------------------------------------------------- */

export const skeletonShimmer: Transition = {
  repeat: Infinity,
  ease: 'easeInOut',
  duration: 1.6,
};

/* -------------------------------------------------------------------------- */
/*  Pattern 6 — Toasts/Notifications (drawer-from-bottom mobile, top-right    */
/*  desktop). Sonner gère ça nativement — cf. `components/ui/toast.tsx`.      */
/*  Ce preset existe pour les toasts custom hors Sonner.                      */
/* -------------------------------------------------------------------------- */

export const toastSlideIn: Variants = {
  initial: { y: 24, opacity: 0 },
  animate: {
    y: 0,
    opacity: 1,
    transition: {
      duration: 0.22,
      ease: EASE_OUT_QUINT,
    },
  },
  exit: {
    y: 24,
    opacity: 0,
    transition: {
      duration: 0.18,
      ease: EASE_OUT_QUINT,
    },
  },
};

/* -------------------------------------------------------------------------- */
/*  Pattern 7 — Number ticker (stat dashboard, count-up animation)            */
/*  Utilisable avec `useMotionValue` + `useSpring` côté composant.            */
/* -------------------------------------------------------------------------- */

export const numberTickerSpring: Transition = {
  type: 'spring',
  stiffness: 90,
  damping: 26,
  mass: 1,
};

/* -------------------------------------------------------------------------- */
/*  Pattern 8 — Card flip / 3D reveal (page invitation cinématique)           */
/*  Pour les transitions premium-grade (envelope opening). 1.4 s easeInOut.   */
/*  La compo réelle utilise GSAP timeline pour la cinématique complète.       */
/*  Ce preset Motion = fallback simple si JS minimal ou skip animation.       */
/* -------------------------------------------------------------------------- */

export const cardReveal3D: Variants = {
  initial: { rotateX: 90, opacity: 0, transformPerspective: 1200 },
  animate: {
    rotateX: 0,
    opacity: 1,
    transition: {
      duration: 1.4,
      ease: EASE_OUT_EXPO,
    },
  },
};

/* -------------------------------------------------------------------------- */
/*  Helper : viewport options communs pour `whileInView`                      */
/* -------------------------------------------------------------------------- */

export const inViewOnce = { once: true, margin: '-12% 0px' } as const;
