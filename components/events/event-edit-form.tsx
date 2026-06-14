'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { updateEventAction } from '@/app/[locale]/(app)/events/actions';

interface InitialValues {
  title: string;
  partnerA: string;
  partnerB: string;
  eventDate: string;
  timezone: string;
  venueName: string;
  venueAddress: string;
  themePrimary: string;
  themeAccent: string;
  themeFont: string;
}

const TIMEZONE_IDS = [
  'Europe/Paris',
  'Africa/Dakar',
  'Africa/Abidjan',
  'Africa/Casablanca',
  'Africa/Algiers',
  'Africa/Tunis',
  'Africa/Douala',
  'Indian/Antananarivo',
  'Indian/Mauritius',
] as const;

const FONT_IDS = ['Playfair Display', 'Cormorant Garamond', 'Inter', 'Manrope'] as const;

/** Suffixe descriptif localisé par police (« élégant », « classique », …). */
const FONT_DESCRIPTOR_KEY: Record<(typeof FONT_IDS)[number], string> = {
  'Playfair Display': 'elegant',
  'Cormorant Garamond': 'classic',
  Inter: 'modern',
  Manrope: 'sansSerif',
};

/**
 * Formulaire d'édition d'un événement existant — single page.
 * Pré-rempli avec les valeurs courantes ; sur submit, appelle la server action
 * `updateEventAction` puis redirige vers la page event.
 */
