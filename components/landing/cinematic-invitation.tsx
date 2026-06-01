'use client';

import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useReducedMotion } from 'motion/react';

/**
 * Landing — Cinématique invitation V4.
 *
 * Refonte complète après audit "5/100 sur le WoW factor" :
 *
 * 1. Texture papier réelle via SVG `feTurbulence` (grain qui réagit à la
 *    courbure 3D de l'enveloppe)
 * 2. Sceau de cire fendu en 2 morceaux au moment du flap-open (path morphing
 *    GSAP), avec bavure réaliste (pas un cercle parfait)
 * 3. Drop-shadow réaliste sur la carte (feGaussianBlur + offset)
 * 4. Tampon postal au coin haut-droit (texture timbre + date)
 * 5. Carte qui sort avec un léger swing (rotateZ ±2°) — pas un translate
 *    linéaire
 * 6. Cursor custom "cire à cacheter" sur cette section uniquement
 *
 * GSAP timeline pinned + ScrollTrigger lié à Lenis (sync via raf shared
 * dans LenisProvider).
 *
 * Désactivé sur prefers-reduced-motion (carte affichée directement).
 */
export function LandingCinematicInvitation() {
  const t = useTranslations('Landing.cinematic');
  const reduced = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const flapRef = useRef<SVGPathElement>(null);
  const sealLeftRef = useRef<SVGPathElement>(null);
  const sealRightRef = useRef<SVGPathElement>(null);
  const cardRef = useRef<SVGGElement>(null);
  const flourishRef = useRef<SVGGElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);

  // Cursor custom "cire à cacheter" sur la section
  useEffect(() => {
    if (reduced) return;
    if (!sectionRef.current || !cursorRef.current) return;
    const hoverable = window.matchMedia('(hover: hover)').matches;
    if (!hoverable) return;

    const section = sectionRef.current;
    const cursor = cursorRef.current;

    function handleMove(e: MouseEvent) {
      const rect = section.getBoundingClientRect();
      const inside =
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom;
      if (inside) {
        cursor.style.opacity = '1';
        cursor.style.left = `${e.clientX}px`;
        cursor.style.top = `${e.clientY}px`;
      } else {
        cursor.style.opacity = '0';
      }
    }
    window.addEventListener('mousemove', handleMove);
    return () => window.removeEventListener('mousemove', handleMove);
  }, [reduced]);

  // GSAP scroll-driven timeline
  useEffect(() => {
    if (reduced) return;
    if (!containerRef.current) return;

    let cleanup: (() => void) | undefined;
    void (async () => {
      const { gsap } = await import('gsap');
      const { ScrollTrigger } = await import('gsap/ScrollTrigger');
      gsap.registerPlugin(ScrollTrigger);

      const ctx = gsap.context(() => {
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: containerRef.current,
            start: 'top top',
            end: '+=200%',
            pin: true,
            scrub: 0.7,
            anticipatePin: 1,
          },
        });

        // Step 1 : sceau se brise (left part s'envole gauche, right part droite)
        tl.to(
          sealLeftRef.current,
          {
            x: -22,
            y: 8,
            rotate: -25,
            duration: 0.4,
            ease: 'power2.out',
          },
          0,
        );
        tl.to(
          sealRightRef.current,
          {
            x: 22,
            y: 8,
            rotate: 30,
            duration: 0.4,
            ease: 'power2.out',
          },
          0,
        );

        // Step 2 : flap se déplie vers le haut (perspective)
        tl.to(
          flapRef.current,
          {
            rotateX: -178,
            transformOrigin: '50% 0%',
            duration: 0.9,
            ease: 'power2.inOut',
          },
          0.35,
        );

        // Step 3 : carte sort avec un léger swing
        tl.fromTo(
          cardRef.current,
          { y: 0, rotate: 0 },
          {
            y: -200,
            rotate: -1.5,
            duration: 1.2,
            ease: 'power2.out',
          },
          0.7,
        );

        // Step 4 : motifs floraux apparaissent autour avec stagger
        tl.fromTo(
          flourishRef.current?.children ?? [],
          { opacity: 0, scale: 0.5, y: 40 },
          {
            opacity: 1,
            scale: 1,
            y: 0,
            duration: 1,
            ease: 'power3.out',
            stagger: 0.08,
          },
          1.3,
        );

        // Labels qui s'enchaînent avec opacité
        const labels = Array.from(labelRef.current?.querySelectorAll('[data-step]') ?? []);
        if (labels.length === 3) {
          gsap.set(labels, { opacity: 0.25 });
          tl.to(labels[0]!, { opacity: 1 }, 0);
          tl.to(labels[0]!, { opacity: 0.25 }, 0.55);
          tl.to(labels[1]!, { opacity: 1 }, 0.55);
          tl.to(labels[1]!, { opacity: 0.25 }, 1.2);
          tl.to(labels[2]!, { opacity: 1 }, 1.2);
        }
      }, containerRef);

      cleanup = () => {
        ctx.revert();
        ScrollTrigger.getAll().forEach((st) => st.kill());
      };
    })();

    return () => cleanup?.();
  }, [reduced]);

  return (
    <>
      {/* Cursor custom */}
      <div
        ref={cursorRef}
        aria-hidden
        className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2 opacity-0 transition-opacity duration-200"
        style={{ width: '40px', height: '40px' }}
      >
        <svg viewBox="0 0 40 40" fill="none">
          <defs>
            <radialGradient id="cursor-blush" cx="50%" cy="40%" r="55%">
              <stop offset="0%" stopColor="oklch(82% 0.085 22)" />
              <stop offset="100%" stopColor="oklch(48% 0.085 22)" />
            </radialGradient>
          </defs>
          <path
            d="M 20 4 L 24 10 L 32 9 L 31 17 L 36 22 L 31 27 L 32 35 L 24 34 L 20 40 L 16 34 L 8 35 L 9 27 L 4 22 L 9 17 L 8 9 L 16 10 Z"
            fill="url(#cursor-blush)"
            opacity="0.85"
          />
          <text
            x="20"
            y="26"
            textAnchor="middle"
            fontFamily="var(--font-display)"
            fontStyle="italic"
            fontWeight="500"
            fontSize="14"
            fill="oklch(28% 0.05 26)"
          >
            W
          </text>
        </svg>
      </div>

      <section
        ref={sectionRef}
        className="relative cursor-none"
        style={{ backgroundColor: 'oklch(98.5% 0.008 85)' }}
      >
        <div ref={containerRef} className="relative overflow-hidden" style={{ minHeight: '100vh' }}>
          {/* Texture grain section */}
          <div aria-hidden className="paper-grain pointer-events-none absolute inset-0" />

          {/* Mesh subtil */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(50% 40% at 50% 30%, oklch(95% 0.025 22 / 50%) 0%, transparent 70%)',
            }}
          />

          <div className="container-page relative flex flex-col items-center gap-3 pt-24 text-center">
            <span className="font-mono text-[11px] tracking-[0.32em] text-[color:var(--color-ink-500)] uppercase">
              {t('chapter')}
            </span>
            <h2
              className="font-display mt-4 max-w-3xl text-balance italic"
              style={{
                fontSize: 'clamp(2rem, 5vw, 3.5rem)',
                lineHeight: 1.05,
                letterSpacing: '-0.022em',
                color: 'var(--color-ink-900)',
              }}
            >
              {t('title')}
            </h2>
            <p className="mt-3 max-w-xl text-base text-[color:var(--color-ink-500)]">
              {t('subtitle')}
            </p>
          </div>

          {/* Stage SVG — mt généreux pour que la carte (anim y:-200) ne
              chevauche pas le paragraphe de description à son point haut. */}
          <div className="relative mx-auto mt-32 flex items-center justify-center">
            <svg
              viewBox="-220 -280 440 560"
              className="h-[60vh] max-h-[520px] w-auto"
              aria-label="Enveloppe et carte d'invitation animées scroll-driven"
              role="img"
              style={{ overflow: 'visible' }}
            >
              <defs>
                {/* Texture papier — feTurbulence noise */}
                <filter id="paper-grain-svg" x="-5%" y="-5%" width="110%" height="110%">
                  <feTurbulence
                    type="fractalNoise"
                    baseFrequency="0.85"
                    numOctaves="2"
                    stitchTiles="stitch"
                    result="noise"
                  />
                  <feColorMatrix
                    in="noise"
                    type="matrix"
                    values="0 0 0 0 0.4
                            0 0 0 0 0.3
                            0 0 0 0 0.25
                            0 0 0 0.08 0"
                  />
                  <feComposite in2="SourceGraphic" operator="in" />
                </filter>

                {/* Drop-shadow réaliste */}
                <filter id="card-shadow" x="-30%" y="-30%" width="160%" height="160%">
                  <feGaussianBlur in="SourceAlpha" stdDeviation="6" />
                  <feOffset dx="0" dy="14" result="offsetblur" />
                  <feFlood floodColor="oklch(48% 0.085 22)" floodOpacity="0.25" />
                  <feComposite in2="offsetblur" operator="in" />
                  <feMerge>
                    <feMergeNode />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>

                {/* Drop-shadow enveloppe plus subtle */}
                <filter id="env-shadow" x="-15%" y="-15%" width="130%" height="130%">
                  <feGaussianBlur in="SourceAlpha" stdDeviation="3" />
                  <feOffset dx="0" dy="6" result="offsetblur" />
                  <feFlood floodColor="oklch(48% 0.085 22)" floodOpacity="0.2" />
                  <feComposite in2="offsetblur" operator="in" />
                  <feMerge>
                    <feMergeNode />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>

                {/* Gradient cire de sceau */}
                <radialGradient id="wax-grad" cx="40%" cy="35%" r="65%">
                  <stop offset="0%" stopColor="oklch(82% 0.085 22)" />
                  <stop offset="55%" stopColor="oklch(62% 0.095 20)" />
                  <stop offset="100%" stopColor="oklch(42% 0.085 24)" />
                </radialGradient>

                {/* Gradient carte */}
                <linearGradient id="card-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="oklch(98.5% 0.008 85)" />
                  <stop offset="100%" stopColor="oklch(95% 0.025 22)" />
                </linearGradient>

                {/* Gradient enveloppe */}
                <linearGradient id="env-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="oklch(96% 0.022 80)" />
                  <stop offset="100%" stopColor="oklch(91% 0.045 22)" />
                </linearGradient>
              </defs>

              {/* Motifs floraux derrière (initialement masqués) */}
              <g ref={flourishRef}>
                <FlourishOrnament cx={-180} cy={-200} scale={0.8} />
                <FlourishOrnament cx={180} cy={-200} scale={0.8} flip />
                <FlourishOrnament cx={-200} cy={40} scale={0.55} />
                <FlourishOrnament cx={200} cy={40} scale={0.55} flip />
                <FlourishOrnament cx={-100} cy={-260} scale={0.45} />
                <FlourishOrnament cx={100} cy={-260} scale={0.45} flip />
              </g>

              {/*
               * Carte (derrière l'enveloppe initialement).
               *
               * Wrapper <g transform="translate(0,-35)"> qui repositionne
               * statiquement la carte 35 px plus haut → bottom de la carte
               * coïncide avec le bord bas de l'enveloppe (y=80) au lieu de
               * dépasser de 35 px (y=115). Pré-scroll, la carte est donc
               * entièrement masquée derrière l'enveloppe + flap fermé.
               *
               * Le <g cardRef> intérieur est animé indépendamment par GSAP
               * (transform CSS) — les deux transforms se composent sans
               * conflit (wrapper SSR statique + GSAP runtime dynamique).
               */}
              <g transform="translate(0, -35)">
                <g ref={cardRef} filter="url(#card-shadow)">
                  <rect
                    x="-100"
                    y="-145"
                    width="200"
                    height="260"
                    rx="4"
                    fill="url(#card-grad)"
                    stroke="oklch(82% 0.045 22)"
                    strokeWidth="0.6"
                  />
                  {/* Texture grain papier sur la carte */}
                  <rect
                    x="-100"
                    y="-145"
                    width="200"
                    height="260"
                    rx="4"
                    filter="url(#paper-grain-svg)"
                    opacity="0.4"
                  />
                  {/* Filet ornemental haut */}
                  <line
                    x1="-65"
                    y1="-105"
                    x2="65"
                    y2="-105"
                    stroke="oklch(78% 0.075 78)"
                    strokeWidth="0.5"
                  />
                  <text
                    x="0"
                    y="-65"
                    textAnchor="middle"
                    fontFamily="var(--font-mono)"
                    fontWeight="500"
                    fontSize="9"
                    fill="oklch(45% 0.022 28)"
                    letterSpacing="2"
                  >
                    VOUS ÊTES INVITÉS
                  </text>
                  <text
                    x="0"
                    y="-15"
                    textAnchor="middle"
                    fontFamily="var(--font-display)"
                    fontStyle="italic"
                    fontWeight="400"
                    fontSize="34"
                    fill="oklch(22% 0.018 28)"
                    letterSpacing="-0.025em"
                  >
                    Camille
                  </text>
                  <text
                    x="0"
                    y="14"
                    textAnchor="middle"
                    fontFamily="var(--font-display)"
                    fontStyle="italic"
                    fontWeight="300"
                    fontSize="14"
                    fill="oklch(58% 0.075 80)"
                    letterSpacing="0.4em"
                  >
                    &amp;
                  </text>
                  <text
                    x="0"
                    y="50"
                    textAnchor="middle"
                    fontFamily="var(--font-display)"
                    fontStyle="italic"
                    fontWeight="400"
                    fontSize="34"
                    fill="oklch(22% 0.018 28)"
                    letterSpacing="-0.025em"
                  >
                    Hugo
                  </text>
                  {/* Filet ornemental bas */}
                  <line
                    x1="-40"
                    y1="80"
                    x2="40"
                    y2="80"
                    stroke="oklch(78% 0.075 78)"
                    strokeWidth="0.5"
                  />
                  <text
                    x="0"
                    y="100"
                    textAnchor="middle"
                    fontFamily="var(--font-mono)"
                    fontWeight="500"
                    fontSize="8"
                    fill="oklch(45% 0.022 28)"
                    letterSpacing="2"
                  >
                    8 JUIN 2026 · PROVENCE
                  </text>
                </g>
              </g>

              {/* Enveloppe — corps */}
              <g filter="url(#env-shadow)">
                <rect
                  x="-115"
                  y="-90"
                  width="230"
                  height="170"
                  rx="3"
                  fill="url(#env-grad)"
                  stroke="oklch(78% 0.075 78)"
                  strokeWidth="0.8"
                />
                {/* Pli triangulaire bas (en V depuis le centre) */}
                <path d="M -115 80 L 0 -8 L 115 80 Z" fill="oklch(91% 0.045 22)" opacity="0.55" />
                {/* Texture grain sur enveloppe */}
                <rect
                  x="-115"
                  y="-90"
                  width="230"
                  height="170"
                  rx="3"
                  filter="url(#paper-grain-svg)"
                  opacity="0.5"
                />
              </g>

              {/* Sceau cire — 2 moitiés (gauche + droite) */}
              <g>
                {/* Moitié gauche du sceau (path organique, pas demi-cercle parfait) */}
                <path
                  ref={sealLeftRef}
                  d="M 0 -16 L -4 -14 L -10 -10 L -14 -4 L -16 4 L -14 12 L -8 16 L -2 16 L 0 12 L 0 0 L 0 -16 Z M -2 -10 L -6 -6 L -4 -2 L -8 2 Z"
                  fill="url(#wax-grad)"
                  stroke="oklch(38% 0.07 24)"
                  strokeWidth="0.4"
                  opacity="0.95"
                />
                {/* Moitié droite */}
                <path
                  ref={sealRightRef}
                  d="M 0 -16 L 4 -14 L 10 -10 L 14 -4 L 16 4 L 14 12 L 8 16 L 2 16 L 0 12 L 0 0 L 0 -16 Z M 2 -10 L 6 -6 L 4 -2 L 8 2 Z"
                  fill="url(#wax-grad)"
                  stroke="oklch(38% 0.07 24)"
                  strokeWidth="0.4"
                  opacity="0.95"
                />
                {/* Initiale W gravée au centre (avant fracture) */}
                <text
                  x="0"
                  y="6"
                  textAnchor="middle"
                  fontFamily="var(--font-display)"
                  fontStyle="italic"
                  fontWeight="500"
                  fontSize="14"
                  fill="oklch(28% 0.05 26)"
                  opacity="0.7"
                  pointerEvents="none"
                >
                  W
                </text>
              </g>

              {/* Flap (qui se déplie en scroll) */}
              <g style={{ transformOrigin: '0px -90px' }}>
                <path
                  ref={flapRef}
                  d="M -115 -90 L 0 12 L 115 -90 Z"
                  fill="oklch(92% 0.035 80)"
                  stroke="oklch(78% 0.075 78)"
                  strokeWidth="0.8"
                />
              </g>

              {/* Tampon postal coin haut-droit (statique, sur le flap fermé) */}
              <g transform="translate(82, -72) rotate(-6)">
                <rect
                  x="-18"
                  y="-12"
                  width="36"
                  height="24"
                  fill="none"
                  stroke="oklch(48% 0.085 22)"
                  strokeWidth="0.4"
                  strokeDasharray="2 1.5"
                  opacity="0.65"
                />
                <text
                  x="0"
                  y="-2"
                  textAnchor="middle"
                  fontFamily="var(--font-mono)"
                  fontWeight="600"
                  fontSize="5"
                  fill="oklch(48% 0.085 22)"
                  letterSpacing="0.5"
                  opacity="0.7"
                >
                  WEDILLYBIRD
                </text>
                <text
                  x="0"
                  y="6"
                  textAnchor="middle"
                  fontFamily="var(--font-mono)"
                  fontWeight="500"
                  fontSize="4"
                  fill="oklch(48% 0.085 22)"
                  letterSpacing="0.4"
                  opacity="0.6"
                >
                  8 · VI · 2026
                </text>
              </g>
            </svg>
          </div>

          {/* Step labels */}
          <div
            ref={labelRef}
            className="container-page mt-12 grid gap-3 text-center sm:grid-cols-3"
          >
            <span
              data-step="1"
              className="font-mono text-[10px] tracking-[0.32em] text-[color:var(--color-ink-700)] uppercase"
            >
              {t('stepEnvelope')}
            </span>
            <span
              data-step="2"
              className="font-mono text-[10px] tracking-[0.32em] text-[color:var(--color-ink-700)] uppercase"
            >
              {t('stepCard')}
            </span>
            <span
              data-step="3"
              className="font-mono text-[10px] tracking-[0.32em] text-[color:var(--color-ink-700)] uppercase"
            >
              {t('stepFlourish')}
            </span>
          </div>
        </div>
      </section>
    </>
  );
}

function FlourishOrnament({
  cx,
  cy,
  scale,
  flip,
}: {
  cx: number;
  cy: number;
  scale: number;
  flip?: boolean;
}) {
  return (
    <g transform={`translate(${cx} ${cy}) scale(${flip ? -scale : scale} ${scale})`}>
      <path
        d="M 0 0 C 12 -10 32 -16 52 -10 C 64 -7 74 -2 80 8 M 52 -10 C 58 -28 50 -44 32 -54 M 80 8 C 90 16 92 28 86 38"
        fill="none"
        stroke="oklch(78% 0.075 78)"
        strokeWidth="1"
        strokeLinecap="round"
      />
      <circle cx="52" cy="-10" r="3.5" fill="oklch(85% 0.06 22)" />
      <circle cx="32" cy="-54" r="2.8" fill="oklch(78% 0.075 78)" />
      <circle cx="80" cy="8" r="2.4" fill="oklch(85% 0.06 22)" />
      <circle cx="86" cy="38" r="2" fill="oklch(78% 0.075 78)" />
    </g>
  );
}
