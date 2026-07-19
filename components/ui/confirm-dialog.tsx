'use client';

import { useCallback, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export type ConfirmOptions = {
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Action irréversible → bouton de confirmation en rouge. */
  destructive?: boolean;
};

type Pending = ConfirmOptions & { resolve: (value: boolean) => void };

/**
 * Remplace le `confirm()` natif du navigateur par une modale Dialog thémée
 * (règle projet : toujours Dialog, jamais de dialogue système). Le portail hérite
 * du thème (dark agence / light couple) via {@link useUiTheme}. API impérative
 * promisifiée pour une adoption minimale au point d'appel :
 *
 *   const { confirm, confirmDialog } = useConfirm();
 *   // dans un handler rendu `async` :
 *   if (!(await confirm({ title: t('confirmRemove'), destructive: true }))) return;
 *   // une seule fois dans le JSX du composant :
 *   {confirmDialog}
 */
export function useConfirm() {
  const t = useTranslations('Common');
  const [pending, setPending] = useState<Pending | null>(null);

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => setPending({ ...options, resolve })),
    [],
  );

  const settle = useCallback((value: boolean) => {
    setPending((current) => {
      current?.resolve(value);
      return null;
    });
  }, []);

  const confirmDialog = (
    <Dialog
      open={pending != null}
      onOpenChange={(open) => {
        if (!open) settle(false);
      }}
    >
      {pending ? (
        <DialogContent
          className="max-w-sm"
          showClose={false}
          {...(pending.description ? {} : { 'aria-describedby': undefined })}
        >
          <DialogHeader>
            <DialogTitle>{pending.title}</DialogTitle>
            {pending.description ? (
              <DialogDescription>{pending.description}</DialogDescription>
            ) : null}
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" size="md" type="button" onClick={() => settle(false)}>
              {pending.cancelLabel ?? t('cancel')}
            </Button>
            <Button
              variant={pending.destructive ? 'destructive' : 'primary'}
              size="md"
              type="button"
              autoFocus
              onClick={() => settle(true)}
            >
              {pending.confirmLabel ?? t('confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      ) : null}
    </Dialog>
  );

  return { confirm, confirmDialog };
}
