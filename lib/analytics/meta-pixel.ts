/**
 * Pixel Meta (Facebook / Instagram Ads) — chargé UNIQUEMENT après consentement.
 *
 * Distinct de PostHog (analytics produit, cf. posthog-client.ts) : le pixel sert
 * à l'OPTIMISATION de diffusion et au RETARGETING des campagnes Meta. Il est
 * piloté par le MÊME consentement RGPD — `setMetaConsent` est appelée depuis
 * `setAnalyticsConsent`, donc aucun script ni cookie Meta tant que l'utilisateur
 * n'a pas cliqué « Accepter ».
 *
 * Entièrement inerte si `NEXT_PUBLIC_META_PIXEL_ID` est absent (no-op gracieux) :
 * on peut déployer sans risque, puis activer en posant l'ID sur Vercel.
 */

const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;

type FbqFn = (...args: unknown[]) => void;
interface Fbq extends FbqFn {
  callMethod?: FbqFn;
  queue: unknown[];
  push: FbqFn;
  loaded: boolean;
  version: string;
}

declare global {
  interface Window {
    fbq?: Fbq;
    _fbq?: Fbq;
  }
}

let loaded = false;

const isBrowser = (): boolean => typeof window !== 'undefined';

/** True si un ID de pixel est configuré (sinon toute l'API est no-op). */
export function isMetaConfigured(): boolean {
  return Boolean(PIXEL_ID);
}

/** Injecte fbevents.js (snippet officiel Meta) + init + 1er PageView. Idempotent. */
export function loadMetaPixel(): void {
  if (loaded || !isBrowser() || !PIXEL_ID) return;
  loaded = true;
  if (window.fbq) return;

  const fbq = function (...args: unknown[]) {
    if (fbq.callMethod) fbq.callMethod(...args);
    else fbq.queue.push(args);
  } as Fbq;
  fbq.queue = [];
  fbq.push = fbq;
  fbq.loaded = true;
  fbq.version = '2.0';
  window.fbq = fbq;
  window._fbq = window._fbq ?? fbq;

  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://connect.facebook.net/en_US/fbevents.js';
  document.head.appendChild(script);

  window.fbq('init', PIXEL_ID);
  window.fbq('track', 'PageView');
}

/** Applique le consentement : accepté → charge le pixel ; refusé → rien n'est chargé. */
export function setMetaConsent(granted: boolean): void {
  if (granted) loadMetaPixel();
}

/** Track un event standard Meta (Lead, InitiateCheckout, Purchase…). No-op si non chargé. */
export function metaTrack(event: string, params?: Record<string, unknown>): void {
  if (!isBrowser() || !window.fbq) return;
  try {
    if (params) window.fbq('track', event, params);
    else window.fbq('track', event);
  } catch {
    /* l'analytics ne doit jamais casser l'app */
  }
}

/** PageView Meta (à émettre sur navigation SPA). */
export function metaPageView(): void {
  metaTrack('PageView');
}
