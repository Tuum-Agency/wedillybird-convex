import { describe, it, expect } from 'vitest';
import { resolveNotificationLink, selectNotificationRecipients } from '../../../convex/lib/notify';

describe('resolveNotificationLink', () => {
  it('couple → portail couple', () => {
    expect(resolveNotificationLink({ _id: 'e1' }, 'couple')).toBe('/espace-couple/e1');
  });
  it('propriétaire d’un event d’orga → back-office agence', () => {
    expect(resolveNotificationLink({ _id: 'e1', organizationId: 'o1' }, 'owner')).toBe(
      '/pro/weddings/e1',
    );
  });
  it('propriétaire couple solo → page event', () => {
    expect(resolveNotificationLink({ _id: 'e1' }, 'owner')).toBe('/events/e1');
  });
});

describe('selectNotificationRecipients', () => {
  it('notifie le propriétaire + les couples rattachés', () => {
    expect(
      selectNotificationRecipients({ ownerId: 'agency', coupleCollaboratorIds: ['c1', 'c2'] }),
    ).toEqual([
      { userId: 'agency', role: 'owner' },
      { userId: 'c1', role: 'couple' },
      { userId: 'c2', role: 'couple' },
    ]);
  });

  it('exclut l’auteur de l’action', () => {
    expect(
      selectNotificationRecipients({
        ownerId: 'agency',
        coupleCollaboratorIds: ['c1'],
        excludeUserId: 'c1',
      }),
    ).toEqual([{ userId: 'agency', role: 'owner' }]);
  });

  it('includeOwner=false → couples seulement (déclencheur agence → couple)', () => {
    expect(
      selectNotificationRecipients({
        ownerId: 'agency',
        coupleCollaboratorIds: ['c1'],
        includeOwner: false,
        excludeUserId: 'agency',
      }),
    ).toEqual([{ userId: 'c1', role: 'couple' }]);
  });

  it('includeCouple=false → propriétaire seulement (déclencheur couple → agence)', () => {
    expect(
      selectNotificationRecipients({
        ownerId: 'agency',
        coupleCollaboratorIds: ['c1'],
        includeCouple: false,
        excludeUserId: 'c1',
      }),
    ).toEqual([{ userId: 'agency', role: 'owner' }]);
  });

  it('ne rétrograde pas un propriétaire également listé comme couple', () => {
    expect(
      selectNotificationRecipients({ ownerId: 'u1', coupleCollaboratorIds: ['u1', 'c2'] }),
    ).toEqual([
      { userId: 'u1', role: 'owner' },
      { userId: 'c2', role: 'couple' },
    ]);
  });
});
