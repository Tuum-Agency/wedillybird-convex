# Wedillybird — Backlog

Items différés au fil des sprints. Chacun est **drop-in** : la plomberie applicative est déjà en place, seul le câblage final reste.

## Paiements

### CinetPay driver (Sprint 11 — code livré)
- **Code** ✅ : `lib/payments/drivers/cinetpay.ts` implémente createCheckout / verifyAndParseWebhook
  (HMAC SHA256 sur le `x-token`) / retrieveSessionStatus avec gestion du divisor XOF.
  10 tests unitaires : `tests/unit/lib/payments-cinetpay-driver.test.ts`.
- **Bloqué par** : creds `CINETPAY_API_KEY` + `CINETPAY_SITE_ID` + `CINETPAY_WEBHOOK_SECRET`
  (à créer sur le dashboard CinetPay) — sans ces vars le driver throw
  `CINETPAY_DRIVER_NOT_CONFIGURED` proprement.
- **Doc** : https://docs.cinetpay.com/api/1.0-en/checkout/initialisation

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

### Branding organisation (Sprint 11 — code livré)
- **Code** ✅ : page `/pro/branding` avec color pickers + uploader logo S3 (presigned PUT
  via `convex/brandingActions.ts`). Schema migré : nouveau champ
  `organizations.logoS3Key` (le legacy `logoStorageId` reste optional pour rétro-compat).
  Le branding est appliqué automatiquement aux pages publiques d'invitation
  (`/i/[token]`) lorsqu'un event appartient à une org avec branding défini, et au
  layout `(public-org)/orgs/[slug]` (cf. wildcard subdomain).
- **Bloqueur** : aucun.

### Sous-domaine wildcard `<slug>.wedillybird.com` (Sprint 11 — code livré, DNS à activer)
- **Code** ✅ : middleware `proxy.ts` détecte `<slug>.wedillybird.com` et rewrite vers
  `/orgs/<slug>/...` ; route group `(public-org)/orgs/[slug]/{,events}` avec layout custom
  appliquant le branding (couleurs CSS + logo). Tests unitaires : voir
  `tests/unit/lib/middleware-subdomain.test.ts`.
- **DNS wildcard à activer** (action manuelle) :
  1. Vercel → Project → Settings → Domains → **Add domain** : `*.wedillybird.com`.
  2. Ajouter chez le registrar : enregistrement `CNAME *` → `cname.vercel-dns.com.`
     (ou enregistrement `A *` → `76.76.21.21` si CNAME wildcard non supporté).
  3. Vercel attribue automatiquement un certificat TLS wildcard via Let's Encrypt
     (peut prendre quelques minutes).
  4. Pour tester en local : ajouter `tuum.localhost` à `/etc/hosts` et exporter
     `ALLOWED_SUBDOMAIN_ROOTS=wedillybird.com,localhost`.
- **Bloqueurs résiduels** : aucun côté code.

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

