'use client';

import { useEffect } from 'react';
import Lenis from 'lenis';

/**
 * Lenis smooth scroll provider — non-négociable selon les standards 2026.
 *
 * Active le smooth scroll natif Lenis sur toute la landing. Tous les sites
 * Awwwards SOTD 2025-2026 (Adovasio, Off Menu, Ruinart) tournent là-dessus.
 *
 * Désactivé automatiquement si `prefers-reduced-motion: reduce` (la prop
 * `prevent` couvre ce cas via Lenis lui-même qui respecte la pref OS).
 *
 * GSAP ScrollTrigger est connecté à Lenis via le requestAnimationFrame
 * partagé pour que les animations scroll-driven (cinematic invitation)
 * restent synchrones avec le smooth scroll.
 */
export function LenisProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Respecte prefers-reduced-motion
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;

    const lenis = new Lenis({
      duration: 1.1,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      touchMultiplier: 1.4,
    });

    let rafId: number;
    function raf(time: number) {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    }
    rafId = requestAnimationFrame(raf);

    // Synchronise GSAP ScrollTrigger avec Lenis (lazy import pour éviter
    // de plomber le bundle initial si la cinematic n'est pas chargée).
    void (async () => {
      try {
        const { gsap } = await import('gsap');
        const { ScrollTrigger } = await import('gsap/ScrollTrigger');
        gsap.registerPlugin(ScrollTrigger);
        lenis.on('scroll', ScrollTrigger.update);
        gsap.ticker.add((time) => lenis.raf(time * 1000));
        gsap.ticker.lagSmoothing(0);
      } catch {
        // GSAP non chargé encore — pas grave, on continue sans la sync.
      }
    })();

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
    };
  }, []);

  return <>{children}</>;
}
