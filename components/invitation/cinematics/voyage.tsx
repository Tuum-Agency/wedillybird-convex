'use client';

import { useTranslations } from 'next-intl';
import { useReducedMotion } from 'motion/react';
import { useRef, type CSSProperties } from 'react';
import {
  CinematicSkip,
  useCinematicTimeline,
  useCountdown,
  useSceneParallax,
  type CinematicSceneProps,
} from './shared';
import './voyage.css';

/**
 * « L'Embarquement » — cinématique voyage, langage graphique AVIATION.
 * AUCUNE carte de papeterie : une vraie CARTE D'EMBARQUEMENT paysage.
 *
 * Cabine au crépuscule : le cache du hublot se lève sur l'aube, la caméra
 * traverse le hublot et bascule en plein ciel. Un avion en papier trace sa
 * route pendant que la carte d'embarquement glisse comme si elle sortait de
 * l'imprimante : codes voyageurs (CAM ✈ HUG), porte ♥, siège 2A, talon à
 * code-barres — puis un TAMPON encreur s'abat dessus. Le compte à rebours
 * final est un TABLEAU DES DÉPARTS à volets.
 *
 * Phases : 0 cabine · 1 shade (cache) · 2 through (traversée) · 3 ticket
 *          (impression du pass) · 4 stamp (tampon) · 5 settled (départs)
 */
const WAITS = [900, 800, 1050, 1050, 900];
const PHASES = ['', 'shade', 'through', 'ticket', 'stamp', 'settled'] as const;

/** translateZ ≤ 22 px : les nuages restent DERRIÈRE le pass (z 30). */
const CLOUDS: ReadonlyArray<{ x: number; y: number; s: number; z: number; d: number }> = [
  { x: 8, y: 66, s: 1.25, z: 18, d: 0 },
  { x: 55, y: 74, s: 1.6, z: 10, d: 1.6 },
  { x: 30, y: 84, s: 2, z: 22, d: 0.8 },
  { x: 72, y: 60, s: 1, z: 6, d: 2.4 },
  { x: -6, y: 80, s: 1.7, z: 14, d: 3.1 },
  { x: 62, y: 88, s: 2.2, z: 4, d: 1.2 },
];

const MINI_CLOUDS: ReadonlyArray<{ x: number; y: number; s: number; d: number }> = [
  { x: 6, y: 58, s: 0.8, d: 0 },
  { x: 48, y: 70, s: 1.05, d: 1.4 },
  { x: 26, y: 82, s: 1.3, d: 0.7 },
];

/** Code voyageur 3 lettres (accents retirés) — signature aviation. */
function travelCode(name: string): string {
  const letters = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z]/g, '')
    .toUpperCase();
  return (letters.slice(0, 3) || 'AMR').padEnd(3, letters[0] ?? 'A');
}

