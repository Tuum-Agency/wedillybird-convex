'use client';

import { useTranslations } from 'next-intl';
import { useReducedMotion } from 'motion/react';
import { useRef, type CSSProperties } from 'react';
import {
  CinematicSkip,
  shiftL,
  useCinematicTimeline,
  useCountdown,
  useSceneParallax,
  type CinematicSceneProps,
} from './shared';
import './royal.css';

/**
 * « L'Invitation royale » — l'ouverture de film. Un seul plan-séquence :
 *
 * Nuit de palais (façade dorée, torchères, lune) — les PORTES DE DOUZE
 * MÈTRES s'ouvrent sur un rai de lumière et une envolée de pétales — la
 * caméra FRANCHIT le seuil (vraie traversée 3D : le mur passe derrière la
 * caméra) et remonte la colonnade aux bougies — au fond, une invitation
 * FLOTTE au-dessus d'un piédestal de marbre, devant une baie en plein
 * cintre ouverte sur la nuit — gros plan : les PRÉNOMS SE GRAVENT EN OR
 * sur le bristol (sceau de cire, filigranes) — l'invitation se révèle
 * (date, lieu, étincelles) — final : FEUX D'ARTIFICE dorés dans la baie,
 * bougies qui vacillent, compte à rebours en chiffres royaux.
 *
 * Phases : 0 façade nocturne · 1 gates (les portes) · 2 hall (traversée) ·
 *          3 reveal (les prénoms) · 4 open (date & lieu) · 5 settled
 *
 * Rappels 3D durement acquis : les voiles lumineux (rai, vignette,
 * pétales) vivent HORS du contexte preserve-3d (sinon z-fighting) ; le mur
 * des portes ne fade jamais (la caméra le traverse, le navigateur cesse de
 * le peindre) ; plans parallèles à Z bien distincts.
 */
const WAITS = [1150, 1300, 1250, 1150, 1000];
const PHASES = ['', 'gates', 'hall', 'reveal', 'open', 'settled'] as const;

/** Étoiles du ciel de façade (au-dessus du fronton). */
const FSTARS: ReadonlyArray<{ x: number; y: number; s: number; d: number }> = [
  { x: 8, y: 12, s: 2, d: 0 },
  { x: 20, y: 6, s: 2.5, d: 1.6 },
  { x: 36, y: 14, s: 1.6, d: 2.8 },
  { x: 55, y: 5, s: 2.2, d: 0.9 },
  { x: 70, y: 12, s: 1.8, d: 3.4 },
  { x: 86, y: 7, s: 2.4, d: 2.1 },
  { x: 94, y: 16, s: 1.6, d: 1.2 },
];

/** Étoiles vues à travers la baie du fond. */
const WSTARS: ReadonlyArray<{ x: number; y: number; d: number }> = [
  { x: 22, y: 16, d: 0.4 },
  { x: 40, y: 8, d: 2.2 },
  { x: 58, y: 18, d: 1.1 },
  { x: 74, y: 10, d: 3.1 },
  { x: 32, y: 30, d: 1.8 },
  { x: 66, y: 32, d: 0 },
];

/** Feux d'artifice dans la baie (x/y % du ciel, délai, teinte or/blush). */
const FIREWORKS: ReadonlyArray<{ x: number; y: number; d: number; s: number; warm: boolean }> = [
  { x: 30, y: 26, d: 0, s: 1, warm: true },
  { x: 66, y: 18, d: 2.3, s: 0.8, warm: false },
  { x: 48, y: 34, d: 4.6, s: 0.9, warm: true },
];
const FW_SPOKES = [0, 36, 72, 108, 144, 180, 216, 252, 288, 324];

/** Colonnade : trois paires (x miroir, profondeur, échelle) — assez
    écartées pour ne jamais mordre sur la carte au gros plan. */
const COLS: ReadonlyArray<{ x: number; z: number; s: number }> = [
  { x: 128, z: -40, s: 1 },
  { x: 119, z: -85, s: 0.88 },
  { x: 113, z: -125, s: 0.78 },
];

/** Bougies des candélabres (x, profondeur, délai de vacillement). */
const CANDLES: ReadonlyArray<{ x: number; z: number; d: number }> = [
  { x: -112, z: -52, d: 0 },
  { x: 112, z: -52, d: 0.7 },
  { x: -90, z: -96, d: 1.3 },
  { x: 90, z: -96, d: 0.4 },
  { x: -72, z: -134, d: 1.9 },
  { x: 72, z: -134, d: 1 },
];

