import { describe, expect, it } from 'vitest';
import { matchOrgSubdomain, getRootDomains } from '@/lib/middleware/subdomain';

describe('matchOrgSubdomain', () => {
  it('matches a single-level subdomain', () => {
    expect(matchOrgSubdomain('tuum.wedillybird.com')).toEqual({ slug: 'tuum' });
  });

  it('strips the port before matching', () => {
    expect(matchOrgSubdomain('tuum.wedillybird.com:443')).toEqual({ slug: 'tuum' });
  });

  it('returns null for the apex domain', () => {
    expect(matchOrgSubdomain('wedillybird.com')).toBeNull();
  });

  it('returns null for reserved subdomains', () => {
    expect(matchOrgSubdomain('www.wedillybird.com')).toBeNull();
    expect(matchOrgSubdomain('api.wedillybird.com')).toBeNull();
    expect(matchOrgSubdomain('media.wedillybird.com')).toBeNull();
    expect(matchOrgSubdomain('app.wedillybird.com')).toBeNull();
    expect(matchOrgSubdomain('admin.wedillybird.com')).toBeNull();
  });

  it('rejects multi-level subdomains', () => {
    expect(matchOrgSubdomain('preview.tuum.wedillybird.com')).toBeNull();
  });

  it('rejects hosts on unknown root domains', () => {
    expect(matchOrgSubdomain('tuum.example.com')).toBeNull();
  });

  it('rejects hosts that look invalid as a slug', () => {
    expect(matchOrgSubdomain('-bad.wedillybird.com')).toBeNull();
    expect(matchOrgSubdomain('bad-.wedillybird.com')).toBeNull();
  });

  it('honors a custom root domain (e.g. dev: tuum.localhost)', () => {
    expect(matchOrgSubdomain('tuum.localhost', ['localhost'])).toEqual({ slug: 'tuum' });
    expect(matchOrgSubdomain('tuum.localhost:3000', ['localhost'])).toEqual({ slug: 'tuum' });
  });

  it('returns null for null/empty hosts', () => {
    expect(matchOrgSubdomain(null)).toBeNull();
    expect(matchOrgSubdomain('')).toBeNull();
  });
});

describe('getRootDomains', () => {
  it('returns the default list when no env var is set', () => {
    expect(getRootDomains({} as NodeJS.ProcessEnv)).toEqual(['wedillybird.com']);
  });

  it('parses comma-separated ALLOWED_SUBDOMAIN_ROOTS', () => {
    expect(
      getRootDomains({
        ALLOWED_SUBDOMAIN_ROOTS: 'wedillybird.com,localhost',
      } as unknown as NodeJS.ProcessEnv),
    ).toEqual(['wedillybird.com', 'localhost']);
  });
});
