import { describe, expect, it } from 'vitest';
import { PHOTO_BOOK_REQUIRED_FIELDS, validatePhotoBookAddress } from '@/lib/photos/photo-book';

const VALID = {
  recipientName: 'Awa & Karim',
  addressLine1: '12 rue des Lilas',
  addressLine2: 'Bât. B',
  city: 'Bobigny',
  postalCode: '93000',
  country: 'France',
  notes: 'Sonnez fort',
};

describe('validatePhotoBookAddress', () => {
  it('accepte une adresse complète et trim les valeurs', () => {
    const r = validatePhotoBookAddress({ ...VALID, recipientName: '  Awa & Karim  ' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.recipientName).toBe('Awa & Karim');
      expect(r.value.addressLine2).toBe('Bât. B');
    }
  });

  it('réduit les champs optionnels vides à undefined', () => {
    const r = validatePhotoBookAddress({ ...VALID, addressLine2: '   ', notes: '' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.addressLine2).toBeUndefined();
      expect(r.value.notes).toBeUndefined();
    }
  });

  it('rejette quand un champ requis est vide / blanc', () => {
    const r = validatePhotoBookAddress({ ...VALID, city: '   ', postalCode: '' });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.city).toBe('required');
      expect(r.errors.postalCode).toBe('required');
      expect(r.errors.recipientName).toBeUndefined();
    }
  });

  it('liste exactement 5 champs requis (line2/notes optionnels)', () => {
    expect([...PHOTO_BOOK_REQUIRED_FIELDS]).toEqual([
      'recipientName',
      'addressLine1',
      'city',
      'postalCode',
      'country',
    ]);
  });
});
