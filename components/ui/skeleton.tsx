import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

/**
 * Branded skeleton loader. Le shimmer (gradient terracotta) est défini dans
 * `globals.css` via l'utility `shimmer`. Pas de gris générique.
 *
 * Accessibilité : `role="status"` + `aria-busy="true"` suffisent à signaler
 * un état de chargement aux screen readers (annoncé selon la locale de
 * l'agent utilisateur). Le caller peut surcharger via la prop `aria-label`
 * (déjà traduite côté composant parent) si un libellé explicite est utile.
 */
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="status"
      aria-busy="true"
      className={cn(
        'shimmer rounded-md',
        // Fallback solide (sans le shimmer) pour reduced-motion users.
        'motion-reduce:animate-none motion-reduce:bg-[color:var(--color-brand-100)]',
        className,
      )}
      {...props}
    />
  );
}
