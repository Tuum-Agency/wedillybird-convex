import { describe, expect, it } from 'vitest';
import {
  isAgencyRole,
  resolvePostAuthDestination,
  type PostAuthUser,
} from '../../../lib/auth/post-auth-destination';

describe('resolvePostAuthDestination — aiguillage agence vs particulier', () => {
  it('user nul → onboarding', () => {
    expect(resolvePostAuthDestination(null, false)).toBe('/onboarding');
    expect(resolvePostAuthDestination(undefined, true)).toBe('/onboarding');
  });

  it('pas de nom (onboarding incomplet) → onboarding', () => {
    expect(resolvePostAuthDestination({ role: 'couple' }, false)).toBe('/onboarding');
    expect(resolvePostAuthDestination({ role: 'pro', fullName: '' }, true)).toBe('/onboarding');
  });

  it('rôle guest → onboarding même avec un nom', () => {
    expect(resolvePostAuthDestination({ role: 'guest', fullName: 'Awa' }, false)).toBe(
      '/onboarding',
    );
  });

  it('particulier (couple) onboardé → dashboard couple', () => {
    expect(resolvePostAuthDestination({ role: 'couple', fullName: 'Awa & Karim' }, false)).toBe(
      '/dashboard',
    );
    // L'appartenance à une orga ne change rien pour un couple.
    expect(resolvePostAuthDestination({ role: 'couple', fullName: 'Awa & Karim' }, true)).toBe(
      '/dashboard',
    );
  });

  it('agence (pro) SANS organisation → onboarding pro', () => {
    expect(resolvePostAuthDestination({ role: 'pro', fullName: 'Camille Faye' }, false)).toBe(
      '/pro/onboarding',
    );
  });

  it('agence (pro) AVEC organisation active → back-office pro', () => {
    expect(resolvePostAuthDestination({ role: 'pro', fullName: 'Camille Faye' }, true)).toBe(
      '/pro/dashboard',
    );
  });

  it('admin AVEC organisation → back-office pro (admin = rôle agence)', () => {
    expect(resolvePostAuthDestination({ role: 'admin', fullName: 'Yacine Sow' }, true)).toBe(
      '/pro/dashboard',
    );
  });

  it('admin SANS organisation → onboarding pro', () => {
    expect(resolvePostAuthDestination({ role: 'admin', fullName: 'Yacine Sow' }, false)).toBe(
      '/pro/onboarding',
    );
  });
});

describe('isAgencyRole', () => {
  it('pro et admin sont des rôles agence', () => {
    expect(isAgencyRole('pro')).toBe(true);
    expect(isAgencyRole('admin')).toBe(true);
  });
  it('couple, guest, null ne le sont pas', () => {
    expect(isAgencyRole('couple')).toBe(false);
    expect(isAgencyRole('guest')).toBe(false);
    expect(isAgencyRole(null)).toBe(false);
    expect(isAgencyRole(undefined)).toBe(false);
  });
});

// Garde-fou de type : la matrice de décision couvre tous les rôles.
describe('exhaustivité des rôles', () => {
  const roles: ReadonlyArray<NonNullable<PostAuthUser['role']>> = [
    'couple',
    'pro',
    'guest',
    'admin',
  ];
  it('chaque rôle onboardé produit une destination connue', () => {
    const allowed = new Set(['/onboarding', '/pro/onboarding', '/pro/dashboard', '/dashboard']);
    for (const role of roles) {
      const dest = resolvePostAuthDestination({ role, fullName: 'Test' }, false);
      expect(allowed.has(dest)).toBe(true);
    }
  });
});
