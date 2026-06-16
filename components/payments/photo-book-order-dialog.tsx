'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { BookOpen } from 'lucide-react';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { requestPhotoBookAction } from '@/app/[locale]/(app)/events/[eventId]/photo-book-actions';
import { validatePhotoBookAddress, type PhotoBookAddressInput } from '@/lib/photos/photo-book';

const EMPTY: PhotoBookAddressInput = {
  recipientName: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  postalCode: '',
  country: 'France',
  notes: '',
};

export function PhotoBookOrderDialog({ eventId }: { eventId: string }) {
  const t = useTranslations('Upgrade.upsell.photoBook');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<PhotoBookAddressInput>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const valid = validatePhotoBookAddress(form).ok;

  function set<K extends keyof PhotoBookAddressInput>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function submit() {
    setError(null);
    if (!validatePhotoBookAddress(form).ok) {
      setError('INVALID_ADDRESS');
      return;
    }
    startTransition(async () => {
      const res = await requestPhotoBookAction(eventId, form);
      if (res.ok) {
        setOpen(false);
        setForm(EMPTY);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="md" data-testid="photo-book-trigger">
          <BookOpen className="h-4 w-4" strokeWidth={1.9} aria-hidden />
          {t('cta')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('dialogTitle')}</DialogTitle>
          <DialogDescription>{t('dialogSubtitle')}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <Field label={t('recipientName')} required>
            <Input
              value={form.recipientName}
              onChange={(e) => set('recipientName', e.target.value)}
              data-testid="pb-recipient"
              autoComplete="name"
            />
          </Field>
          <Field label={t('addressLine1')} required>
            <Input
              value={form.addressLine1}
              onChange={(e) => set('addressLine1', e.target.value)}
              data-testid="pb-address1"
              autoComplete="address-line1"
            />
          </Field>
          <Field label={t('addressLine2')}>
            <Input
              value={form.addressLine2 ?? ''}
              onChange={(e) => set('addressLine2', e.target.value)}
              autoComplete="address-line2"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('postalCode')} required>
              <Input
                value={form.postalCode}
                onChange={(e) => set('postalCode', e.target.value)}
                data-testid="pb-postal"
                autoComplete="postal-code"
              />
            </Field>
            <Field label={t('city')} required>
              <Input
                value={form.city}
                onChange={(e) => set('city', e.target.value)}
                data-testid="pb-city"
                autoComplete="address-level2"
              />
            </Field>
          </div>
          <Field label={t('country')} required>
            <Input
              value={form.country}
              onChange={(e) => set('country', e.target.value)}
              data-testid="pb-country"
              autoComplete="country-name"
            />
          </Field>
          <Field label={t('notes')}>
            <textarea
              value={form.notes ?? ''}
              onChange={(e) => set('notes', e.target.value)}
              rows={2}
              className="focus-ring w-full resize-none rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2 text-sm"
            />
          </Field>
        </div>
        {error ? (
          <p role="alert" className="mt-3 text-sm text-[color:var(--color-destructive)]">
            {t(`errors.${error.toLowerCase()}` as const)}
          </p>
        ) : null}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" size="md" disabled={pending}>
              {t('cancel')}
            </Button>
          </DialogClose>
          <Button onClick={submit} disabled={pending || !valid} data-testid="photo-book-submit">
            {pending ? t('submitting') : t('submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>
        {label}
        {required ? <span aria-hidden> *</span> : null}
      </Label>
      {children}
    </div>
  );
}
