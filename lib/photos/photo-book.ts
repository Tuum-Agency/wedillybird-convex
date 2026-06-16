/**
 * Validation **pure** de l'adresse de livraison d'un livre photo HD. Partagée
 * entre le formulaire client (désactivation du bouton + erreurs inline) et le
 * test unitaire. La mutation Convex `photoBooks:request` refait sa propre garde
 * côté serveur — ceci n'est qu'un garde-fou UX.
 */
export interface PhotoBookAddressInput {
  recipientName: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  postalCode: string;
  country: string;
  notes?: string;
}

/** Champs requis et leur ordre d'affichage. */
export const PHOTO_BOOK_REQUIRED_FIELDS = [
  'recipientName',
  'addressLine1',
  'city',
  'postalCode',
  'country',
] as const;

export type PhotoBookRequiredField = (typeof PHOTO_BOOK_REQUIRED_FIELDS)[number];

export type PhotoBookValidation =
  | { ok: true; value: PhotoBookAddressInput }
  | { ok: false; errors: Partial<Record<PhotoBookRequiredField, 'required'>> };

export function validatePhotoBookAddress(input: PhotoBookAddressInput): PhotoBookValidation {
  const trimmed: PhotoBookAddressInput = {
    recipientName: input.recipientName.trim(),
    addressLine1: input.addressLine1.trim(),
    addressLine2: input.addressLine2?.trim() || undefined,
    city: input.city.trim(),
    postalCode: input.postalCode.trim(),
    country: input.country.trim(),
    notes: input.notes?.trim() || undefined,
  };

  const errors: Partial<Record<PhotoBookRequiredField, 'required'>> = {};
  for (const field of PHOTO_BOOK_REQUIRED_FIELDS) {
    if (!trimmed[field]) errors[field] = 'required';
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: trimmed };
}
