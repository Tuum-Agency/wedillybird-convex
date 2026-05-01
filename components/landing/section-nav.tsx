'use client';

import { useEffect, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/cn';

type SectionItem = {
  id: string;
  label: string;
};

// Ordre = ordre d'apparition au scroll dans la page (features → testimonials
// → pricing). Déroger à cet ordre fait sauter l'underline en arrière quand
// l'utilisateur scrolle, ce qui casse la perception de progression.
const ITEMS: readonly SectionItem[] = [
  { id: 'features', label: 'Piliers' },
  { id: 'testimonials', label: 'Témoignages' },
  { id: 'pricing', label: 'Tarifs' },
];

/**
 * Liens d'ancres avec indicateur de section active.
 *
 * Observe les sections `#features`, `#pricing`, `#testimonials` via
 * IntersectionObserver et applique une classe `active` au lien
 * correspondant à la section la plus visible (ratio d'intersection le
 * plus élevé). Le rootMargin négatif côté top compense la hauteur du
 * header sticky pour que la transition se fasse quand la section
 * "remplace" la précédente sous la nav.
 */
export function SectionNav() {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const sections = ITEMS.map((item) => document.getElementById(item.id)).filter(
      (el): el is HTMLElement => el !== null,
    );
    if (sections.length === 0) return;

    const visibility = new Map<string, number>();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          visibility.set(entry.target.id, entry.intersectionRatio);
        }
        let topId: string | null = null;
        let topRatio = 0;
        for (const [id, ratio] of visibility) {
          if (ratio > topRatio) {
            topRatio = ratio;
            topId = id;
          }
        }
        setActiveId(topRatio > 0.15 ? topId : null);
      },
      {
        rootMargin: '-72px 0px -40% 0px',
        threshold: [0, 0.15, 0.3, 0.5, 0.75, 1],
      },
    );

    for (const section of sections) observer.observe(section);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      {ITEMS.map((item) => {
        const isActive = activeId === item.id;
        return (
          <Link
            key={item.id}
            href={`/#${item.id}` as never}
            aria-current={isActive ? 'true' : undefined}
            className={cn(
              'relative font-mono text-[10px] tracking-[0.24em] uppercase transition-colors',
              isActive
                ? 'text-[color:var(--color-ink-900)]'
                : 'text-[color:var(--color-ink-500)] hover:text-[color:var(--color-ink-900)]',
            )}
          >
            {item.label}
            <span
              aria-hidden
              className={cn(
                'absolute -bottom-1.5 left-0 h-px bg-[color:var(--color-gold-500)] transition-[width,opacity] duration-300 ease-out',
                isActive ? 'w-full opacity-100' : 'w-0 opacity-0',
              )}
            />
          </Link>
        );
      })}
    </>
  );
}
