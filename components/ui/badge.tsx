import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
  {
    variants: {
      variant: {
        neutral:
          'bg-[color:var(--color-ivory-100)] text-[color:var(--color-night-700)] dark:bg-white/10 dark:text-[color:var(--color-ivory-100)]',
        primary: 'bg-[color:var(--color-terracotta-100)] text-[color:var(--color-terracotta-700)]',
        accent: 'bg-[color:var(--color-sage-100)] text-[color:var(--color-sage-700)]',
        success: 'bg-[color:var(--color-sage-100)] text-[color:var(--color-sage-700)]',
        warning: 'bg-amber-100 text-amber-800',
        destructive: 'bg-red-100 text-red-800',
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
