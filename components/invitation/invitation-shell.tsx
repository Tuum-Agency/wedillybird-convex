'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { CinematicPlayer } from './cinematics/player';
import './invitation-shell.css';

/**
 * InvitationShell — orchestre la cinématique d'ouverture puis dévoile le
 * contenu de l'invitation (server-rendered en dessous).
 *
 * Pattern : la cinématique est un overlay `position: fixed inset-0 z-50`
 * qui couvre le contenu. Quand onComplete est déclenché (par la timeline
 * auto-play ou par le bouton Skip), l'overlay fade out et le contenu
 * reste, déjà SEO-friendly et hydraté.
 *
 * Cinématique : le thème est choisi par le couple/l'agence
 * (`invitationCinematic`) — défaut : sceau v3. Voir `cinematics/registry`.
 *
 * Musique : quand l'event a une musique (`invitationMusic`), les règles
 * d'autoplay des navigateurs imposent un geste — on affiche alors une
 * PORTE « Ouvrir l'invitation » élégante ; le tap démarre l'audio (fondu
 * d'entrée, boucle) ET la cinématique. Un bouton sourdine flottant reste
 * disponible ensuite. Sans musique : autoplay direct, comportement
 * historique inchangé.
 *
 * `sessionStorage` mémorise que l'invité a déjà vu la cinématique pour
 * cette session (navigation /gallery puis retour) — dans ce cas ni
 * cinématique ni musique auto : le bouton flottant permet de lancer la
 * musique à la demande.
 */
export interface InvitationShellProps {
  partnerA: string;
  partnerB: string;
  formattedDate: string;
  venueName?: string;
  /** Couleur d'accent du couple (theme.primaryColor) — sceau + filets. */
  accentColor?: string;
  /** Date de l'événement (epoch ms ou ISO) — compte à rebours de la cinématique. */
  eventDate?: number | string;
  /** Token de l'invitation, sert de clé sessionStorage pour le replay. */
  token: string;
  /** Thème de cinématique (`invitationCinematic`) — défaut : sceau. */
  cinematic?: string | null;
  /** Musique de l'invitation (résolue en URL jouable) — null : silence. */
  music?: { url: string; title?: string } | null;
  children: ReactNode;
}

const TARGET_VOLUME = 0.45;

function SpeakerIcon({ off }: { off: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M11 5 6.5 8.5H3.5v7h3L11 19V5Z" />
      {off ? (
        <path d="m16 9.5 5 5m0-5-5 5" />
      ) : (
        <>
          <path d="M15.5 9.2a4 4 0 0 1 0 5.6" />
          <path d="M18.2 6.8a7.4 7.4 0 0 1 0 10.4" />
        </>
      )}
    </svg>
  );
}

