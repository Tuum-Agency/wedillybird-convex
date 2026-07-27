'use client';

import { useTranslations } from 'next-intl';
import { useReducedMotion } from 'motion/react';
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  type CinematicSceneProps,
  useCountdown,
  useSceneParallax,
  CinematicSkip,
  CinematicCountdown,
} from './shared';
import './fairepart.css';

/**
 * Cinématique « Le Faire-part » — une vraie page d'invitation, ouverte au TAP.
 *
 * Un faire-part photo scellé d'un cachet de cire en 3D. On appuie sur le sceau :
 * il SAUTE (bond 3D rotate3d + squash-stretch, onde de choc), le bandeau de
 * vélin se retire et la carte révèle la photo du couple, vos prénoms, la date,
 * le lieu — puis un rappel du déroulé de la cérémonie (édité depuis l'espace
 * couple/agence, affiché sur la page en dessous).
 *
 * Autoplay dans le shell / la landing (le tap est simulé après un court temps),
 * mais un vrai tap du sceau déclenche l'ouverture immédiatement. Contrat
 * identique aux autres thèmes (phases 0→4, `holdPhase`, `playKey`, `onDone`,
 * reduced-motion → état ouvert direct).
 */

// ms avant chaque transition : [fenêtre de tap] · pop · ouverture · pose
const WAITS = [1500, 620, 720, 1000] as const;
const FINAL = WAITS.length; // phase 4 = apaisée

const DUST: ReadonlyArray<{ x: number; y: number; d: number }> = [
  { x: 16, y: 26, d: 0 },
  { x: 82, y: 20, d: 1.4 },
  { x: 72, y: 68, d: 2.3 },
  { x: 24, y: 74, d: 0.8 },
  { x: 50, y: 14, d: 3.1 },
];

export function CinematicFairepart({
  partnerA,
  partnerB,
  formattedDate,
  venueName,
  eventDate,
  photoUrl,
  reduced,
  parallax = true,
  holdPhase = null,
  playKey,
  onDone,
  live = false,
}: CinematicSceneProps) {
  const t = useTranslations('Invitation');
  const prefersReduced = useReducedMotion();
  const isReduced = reduced || !!prefersReduced;
  const sceneRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const [phase, setPhase] = useState(0);
  const effectivePhase = holdPhase ?? (isReduced ? FINAL : phase);

  // Réinitialise au changement de run (rejeu playKey, sortie de hold/reduced).
  const runKey = `${playKey ?? 0}|${holdPhase == null ? 'auto' : 'hold'}|${isReduced ? 'still' : 'anim'}`;
  const [prevRunKey, setPrevRunKey] = useState(runKey);
  if (runKey !== prevRunKey) {
    setPrevRunKey(runKey);
    setPhase(0);
  }

  const cd = useCountdown(eventDate);
  const { onPointerMove, onPointerLeave } = useSceneParallax(sceneRef, {
    enabled: parallax && !isReduced,
    intensity: 0.7,
  });

  // Enchaîne les phases à partir d'un index (réutilisé par l'autoplay et le tap).
  const runFrom = useCallback(
    (index: number) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      const step = (i: number) => {
        if (i >= WAITS.length) {
          timerRef.current = setTimeout(() => onDone?.(), 1100);
          return;
        }
        timerRef.current = setTimeout(() => {
          setPhase(i + 1);
          step(i + 1);
        }, WAITS[i]);
      };
      step(index);
    },
    [onDone],
  );

  useEffect(() => {
    if (holdPhase != null) return;
    if (isReduced) {
      const id = setTimeout(() => onDone?.(), 600);
      return () => clearTimeout(id);
    }
    // La phase est déjà remise à 0 au render (via `runKey`) — on lance la séquence.
    runFrom(0);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rejoue sur playKey/holdPhase/reduced
  }, [playKey, holdPhase, isReduced]);

  // Tap sur le sceau (ou la scène) : ouvre immédiatement si encore fermé.
  function handleOpen() {
    if (isReduced || holdPhase != null) return;
    if (phase === 0) {
      setPhase(1);
      runFrom(1);
    }
  }

  // Classes d'état cumulatives (state 0 = fermé, sans classe).
  const PHASE_CLASSES = ['pop', 'open', 'named', 'settled'] as const;
  const sceneCls = [
    'cineFp-scene',
    ...PHASE_CLASSES.slice(0, effectivePhase).map((c) => `cineFp-${c}`),
  ].join(' ');

  const initials = `${(partnerA.trim()[0] ?? '').toUpperCase()} & ${(partnerB.trim()[0] ?? '').toUpperCase()}`;
  const photoStyle: CSSProperties = photoUrl ? { backgroundImage: `url("${photoUrl}")` } : {};

  return (
    <div className="cineFp-stage paper-grain" data-phase={effectivePhase} role="presentation">
      {live && holdPhase == null && !isReduced && effectivePhase < FINAL && (
        <CinematicSkip onSkip={() => setPhase(FINAL)} />
      )}

      <div
        ref={sceneRef}
        className={sceneCls}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
      >
        <div className="cineFp-dust" aria-hidden>
          {DUST.map((p, i) => (
            <span
              key={i}
              style={{ left: `${p.x}%`, top: `${p.y}%`, '--dd': `${p.d}s` } as CSSProperties}
            />
          ))}
        </div>

        {/* La carte faire-part */}
        <div className="fp-card">
          <div className="fp-photo" style={photoStyle} data-empty={photoUrl ? undefined : ''}>
            {!photoUrl && <span className="fp-photo-mono">{initials}</span>}
            <span className="fp-photo-veil" aria-hidden />
          </div>

          {/* Panneau de texte révélé */}
          <div className="fp-panel">
            <span className="fp-eyebrow">{t('youreInvited')}</span>
            <span className="fp-rule" aria-hidden />
            <div className="fp-names">
              <span className="fp-name">{partnerA}</span>
              <span className="fp-amp" aria-hidden>
                &amp;
              </span>
              <span className="fp-name">{partnerB}</span>
            </div>
            <span className="fp-rule" aria-hidden />
            <span className="fp-date">{formattedDate}</span>
            {venueName && <span className="fp-venue">{venueName}</span>}
          </div>

          {/* Bandeau de vélin + sceau de cire 3D (tap) */}
          <button
            type="button"
            className="fp-band focus-ring"
            onClick={handleOpen}
            aria-label={t('openInvitation')}
          >
            <span className="fp-band-line" aria-hidden />
            <span className="fp-seal" aria-hidden>
              <span className="fp-seal-face">
                <span className="fp-seal-mono">{initials}</span>
                <span className="fp-seal-shine" />
              </span>
              <span className="fp-seal-ring" />
            </span>
            <span className="fp-shock" aria-hidden />
            <span className="fp-hint">{t('tapSeal')}</span>
          </button>
        </div>

        <div className="cineFp-orn" aria-hidden>
          <span>✦</span>
          <span>✦</span>
        </div>
      </div>

      {eventDate != null && <CinematicCountdown cd={cd} className="cineFp-after" />}
    </div>
  );
}
