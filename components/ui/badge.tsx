import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

/*
 * Variants thème-aware : fonds via tokens `*-soft` (clairs en light éditorial,
 * charbon teinté en dark agence) et texte dérivé par `color-mix` avec la couleur
 * de premier plan → toujours lisible (AA) dans les deux univers, sans jamais
 * poser une pastille pastel claire sur le back-office sombre. `dark:` n'est pas
 * utilisé (le projet thème via `[data-theme]`, pas via `prefers-color-scheme`).
 */
const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
  {
    variants: {
      variant: {
        neutral:
          'bg-[color:var(--color-surface-elevated)] text-[color:var(--color-muted-foreground)]',
        primary: 'bg-[color:var(--color-primary-soft)] text-[color:var(--color-primary)]',
        accent:
          'bg-[color:var(--color-accent-soft)] text-[color:color-mix(in_oklab,var(--color-accent),var(--color-foreground)_30%)]',
        success:
          'bg-[color:var(--color-success-soft)] text-[color:color-mix(in_oklab,var(--color-success),var(--color-foreground)_42%)]',
        warning:
          'bg-[color:var(--color-warning-soft)] text-[color:color-mix(in_oklab,var(--color-warning),var(--color-foreground)_55%)]',
        destructive:
          'bg-[color:var(--color-danger-soft)] text-[color:color-mix(in_oklab,var(--color-danger),var(--color-foreground)_40%)]',
      },
    },
    defaultVariants: {
      variant: 'neutral',
    },
  },
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
