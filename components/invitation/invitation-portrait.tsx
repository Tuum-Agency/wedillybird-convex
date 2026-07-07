/**
 * Portrait du couple en tête de l'invitation publique.
 *
 * Dévoilé AVEC le contenu quand la cinématique se lève : `InvitationShell`
 * garde les enfants en `opacity: 0` sous l'overlay, puis fait le fondu — le
 * portrait apparaît donc au moment où l'enveloppe (ou le thème choisi) s'ouvre.
 * Rien à animer ici : markup serveur pur.
 *
 * Cadre papeterie premium : arche haute façon vitrail de chapelle, double
 * filet gold sur passe-partout ivoire, halo blush signature (`--shadow-blush`).
 * L'orientation de l'upload importe peu — ratio 4/5 fixe + `object-fit: cover`
 * (cadrage biaisé vers le haut pour les visages) → toujours un vrai portrait.
 *
 * `photo` = projection client (`photoForClient`) : URL CloudFront résolue.
 * `null` = pas de photo → aucun rendu.
 */
export function InvitationPortrait({
  photo,
  alt,
}: {
  photo: { url: string; width?: number; height?: number } | null;
  alt: string;
}) {
  if (!photo) return null;
  return (
    <figure className="inv-portrait">
      {/* eslint-disable-next-line @next/next/no-img-element -- URL CloudFront externe; next/image exigerait remotePatterns */}
      <img
        src={photo.url}
        alt={alt}
        loading="eager"
        decoding="async"
        className="inv-portrait-img"
      />
    </figure>
  );
}
