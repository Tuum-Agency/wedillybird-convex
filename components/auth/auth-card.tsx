'use client';

import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';

/**
 * AuthCard — wrapper d'animation Motion pour les pages auth V4.
 *
 * Niveau Motion B (sobre) : fade-in + slide-up à l'entrée, stagger doux entre
 * eyebrow / titre / description / form. Désactivé en prefers-reduced-motion.
 *
 * Eyebrow chapter mono caps + titre Bodoni Moda Italic + description Geist —
 * cohérent avec la grammaire éditoriale de la landing V4.
 */
interface Props {
  /** Eyebrow en mono caps tracking large (ex: "ÉTAPE 01 — IDENTITÉ"). Optionnel. */
  eyebrow?: string;
  /** Titre principal — toujours en Bodoni Moda Italic via font-display. */
  title: string;
  /** Description sous-titre (Geist). Optionnelle. */
  description?: string;
  /** Contenu principal (formulaire) */
  children: ReactNode;
  /** Slot bas (lien retour, switch step, etc.) */
  footer?: ReactNode;
}

export function AuthCard({ eyebrow, title, description, children, footer }: Props) {
  const reduced = useReducedMotion();

  const containerVariants = {
    hidden: {},
    visible: {
      transition: { staggerChildren: reduced ? 0 : 0.07, delayChildren: 0.05 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: reduced ? 0 : 12 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' as const } },
  };

  return (
    <motion.section
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="flex flex-col gap-8"
    >
      <motion.header variants={itemVariants} className="flex flex-col gap-3">
        {eyebrow && (
          <span className="font-mono text-[10px] tracking-[0.32em] text-[color:var(--color-gold-700)] uppercase">
            {eyebrow}
          </span>
        )}
        <h1
          className="font-display text-balance italic"
          style={{
            fontSize: 'clamp(1.875rem, 3vw, 2.5rem)',
            lineHeight: 1.05,
            letterSpacing: '-0.022em',
            color: 'var(--color-ink-900)',
          }}
        >
          {title}
        </h1>
        {description && (
          <p className="text-sm leading-relaxed text-[color:var(--color-ink-500)] sm:text-base">
            {description}
          </p>
        )}
      </motion.header>

      <motion.div variants={itemVariants} className="flex flex-col gap-5">
        {children}
      </motion.div>

      {footer && (
        <motion.div
          variants={itemVariants}
          className="border-t border-[color:var(--color-border)] pt-5"
        >
          {footer}
        </motion.div>
      )}
    </motion.section>
  );
}
