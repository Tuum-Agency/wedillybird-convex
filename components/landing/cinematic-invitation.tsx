'use client';

import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useReducedMotion } from 'motion/react';

/**
 * Landing — Cinématique invitation V3.
 *
 * Scroll-driven storytelling : enveloppe scellée → flap qui s'ouvre →
 * carte qui sort vers le haut → motifs floraux qui apparaissent autour.
 *
 * Implémentation : GSAP timeline pinned avec ScrollTrigger, contrôlée par
 * la position de scroll. Pas de timeline auto-play — l'utilisateur déroule
 * la séquence à son rythme. Désactivée en `prefers-reduced-motion` (la
 * carte s'affiche directement, sans animation).
 *
 * Plugin ScrollTrigger lazy-importé pour ne pas plomber le bundle initial.
 */
export function LandingCinematicInvitation() {
  const t = useTranslations('Landing.cinematic');
  const reduced = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const envelopeRef = useRef<SVGSVGElement>(null);
  const flapRef = useRef<SVGPathElement>(null);
  const cardRef = useRef<SVGGElement>(null);
  const flourishRef = useRef<SVGGElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);

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
            end: '+=180%',
            pin: true,
            scrub: 0.6,
            anticipatePin: 1,
          },
        });

        // Step 1 : enveloppe centrée et fermée → flap se déplie vers le haut
        tl.to(
          flapRef.current,
          {
            rotateX: -180,
            transformOrigin: '50% 0%',
            duration: 1,
            ease: 'power2.inOut',
          },
          0,
        );

        // Step 2 : carte sort par le haut
        tl.to(
          cardRef.current,
          {
            y: -180,
            duration: 1.2,
            ease: 'power2.out',
          },
          0.6,
        );

        // Step 3 : motifs floraux s'élèvent et fadent in
        tl.fromTo(
          flourishRef.current,
          { opacity: 0, scale: 0.7 },
          { opacity: 1, scale: 1, duration: 1, ease: 'power3.out' },
          1.2,
        );

        // Step labels qui s'enchaînent
        const labels = Array.from(labelRef.current?.querySelectorAll('[data-step]') ?? []);
        if (labels.length === 3) {
          const [l1, l2, l3] = labels as [Element, Element, Element];
          gsap.set(labels, { opacity: 0, y: 8 });
          tl.to(l1, { opacity: 1, y: 0 }, 0);
          tl.to(l1, { opacity: 0.3 }, 0.55);
          tl.to(l2, { opacity: 1, y: 0 }, 0.55);
          tl.to(l2, { opacity: 0.3 }, 1.15);
          tl.to(l3, { opacity: 1, y: 0 }, 1.15);
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
    <section
      ref={containerRef}
      className="relative overflow-hidden bg-[color:var(--color-ivory-50)] py-24"
      style={{ minHeight: '100vh' }}
    >
      <div className="container-page flex flex-col items-center gap-3 text-center">
        <span className="text-xs font-medium tracking-[0.2em] text-[color:var(--color-champagne-700)] uppercase">
          {t('eyebrow')}
        </span>
        <h2
          className="font-display max-w-3xl text-balance italic"
          style={{
            fontSize: 'clamp(2rem, 5vw, 3.5rem)',
            lineHeight: 1.05,
            letterSpacing: '-0.022em',
          }}
        >
          {t('title')}
        </h2>
        <p className="max-w-xl text-base text-[color:var(--color-ink-500)]">{t('subtitle')}</p>
      </div>

      {/* Stage SVG */}
      <div className="relative mx-auto mt-12 flex items-center justify-center">
        <svg
          ref={envelopeRef}
          viewBox="-200 -250 400 500"
          className="h-[60vh] max-h-[480px] w-auto"
          aria-label="Enveloppe et carte d'invitation animées"
          role="img"
        >
          {/* Motifs floraux derrière (initialement masqués) */}
          <g ref={flourishRef}>
            <FlourishOrnament cx={-140} cy={-180} scale={0.7} />
            <FlourishOrnament cx={140} cy={-180} scale={0.7} flip />
            <FlourishOrnament cx={-160} cy={20} scale={0.5} />
            <FlourishOrnament cx={160} cy={20} scale={0.5} flip />
          </g>

          {/* Carte (derrière l'enveloppe initialement) */}
          <g ref={cardRef}>
            <rect
              x="-95"
              y="-130"
              width="190"
              height="240"
              rx="6"
              fill="url(#cardGrad)"
              stroke="oklch(82% 0.045 22)"
              strokeWidth="0.5"
            />
            <text
              x="0"
              y="-50"
              textAnchor="middle"
              fontFamily="var(--font-display)"
              fontStyle="italic"
              fontWeight="300"
              fontSize="14"
              fill="oklch(48% 0.085 22)"
              letterSpacing="0.2em"
            >
              VOUS ÊTES INVITÉS
            </text>
            <text
              x="0"
              y="-5"
              textAnchor="middle"
              fontFamily="var(--font-display)"
              fontStyle="italic"
              fontWeight="400"
              fontSize="32"
              fill="oklch(28% 0.02 28)"
              letterSpacing="-0.025em"
            >
              Camille
            </text>
            <text
              x="0"
              y="22"
              textAnchor="middle"
              fontFamily="var(--font-display)"
              fontStyle="italic"
              fontWeight="300"
              fontSize="12"
              fill="oklch(58% 0.075 80)"
              letterSpacing="0.4em"
            >
              &amp;
            </text>
            <text
              x="0"
              y="55"
              textAnchor="middle"
              fontFamily="var(--font-display)"
              fontStyle="italic"
              fontWeight="400"
              fontSize="32"
              fill="oklch(28% 0.02 28)"
              letterSpacing="-0.025em"
            >
              Hugo
            </text>
            {/* Filet ornemental */}
            <line x1="-40" y1="78" x2="40" y2="78" stroke="oklch(78% 0.075 78)" strokeWidth="0.5" />
            <text
              x="0"
              y="100"
              textAnchor="middle"
              fontFamily="var(--font-sans)"
              fontSize="9"
              fill="oklch(45% 0.022 28)"
              letterSpacing="0.15em"
            >
              8 JUIN 2026 · PROVENCE
            </text>
          </g>

          {/* Enveloppe — corps */}
          <rect
            x="-110"
            y="-80"
            width="220"
            height="160"
            rx="4"
            fill="oklch(95% 0.025 22)"
            stroke="oklch(82% 0.045 22)"
            strokeWidth="1"
          />
          {/* Lignes de pli triangulaires bas */}
          <path d="M -110 80 L 0 -10 L 110 80 Z" fill="oklch(91% 0.045 22)" opacity="0.6" />
          {/* Sceau gold central */}
          <circle
            cx="0"
            cy="0"
            r="14"
            fill="oklch(78% 0.075 78)"
            stroke="oklch(58% 0.075 80)"
            strokeWidth="1"
          />
          <text
            x="0"
            y="4"
            textAnchor="middle"
            fontFamily="var(--font-display)"
            fontStyle="italic"
            fontSize="12"
            fill="oklch(98% 0.012 90)"
          >
            W
          </text>

          {/* Flap (qui se déplie en scroll) */}
          <path
            ref={flapRef}
            d="M -110 -80 L 0 10 L 110 -80 Z"
            fill="oklch(92% 0.035 80)"
            stroke="oklch(78% 0.075 78)"
            strokeWidth="1"
          />

          {/* Defs */}
          <defs>
            <linearGradient id="cardGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="oklch(98.5% 0.008 85)" />
              <stop offset="100%" stopColor="oklch(95% 0.025 22)" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Step labels */}
      <div ref={labelRef} className="container-page mt-12 grid gap-3 text-center sm:grid-cols-3">
        <span
          data-step="1"
          className="text-sm tracking-wide text-[color:var(--color-ink-500)] uppercase"
        >
          {t('stepEnvelope')}
        </span>
        <span
          data-step="2"
          className="text-sm tracking-wide text-[color:var(--color-ink-500)] uppercase"
        >
          {t('stepCard')}
        </span>
        <span
          data-step="3"
          className="text-sm tracking-wide text-[color:var(--color-ink-500)] uppercase"
        >
          {t('stepFlourish')}
        </span>
      </div>

      <p className="mt-10 text-center text-xs text-[color:var(--color-ink-300)] italic">
        {t('caption')}
      </p>
    </section>
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
        d="M 0 0 C 10 -10 30 -15 50 -10 C 60 -8 70 -3 75 5 M 50 -10 C 55 -25 50 -40 35 -50"
        fill="none"
        stroke="oklch(78% 0.075 78)"
        strokeWidth="1"
        strokeLinecap="round"
      />
      <circle cx="50" cy="-10" r="3" fill="oklch(85% 0.06 22)" />
      <circle cx="35" cy="-50" r="2.5" fill="oklch(78% 0.075 78)" />
      <circle cx="75" cy="5" r="2" fill="oklch(85% 0.06 22)" />
    </g>
  );
}
