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
  if (theme === 'seal') return null;

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

  // theatre
  return (
    <div className="invd invd-theatre" aria-hidden>
      <span className="invd-bg" />
      <span className="invd-t-moon" />
      {[
        { x: 8, y: 10, d: 0 },
        { x: 22, y: 22, d: 1.4 },
        { x: 38, y: 8, d: 2.6 },
        { x: 58, y: 16, d: 0.8 },
        { x: 76, y: 7, d: 1.9 },
        { x: 90, y: 20, d: 3.1 },
        { x: 14, y: 34, d: 2.2 },
        { x: 84, y: 36, d: 0.4 },
      ].map((s, i) => (
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
