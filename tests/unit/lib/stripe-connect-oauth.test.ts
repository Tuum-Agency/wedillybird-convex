import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { stripeConnectAuthorizeUrl } from '../../../lib/payments/drivers/stripe';

/**
 * Vérifie que le bouton « Se connecter avec Stripe » produit la BONNE URL
 * d'autorisation OAuth (comptes Standard). C'est la cible exacte vers laquelle
 * l'agence est redirigée au clic — donc la preuve déterministe que notre côté du
 * handshake est correct, sans dépendre d'un appel réseau (authorizeUrl est un
 * constructeur d'URL synchrone du SDK Stripe).
 */
const ORIG_ENV = { ...process.env };

describe('stripeConnectAuthorizeUrl (OAuth « Se connecter avec Stripe »)', () => {
  beforeEach(() => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_dummy_for_url_building';
    process.env.STRIPE_CONNECT_CLIENT_ID = 'ca_test_123';
  });
  afterEach(() => {
    process.env = { ...ORIG_ENV };
  });

  it('construit une URL d’autorisation Stripe Standard correcte', () => {
    const url = stripeConnectAuthorizeUrl({
      state: 'signed-state-token',
      redirectUri: 'https://app.example.com/api/stripe/oauth/callback',
    });
    const u = new URL(url);
    expect(u.host).toBe('connect.stripe.com');
    expect(u.pathname).toBe('/oauth/authorize');
    expect(u.searchParams.get('client_id')).toBe('ca_test_123');
    expect(u.searchParams.get('response_type')).toBe('code');
    // scope read_write = lecture des données + création de paiements sur le compte.
    expect(u.searchParams.get('scope')).toBe('read_write');
    // state = jeton signé anti-CSRF, renvoyé tel quel par Stripe au callback.
    expect(u.searchParams.get('state')).toBe('signed-state-token');
    expect(u.searchParams.get('redirect_uri')).toBe(
      'https://app.example.com/api/stripe/oauth/callback',
    );
  });

  it('préremplit le nom d’entreprise (onboarding plus fluide pour l’agence)', () => {
    const url = stripeConnectAuthorizeUrl({ state: 's', suggestedBusinessName: 'Studio Lune' });
    const u = new URL(url);
    expect(u.searchParams.get('stripe_user[business_name]')).toBe('Studio Lune');
    expect(u.searchParams.get('stripe_user[country]')).toBe('FR');
  });

  it('échoue proprement (code clair) si STRIPE_CONNECT_CLIENT_ID est absent', () => {
    delete process.env.STRIPE_CONNECT_CLIENT_ID;
    expect(() => stripeConnectAuthorizeUrl({ state: 's' })).toThrow(
      'STRIPE_CONNECT_NOT_CONFIGURED',
    );
  });
});
