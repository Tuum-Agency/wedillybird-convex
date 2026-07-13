'use client';

import { useState, useTransition } from 'react';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createOrganizationAction } from '@/app/[locale]/(app)/pro/actions';

export function OrgOnboardingForm() {
  const t = useTranslations('Pro');
  const tCommon = useTranslations('Common');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createOrganizationAction(formData);
      if (result.ok) {
        // Après création de l'organisation, on dirige vers la Facturation :
        // l'agence DOIT choisir un forfait avant d'accéder aux fonctionnalités
        // (créer un mariage, rétroplanning…). Sans forfait actif, le back-office
        // reste verrouillé côté serveur.
        router.push('/pro/billing' as Route);
        router.refresh();
        return;
      }
      setError(t(`errors.${result.error.toLowerCase()}` as const));
    });
  }

  return (
    <form
      action={onSubmit}
      className="flex flex-col gap-4 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6"
      data-testid="org-onboarding-form"
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">{t('orgNameLabel')}</Label>
        <Input
          id="name"
          name="name"
          required
          maxLength={120}
          placeholder={t('orgNamePlaceholder')}
        />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="primaryColor">{t('primaryColorLabel')}</Label>
          <Input id="primaryColor" name="primaryColor" type="color" defaultValue="#2c1a11" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="accentColor">{t('accentColorLabel')}</Label>
          <Input id="accentColor" name="accentColor" type="color" defaultValue="#c8a165" />
        </div>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-[color:var(--color-destructive)]">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending} data-testid="submit-org">
        {pending ? tCommon('loading') : t('createOrg')}
      </Button>
    </form>
  );
}
