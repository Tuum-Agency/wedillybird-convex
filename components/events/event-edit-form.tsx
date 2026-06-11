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

const TIMEZONES: ReadonlyArray<{ id: string; label: string }> = [
  { id: 'Europe/Paris', label: 'Europe/Paris (UTC+1/+2)' },
  { id: 'Africa/Dakar', label: 'Afrique/Dakar (UTC+0)' },
  { id: 'Africa/Abidjan', label: 'Afrique/Abidjan (UTC+0)' },
  { id: 'Africa/Casablanca', label: 'Afrique/Casablanca (UTC+1)' },
  { id: 'Africa/Algiers', label: 'Afrique/Alger (UTC+1)' },
  { id: 'Africa/Tunis', label: 'Afrique/Tunis (UTC+1)' },
  { id: 'Africa/Douala', label: 'Afrique/Douala (UTC+1)' },
  { id: 'Indian/Antananarivo', label: 'Océan Indien/Antananarivo (UTC+3)' },
  { id: 'Indian/Mauritius', label: 'Océan Indien/Maurice (UTC+4)' },
];

const FONT_OPTIONS: ReadonlyArray<{ id: string; label: string }> = [
  { id: 'Playfair Display', label: 'Playfair Display (élégant)' },
  { id: 'Cormorant Garamond', label: 'Cormorant Garamond (classique)' },
  { id: 'Inter', label: 'Inter (moderne)' },
  { id: 'Manrope', label: 'Manrope (sans serif)' },
];

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
      setError('Impossible de sauvegarder les changements. Réessayez.');
    });
  }

  return (
    <form
      action={submit}
      className="flex flex-col gap-8 rounded-3xl border border-[color:var(--color-border)] bg-white p-7 shadow-[var(--shadow-soft)] sm:p-9"
    >
      <Section title="Le couple" description="Les prénoms qui apparaîtront sur les invitations.">
        <Field
          label="Titre de l'événement"
          id="title"
          value={form.title}
          error={fieldErrors.title}
          placeholder="Mariage de Camille & Hugo"
          onChange={(v) => setForm({ ...form, title: v })}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="Partenaire 1"
            id="partnerA"
            value={form.partnerA}
            error={fieldErrors.partnerA}
            onChange={(v) => setForm({ ...form, partnerA: v })}
          />
          <Field
            label="Partenaire 2"
            id="partnerB"
            value={form.partnerB}
            error={fieldErrors.partnerB}
            onChange={(v) => setForm({ ...form, partnerB: v })}
          />
        </div>
      </Section>

      <Section title="Date et fuseau">
        <Field
          label="Date et heure"
          id="eventDate"
          type="datetime-local"
          value={form.eventDate}
          error={fieldErrors.eventDate}
          onChange={(v) => setForm({ ...form, eventDate: v })}
        />
        <div className="flex flex-col gap-2">
          <Label htmlFor="timezone">Fuseau horaire</Label>
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
              {TIMEZONES.map((tz) => (
                <SelectItem key={tz.id} value={tz.id}>
                  {tz.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {fieldErrors.timezone ? (
            <p className="text-xs text-[color:var(--color-destructive)]">{fieldErrors.timezone}</p>
          ) : null}
        </div>
      </Section>

      <Section
        title="Le lieu (optionnel)"
        description="Laissez vide si vous n'avez pas encore défini le lieu."
      >
        <Field
          label="Nom du lieu"
          id="venueName"
          value={form.venueName}
          placeholder="Domaine des Lilas"
          onChange={(v) => setForm({ ...form, venueName: v })}
        />
        <Field
          label="Adresse"
          id="venueAddress"
          value={form.venueAddress}
          placeholder="12 avenue de la République, Dakar"
          onChange={(v) => setForm({ ...form, venueAddress: v })}
        />
      </Section>

      <Section
        title="Thème visuel"
        description="Personnalisez les couleurs et la police de votre invitation."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ColorField
            label="Couleur principale"
            id="themePrimary"
            value={form.themePrimary}
            onChange={(v) => setForm({ ...form, themePrimary: v })}
          />
          <ColorField
            label="Couleur d'accent"
            id="themeAccent"
            value={form.themeAccent}
            onChange={(v) => setForm({ ...form, themeAccent: v })}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="themeFont">Police</Label>
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
              {FONT_OPTIONS.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.label}
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
