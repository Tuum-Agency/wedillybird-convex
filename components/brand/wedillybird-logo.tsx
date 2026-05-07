import Image from 'next/image';
import { cn } from '@/lib/cn';

interface WedillybirdLogoProps {
  className?: string;
  priority?: boolean;
}

export function WedillybirdLogo({ className, priority = false }: WedillybirdLogoProps) {
  return (
    <Image
      src="/wedillybird-logo.png"
      alt="Wedillybird"
      width={2001}
      height={551}
      priority={priority}
      sizes="(max-width: 640px) 208px, 224px"
      className={cn('h-auto w-52 sm:w-56', className)}
    />
  );
}
