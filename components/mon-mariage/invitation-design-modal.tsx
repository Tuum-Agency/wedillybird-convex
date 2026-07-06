'use client';

// Modal « Personnaliser l'invitation » — choix de la cinématique d'ouverture
// et de la musique (bibliothèque maison ou fichier du couple). Application
// OPTIMISTE immédiate via le store (revert+toast si échec) ; chaque thème a
// un lien Aperçu qui ouvre la vraie page preview avec l'override ?cinematic=.
// Gating : Essentiel voit tout mais ne peut choisir que le sceau (badge
// Premium sur le reste) — cohérent avec `cinematicInvitation`.

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useMonMariage } from '@/stores/mon-mariage';
import {
  CINEMATIC_IDS,
  CINEMATIC_META,
  type CinematicId,
} from '@/components/invitation/cinematics/registry';
import { MUSIC_TRACK_IDS, musicTrackSrc, type MusicTrackId } from '@/lib/invitation/music';
import { mmCreateMusicUploadUrlAction } from '@/app/[locale]/(app)/mon-mariage/actions';
import { Icon } from './icons';
import { McModal } from './modal';
import { McBtn } from './parts';

const THEME_ICON: Record<CinematicId, string> = {
  seal: 'Mail',
  floral: 'Flower',
  cake: 'CakeSlice',
  voyage: 'Send',
  theatre: 'Sparkles',
  etoiles: 'Star',
  lanternes: 'Flame',
  rivage: 'Waves',
  feux: 'PartyPopper',
  deco: 'Gem',
  neige: 'Snowflake',
};

/** Vignette dégradée évoquant chaque scène (pas de screenshot à charger). */
const THEME_SWATCH: Record<CinematicId, string> = {
  seal: 'linear-gradient(135deg, oklch(96% 0.02 84), oklch(88% 0.055 24))',
  floral: 'linear-gradient(135deg, oklch(97% 0.015 140), oklch(88% 0.055 18))',
  cake: 'linear-gradient(135deg, oklch(30% 0.035 55), oklch(84% 0.06 22))',
  voyage: 'linear-gradient(135deg, oklch(72% 0.06 262), oklch(92% 0.05 70))',
  theatre: 'linear-gradient(135deg, oklch(22% 0.03 290), oklch(42% 0.12 18))',
  etoiles: 'linear-gradient(135deg, oklch(16% 0.03 268), oklch(38% 0.05 280))',
  lanternes: 'linear-gradient(135deg, oklch(24% 0.04 290), oklch(62% 0.11 52))',
  rivage: 'linear-gradient(135deg, oklch(76% 0.075 210), oklch(90% 0.03 78))',
  feux: 'linear-gradient(135deg, oklch(14% 0.022 278), oklch(60% 0.1 82))',
  deco: 'linear-gradient(135deg, oklch(13% 0.008 80), oklch(66% 0.09 84))',
  neige: 'linear-gradient(135deg, oklch(90% 0.02 240), oklch(72% 0.035 235))',
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
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

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
        {CINEMATIC_IDS.map((id) => {
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
    </McModal>
  );
}