export function CinematicVoyage({
  partnerA,
  partnerB,
  formattedDate,
  venueName,
  eventDate,
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

  const { effectivePhase, skipToEnd } = useCinematicTimeline({
    waits: WAITS,
    playKey,
    holdPhase,
    isReduced,
    onDone,
  });
  const par = useSceneParallax(sceneRef, { enabled: parallax && !isReduced });
  const cd = useCountdown(eventDate);
  const target = eventDate != null ? new Date(eventDate).getTime() : null;

  const sceneCls = [
    'cineV-scene',
    'cineV',
    isReduced && 'reduced',
    holdPhase != null && 'frozen',
    ...PHASES.slice(1, effectivePhase + 1),
  ]
    .filter(Boolean)
    .join(' ');

  const stageCls = ['cineV-stage', live && 'live'].filter(Boolean).join(' ');

  const initials = `${(partnerA.trim()[0] ?? '').toUpperCase()} ♥ ${(partnerB.trim()[0] ?? '').toUpperCase()}`;

  const cloud = (c: { x: number; y: number; s: number; d: number; z?: number }, i: number) => (
    <span
      key={i}
      className="cl"
      style={
        {
          left: `${c.x}%`,
          top: `${c.y}%`,
          '--cs': c.s,
          '--cz': `${c.z ?? 0}px`,
          '--cd': `${c.d}s`,
        } as CSSProperties
      }
    />
  );

  const flap = (v: number | null, u: string, i: number) => (
    <span className="v-cell" style={{ '--fd': `${i * 0.14}s` } as CSSProperties}>
      <b>{v == null ? '——' : String(v).padStart(2, '0')}</b>
      <i>{u}</i>
    </span>
  );

  return (
    <div className={stageCls} role="presentation">
      {live && holdPhase == null && !isReduced && effectivePhase < 5 && (
        <CinematicSkip
          onSkip={() => {
            skipToEnd();
            onDone?.();
          }}
        />
      )}

      <div
        className={sceneCls}
        ref={sceneRef}
        onPointerMove={par.onPointerMove}
        onPointerLeave={par.onPointerLeave}
      >
        <div className="vx-camera">
          <div className="vx-par">
            {/* Plein ciel (révélé à la traversée du hublot) */}
            <div className="vx-sky" aria-hidden>
              <span className="sun" />
              <span className="horizon" />
              {CLOUDS.map(cloud)}
              <span className="streak s1" />
              <span className="streak s2" />
            </div>

            {/* Avion en papier + traînée pointillée */}
            <div className="pp-path" aria-hidden>
              <span className="pp-trail" />
              <div className="pplane">
                <span className="w1" />
                <span className="w2" />
              </div>
            </div>

            {/* Cabine + hublot */}
            <div className="vx-cabin" aria-hidden />
            <div className="hublot" aria-hidden>
              <div className="h-sky">
                <span className="sun" />
                {MINI_CLOUDS.map(cloud)}
                <div className="h-shade">
                  <span className="h-handle" />
                </div>
                <span className="h-glass" />
              </div>
              <span className="h-frame" />
            </div>
            <div className="h-plaque" aria-hidden>
              {initials}
            </div>

            {/* CARTE D'EMBARQUEMENT paysage */}
            <div className="v-pass">
              <div className="v-main">
                <div className="v-head">
                  <span className="v-brand">Wedillybird Air</span>
                  <span className="v-type">{t('youreInvited')}</span>
                </div>
                <div className="v-codes">
                  <b className="v-f f1">{travelCode(partnerA)}</b>
                  <span className="v-planeglyph v-f f2" aria-hidden>
                    <i className="w1" />
                    <i className="w2" />
                  </span>
                  <b className="v-f f3">{travelCode(partnerB)}</b>
                </div>
                <div className="v-names v-f f4">
                  {partnerA} &amp; {partnerB}
                </div>
                <div className="v-fields">
                  <span className="v-field v-f f5">
                    <i>{t('passDate')}</i>
                    <b>{formattedDate}</b>
                  </span>
                  <span className="v-field v-f f6">
                    <i>{t('passGate')}</i>
                    <b>♥</b>
                  </span>
                  <span className="v-field v-f f7">
                    <i>{t('passSeat')}</i>
                    <b>2A</b>
                  </span>
                </div>
                {venueName ? <div className="v-venue v-f f8">{venueName}</div> : null}
              </div>
              <div className="v-stub" aria-hidden>
                <span className="v-barcode" />
                <span className="v-stubtxt">{initials}</span>
              </div>
              {/* Le tampon encreur */}
              <span className="v-stamp" aria-hidden>
                <i>{initials}</i>
                <em>Wedillybird</em>
              </span>
            </div>
          </div>
        </div>

        {/* Compte à rebours « tableau des départs » */}
        {target != null && (
          <div className="v-board">
            <span className="lbl">{t('countdownLabel')}</span>
            <div className="row">
              {flap(cd?.d ?? null, t('countdownDays'), 0)}
              {flap(cd?.h ?? null, t('countdownHours'), 1)}
              {flap(cd?.m ?? null, t('countdownMinutes'), 2)}
            </div>
          </div>
        )}
      </div>

      <p className="cineV-cue" style={{ opacity: effectivePhase === 4 ? 1 : 0 }}>
        <span className="t">{t('scrollToDiscover')}</span>
      </p>
    </div>
  );
}
