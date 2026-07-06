'use client';

import { useRef, useState, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { ExternalLink, Loader2, Save, Upload } from 'lucide-react';
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
import {
  createEventMusicUploadUrlAction,
  updateEventAction,
} from '@/app/[locale]/(app)/events/actions';
import { CINEMATIC_IDS } from '@/components/invitation/cinematics/registry';
import { MUSIC_TRACK_IDS } from '@/lib/invitation/music';

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
  /** Id de cinématique (défaut « seal »). */
  invitationCinematic: string;
  /** 'none' | trackId bibliothèque | 'custom' (fichier déjà uploadé). */
  musicChoice: string;
  musicCustomTitle: string;
}

const AUDIO_TYPES = ['audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/x-m4a', 'audio/aac'];
const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

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
  cinematicUnlocked,
}: {
  eventId: string;
  initialValues: InitialValues;
  /** Choix de cinématique + musique (feature `cinematicInvitation`, Premium/Pro). */
  cinematicUnlocked: boolean;
}) {
  const tCommon = useTranslations('Common');
  const t = useTranslations('Events');
  const tDesign = useTranslations('InvitationDesign');
  const locale = useLocale();
  const router = useRouter();
  const [form, setForm] = useState<InitialValues>(initialValues);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | undefined>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  /** Fichier uploadé pendant la session d'édition, persisté au submit. */
  const [pendingMusic, setPendingMusic] = useState<{ s3Key: string; title: string } | null>(null);
  const [uploadingMusic, setUploadingMusic] = useState(false);
  const [musicError, setMusicError] = useState<'type' | 'size' | 'network' | null>(null);
  const musicFileRef = useRef<HTMLInputElement | null>(null);

  async function onMusicFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!AUDIO_TYPES.includes(file.type)) {
      setMusicError('type');
      return;
    }
    if (file.size > MAX_AUDIO_BYTES) {
      setMusicError('size');
      return;
    }
    setMusicError(null);
    setUploadingMusic(true);
    try {
      const pres = await createEventMusicUploadUrlAction(eventId, file.type);
      if (!pres.ok) {
        setMusicError('network');
        return;
      }
      const put = await fetch(pres.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!put.ok) {
        setMusicError('network');
        return;
      }
      const title = file.name.replace(/\.[^.]+$/, '').slice(0, 80);
      setPendingMusic({ s3Key: pres.s3Key, title });
      setForm((f) => ({ ...f, musicChoice: 'custom', musicCustomTitle: title }));
    } catch {
      setMusicError('network');
    } finally {
      setUploadingMusic(false);
    }
  }

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
    if (cinematicUnlocked) {
      fd.set('invitationCinematic', form.invitationCinematic);
      if (form.musicChoice === 'none') {
        if (initialValues.musicChoice !== 'none') fd.set('clearInvitationMusic', '1');
      } else if (form.musicChoice === 'custom') {
        if (pendingMusic) {
          fd.set('invitationMusicKey', pendingMusic.s3Key);
          fd.set('invitationMusicTitle', pendingMusic.title);
        }
        // custom sans nouvel upload = fichier existant, rien à changer.
      } else {
        fd.set('invitationMusicTrack', form.musicChoice);
      }
    }

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

      <Section
        title={t('editInvitationSectionTitle')}
        description={t('editInvitationSectionDescription')}
      >
        {!cinematicUnlocked ? (
          <p className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-3 text-sm text-[color:var(--color-ink-500)]">
            {tDesign('lockedBody')}
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="invitationCinematic">{t('editCinematicLabel')}</Label>
                <Select
                  name="invitationCinematic"
                  value={form.invitationCinematic}
                  onValueChange={(v) => setForm({ ...form, invitationCinematic: v })}
                >
                  <SelectTrigger
                    id="invitationCinematic"
                    className="focus-ring h-11 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 text-sm"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CINEMATIC_IDS.map((id) => (
                      <SelectItem key={id} value={id}>
                        {tDesign(`themes.${id}.name`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <a
                  href={`/${locale}/events/${eventId}/preview?cinematic=${form.invitationCinematic}&replay=1`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 font-mono text-[10px] tracking-[0.24em] text-[color:var(--color-ink-500)] uppercase transition-colors hover:text-[color:var(--color-ink-900)]"
                >
                  <ExternalLink className="h-3 w-3" strokeWidth={2} aria-hidden />
                  {tDesign('preview')}
                </a>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="invitationMusic">{t('editMusicLabel')}</Label>
                <Select
                  name="invitationMusic"
                  value={form.musicChoice}
                  onValueChange={(v) => setForm({ ...form, musicChoice: v })}
                >
                  <SelectTrigger
                    id="invitationMusic"
                    className="focus-ring h-11 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 text-sm"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{tDesign('musicNone')}</SelectItem>
                    {MUSIC_TRACK_IDS.map((id) => (
                      <SelectItem key={id} value={id}>
                        {tDesign(`tracks.${id}.name`)}
                      </SelectItem>
                    ))}
                    {(pendingMusic || initialValues.musicChoice === 'custom') && (
                      <SelectItem value="custom">
                        {pendingMusic?.title || form.musicCustomTitle || tDesign('customMusic')}
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={uploadingMusic}
                    onClick={() => musicFileRef.current?.click()}
                  >
                    {uploadingMusic ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} aria-hidden />
                    ) : (
                      <Upload className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                    )}
                    {uploadingMusic ? tDesign('uploading') : tDesign('chooseFile')}
                  </Button>
                  <span className="text-xs text-[color:var(--color-ink-500)]">
                    {musicError
                      ? tDesign(`uploadErrors.${musicError}`)
                      : tDesign('customMusicHint')}
                  </span>
                </div>
                <input
                  ref={musicFileRef}
                  type="file"
                  accept=".mp3,.m4a,.aac,audio/mpeg,audio/mp4,audio/x-m4a,audio/aac"
                  hidden
                  onChange={(e) => void onMusicFile(e)}
                />
              </div>
            </div>
          </>
        )}
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
