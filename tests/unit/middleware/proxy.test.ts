import { describe, it, expect } from 'vitest';
import { extractOrgSlug, getReservedSubdomains } from '@/lib/subdomain/extract-org-slug';

describe('extractOrgSlug', () => {
  describe('domaines orga valides', () => {
    it("extrait le slug d'un sous-domaine standard", () => {
      expect(extractOrgSlug('tuum.wedillybird.com')).toBe('tuum');
    });

    it('lower-case le host', () => {
      expect(extractOrgSlug('TUUM.WEDILLYBIRD.COM')).toBe('tuum');
      expect(extractOrgSlug('Tuum-Agency.Wedillybird.com')).toBe('tuum-agency');
    });

    it('strip le port avant analyse', () => {
      expect(extractOrgSlug('tuum.wedillybird.com:443')).toBe('tuum');
      expect(extractOrgSlug('tuum.wedillybird.com:80')).toBe('tuum');
    });

    it('accepte les slugs avec tirets internes', () => {
      expect(extractOrgSlug('mon-agence-pro.wedillybird.com')).toBe('mon-agence-pro');
    });

    it('accepte les slugs alphanumériques', () => {
      expect(extractOrgSlug('agence42.wedillybird.com')).toBe('agence42');
    });
  });

  describe('domaines système (whitelist)', () => {
    it('refuse www', () => {
      expect(extractOrgSlug('www.wedillybird.com')).toBeNull();
    });

    it('refuse api', () => {
      expect(extractOrgSlug('api.wedillybird.com')).toBeNull();
    });

    it('refuse media (CDN CloudFront)', () => {
      expect(extractOrgSlug('media.wedillybird.com')).toBeNull();
    });

    it('refuse app et admin', () => {
      expect(extractOrgSlug('app.wedillybird.com')).toBeNull();
      expect(extractOrgSlug('admin.wedillybird.com')).toBeNull();
    });

    it('expose la liste pour la documentation', () => {
      const reserved = getReservedSubdomains();
      expect(reserved.has('www')).toBe(true);
      expect(reserved.has('api')).toBe(true);
      expect(reserved.has('media')).toBe(true);
    });
  });

  describe('domaines racine', () => {
    it('refuse wedillybird.com nu', () => {
      expect(extractOrgSlug('wedillybird.com')).toBeNull();
    });

    it('refuse les sous-sous-domaines', () => {
      expect(extractOrgSlug('foo.bar.wedillybird.com')).toBeNull();
    });
  });

  describe('hosts dev / preview', () => {
    it('refuse localhost', () => {
      expect(extractOrgSlug('localhost')).toBeNull();
      expect(extractOrgSlug('localhost:3000')).toBeNull();
    });

    it('refuse les sous-domaines de localhost (dev: utiliser ?orgPreview=)', () => {
      expect(extractOrgSlug('tuum.localhost')).toBeNull();
      expect(extractOrgSlug('tuum.localhost:3000')).toBeNull();
    });

    it('refuse 127.0.0.1', () => {
      expect(extractOrgSlug('127.0.0.1')).toBeNull();
      expect(extractOrgSlug('127.0.0.1:3000')).toBeNull();
    });

    it('refuse les preview Vercel', () => {
      expect(extractOrgSlug('wedillybird.vercel.app')).toBeNull();
      expect(
        extractOrgSlug('wedillybird-git-feat-redesign-landing-v2-tuum-agency.vercel.app'),
      ).toBeNull();
    });
  });

  describe('inputs invalides', () => {
    it('refuse host vide ou null/undefined', () => {
      expect(extractOrgSlug(null)).toBeNull();
      expect(extractOrgSlug(undefined)).toBeNull();
      expect(extractOrgSlug('')).toBeNull();
      expect(extractOrgSlug('   ')).toBeNull();
    });

    it('refuse les slugs avec caractères non-autorisés', () => {
      expect(extractOrgSlug('tuum_agency.wedillybird.com')).toBeNull();
      expect(extractOrgSlug('tuum.agency.wedillybird.com')).toBeNull();
      expect(extractOrgSlug('-tuum.wedillybird.com')).toBeNull();
      expect(extractOrgSlug('tuum-.wedillybird.com')).toBeNull();
    });

    it('refuse un slug trop long (> 40 chars)', () => {
      const longSlug = 'a'.repeat(41);
      expect(extractOrgSlug(`${longSlug}.wedillybird.com`)).toBeNull();
    });

    it('refuse un domaine étranger', () => {
      expect(extractOrgSlug('tuum.example.com')).toBeNull();
      expect(extractOrgSlug('wedillybird.com.evil.com')).toBeNull();
    });
  });
});