export function InvitationShell({
  partnerA,
  partnerB,
  formattedDate,
  venueName,
  accentColor,
  eventDate,
  token,
  cinematic,
  music,
  children,
}: InvitationShellProps) {
  const t = useTranslations('Invitation');
  const storageKey = `wbb-cinematic-seen:${token}`;
  // Le state initial doit être SSR-friendly — donc toujours `false` pour
  // ne pas créer un mismatch avec le serveur. On lit sessionStorage en
  // useEffect après le mount.
  const [cinematicDone, setCinematicDone] = useState(false);
  const hasMusic = !!music?.url;
  /** Porte franchie (geste utilisateur — requis pour démarrer l'audio). */
  const [entered, setEntered] = useState(false);
  /** Lecture audio effectivement démarrée (play() résolu). */
  const [audioOn, setAudioOn] = useState(false);
  const [muted, setMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Replay-skip : si l'invité a déjà vu la cinématique dans cette session
  // (navigation /gallery → retour), on saute direct au contenu.
  // ?replay=1 force le rejeu (utile pour les captures vidéo marketing).
  // Un rechargement explicite de la page rejoue toujours la cinématique.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('replay') === '1') {
      sessionStorage.removeItem(storageKey);
      return;
    }
    const navEntry = performance.getEntriesByType('navigation')[0] as
      | PerformanceNavigationTiming
      | undefined;
    if (navEntry?.type === 'reload') {
      sessionStorage.removeItem(storageKey);
      return;
    }
    if (sessionStorage.getItem(storageKey) === '1') {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot sync from external store (sessionStorage) on mount
      setCinematicDone(true);
    }
  }, [storageKey]);

  // Fondu d'entrée de la musique une fois la lecture démarrée.
  useEffect(() => {
    if (!audioOn) return;
    const el = audioRef.current;
    if (!el) return;
    let v = el.volume;
    const id = setInterval(() => {
      v = Math.min(TARGET_VOLUME, v + 0.03);
      el.volume = v;
      if (v >= TARGET_VOLUME) clearInterval(id);
    }, 60);
    return () => clearInterval(id);
  }, [audioOn]);

  function startAudio() {
    const el = audioRef.current;
    if (!el) return;
    el.loop = true;
    el.volume = 0;
    el.muted = false;
    // play() DOIT être appelé dans le handler du geste utilisateur (iOS).
    void el
      .play()
      .then(() => setAudioOn(true))
      .catch(() => {
        // Lecture refusée (politique navigateur) — l'invitation reste utilisable.
      });
  }

  function handleGateOpen() {
    startAudio();
    setEntered(true);
  }

  function toggleAudio() {
    if (!audioOn) {
      // Cas « déjà vu » : premier tap = démarrer la musique à la demande.
      startAudio();
      setEntered(true);
      return;
    }
    const el = audioRef.current;
    if (!el) return;
    el.muted = !el.muted;
    setMuted(el.muted);
  }

  function handleComplete() {
    setCinematicDone(true);
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem(storageKey, '1');
      } catch {
        // sessionStorage may be unavailable in private mode — silent fail.
      }
    }
  }

  const gateVisible = hasMusic && !entered && !cinematicDone;
  const cinematicVisible = !cinematicDone && (!hasMusic || entered);
  const initials = `${(partnerA.trim()[0] ?? '').toUpperCase()} & ${(partnerB.trim()[0] ?? '').toUpperCase()}`;

  return (
    <>
      {hasMusic && <audio ref={audioRef} src={music.url} preload="auto" loop aria-hidden="true" />}

      <AnimatePresence>
        {gateVisible && (
          <motion.div
            key="invitation-gate"
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="inv-gate"
          >
            <div className="inv-gate-inner">
              <span className="inv-gate-mono">{initials}</span>
              <span className="inv-gate-rule" aria-hidden />
              <button type="button" className="inv-gate-btn focus-ring" onClick={handleGateOpen}>
                {t('openInvitation')}
              </button>
              <span className="inv-gate-note">♪ {music.title ?? t('musicHint')}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {cinematicVisible && (
          <motion.div
            key="cinematic-overlay"
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
            className="fixed inset-0 z-50"
          >
            <CinematicPlayer
              live
              cinematic={cinematic}
              partnerA={partnerA}
              partnerB={partnerB}
              formattedDate={formattedDate}
              venueName={venueName}
              accentColor={accentColor}
              eventDate={eventDate}
              onDone={handleComplete}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {hasMusic && (entered || cinematicDone) && (
        <button
          type="button"
          className="inv-audio-btn focus-ring"
          onClick={toggleAudio}
          aria-label={
            !audioOn ? t('musicPlayAria') : muted ? t('musicUnmuteAria') : t('musicMuteAria')
          }
          data-state={!audioOn || muted ? 'off' : 'on'}
        >
          <SpeakerIcon off={!audioOn || muted} />
        </button>
      )}

      {/* Contenu invitation — SSR-friendly, simplement scrollable une fois
          la cinematic terminée. On masque visuellement avant pour éviter
          le flash sous l'overlay. */}
      <div
        aria-hidden={!cinematicDone}
        style={{
          opacity: cinematicDone ? 1 : 0,
          pointerEvents: cinematicDone ? 'auto' : 'none',
          transition: 'opacity 0.5s ease-out 0.1s',
        }}
      >
        {children}
      </div>
    </>
  );
}