/** Poussière d'or en suspension (overlay plat, hors 3D). */
const DUST: ReadonlyArray<{ x: number; y: number; s: number; d: number; t: number }> = [
  { x: 12, y: 30, s: 2.5, d: 0, t: 10 },
  { x: 26, y: 62, s: 2, d: 2.4, t: 12 },
  { x: 42, y: 24, s: 3, d: 4.8, t: 9 },
  { x: 58, y: 70, s: 2, d: 1.2, t: 11 },
  { x: 72, y: 36, s: 2.5, d: 3.6, t: 10.5 },
  { x: 86, y: 58, s: 2, d: 5.9, t: 9.5 },
  { x: 34, y: 84, s: 2.5, d: 7.1, t: 12.5 },
  { x: 66, y: 88, s: 2, d: 8.3, t: 10 },
];

/** Envolée de pétales à l'ouverture des portes (cible, rotation, délai). */
const PETALS: ReadonlyArray<{ tx: number; ty: number; r: number; d: number; s: number }> = [
  { tx: -130, ty: -150, r: -240, d: 0, s: 1 },
  { tx: 120, ty: -180, r: 300, d: 0.1, s: 0.8 },
  { tx: -70, ty: -220, r: 200, d: 0.05, s: 0.9 },
  { tx: 60, ty: -120, r: -280, d: 0.2, s: 1.1 },
  { tx: -160, ty: -60, r: 320, d: 0.15, s: 0.7 },
  { tx: 150, ty: -90, r: -200, d: 0.25, s: 0.9 },
  { tx: -40, ty: -260, r: 260, d: 0.3, s: 0.8 },
  { tx: 30, ty: -240, r: -320, d: 0.12, s: 1 },
  { tx: -110, ty: -190, r: 180, d: 0.35, s: 0.75 },
  { tx: 90, ty: -210, r: -180, d: 0.22, s: 0.85 },
];

/** Étincelles qui montent autour de la carte à la révélation des infos. */
const SPARKS: ReadonlyArray<{ x: number; d: number }> = [
  { x: -70, d: 0 },
  { x: 62, d: 0.3 },
  { x: -34, d: 0.6 },
  { x: 78, d: 0.15 },
  { x: -82, d: 0.45 },
  { x: 40, d: 0.75 },
];

