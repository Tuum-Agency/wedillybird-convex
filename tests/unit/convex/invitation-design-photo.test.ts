import { afterEach, describe, expect, it } from 'vitest';
import {
  assertInvitationDesignAllowed,
  photoForClient,
} from '../../../convex/lib/invitationDesign';

// photoForClient lit process.env.CLOUDFRONT_DOMAIN — on le restaure après chaque cas.
const ORIGINAL_CDN = process.env.CLOUDFRONT_DOMAIN;
afterEach(() => {
  if (ORIGINAL_CDN === undefined) delete process.env.CLOUDFRONT_DOMAIN;
  else process.env.CLOUDFRONT_DOMAIN = ORIGINAL_CDN;
});

describe('photoForClient — projection CDN de la photo du couple', () => {
  it('null / sans clé → null (jamais de rendu vide)', () => {
    process.env.CLOUDFRONT_DOMAIN = 'cdn.example.com';
    expect(photoForClient(null)).toBeNull();
    expect(photoForClient(undefined)).toBeNull();
    expect(photoForClient({ s3Key: '' })).toBeNull();
  });

  it('clé valide + CDN configuré → URL CloudFront + dimensions', () => {
    process.env.CLOUDFRONT_DOMAIN = 'cdn.example.com';
    expect(photoForClient({ s3Key: 'invitation/evt1/a.jpg', width: 800, height: 1000 })).toEqual({
      url: 'https://cdn.example.com/invitation/evt1/a.jpg',
      width: 800,
      height: 1000,
    });
  });

  it('CDN absent → null (jamais la clé S3 brute côté client)', () => {
    delete process.env.CLOUDFRONT_DOMAIN;
    expect(photoForClient({ s3Key: 'invitation/evt1/a.jpg' })).toBeNull();
  });
});

describe('assertInvitationDesignAllowed — gating & clé de la photo', () => {
  const premium = { _id: 'evt1', planTier: 'premium' as const };

  it('Premium + clé sous invitation/{eventId}/ → autorisé', () => {
    expect(() =>
      assertInvitationDesignAllowed(premium, { photo: { s3Key: 'invitation/evt1/a.jpg' } }),
    ).not.toThrow();
  });

  it("clé hors du préfixe de l'event → INVALID_PHOTO_KEY", () => {
    // Photo d'un autre event.
    expect(() =>
      assertInvitationDesignAllowed(premium, { photo: { s3Key: 'invitation/autre/a.jpg' } }),
    ).toThrow('INVALID_PHOTO_KEY');
    // Mauvais préfixe (préfixe musique).
    expect(() =>
      assertInvitationDesignAllowed(premium, { photo: { s3Key: 'audio/evt1/a.jpg' } }),
    ).toThrow('INVALID_PHOTO_KEY');
    // Préfixe de modération invité — interdit.
    expect(() =>
      assertInvitationDesignAllowed(premium, { photo: { s3Key: 'incoming/evt1/a.jpg' } }),
    ).toThrow('INVALID_PHOTO_KEY');
  });

  it('Essentiel → FEATURE_LOCKED même avec une clé valide', () => {
    expect(() =>
      assertInvitationDesignAllowed(
        { _id: 'evt1', planTier: 'essential' },
        { photo: { s3Key: 'invitation/evt1/a.jpg' } },
      ),
    ).toThrow('FEATURE_LOCKED');
  });

  it('event Pro (organizationId) → photo autorisée', () => {
    expect(() =>
      assertInvitationDesignAllowed(
        { _id: 'evt2', organizationId: 'org1' },
        { photo: { s3Key: 'invitation/evt2/a.jpg' } },
      ),
    ).not.toThrow();
  });

  it('aucune photo → pas de gating déclenché par la photo', () => {
    expect(() =>
      assertInvitationDesignAllowed({ _id: 'evt1', planTier: 'essential' }, { cinematic: 'seal' }),
    ).not.toThrow();
  });
});