### ~~Migration AWS S3 + CloudFront~~ ✅ Fait (PR #12)
- Bucket `wedillybird-media-prod` (eu-west-3) + CloudFront `media.wedillybird.com`
- Action Convex `photosActions.createOwnerS3UploadUrl` / `createGuestS3UploadUrl` (presigned PUT, 5 min)
- `photos.s3Key` + index `by_s3_key`, `storageId` rendu optionnel pour fallback lecture des photos legacy
- `PhotoUploader` PUT direct vers S3 (au lieu de POST Convex storage)
- **Restant** : migration job `convex/migratePhotos.ts` pour rapatrier les éventuelles photos `_storage` legacy → S3 (idempotent, dry-run d'abord). Pas urgent tant que la dev DB n'a pas de photos en prod.

### ~~Modération Rekognition~~ ✅ Fait (PR #12)
- Lambda `WedillybirdMediaStack-ModerationFunction` déclenchée sur S3 PUT `incoming/`
- Rekognition cross-region (Lambda eu-west-3 → Rekognition eu-west-1, Bytes inline car Rekognition pas dispo en eu-west-3)
- Rejet si `Explicit Nudity / Sexual Activity / Graphic Violence / Visually Disturbing / Hate Symbols` ≥ 80 % confidence
- Callback HMAC SHA-256 vers `convex/http.ts /lambda/photo-moderation-callback` → `internal.photos.internalMarkModerated`
- Snapshot dans `photos.moderation: { source, decision, topLabel, topConfidence, labels, decidedAt }`

### Génération variantes (sharp Lambda)
- **Bloqué par** : Docker en local (libvips natif) ou layer sharp pré-construit pour ARM64 (ex. `pH200/sharp-layer`)
- **Travail** :
  - Nouvelle Lambda `variants` ou extension de `moderation` : déclenchée après `decision = approved`
  - Génère thumbnail 320 px, medium 800 px, full 2000 px en webp (mode `cover`)
  - Upload vers `processed/{photoId}/{variant}.webp`
  - Callback Convex `internalSetVariants` → `photos.variants: { thumb, medium, full }` (`s3Key` strings)
  - Galerie : `thumb` en grid, `medium` en lightbox, `full` au download
- **CDK** : utiliser `NodejsFunction` avec `bundling.nodeModules: ['sharp']` + `forceDockerBundling: true`, ou attacher un Layer ARM64 pré-construit
- **Permissions Lambda** : `s3:GetObject` sur `incoming/`, `s3:PutObject` sur `processed/`

## AWS — opérations & sécurité (post-PR #12)

### Sortie de sandbox SES (PENDING)
- Demande soumise via `aws sesv2 put-account-details --production-access-enabled` (réponse AWS sous 24-48 h)
- Surveille `admin@tuumagency.com` pour la confirmation
- Une fois acceptée : passer `EMAIL_DRIVER=mock` → `ses` sur Vercel Production / Preview
- En cas de refus : revoir use-case description, prouver opt-in et gestion bounces/complaints

### IAM scope-down avant prod élargie
- L'utilisateur `wedillybird-dev` a actuellement `AdministratorAccess` (bootstrap). À scoper avant ouverture équipe :
  - `s3:{PutObject,GetObject,DeleteObject,ListBucket}` sur `arn:aws:s3:::wedillybird-media-prod*`
  - `ses:{SendEmail,SendRawEmail}` sur `arn:aws:ses:eu-west-3:487046110766:identity/wedillybird.com`
  - `cloudfront:CreateInvalidation` sur la distribution `E3O56ZG0J0BA9J` (purge cache après suppression)
  - `rekognition:DetectModerationLabels` sur `*`
- Créer un `wedillybird-app-runtime` IAM user séparé pour Vercel (read-only sur SES, write sur S3 incoming/), distinct du `wedillybird-dev` qui sert au déploiement CDK

### Rotation de l'access key initiale
- La clé `AKIAXCZRV3YXAVVRYIWU` a transité dans des screenshots de la session de bootstrap → la rotater :
  - Créer une nouvelle clé `wedillybird-dev` via console
  - Mettre à jour `.env.local`, Vercel (`AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY` Production + Preview), Convex env
  - Désactiver l'ancienne clé puis la supprimer après 24 h sans erreur

## Câblage métier emails (post-PR #12)

La plomberie `lib/email/` est en place avec drivers SES + mock et 3 templates. Reste à brancher dans le code applicatif :

### Rappel invité (`renderGuestReminder`)
- Cron Convex (action) qui scanne `guests` avec `rsvpStatus='attending'` et `event.eventDate - now() ∈ [7d±1h, 1d±1h]`
- Pour chaque match : `sendEmail({ to: guest.email, ... renderGuestReminder({ daysUntilEvent: 7|1 }) })`
- Champ `guests.lastReminderSentAt` (à ajouter au schema) pour éviter les doublons

### Notification pro (`renderProNotification`)
- `team-member-added` : depuis `organizations.inviteOrgMember` mutation
- `payment-received` : depuis `payments.markSucceeded` (webhook Stripe)
- `subscription-renewed` / `subscription-failed` : depuis le futur câblage Stripe Subscriptions (cf. section Paiements)

### Facture Stripe (`renderStripeInvoice`)
- Bloqué par item « PDF facture » (cf. Paiements) — l'email peut linker vers la page hosted invoice de Stripe en attendant le PDF self-hosted
