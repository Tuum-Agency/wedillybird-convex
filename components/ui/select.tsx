'use client';

import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

/**
 * Select (shadcn/Radix) thémé pour le design system Wedillybird — tokens OKLCH,
 * donc adapté **dark agence** et **light éditorial** via `data-theme`. Remplace
 * les `<select>` natifs partout SAUF les sélecteurs de mariage/événement (qui
 * utilisent `WeddingSelect`).
 *
 * Intégration formulaire : passer `name` (+ `defaultValue`) à `Select` — Radix
 * rend un select natif caché, donc `FormData.get(name)` fonctionne comme avant.
 */

export const Select = SelectPrimitive.Root;
export const SelectGroup = SelectPrimitive.Group;
export const SelectValue = SelectPrimitive.Value;

export function SelectTrigger({
  className,
  children,
  ...props
}: ComponentProps<typeof SelectPrimitive.Trigger>) {
  return (
    <SelectPrimitive.Trigger
      className={cn(
        'focus-ring inline-flex h-11 w-full cursor-pointer items-center justify-between gap-2 rounded-lg border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface-elevated)] px-3 text-sm text-[color:var(--color-foreground)] transition-colors hover:border-[color:var(--color-blush-400)] disabled:cursor-not-allowed disabled:opacity-50 data-[placeholder]:text-[color:var(--color-muted-foreground)] [&>span]:truncate',
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDown
          className="h-4 w-4 flex-shrink-0 text-[color:var(--color-muted-foreground)]"
          strokeWidth={1.9}
          aria-hidden
        />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

export function SelectContent({
  className,
  children,
  position = 'popper',
  ...props
}: ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        position={position}
        className={cn(
          'relative z-50 max-h-[var(--radix-select-content-available-height)] min-w-[8rem] overflow-hidden rounded-xl border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface)] text-[color:var(--color-foreground)] shadow-[var(--shadow-popover)]',
          'data-[state=open]:animate-scale-in',
          position === 'popper' &&
            'data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1',
          className,
        )}
        {...props}
      >
        <SelectPrimitive.ScrollUpButton className="flex cursor-default items-center justify-center py-1 text-[color:var(--color-muted-foreground)]">
          <ChevronUp className="h-4 w-4" strokeWidth={1.9} aria-hidden />
        </SelectPrimitive.ScrollUpButton>
        <SelectPrimitive.Viewport
          className={cn(
            'p-1',
            position === 'popper' && 'w-full min-w-[var(--radix-select-trigger-width)]',
          )}
        >
          {children}
        </SelectPrimitive.Viewport>
        <SelectPrimitive.ScrollDownButton className="flex cursor-default items-center justify-center py-1 text-[color:var(--color-muted-foreground)]">
          <ChevronDown className="h-4 w-4" strokeWidth={1.9} aria-hidden />
        </SelectPrimitive.ScrollDownButton>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

export function SelectLabel({ className, ...props }: ComponentProps<typeof SelectPrimitive.Label>) {
  return (
    <SelectPrimitive.Label
      className={cn(
        'px-2 py-1.5 font-mono text-[10px] tracking-[0.16em] text-[color:var(--color-muted-foreground)] uppercase',
        className,
      )}
      {...props}
    />
  );
}

export function SelectItem({
  className,
  children,
  ...props
}: ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      className={cn(
        'relative flex w-full cursor-pointer items-center rounded-lg py-1.5 pr-8 pl-2.5 text-sm outline-none select-none',
        'focus:bg-[color:var(--color-surface-elevated)] data-[state=checked]:bg-[color:var(--color-surface-elevated)]',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className,
      )}
      {...props}
    >
      <span className="absolute right-2.5 flex h-3.5 w-3.5 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <Check
            className="h-3.5 w-3.5 text-[color:var(--color-blush-300)]"
            strokeWidth={2.4}
            aria-hidden
          />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}

export function SelectSeparator({
  className,
  ...props
}: ComponentProps<typeof SelectPrimitive.Separator>) {
  return (
    <SelectPrimitive.Separator
      className={cn('-mx-1 my-1 h-px bg-[color:var(--color-border)]', className)}
      {...props}
    />
  );
}