export function CinematicRoyal({
  partnerA,
  partnerB,
  formattedDate,
  venueName,
  accentColor,
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
  const par = useSceneParallax(sceneRef, { enabled: parallax && !isReduced, intensity: 1.4 });
  const cd = useCountdown(eventDate);
  const target = eventDate != null ? new Date(eventDate).getTime() : null;

  const sceneCls = [
    'cineR-scene',
    'cineR',
    isReduced && 'reduced',
    holdPhase != null && 'frozen',
    ...PHASES.slice(1, effectivePhase + 1),
  ]
    .filter(Boolean)
    .join(' ');

  // Marque blanche : l'accent teinte la cire du sceau.
  const tint: CSSProperties = accentColor
    ? ({ '--c-wax': shiftL(accentColor, -0.16) } as CSSProperties)
    : {};

  const stageCls = ['cineR-stage', live && 'live'].filter(Boolean).join(' ');

  const cdCell = (v: number | null, u: string, i: number) => (
    <span className="r-cdc" style={{ '--cdd': `${i * 0.12}s` } as CSSProperties}>
      <b>{v == null ? '—' : String(v).padStart(2, '0')}</b>
      <i>{u}</i>
    </span>
  );

  return (
    <div className={stageCls} style={tint} role="presentation">
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
        <div className="rx-camera">
          <div className="rx-par">
            {/* La baie en plein cintre du fond — ciel nocturne + feux d'artifice */}
            <div className="r-window" aria-hidden>
              <span className="r-wsky">
                {WSTARS.map((s, i) => (
                  <i
                    key={i}
                    className="r-wstar"
                    style={{ left: `${s.x}%`, top: `${s.y}%`, '--sd': `${s.d}s` } as CSSProperties}
                  />
                ))}
                {FIREWORKS.map((f, i) => (
                  <span
                    key={i}
                    className={`r-fw ${f.warm ? 'warm' : 'soft'}`}
                    style={
                      {
                        left: `${f.x}%`,
                        top: `${f.y}%`,
                        '--fd': `${f.d}s`,
                        '--fs': f.s,
                      } as CSSProperties
                    }
                  >
                    {FW_SPOKES.map((a) => (
                      <i key={a} style={{ '--fa': `${a}deg` } as CSSProperties} />
                    ))}
                    <em />
                  </span>
                ))}
              </span>
              <span className="r-arch" />
            </div>

            {/* Colonnade (trois paires en profondeur) */}
            {COLS.map((c, i) => (
              <span
                key={i}
                className="r-col"
                aria-hidden
                style={
                  {
                    '--cx': `${-c.x}px`,
                    '--cz': `${c.z}px`,
                    '--cs': c.s,
                  } as CSSProperties
                }
              />
            ))}
            {COLS.map((c, i) => (
              <span
                key={i}
                className="r-col"
                aria-hidden
                style={
                  {
                    '--cx': `${c.x}px`,
                    '--cz': `${c.z}px`,
                    '--cs': c.s,
                  } as CSSProperties
                }
              />
            ))}

            {/* Sol de marbre + tapis d'honneur */}
            <span className="r-floor" aria-hidden />

            {/* Bougies des candélabres */}
            <div className="r-candles" aria-hidden>
              {CANDLES.map((k, i) => (
                <span
                  key={i}
                  className="r-candle"
                  style={
                    {
                      '--kx': `${k.x}px`,
                      '--kz': `${k.z}px`,
                      '--kd': `${k.d}s`,
                    } as CSSProperties
                  }
                >
                  <i className="r-flame" />
                </span>
              ))}
            </div>

            {/* Le piédestal de marbre */}
            <div className="r-dais" aria-hidden>
              <i className="top" />
              <i className="shaft" />
              <i className="base" />
            </div>

            {/* L'INVITATION en lévitation — les prénoms gravés en or */}
            <div className="r-inv">
              <span className="r-glow" aria-hidden />
              <div className="r-card">
                <span className="r-frame" aria-hidden />
                <span className="r-crest" aria-hidden>
                  ✦
                </span>
                <span className="r-eyebrow">{t('youreInvited')}</span>
                <b className="r-name na">{partnerA}</b>
                <span className="r-amp" aria-hidden>
                  <i>✦</i>&<i>✦</i>
                </span>
                <b className="r-name nb">{partnerB}</b>
                <span className="r-filet" aria-hidden />
                <span className="r-date">{formattedDate}</span>
                {venueName ? <span className="r-venue">{venueName}</span> : null}
                <span className="r-seal" aria-hidden>
                  <i />
                </span>
                <span className="r-cardshine" aria-hidden />
              </div>
              <span className="r-sparks" aria-hidden>
                {SPARKS.map((s, i) => (
                  <i key={i} style={{ '--px': `${s.x}px`, '--pd': `${s.d}s` } as CSSProperties} />
                ))}
              </span>
            </div>

            {/* Le mur des portes — la caméra le TRAVERSE au passage en salle */}
            <div className="r-doorwall" aria-hidden>
              <span className="r-fsky">
                {FSTARS.map((s, i) => (
                  <i
                    key={i}
                    style={
                      {
                        left: `${s.x}%`,
                        top: `${s.y}%`,
                        width: s.s,
                        height: s.s,
                        '--sd': `${s.d}s`,
                      } as CSSProperties
                    }
                  />
                ))}
                <i className="r-moon" />
              </span>
              <span className="r-pediment" />
              <span className="r-jamb jl" />
              <span className="r-jamb jr" />
              <div className="r-door dl">
                <i className="p1" />
                <i className="p2" />
                <i className="knob" />
              </div>
              <div className="r-door dr">
                <i className="p1" />
                <i className="p2" />
                <i className="knob" />
              </div>
              <span className="r-torch tl">
                <i className="r-flame" />
              </span>
              <span className="r-torch tr">
                <i className="r-flame" />
              </span>
            </div>
          </div>
        </div>

        {/* Voiles PLATS hors du contexte 3D (leçon z-fighting) : rai de
            lumière de l'ouverture, envolée de pétales, poussière d'or,
            vignette cinéma. */}
        <span className="r-blade" aria-hidden />
        <div className="r-petals" aria-hidden>
          {PETALS.map((p, i) => (
            <i
              key={i}
              style={
                {
                  '--ptx': `${p.tx}px`,
                  '--pty': `${p.ty}px`,
                  '--pr': `${p.r}deg`,
                  '--pd': `${p.d}s`,
                  '--ps': p.s,
                } as CSSProperties
              }
            />
          ))}
        </div>
        <div className="r-dust" aria-hidden>
          {DUST.map((p, i) => (
            <i
              key={i}
              style={
                {
                  left: `${p.x}%`,
                  top: `${p.y}%`,
                  width: p.s,
                  height: p.s,
                  '--dd': `${p.d}s`,
                  '--dt': `${p.t}s`,
                } as CSSProperties
              }
            />
          ))}
        </div>

        {/* Compte à rebours royal */}
        {target != null && (
          <div className="r-cd">
            <span className="lbl">{t('countdownLabel')}</span>
            <span className="r-rule" aria-hidden />
            <div className="row">
              {cdCell(cd?.d ?? null, t('countdownDays'), 0)}
              {cdCell(cd?.h ?? null, t('countdownHours'), 1)}
              {cdCell(cd?.m ?? null, t('countdownMinutes'), 2)}
            </div>
            <span className="r-rule" aria-hidden />
          </div>
        )}
      </div>

      {/* Vignette cinéma — sur le STAGE entier (pas la boîte de scène,
          sinon elle dessine un rectangle sombre sur le fond). */}
      <span className="r-vign" aria-hidden />

      <p className="cineR-cue" style={{ opacity: effectivePhase === 4 ? 1 : 0 }}>
        <span className="t">{t('scrollToDiscover')}</span>
      </p>
    </div>
  );
}
