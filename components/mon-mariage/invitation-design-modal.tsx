'use client';

// Modal « Personnaliser l'invitation » — choix de la cinématique d'ouverture
// et de la musique (bibliothèque maison ou fichier du couple). Application
// OPTIMISTE immédiate via le store (revert+toast si échec) ; chaque thème a
// un lien Aperçu qui ouvre la vraie page preview avec l'override ?cinematic=.
// Choix des univers temporairement masqué : seul le sceau est proposé (cf.
// `AVAILABLE_CINEMATIC_IDS`). La logique de gating Premium (`chooseCinematic`,
// badge « Premium ») reste en place pour la réactivation.

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useMonMariage } from '@/stores/mon-mariage';
import {
  AVAILABLE_CINEMATIC_IDS,
  CINEMATIC_META,
  type CinematicId,
} from '@/components/invitation/cinematics/registry';
import { THEME_SWATCH } from '@/components/invitation/cinematics/theme-visuals';
import { MUSIC_TRACK_IDS, musicTrackSrc, type MusicTrackId } from '@/lib/invitation/music';
import { compressForUpload, isAllowedContentType, MAX_UPLOAD_BYTES } from '@/lib/photos/compress';
import {
  mmCreateMusicUploadUrlAction,
  mmCreateInvitationPhotoUploadUrlAction,
} from '@/app/[locale]/(app)/mon-mariage/actions';
import { Icon } from './icons';
import { McModal } from './modal';
import { McBtn } from './parts';
import { CeremonyScheduleEditor } from './ceremony-schedule-editor';

const THEME_ICON: Record<CinematicId, string> = {
  seal: 'Mail',
  fairepart: 'Image',
  royal: 'Crown',
  floral: 'Flower',
  cake: 'CakeSlice',
  voyage: 'Send',
  theatre: 'Sparkles',
  etoiles: 'Star',
  lanternes: 'Flame',
  rivage: 'Waves',
  feux: 'PartyPopper',
  deco: 'Gem',
  'jardin-japonais': 'Moon',
};

const AUDIO_TYPES = ['audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/x-m4a', 'audio/aac'];
const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

