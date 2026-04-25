import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

const buttonVariants = cva(
  [
    'focus-ring inline-flex items-center justify-center gap-2 font-medium',
    'transition-[transform,background-color,box-shadow,color] duration-150',
    'disabled:pointer-events-none disabled:opacity-50',
    // Hover lift uniquement desktop (cf. redesign-direction.md pattern 2).
    '@media(hover:hover){hover:-translate-y-px}',
    'active:translate-y-0 active:scale-[0.99]',
  ].join(' '),
  {
    variants: {
      variant: {
        primary: [
          'bg-[color:var(--color-primary)] text-[color:var(--color-primary-foreground)]',
          'shadow-[var(--shadow-soft)]',
          'hover:bg-[color:var(--color-primary-hover)] hover:shadow-[var(--shadow-lifted)]',
        ].join(' '),
        accent: [
          'bg-[color:var(--color-accent)] text-[color:var(--color-accent-foreground)]',
          'shadow-[var(--shadow-soft)]',
          'hover:bg-[color:var(--color-sage-700)] hover:shadow-[var(--shadow-lifted)]',
        ].join(' '),
        outline: [
          'border border-[color:var(--color-border-strong)] bg-transparent',
          'text-[color:var(--color-foreground)]',
          'hover:bg-[color:var(--color-surface-elevated)] hover:border-[color:var(--color-primary)]',
        ].join(' '),
        ghost:
          'bg-transparent text-[color:var(--color-foreground)] hover:bg-[color:var(--color-surface-elevated)]',
        link: 'text-[color:var(--color-primary)] underline-offset-4 hover:underline hover:translate-y-0',
        destructive: [
          'bg-[color:var(--color-danger)] text-white shadow-[var(--shadow-soft)]',
          'hover:opacity-90 hover:shadow-[var(--shadow-lifted)]',
        ].join(' '),
        soft: [
          'bg-[color:var(--color-primary-soft)] text-[color:var(--color-primary)]',
          'hover:bg-[color:var(--color-brand-100)]',
        ].join(' '),
      },
      size: {
        sm: 'h-9 rounded-md px-3 text-sm',
        md: 'h-11 rounded-lg px-5 text-sm',
        lg: 'h-12 rounded-xl px-6 text-base',
        xl: 'h-14 rounded-2xl px-8 text-base',
        icon: 'h-10 w-10 rounded-lg',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
    );
  },
);
Button.displayName = 'Button';

export { buttonVariants };
