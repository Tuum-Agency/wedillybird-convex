import type { CinematicId } from './cinematics/registry';

/**
 * Décor ambiant de la PAGE d'invitation — prolonge l'ADN de la cinématique
 * choisie une fois celle-ci terminée (fond, motifs, particules discrètes).
 *
 * Couches `position: fixed` sous le contenu (le wrapper de contenu du shell
 * est en z-index 1) ; volontairement AUTONOME côté CSS
 * (`invitation-themes.css`) : le décor doit exister même quand la cinématique
 * ne se rejoue pas (retour de galerie → seen-skip, le composant de thème
 * n'est alors jamais chargé).
 */
export function InvitationThemeDecor({ theme }: { theme: CinematicId }) {
  // `seal` et `fairepart` = page éditoriale light, sans décor ambiant dédié.
  if (theme === 'seal' || theme === 'fairepart') return null;

  if (theme === 'royal') {
    return (
      <div className="invd invd-royal" aria-hidden>
        <span className="invd-bg" />
        <span className="invd-y-arch" />
        <span className="invd-y-col wl" />
        <span className="invd-y-col wr" />
        <span className="invd-y-candle ka" />
        <span className="invd-y-candle kb" />
        <span className="invd-dust d1" />
        <span className="invd-dust d2" />
        <span className="invd-dust d3" />
      </div>
    );
  }

  if (theme === 'floral') {
    return (
      <div className="invd invd-floral" aria-hidden>
        <span className="invd-bg" />
        <span className="invd-f-corner ca">
          {[0, 1, 2].map((i) => (
            <Bloom key={i} i={i} />
          ))}
        </span>
        <span className="invd-f-corner cb">
          {[0, 1, 2].map((i) => (
            <Bloom key={i} i={i} />
          ))}
        </span>
        <span className="invd-f-meadow" />
        <span className="invd-f-petal p1" />
        <span className="invd-f-petal p2" />
        <span className="invd-dust d1" />
        <span className="invd-dust d2" />
      </div>
    );
  }

  if (theme === 'cake') {
    return (
      <div className="invd invd-cake" aria-hidden>
        <span className="invd-bg" />
        <span className="invd-k-spot" />
        <span className="invd-k-pearls" />
        <span className="invd-dust d1" />
        <span className="invd-dust d2" />
        <span className="invd-dust d3" />
      </div>
    );
  }

  if (theme === 'voyage') {
    return (
      <div className="invd invd-voyage" aria-hidden>
        <span className="invd-bg" />
        <span className="invd-v-route" />
        <span className="invd-v-plane">
          <i className="w1" />
          <i className="w2" />
        </span>
        <span className="invd-v-cloud c1" />
        <span className="invd-v-cloud c2" />
        <span className="invd-v-cloud c3" />
      </div>
    );
  }

  if (theme === 'theatre') {
    return (
      <div className="invd invd-theatre" aria-hidden>
        <span className="invd-bg" />
        <span className="invd-t-moon" />
        {STARS8.map((s, i) => (
          <span
            key={i}
            className="invd-t-star"
            style={{ left: `${s.x}%`, top: `${s.y}%`, animationDelay: `${s.d}s` }}
          />
        ))}
        <span className="invd-t-cone" />
        <span className="invd-t-wing wl" />
        <span className="invd-t-wing wr" />
      </div>
    );
  }

  if (theme === 'etoiles') {
    return (
      <div className="invd invd-etoiles" aria-hidden>
        <span className="invd-bg" />
        <span className="invd-s-milky" />
        {STARS10.map((s, i) => (
          <span
            key={i}
            className="invd-s-star"
            style={{ left: `${s.x}%`, top: `${s.y}%`, animationDelay: `${s.d}s` }}
          />
        ))}
        <span className="invd-s-shoot" />
      </div>
    );
  }

  if (theme === 'lanternes') {
    return (
      <div className="invd invd-lanternes" aria-hidden>
        <span className="invd-bg" />
        {[
          { x: 12, y: 68, d: 0, s: 1 },
          { x: 84, y: 30, d: 3.2, s: 0.8 },
          { x: 68, y: 78, d: 6.1, s: 0.65 },
        ].map((l, i) => (
          <span
            key={i}
            className="invd-l-lant"
            style={
              {
                left: `${l.x}%`,
                top: `${l.y}%`,
                scale: `${l.s}`,
                animationDelay: `${l.d}s`,
              } as React.CSSProperties
            }
          />
        ))}
        <span className="invd-l-fly a" />
        <span className="invd-l-fly b" />
      </div>
    );
  }

  if (theme === 'rivage') {
    return (
      <div className="invd invd-rivage" aria-hidden>
        <span className="invd-bg" />
        <span className="invd-r-sea">
          <i className="foam" />
        </span>
        <span className="invd-r-shell" />
        <span className="invd-r-star" />
      </div>
    );
  }

  if (theme === 'feux') {
    return (
      <div className="invd invd-feux" aria-hidden>
        <span className="invd-bg" />
        <span className="invd-w-trees" />
        <span className="invd-w-far a" />
        <span className="invd-w-far b" />
        <span className="invd-w-ember e1" />
        <span className="invd-w-ember e2" />
      </div>
    );
  }

  if (theme === 'deco') {
    return (
      <div className="invd invd-deco" aria-hidden>
        <span className="invd-bg" />
        <span className="invd-d-frame" />
        <span className="invd-d-fan">
          {[-52, -26, 0, 26, 52].map((a, i) => (
            <i key={i} style={{ rotate: `${a}deg` }} />
          ))}
        </span>
        <span className="invd-d-bub b1" />
        <span className="invd-d-bub b2" />
        <span className="invd-d-bub b3" />
      </div>
    );
  }

  // neige
  return (
    <div className="invd invd-neige" aria-hidden>
      <span className="invd-bg" />
      <span className="invd-n-pines" />
      {FLAKES8.map((f, i) => (
        <span
          key={i}
          className="invd-n-flake"
          style={
            {
              left: `${f.x}%`,
              width: f.s,
              height: f.s,
              animationDuration: `${f.t}s`,
              animationDelay: `${f.d}s`,
            } as React.CSSProperties
          }
        />
      ))}
      <span className="invd-n-fern fl" />
      <span className="invd-n-fern fr" />
    </div>
  );
}

