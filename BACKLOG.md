# Wedillybird — Backlog

Items différés au fil des sprints. Chacun est **drop-in** : la plomberie applicative est déjà en place, seul le câblage final reste.

## Paiements

### CinetPay driver (post-Sprint 6)
- **Bloqué par** : creds `CINETPAY_API_KEY` + `CINETPAY_SITE_ID` (à créer sur dashboard CinetPay)
- **Travail** : remplacer `lib/payments/drivers/cinetpay.ts` (stub `THROW NOT_CONFIGURED`) par une implémentation `fetch` directe contre l'API Pay-In + signature HMAC sur webhook
- **Doc** : https://docs.cinetpay.com/api/1.0-en/checkout/initialisation
- **Webhook header** : `x-token` (déjà géré par la route `/api/webhooks/[provider]`)

### Stripe Subscriptions pour comptes pro (post-Sprint 7)
- **Bloqué par** : créer 3 Stripe Prices recurring (Starter 29€/mo, Business 79€/mo, Agency 199€/mo)
- **Travail** :
  - Étendre `lib/payments/drivers/stripe.ts` avec `createSubscriptionCheckout(input)` utilisant `mode: 'subscription'`
  - Câbler `customer.subscription.created/updated/deleted` dans `verifyAndParseWebhook` → mutation `organizations.updateSubscription`
  - Page `/pro/billing` avec choix de tier + customer portal Stripe
- **Schema** : déjà prêt sur `organizations.{stripeCustomerId, stripeSubscriptionId, subscriptionTier, subscriptionStatus, subscriptionPeriodEnd}`

### PDF facture (post-Sprint 6)
- Installer `@react-pdf/renderer`
- Composant `<InvoicePDF payment={...} />` rendu côté serveur
- Route `/api/payments/[paymentId]/invoice.pdf`

## Multi-utilisateurs (post-Sprint 7)

### Branding upload organisation
- Logo via Convex storage (déjà en place côté schema `organizations.logoStorageId`)
- Composant `OrganizationBranding` réutilisant `PhotoUploader` mode 'owner'
- Mutation `organizations.updateBranding` déjà câblée

### Sous-domaine wildcard `<slug>.wedillybird.com`
- **Bloqué par** : config DNS wildcard `*.wedillybird.com` chez le registrar + Vercel domain wildcard
- **Travail** :
  - Middleware `proxy.ts` : détecter sous-domaine, rewrite vers `/orgs/[slug]/...`
  - Route group `(public-org)` avec layout custom utilisant le branding
- **Référence** : Vercel multi-tenant docs

### Invite par lien WhatsApp auto
- Service WhatsApp existe déjà (`lib/whatsapp/`)
- À faire : après `inviteOrgMember`, envoyer template WhatsApp `team_invitation` avec lien `<host>/pro/invite/[token]`
- Template à créer dans Meta Business Manager + valider

## Check-in offline (post-Sprint 4)

### Sync queue bidirectionnelle
- État actuel : cache lecture-seule dans Dexie ; les check-ins offline ne sont pas envoyés en différé
- À faire :
  - Ajouter table `pendingCheckIns` dans Dexie (token, eventId, scannedAt)
  - Service worker (Workbox) écoute `online` → drain de la queue vers `/api/checkin/sync`
  - Route `/api/checkin/sync` qui appelle `guests.checkInByToken` en bulk avec idempotency

## Galerie (post-Sprint 5)

### Migration AWS S3 + CloudFront
- Actuellement sur Convex storage (limite 1 GB free)
- À faire :
  - Bucket S3 `eu-west-3` Paris + CloudFront
  - Lambda presigned URL generator
  - Migration job `convex/migratePhotos.ts` qui copie les `_storage` vers S3 et patche les rows
- **Bloqué par** : creds AWS

### Modération Rekognition
- Lambda déclenchée sur S3 PUT
- Si `ModerationLabels` détecte explicit/violence → patch `photos.status = 'rejected'`
- Sinon `photos.status = 'approved'`
- Remplace l'auto-approve actuel sur uploads owner

### Génération variantes (sharp Lambda)
- Versions thumbnail (320px), medium (800px), full (2000px)
- Stocke `photos.variants: { thumb, medium, full }` (storage IDs)
- Galerie utilise `thumb` en grid, `medium` en lightbox
