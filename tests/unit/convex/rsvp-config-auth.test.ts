import { describe, it, expect } from 'vitest';
import { decideRsvpConfigWrite } from '../../../convex/lib/rsvpAuth';

describe('decideRsvpConfigWrite — autorité de délégation du questionnaire', () => {
  it('propriétaire : autorisé et pilote le flag (valeur soumise prise en compte)', () => {
    expect(
      decideRsvpConfigWrite({
        isOwner: true,
        isDelegateCouple: false,
        previousCoupleCanEdit: false,
        incomingCoupleCanEdit: true,
      }),
    ).toEqual({ allowed: true, coupleCanEdit: true });

    expect(
      decideRsvpConfigWrite({
        isOwner: true,
        isDelegateCouple: false,
        previousCoupleCanEdit: true,
        incomingCoupleCanEdit: false,
      }),
    ).toEqual({ allowed: true, coupleCanEdit: false });
  });

  it('propriétaire sans valeur soumise : conserve l’existant (défaut false)', () => {
    expect(
      decideRsvpConfigWrite({
        isOwner: true,
        isDelegateCouple: false,
        previousCoupleCanEdit: true,
        incomingCoupleCanEdit: undefined,
      }),
    ).toEqual({ allowed: true, coupleCanEdit: true });

    expect(
      decideRsvpConfigWrite({
        isOwner: true,
        isDelegateCouple: false,
        previousCoupleCanEdit: undefined,
        incomingCoupleCanEdit: undefined,
      }),
    ).toEqual({ allowed: true, coupleCanEdit: false });
  });

  it('couple rattaché autorisé : autorisé mais ne peut PAS changer le flag', () => {
    expect(
      decideRsvpConfigWrite({
        isOwner: false,
        isDelegateCouple: true,
        previousCoupleCanEdit: true,
        incomingCoupleCanEdit: false, // ignoré
      }),
    ).toEqual({ allowed: true, coupleCanEdit: true });
  });

  it('couple rattaché NON autorisé : refusé (et ne peut pas s’auto-accorder)', () => {
    expect(
      decideRsvpConfigWrite({
        isOwner: false,
        isDelegateCouple: true,
        previousCoupleCanEdit: false,
        incomingCoupleCanEdit: true,
      }),
    ).toEqual({ allowed: false, coupleCanEdit: false });

    expect(
      decideRsvpConfigWrite({
        isOwner: false,
        isDelegateCouple: true,
        previousCoupleCanEdit: undefined,
        incomingCoupleCanEdit: true,
      }),
    ).toEqual({ allowed: false, coupleCanEdit: false });
  });

  it('personnel d’agence non-propriétaire (pas couple) : autorisé, conserve le flag', () => {
    expect(
      decideRsvpConfigWrite({
        isOwner: false,
        isDelegateCouple: false,
        previousCoupleCanEdit: true,
        incomingCoupleCanEdit: false, // ne pilote pas le flag
      }),
    ).toEqual({ allowed: true, coupleCanEdit: true });
  });
});