const STARS8 = [
  { x: 8, y: 10, d: 0 },
  { x: 22, y: 22, d: 1.4 },
  { x: 38, y: 8, d: 2.6 },
  { x: 58, y: 16, d: 0.8 },
  { x: 76, y: 7, d: 1.9 },
  { x: 90, y: 20, d: 3.1 },
  { x: 14, y: 34, d: 2.2 },
  { x: 84, y: 36, d: 0.4 },
];

const STARS10 = [...STARS8, { x: 46, y: 30, d: 3.7 }, { x: 66, y: 40, d: 1.1 }];

const FLAKES8 = [
  { x: 8, s: 4, t: 11, d: 0 },
  { x: 22, s: 3, t: 13, d: 2.6 },
  { x: 38, s: 5, t: 10, d: 5.1 },
  { x: 54, s: 3.5, t: 12, d: 1.4 },
  { x: 68, s: 4.5, t: 11.5, d: 6.8 },
  { x: 80, s: 3, t: 13.5, d: 3.7 },
  { x: 92, s: 4, t: 10.5, d: 8.2 },
  { x: 30, s: 2.5, t: 14, d: 9.4 },
];

/** Petite fleur de coin (6 pétales + cœur doré). */
function Bloom({ i }: { i: number }) {
  return (
    <span className={`invd-bloom b${i}`}>
      {[0, 1, 2, 3, 4, 5].map((p) => (
        <i key={p} style={{ rotate: `${p * 60}deg` }} />
      ))}
      <em />
    </span>
  );
}
