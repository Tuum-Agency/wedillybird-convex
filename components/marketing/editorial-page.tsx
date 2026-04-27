'use client';

import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';

/**
 * EditorialPage — wrapper Motion pour les pages publiques éditoriales
 * (FAQ, CGU, Privacy, Cookies). Anim sobre fade-in stagger sur header
 * + contenu.
 */
interface Props {
  eyebrow?: string;
  title: string;
  lastUpdated?: string;
  children: ReactNode;
}

export function EditorialPage({ eyebrow, title, lastUpdated, children }: Props) {
  const reduced = useReducedMotion();

  const containerVariants = {
    hidden: {},
    visible: {
      transition: { staggerChildren: reduced ? 0 : 0.07, delayChildren: 0.05 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: reduced ? 0 : 12 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: 'easeOut' as const } },
  };

  return (
    <motion.article
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="paper-grain mx-auto flex w-full max-w-3xl flex-col gap-12"
    >
      <motion.header variants={itemVariants} className="flex flex-col gap-5">
        {eyebrow && (
          <span className="font-mono text-[10px] tracking-[0.32em] text-[color:var(--color-gold-700)] uppercase">
            {eyebrow}
          </span>
        )}
        <h1
          className="font-display text-balance italic"
          style={{
            fontSize: 'clamp(2rem, 4vw, 3.25rem)',
            lineHeight: 1.05,
            letterSpacing: '-0.022em',
            color: 'var(--color-ink-900)',
          }}
        >
          {title}
        </h1>
        {lastUpdated && (
          <p className="font-mono text-[10px] tracking-[0.24em] text-[color:var(--color-ink-500)] uppercase">
            {lastUpdated}
          </p>
        )}
        {/* Filet ornemental gold */}
        <span
          aria-hidden
          className="mt-2 inline-block h-px w-16"
          style={{ background: 'oklch(78% 0.075 78)' }}
        />
      </motion.header>

      <motion.div variants={itemVariants} className="flex flex-col gap-10">
        {children}
      </motion.div>
    </motion.article>
  );
}

/**
 * EditorialSection — section avec h2 éditorial + body. Pour CGU, Privacy,
 * Cookies. Sépare visuellement les articles.
 */
export function EditorialSection({ title, body }: { title: string; body: string }) {
  return (
    <section className="flex flex-col gap-3">
      <h2
        className="font-display italic"
        style={{
          fontSize: 'clamp(1.25rem, 1.8vw, 1.625rem)',
          lineHeight: 1.2,
          letterSpacing: '-0.018em',
          color: 'var(--color-ink-900)',
        }}
      >
        {title}
      </h2>
      <p className="text-base leading-relaxed whitespace-pre-line text-[color:var(--color-ink-700)]">
        {body}
      </p>
    </section>
  );
}
