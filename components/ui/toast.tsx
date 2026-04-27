'use client';

import { Toaster as SonnerToaster, toast } from 'sonner';

/**
 * Sonner wrapper aux tokens Wedillybird. À mounter une fois dans le layout
 * root (sous `<NextIntlClientProvider>`).
 *
 * Position : drawer-from-bottom mobile (default Sonner), top-right desktop.
 * Stacking : 3 max (visibleToasts), auto-dismiss 4 s.
 */
export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-center"
      visibleToasts={3}
      duration={4000}
      richColors
      theme="system"
      closeButton
      offset={16}
      toastOptions={{
        classNames: {
          toast:
            'rounded-2xl border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface)] shadow-[var(--shadow-popover)]',
          title: 'text-sm font-medium text-[color:var(--color-foreground)]',
          description: 'text-xs text-[color:var(--color-muted-foreground)]',
          success: 'border-[color:var(--color-success)]/40',
          error: 'border-[color:var(--color-danger)]/40',
        },
      }}
    />
  );
}

export { toast };
