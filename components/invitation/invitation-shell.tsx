'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useState, type ReactNode } from 'react';
import { CinematicOpening } from './cinematic-opening';

/**
 * InvitationShell — orchestre la cinématique d'ouverture puis dévoile le
 * contenu de l'invitation (server-rendered en dessous).
 *
 * Pattern : la cinématique est un overlay `position: fixed inset-0 z-50`
 * qui couvre le contenu. Quand onComplete est déclenché (par la timeline
 * auto-play ou par le bouton Skip), l'overlay fade out (350ms) et le
 * contenu reste, déjà SEO-friendly et hydraté.
 *
 * `sessionStorage` mémorise que l'invité a déjà vu la cinématique pour
 * cette session — éviter de la re-jouer si l'utilisateur navigue
 * dans /i/[token]/gallery puis revient.
 */
export interface InvitationShellProps {
  partnerA: string;
  partnerB: string;
  formattedDate: string;
  venueName?: string;
  /** Couleur d'accent du couple (theme.primaryColor) — sceau + filets. */
  accentColor?: string;
  /** Token de l'invitation, sert de clé sessionStorage pour le replay. */
  token: string;
  children: ReactNode;
}

export function InvitationShell({
  partnerA,
  partnerB,
  formattedDate,
  venueName,
  accentColor,
  token,
  children,
}: InvitationShellProps) {
  const storageKey = `wbb-cinematic-seen:${token}`;
  // Le state initial doit être SSR-friendly — donc toujours `false` pour
  // ne pas créer un mismatch avec le serveur. On lit sessionStorage en
  // useEffect après le mount.
  const [cinematicDone, setCinematicDone] = useState(false);

  // useEffect d'init : on regarde si la cinematic a déjà été vue pour ce
  // token dans cette session, on l'esquive si oui.
  useState(() => {
    if (typeof window === 'undefined') return;
    if (sessionStorage.getItem(storageKey) === '1') {
      setCinematicDone(true);
    }
  });

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

  return (
    <>
      <AnimatePresence>
        {!cinematicDone && (
          <motion.div
            key="cinematic-overlay"
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
            className="fixed inset-0 z-50"
          >
            <CinematicOpening
              partnerA={partnerA}
              partnerB={partnerB}
              formattedDate={formattedDate}
              venueName={venueName}
              accentColor={accentColor}
              onComplete={handleComplete}
            />
          </motion.div>
        )}
      </AnimatePresence>

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
