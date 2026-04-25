import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

/**
 * Branded skeleton loader. Le shimmer (gradient terracotta) est défini dans
 * `globals.css` via l'utility `shimmer`. Pas de gris générique.
 */
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Chargement…"
      className={cn(
        'shimmer rounded-md',
        // Fallback solide (sans le shimmer) pour reduced-motion users.
        'motion-reduce:bg-[color:var(--color-brand-100)] motion-reduce:animate-none',
        className,
      )}
      {...props}
    />
  );
}
