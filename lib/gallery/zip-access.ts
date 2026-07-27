/**
 * Droit de télécharger l'archive ZIP HD de la galerie (originaux pleine
 * résolution). Partagé entre la route `download-zip` (enforcement serveur) et
 * la page galerie (affichage du bouton) pour éviter toute divergence.
 *
 * Trois portes :
 *  - **Premium** : la feature `galleryZipDownload` est incluse (cf.
 *    `PREMIUM_EXTRA_FEATURES`).
 *  - **Pro (org)** : un event rattaché à une organisation a toutes les
 *    features Premium.
 *  - **Upsell HD post-event** : un event Essentiel qui a acheté l'upsell HD
 *    (+29 €) débloque l'export HD + l'archive 5 ans, quel que soit son plan.
 */
export function canDownloadGalleryZip(event: {
  planTier?: 'essential' | 'premium';
  organizationId?: string;
  hdUpsellPurchasedAt?: number;
}): boolean {
  return (
    event.planTier === 'premium' ||
    Boolean(event.organizationId) ||
    Boolean(event.hdUpsellPurchasedAt)
  );
}