export function EventEditForm({
  eventId,
  initialValues,
}: {
  eventId: string;
  initialValues: InitialValues;
}) {
  const tCommon = useTranslations('Common');
  const t = useTranslations('Events');
  const router = useRouter();
  const [form, setForm] = useState<InitialValues>(initialValues);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | undefined>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    setFieldErrors({});
    const fd = new FormData();
    fd.set('title', form.title.trim());
    fd.set('partnerA', form.partnerA.trim());
    fd.set('partnerB', form.partnerB.trim());
    fd.set('eventDate', form.eventDate);
    fd.set('timezone', form.timezone);
    if (form.venueName.trim() && form.venueAddress.trim()) {
      fd.set('venueName', form.venueName.trim());
      fd.set('venueAddress', form.venueAddress.trim());
    } else if (initialValues.venueName || initialValues.venueAddress) {
      // L'utilisateur a vidé un lieu qui existait → flag pour clear côté Convex.
      fd.set('clearVenue', '1');
    }
    fd.set('themePrimary', form.themePrimary);
    fd.set('themeAccent', form.themeAccent);
    fd.set('themeFont', form.themeFont);

    startTransition(async () => {
      const result = await updateEventAction(eventId, fd);
      if (result.ok) {
        router.push(`/fr/events/${eventId}`);
        return;
      }
      if (result.fieldErrors) {
        const flat: Record<string, string | undefined> = {};
        for (const [k, v] of Object.entries(result.fieldErrors)) {
          if (v && v.length > 0) flat[k] = v[0];
        }
        setFieldErrors(flat);
        return;
      }
      setError(t('editErrorSave'));
    });
  }

  return (
    <form
      action={submit}
      className="flex flex-col gap-8 rounded-3xl border border-[color:var(--color-border)] bg-white p-7 shadow-[var(--shadow-soft)] sm:p-9"
    >
      <Section title={t('editCoupleSectionTitle')} description={t('editCoupleSectionDescription')}>
        <Field
          label={t('editTitleLabel')}
          id="title"
          value={form.title}
          error={fieldErrors.title}
          placeholder={t('editTitlePlaceholder')}
          onChange={(v) => setForm({ ...form, title: v })}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label={t('editPartnerALabel')}
            id="partnerA"
            value={form.partnerA}
            error={fieldErrors.partnerA}
            onChange={(v) => setForm({ ...form, partnerA: v })}
          />
          <Field
            label={t('editPartnerBLabel')}
            id="partnerB"
            value={form.partnerB}
            error={fieldErrors.partnerB}
            onChange={(v) => setForm({ ...form, partnerB: v })}
          />
        </div>
      </Section>

      <Section title={t('editDateSectionTitle')}>
        <Field
          label={t('editDateLabel')}
          id="eventDate"
          type="datetime-local"
          value={form.eventDate}
          error={fieldErrors.eventDate}
          onChange={(v) => setForm({ ...form, eventDate: v })}
        />
        <div className="flex flex-col gap-2">
          <Label htmlFor="timezone">{t('editTimezoneLabel')}</Label>
          <Select
            name="timezone"
            value={form.timezone}
            onValueChange={(v) => setForm({ ...form, timezone: v })}
          >
            <SelectTrigger
              id="timezone"
              className="focus-ring h-11 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 text-sm"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIMEZONE_IDS.map((id) => (
                <SelectItem key={id} value={id}>
                  {t(`timezones.${id}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {fieldErrors.timezone ? (
            <p className="text-xs text-[color:var(--color-destructive)]">{fieldErrors.timezone}</p>
          ) : null}
        </div>
      </Section>

      <Section title={t('editVenueSectionTitle')} description={t('editVenueSectionDescription')}>
        <Field
          label={t('editVenueNameLabel')}
          id="venueName"
          value={form.venueName}
          placeholder={t('editVenueNamePlaceholder')}
          onChange={(v) => setForm({ ...form, venueName: v })}
        />
        <Field
          label={t('editVenueAddressLabel')}
          id="venueAddress"
          value={form.venueAddress}
          placeholder={t('editVenueAddressPlaceholder')}
          onChange={(v) => setForm({ ...form, venueAddress: v })}
        />
      </Section>

      <Section title={t('editThemeSectionTitle')} description={t('editThemeSectionDescription')}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ColorField
            label={t('editPrimaryColorLabel')}
            id="themePrimary"
            value={form.themePrimary}
            onChange={(v) => setForm({ ...form, themePrimary: v })}
          />
          <ColorField
            label={t('editAccentColorLabel')}
            id="themeAccent"
            value={form.themeAccent}
            onChange={(v) => setForm({ ...form, themeAccent: v })}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="themeFont">{t('editFontLabel')}</Label>
          <Select
            name="themeFont"
            value={form.themeFont}
            onValueChange={(v) => setForm({ ...form, themeFont: v })}
          >
            <SelectTrigger
              id="themeFont"
              className="focus-ring h-11 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 text-sm"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FONT_IDS.map((id) => (
                <SelectItem key={id} value={id}>
                  {t('editFontOption', {
                    name: id,
                    descriptor: t(`fontDescriptors.${FONT_DESCRIPTOR_KEY[id]}`),
                  })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Section>

      {error ? (
        <p role="alert" className="text-sm text-[color:var(--color-destructive)]">
          {error}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 border-t border-[color:var(--color-border)] pt-6 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push(`/fr/events/${eventId}`)}
          disabled={pending}
        >
          {tCommon('cancel')}
        </Button>
        <Button type="submit" variant="primary" size="lg" disabled={pending}>
          <Save className="h-4 w-4" strokeWidth={2} aria-hidden />
          {pending ? tCommon('loading') : tCommon('save')}
        </Button>
      </div>
    </form>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <h2
          className="font-display italic"
          style={{
            fontSize: 'clamp(1.25rem, 1.8vw, 1.5rem)',
            lineHeight: 1.2,
            letterSpacing: '-0.018em',
            color: 'var(--color-ink-900)',
          }}
        >
          {title}
        </h2>
        {description ? (
          <p className="text-sm text-[color:var(--color-ink-500)]">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  id,
  value,
  onChange,
  error,
  placeholder,
  type = 'text',
}: {
  label: string;
  id: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={id}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
      />
      {error ? <p className="text-xs text-[color:var(--color-destructive)]">{error}</p> : null}
    </div>
  );
}

function ColorField({
  label,
  id,
  value,
  onChange,
}: {
  label: string;
  id: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-3">
        <input
          id={id}
          name={id}
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-11 w-14 cursor-pointer rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)]"
        />
        <Input value={value.toUpperCase()} onChange={(e) => onChange(e.target.value)} />
      </div>
    </div>
  );
}
