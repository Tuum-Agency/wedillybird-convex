'use client';

import { useRef, useState, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { ExternalLink, ImagePlus, Loader2, Plus, Save, Trash2, Upload } from 'lucide-react';
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
  createEventInvitationPhotoUploadUrlAction,
  createEventMusicUploadUrlAction,
  updateEventAction,
} from '@/app/[locale]/(app)/events/actions';
import {
  AVAILABLE_CINEMATIC_IDS,
  isCinematicId,
} from '@/components/invitation/cinematics/registry';
import { MUSIC_TRACK_IDS } from '@/lib/invitation/music';
import { compressForUpload, isAllowedContentType, MAX_UPLOAD_BYTES } from '@/lib/photos/compress';

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
  /** URL CDN de la photo du couple déjà enregistrée (vide = aucune). */
  invitationPhotoUrl: string;
  /** Déroulé de la journée affiché sur l'invitation. */
  ceremonySchedule: Array<{ time: string; title: string; note?: string }>;
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
  const tSched = useTranslations('CeremonySchedule');
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
  /** Photo uploadée pendant la session (persistée au submit) ; `url` = aperçu. */
  const [pendingPhoto, setPendingPhoto] = useState<{
    s3Key: string;
    url: string;
    width?: number;
    height?: number;
  } | null>(null);
  /** L'utilisateur a retiré une photo existante (clear au submit). */
  const [photoRemoved, setPhotoRemoved] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<'type' | 'size' | 'network' | null>(null);
  const photoFileRef = useRef<HTMLInputElement | null>(null);
  // Aperçu affiché : nouvel upload > photo existante (sauf si retirée).
  const photoPreviewUrl =
    pendingPhoto?.url ?? (photoRemoved ? null : initialValues.invitationPhotoUrl || null);

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

  async function onPhotoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!isAllowedContentType(file.type)) {
      setPhotoError('type');
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setPhotoError('size');
      return;
    }
    setPhotoError(null);
    setUploadingPhoto(true);
    try {
      const { file: blob, width, height, contentType } = await compressForUpload(file);
      const pres = await createEventInvitationPhotoUploadUrlAction(eventId, contentType);
      if (!pres.ok) {
        setPhotoError('network');
        return;
      }
      const put = await fetch(pres.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': contentType },
        body: blob,
      });
      if (!put.ok) {
        setPhotoError('network');
        return;
      }
      setPhotoRemoved(false);
      setPendingPhoto({ s3Key: pres.s3Key, url: URL.createObjectURL(blob), width, height });
    } catch {
      setPhotoError('network');
    } finally {
      setUploadingPhoto(false);
    }
  }

  function removePhoto() {
    setPendingPhoto(null);
    setPhotoRemoved(true);
    setPhotoError(null);
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
      if (pendingPhoto) {
        fd.set('invitationPhotoKey', pendingPhoto.s3Key);
        if (pendingPhoto.width) fd.set('invitationPhotoWidth', String(pendingPhoto.width));
        if (pendingPhoto.height) fd.set('invitationPhotoHeight', String(pendingPhoto.height));
      } else if (photoRemoved && initialValues.invitationPhotoUrl) {
        fd.set('clearInvitationPhoto', '1');
      }
    }
    // Déroulé (non gaté) — toujours transmis (array vide = efface le programme).
    fd.set('ceremonySchedule', JSON.stringify(form.ceremonySchedule));

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

  // Déroulé de la journée — édition locale, sérialisée au submit.
  function setSchedRow(i: number, patch: Partial<{ time: string; title: string }>) {
    setForm((f) => ({
      ...f,
      ceremonySchedule: f.ceremonySchedule.map((r, idx) => (idx === i ? { ...r, ...patch } : r)),
    }));
  }
  function addSchedRow() {
    setForm((f) =>
      f.ceremonySchedule.length >= 20
        ? f
        : { ...f, ceremonySchedule: [...f.ceremonySchedule, { time: '', title: '' }] },
    );
  }
  function removeSchedRow(i: number) {
    setForm((f) => ({ ...f, ceremonySchedule: f.ceremonySchedule.filter((_, idx) => idx !== i) }));
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
                    {/* Un seul univers proposé (cf. AVAILABLE_CINEMATIC_IDS) ;
                        on conserve la valeur déjà enregistrée si elle diffère,
                        pour ne jamais afficher un Select vide. */}
                    {(isCinematicId(form.invitationCinematic) &&
                    !AVAILABLE_CINEMATIC_IDS.includes(form.invitationCinematic)
                      ? [form.invitationCinematic, ...AVAILABLE_CINEMATIC_IDS]
                      : AVAILABLE_CINEMATIC_IDS
                    ).map((id) => (
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

            {/* Photo du couple — portrait de tête de l'invitation. */}
            <div className="flex items-center gap-4 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-3">
              <span className="flex h-16 w-[3.25rem] flex-none items-center justify-center overflow-hidden rounded-[42%_42%_8px_8px] border border-[color:var(--color-gold-300)] bg-[color:var(--color-ivory-100)] text-[color:var(--color-ink-500)]">
                {photoPreviewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- object URL / URL CDN externe
                  <img
                    src={photoPreviewUrl}
                    alt=""
                    className="h-full w-full object-cover"
                    style={{ objectPosition: 'center 32%' }}
                  />
                ) : (
                  <ImagePlus className="h-5 w-5" strokeWidth={1.7} aria-hidden />
                )}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <Label>{tDesign('photoSection')}</Label>
                <span className="text-xs text-[color:var(--color-ink-500)]">
                  {photoError ? tDesign(`photoUploadErrors.${photoError}`) : tDesign('photoHint')}
                </span>
              </div>
              {photoPreviewUrl ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={removePhoto}
                  aria-label={tDesign('photoRemove')}
                >
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                </Button>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={uploadingPhoto}
                onClick={() => photoFileRef.current?.click()}
              >
                {uploadingPhoto ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} aria-hidden />
                ) : (
                  <Upload className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                )}
                {uploadingPhoto
                  ? tDesign('uploading')
                  : photoPreviewUrl
                    ? tDesign('photoReplace')
                    : tDesign('chooseFile')}
              </Button>
              <input
                ref={photoFileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                onChange={(e) => void onPhotoFile(e)}
              />
            </div>
          </>
        )}
      </Section>

      <Section title={tSched('section')} description={tSched('hint')}>
        <div className="flex flex-col gap-2">
          {form.ceremonySchedule.map((row, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                value={row.time}
                placeholder={tSched('timePlaceholder')}
                aria-label={tSched('timeLabel')}
                onChange={(e) => setSchedRow(i, { time: e.target.value })}
                className="w-28 flex-none tabular-nums"
              />
              <Input
                value={row.title}
                placeholder={tSched('titlePlaceholder')}
                aria-label={tSched('titleLabel')}
                onChange={(e) => setSchedRow(i, { title: e.target.value })}
                className="flex-1"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeSchedRow(i)}
                aria-label={tSched('remove')}
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
              </Button>
            </div>
          ))}
        </div>
        {form.ceremonySchedule.length < 20 ? (
          <Button type="button" variant="outline" size="sm" onClick={addSchedRow}>
            <Plus className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden />
            {tSched('add')}
          </Button>
        ) : null}
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
