'use client';

import { Drawer as VaulDrawer } from 'vaul';
import { cn } from '@/lib/cn';
import type { ComponentProps, ReactNode } from 'react';

/**
 * Vaul wrapper — drawer mobile-first (bottom sheet) avec rebond et pull-to-close
 * gestures. Sur desktop on l'utilise pour les détails invité, modération photo,
 * confirmation suppression. Sur mobile c'est le pattern privilégié vs modal.
 */

export const Drawer = VaulDrawer.Root;
export const DrawerTrigger = VaulDrawer.Trigger;
export const DrawerClose = VaulDrawer.Close;

export function DrawerContent({
  className,
  children,
  ...props
}: ComponentProps<typeof VaulDrawer.Content> & { children: ReactNode }) {
  return (
    <VaulDrawer.Portal>
      <VaulDrawer.Overlay className="fixed inset-0 z-40 bg-[color:var(--color-night-900)]/40 backdrop-blur-[2px]" />
      <VaulDrawer.Content
        className={cn(
          'fixed inset-x-0 bottom-0 z-50 mt-24 flex flex-col rounded-t-3xl',
          'border-t border-[color:var(--color-border-strong)]',
          'bg-[color:var(--color-surface)]',
          'shadow-[var(--shadow-popover)]',
          'max-h-[92dvh]',
          className,
        )}
        {...props}
      >
        <div
          aria-hidden
          className="bg-[color:var(--color-border-strong)] mx-auto mt-3 mb-2 h-1.5 w-12 rounded-full"
        />
        <div className="flex flex-col overflow-y-auto px-5 pb-6">{children}</div>
      </VaulDrawer.Content>
    </VaulDrawer.Portal>
  );
}

export function DrawerHeader({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('flex flex-col gap-1 py-3 text-left', className)}>{children}</div>;
}

export function DrawerTitle({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <VaulDrawer.Title
      className={cn(
        'font-display text-xl text-[color:var(--color-foreground)] italic',
        className,
      )}
    >
      {children}
    </VaulDrawer.Title>
  );
}

export function DrawerDescription({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <VaulDrawer.Description
      className={cn('text-sm text-[color:var(--color-muted-foreground)]', className)}
    >
      {children}
    </VaulDrawer.Description>
  );
}
