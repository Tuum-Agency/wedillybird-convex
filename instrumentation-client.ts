import { initPostHogClient } from '@/lib/analytics/posthog-client';

// Initialise PostHog avant l'hydratation React (convention Next.js 15.3+).
// RGPD : la capture reste silencieuse tant que l'utilisateur n'a pas accepté la
// bannière de consentement (cf. components/layout/cookie-consent.tsx).
initPostHogClient();