export function InvitationDesignModal({
  eventId,
  previewPath,
  onClose,
}: {
  eventId: string;
  previewPath: string;
  onClose: () => void;
}) {
  const t = useTranslations('InvitationDesign');
  const locale = useLocale();
  const event = useMonMariage((s) => s.event);
  const demo = useMonMariage((s) => s.demo);
  const setDesign = useMonMariage((s) => s.setInvitationDesign);

  const [playing, setPlaying] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<'type' | 'size' | 'network' | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<'type' | 'size' | 'network' | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const photoRef = useRef<HTMLInputElement | null>(null);

  // Stoppe la pré-écoute à la fermeture/démontage.
  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  if (!event) return null;
  const unlocked = event.cinematicUnlocked;
  const selected = (event.invitationCinematic ?? 'seal') as string;
  const music = event.invitationMusic;
  const photo = event.invitationPhoto;

  function previewHref(id: CinematicId): string {
    const m =
      music?.source === 'library' && music.trackId
        ? `&music=${music.trackId}`
        : music
          ? ''
          : '&music=off';
    return `/${locale}${previewPath}?cinematic=${id}${m}&replay=1`;
  }

  function togglePreview(id: string, src: string) {
    if (playing === id) {
      audioRef.current?.pause();
      setPlaying(null);
      return;
    }
    audioRef.current?.pause();
    const el = new Audio(src);
    el.volume = 0.55;
    el.onended = () => setPlaying(null);
    void el.play().catch(() => setPlaying(null));
    audioRef.current = el;
    setPlaying(id);
  }

  function chooseCinematic(id: CinematicId) {
    if (!unlocked && id !== 'seal') return;
    if (id === selected) return;
    void setDesign({ cinematic: id });
  }

  function chooseTrack(id: MusicTrackId) {
    if (!unlocked) return;
    void setDesign({ music: { source: 'library', trackId: id } });
  }

  function chooseNone() {
    if (!unlocked) return;
    if (music) void setDesign({ music: null });
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !unlocked) return;
    if (!AUDIO_TYPES.includes(file.type)) {
      setUploadError('type');
      return;
    }
    if (file.size > MAX_AUDIO_BYTES) {
      setUploadError('size');
      return;
    }
    setUploadError(null);
    const title = file.name.replace(/\.[^.]+$/, '').slice(0, 80);
    if (demo) {
      void setDesign({ music: { source: 'custom', s3Key: `audio/demo/${title}`, title } });
      return;
    }
    setUploading(true);
    try {
      const pres = await mmCreateMusicUploadUrlAction({ eventId, contentType: file.type });
      if (!pres.ok) {
        setUploadError('network');
        return;
      }
      const put = await fetch(pres.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!put.ok) {
        setUploadError('network');
        return;
      }
      await setDesign({ music: { source: 'custom', s3Key: pres.s3Key, title } });
    } catch {
      setUploadError('network');
    } finally {
      setUploading(false);
    }
  }

  async function onPhotoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !unlocked) return;
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
      // Compression client (≤ 2 Mo, ≤ 2000 px) : léger pour les invités mobiles.
      const { file: blob, width, height, contentType } = await compressForUpload(file);
      // Aperçu immédiat (object URL) le temps que le CDN prenne le relais.
      const url = URL.createObjectURL(blob);
      if (demo) {
        void setDesign({
          photo: { s3Key: `invitation/demo/${width ?? 0}x${height ?? 0}`, url, width, height },
        });
        return;
      }
      const pres = await mmCreateInvitationPhotoUploadUrlAction({ eventId, contentType });
      if (!pres.ok) {
        URL.revokeObjectURL(url);
        setPhotoError('network');
        return;
      }
      const put = await fetch(pres.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': contentType },
        body: blob,
      });
      if (!put.ok) {
        URL.revokeObjectURL(url);
        setPhotoError('network');
        return;
      }
      await setDesign({ photo: { s3Key: pres.s3Key, url, width, height } });
    } catch {
      setPhotoError('network');
    } finally {
      setUploadingPhoto(false);
    }
  }

  function removePhoto() {
    if (!unlocked || !photo) return;
    void setDesign({ photo: null });
  }

  const trackRow = (id: MusicTrackId) => {
    const sel = music?.source === 'library' && music.trackId === id;
    return (
      <div key={id} className={'mc-musicrow' + (sel ? ' sel' : '') + (!unlocked ? ' locked' : '')}>
        <button
          type="button"
          className="mc-musicplay"
          onClick={() => togglePreview(id, musicTrackSrc(id))}
          aria-label={playing === id ? t('pause') : t('play')}
        >
          <Icon name={playing === id ? 'X' : 'Music'} size={14} stroke={2} />
        </button>
        <button type="button" className="mc-musicpick" onClick={() => chooseTrack(id)}>
          <b>{t(`tracks.${id}.name`)}</b>
          <span>{t(`tracks.${id}.desc`)}</span>
        </button>
        {sel && (
          <span className="mc-musicsel">
            <Icon name="Check" size={15} stroke={2.4} />
          </span>
        )}
      </div>
    );
  };

  return (
    <McModal
      title={t('title')}
      eyebrow={t('eyebrow')}
      onClose={onClose}
      wide
      footer={
        <McBtn variant="primary" onClick={onClose}>
          {t('done')}
        </McBtn>
      }
    >
      {!unlocked && (
        <div className="mc-cinelock">
          <Icon name="Crown" size={16} stroke={2} />
          <span>{t('lockedBody')}</span>
        </div>
      )}

      <div className="mc-field-label mc-cinelabel">{t('cinematicSection')}</div>
      <div className="mc-cinegrid" role="radiogroup" aria-label={t('cinematicSection')}>
        {AVAILABLE_CINEMATIC_IDS.map((id) => {
          const sel = selected === id;
          const locked = !unlocked && id !== 'seal';
          return (
            <div
              key={id}
              className={'mc-cinecard' + (sel ? ' sel' : '') + (locked ? ' locked' : '')}
            >
              <button
                type="button"
                role="radio"
                aria-checked={sel}
                className="mc-cinemain"
                onClick={() => chooseCinematic(id)}
              >
                <span
                  className="mc-cineswatch"
                  style={{ background: THEME_SWATCH[id] } as CSSProperties}
                  data-dark={CINEMATIC_META[id].dark ? '' : undefined}
                >
                  <Icon name={THEME_ICON[id]} size={17} stroke={1.8} />
                </span>
                <b>{t(`themes.${id}.name`)}</b>
                <span className="d">{t(`themes.${id}.desc`)}</span>
              </button>
              {locked ? (
                <span className="mc-cinebadge">
                  <Icon name="Crown" size={11} stroke={2.2} /> Premium
                </span>
              ) : (
                <a
                  className="mc-cinepreview"
                  href={previewHref(id)}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Icon name="Eye" size={13} stroke={2} />
                  {t('preview')}
                </a>
              )}
            </div>
          );
        })}
      </div>

      <div className="mc-field-label mc-cinelabel">{t('musicSection')}</div>
      <div className={'mc-musiclist' + (!unlocked ? ' locked' : '')}>
        <div className={'mc-musicrow' + (!music ? ' sel' : '') + (!unlocked ? ' locked' : '')}>
          <span className="mc-musicplay ghost" aria-hidden>
            <Icon name="Minus" size={14} stroke={2} />
          </span>
          <button type="button" className="mc-musicpick" onClick={chooseNone}>
            <b>{t('musicNone')}</b>
            <span>{t('musicNoneDesc')}</span>
          </button>
          {!music && (
            <span className="mc-musicsel">
              <Icon name="Check" size={15} stroke={2.4} />
            </span>
          )}
        </div>

        {MUSIC_TRACK_IDS.map(trackRow)}

        <div
          className={
            'mc-musicrow custom' +
            (music?.source === 'custom' ? ' sel' : '') +
            (!unlocked ? ' locked' : '')
          }
        >
          <span className="mc-musicplay ghost" aria-hidden>
            <Icon name="Upload" size={14} stroke={2} />
          </span>
          <div className="mc-musicpick">
            <b>{music?.source === 'custom' && music.title ? music.title : t('customMusic')}</b>
            <span>{uploadError ? t(`uploadErrors.${uploadError}`) : t('customMusicHint')}</span>
          </div>
          <McBtn
            variant="outline"
            size="sm"
            disabled={uploading || !unlocked}
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? (
              <Icon name="Loader" size={14} stroke={2} />
            ) : (
              <Icon name="Upload" size={14} stroke={2} />
            )}
            {uploading ? t('uploading') : t('chooseFile')}
          </McBtn>
          {music?.source === 'custom' && (
            <span className="mc-musicsel">
              <Icon name="Check" size={15} stroke={2.4} />
            </span>
          )}
          <input
            ref={fileRef}
            type="file"
            accept=".mp3,.m4a,.aac,audio/mpeg,audio/mp4,audio/x-m4a,audio/aac"
            hidden
            onChange={(e) => void onFile(e)}
          />
        </div>
      </div>

      <div className="mc-field-label mc-cinelabel">{t('photoSection')}</div>
      <div className={'mc-photorow' + (photo ? ' sel' : '') + (!unlocked ? ' locked' : '')}>
        <span className="mc-photothumb" aria-hidden>
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element -- object URL / URL CDN externe
            <img src={photo.url} alt="" />
          ) : (
            <Icon name="Image" size={18} stroke={1.7} />
          )}
        </span>
        <div className="mc-musicpick">
          <b>{photo ? t('photoChange') : t('photoAdd')}</b>
          <span>{photoError ? t(`photoUploadErrors.${photoError}`) : t('photoHint')}</span>
        </div>
        {photo && (
          <button
            type="button"
            className="mc-photoremove"
            onClick={removePhoto}
            disabled={!unlocked}
            aria-label={t('photoRemove')}
          >
            <Icon name="Trash2" size={14} stroke={2} />
          </button>
        )}
        <McBtn
          variant="outline"
          size="sm"
          disabled={uploadingPhoto || !unlocked}
          onClick={() => photoRef.current?.click()}
        >
          {uploadingPhoto ? (
            <Icon name="Loader" size={14} stroke={2} />
          ) : (
            <Icon name="Upload" size={14} stroke={2} />
          )}
          {uploadingPhoto ? t('uploading') : photo ? t('photoReplace') : t('chooseFile')}
        </McBtn>
        <input
          ref={photoRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          hidden
          onChange={(e) => void onPhotoFile(e)}
        />
      </div>

      <CeremonyScheduleEditor />
    </McModal>
  );
}
