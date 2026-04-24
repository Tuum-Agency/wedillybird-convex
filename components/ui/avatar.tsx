import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

interface AvatarProps extends HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg';
}

const sizeMap = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-base',
};

export const Avatar = forwardRef<HTMLDivElement, AvatarProps>(
  ({ className, size = 'md', ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center overflow-hidden rounded-full bg-[color:var(--color-ivory-200)] font-medium text-[color:var(--color-night-700)]',
        sizeMap[size],
        className,
      )}
      {...props}
    />
  ),
);
Avatar.displayName = 'Avatar';

type AvatarImageProps = React.ImgHTMLAttributes<HTMLImageElement>;

export const AvatarImage = forwardRef<HTMLImageElement, AvatarImageProps>(
  ({ className, alt = '', ...props }, ref) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img ref={ref} alt={alt} className={cn('h-full w-full object-cover', className)} {...props} />
  ),
);
AvatarImage.displayName = 'AvatarImage';

export function AvatarFallback({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <span className={cn('uppercase select-none', className)}>{children}</span>;
}
