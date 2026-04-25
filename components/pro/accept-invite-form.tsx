'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { acceptInviteAction } from '@/app/[locale]/(app)/pro/actions';

interface Props {
  token: string;
}

export function AcceptInviteForm({ token }: Props) {
  const t = useTranslations('Pro');
  const tCommon = useTranslations('Common');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onAccept() {
    setError(null);
    startTransition(async () => {
      const result = await acceptInviteAction(token);
      if (result.ok) {
        router.push('/pro/dashboard');
        router.refresh();
        return;
      }
      const key = result.error.toLowerCase();
      setError(t(`errors.${key}` as const));
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {error ? (
        <p role="alert" className="text-sm text-[color:var(--color-destructive)]">
          {error}
        </p>
      ) : null}
      <Button onClick={onAccept} disabled={pending} data-testid="accept-invite">
        {pending ? tCommon('loading') : t('acceptInvite')}
      </Button>
    </div>
  );
}
