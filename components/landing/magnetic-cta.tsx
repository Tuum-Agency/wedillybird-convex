'use client';

import { motion, useMotionValue, useSpring } from 'motion/react';
import { useEffect, useRef, type ReactNode } from 'react';
import { Link } from '@/i18n/navigation';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/cn';

/**
 * Magnetic CTA — pattern signature des sites Awwwards 2025-2026.
 *
 * Le bouton suit le curseur dans un rayon de ~80px desktop avec une elastic
 * subtle. Au hover, déclenche un confetti blush via canvas-confetti (déjà
 * installé). Tap sur mobile = comportement standard, pas de magnetic.
 *
 * Désactivé en `prefers-reduced-motion`. Désactivé sur touch-only via
 * `@media (hover: hover)` pour éviter les états bloqués.
 */
interface Props {
  href: string;
  variant?: 'primary' | 'outline';
  size?: 'lg' | 'xl';
  className?: string;
  children: ReactNode;
  withConfetti?: boolean;
}

export function MagneticCta({
  href,
  variant = 'primary',
  size = 'xl',
  className,
  children,
  withConfetti = false,
}: Props) {
  const ref = useRef<HTMLAnchorElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 200, damping: 18, mass: 0.5 });
  const sy = useSpring(y, { stiffness: 200, damping: 18, mass: 0.5 });

  useEffect(() => {
    if (!ref.current) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const hoverable = window.matchMedia('(hover: hover)').matches;
    if (reduced || !hoverable) return;

    const el = ref.current;
    function handleMove(e: MouseEvent) {
      const rect = el.getBoundingClientRect();
      const dx = e.clientX - (rect.left + rect.width / 2);
      const dy = e.clientY - (rect.top + rect.height / 2);
      const distance = Math.hypot(dx, dy);
      const maxDistance = 110;
      if (distance > maxDistance) {
        x.set(0);
        y.set(0);
      } else {
        const strength = 0.35;
        x.set(dx * strength);
        y.set(dy * strength);
      }
    }
    function handleLeave() {
      x.set(0);
      y.set(0);
    }
    function handleEnter() {
      if (!withConfetti) return;
      void (async () => {
        try {
          const confetti = (await import('canvas-confetti')).default;
          const rect = el.getBoundingClientRect();
          confetti({
            particleCount: 28,
            spread: 55,
            startVelocity: 28,
            scalar: 0.7,
            ticks: 90,
            origin: {
              x: (rect.left + rect.width / 2) / window.innerWidth,
              y: (rect.top + rect.height / 2) / window.innerHeight,
            },
            colors: ['#f5d0c5', '#e8c5b4', '#d4b896', '#fbf6ee', '#c89788'],
            disableForReducedMotion: true,
          });
        } catch {
          // canvas-confetti non chargé : silent fail.
        }
      })();
    }

    window.addEventListener('mousemove', handleMove);
    el.addEventListener('mouseleave', handleLeave);
    el.addEventListener('mouseenter', handleEnter);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      el.removeEventListener('mouseleave', handleLeave);
      el.removeEventListener('mouseenter', handleEnter);
    };
  }, [x, y, withConfetti]);

  return (
    <motion.div style={{ x: sx, y: sy }} className="inline-block">
      <Link
        ref={ref}
        href={href}
        className={cn(buttonVariants({ variant, size }), 'group', className)}
      >
        {children}
      </Link>
    </motion.div>
  );
}
