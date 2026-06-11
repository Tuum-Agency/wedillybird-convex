import { describe, expect, it } from 'vitest';
import { cleanDomain, isLikelyEmail, defaultSubdomain } from '../../../lib/pro/white-label';

describe('cleanDomain', () => {
  it('normalise protocole, www, chemin et casse', () => {
    expect(cleanDomain('https://www.MonAgence.fr/contact')).toBe('monagence.fr');
    expect(cleanDomain('  mariages.monagence.fr  ')).toBe('mariages.monagence.fr');
  });
  it('rejette ce qui n’a pas la forme d’un domaine', () => {
    expect(cleanDomain('monagence')).toBe('');
    expect(cleanDomain('pas un domaine')).toBe('');
    expect(cleanDomain('')).toBe('');
  });
});

describe('isLikelyEmail', () => {
  it('valide une adresse plausible', () => {
    expect(isLikelyEmail('contact@monagence.fr')).toBe(true);
    expect(isLikelyEmail('Contact@Mon-Agence.co.uk')).toBe(true);
  });
  it('rejette l’invalide', () => {
    expect(isLikelyEmail('contact')).toBe(false);
    expect(isLikelyEmail('contact@')).toBe(false);
    expect(isLikelyEmail('a@b')).toBe(false);
  });
});

describe('defaultSubdomain', () => {
  it('construit l’adresse Wedillybird', () => {
    expect(defaultSubdomain('studio-lumiere')).toBe('studio-lumiere.wedillybird.fr');
  });
});
