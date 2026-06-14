/**
 * Point d'entrée analytics CÔTÉ CLIENT.
 *
 * - Composants client / hooks → `import { analytics } from '@/lib/analytics'`.
 * - Code serveur (routes API, server actions, webhooks) → importer
 *   `@/lib/analytics/posthog-server` (le module ci-dessous tire `posthog-js`).
 */
export {
  analytics,
  track,
  identifyUser,
  resetAnalytics,
  captureException,
  setAnalyticsConsent,
  initPostHogClient,
  CONSENT_STORAGE_KEY,
} from './posthog-client';

export {
  EVENTS,
  type AnalyticsEventName,
  type AnalyticsAudience,
  type BillingPeriod,
  type AnalyticsPersonProps,
} from './events';
