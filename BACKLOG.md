# Wedillybird — Backlog

Items différés au fil des sprints. Chacun est **drop-in** : la plomberie applicative est déjà en place, seul le câblage final reste.

## Production / Vercel — checklist mise en prod

> **À me rappeler dès que l'utilisateur parle de "faire la production" / "go live" / "déployer en prod"**. Ne jamais lancer un deploy sans avoir validé chaque item ci-dessous.

### Env vars Vercel (Production + Preview)
Reproduire `.env.local` sur Vercel → Project Settings → Environment Variables :

- **Convex** : `CONVEX_DEPLOY_KEY` (généré dans Convex dashboard), `NEXT_PUBLIC_CONVEX_URL` (URL du déploiement prod), `NEXT_PUBLIC_CONVEX_SITE_URL`
- **Session** : `SESSION_SECRET` (`openssl rand -hex 32`, **distinct** du dev)
- **Stripe** (live mode) : `STRIPE_SECRET_KEY` (`sk_live_…`), `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (`pk_live_…`), `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_BUSINESS`, `STRIPE_PRICE_AGENCY` (à recréer avec la grille canonique 89/179/349 €)
- **AWS / SES** : `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION=eu-west-3`, `AWS_ACCOUNT_ID`, `SES_FROM_ADDRESS=noreply@wedillybird.com`, `SES_CONFIGURATION_SET=wedillybird-default`, `EMAIL_DRIVER=ses`
- **S3 / CloudFront** : `S3_BUCKET=wedillybird-media-prod`, `CLOUDFRONT_DOMAIN=media.wedillybird.com`, `CLOUDFRONT_DISTRIBUTION_ID=E3O56ZG0J0BA9J`
- **CinetPay** (quand ouvert) : `CINETPAY_API_KEY`, `CINETPAY_SITE_ID`
- **Lambda** : `LAMBDA_CALLBACK_SECRET`
- **WhatsApp** (quand template prod validé) : `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_OTP_TEMPLATE`, `WHATSAPP_INVITE_TEMPLATE`
- **Contact inbox** (optionnel, sinon default codé) : `CONTACT_INBOX_EMAIL=hello@wedillybird.com`

### Bloqueurs prod externes
1. **SES sortie de sandbox** — cf. section "AWS — opérations & sécurité". Sans ça, magic link / contact / newsletter / rappels invités n'arrivent qu'à des adresses vérifiées.
2. **Stripe Customer Portal** — à configurer dans Stripe Dashboard (Settings → Customer Portal) avant ouverture des subscriptions pro.
3. **CinetPay creds prod** — à récupérer sur dashboard CinetPay (apiKey + siteId).
4. **DNS wildcard `*.wedillybird.com`** — Vercel domain + registrar, requis pour multi-tenant pro (sous-domaines `slug.wedillybird.com`).
5. **WhatsApp template `team_invitation`** — à créer + valider dans Meta Business Manager.
6. **Boîte `hello@wedillybird.com`** — vérifier MX configuré sur le domaine, sinon les emails de contact bouncent silencieusement.
7. **Pricing alignment** — la grille canonique (Essentiel 19€, Premium 49€, Pros 89/179/349 €/mo) doit être recréée dans Stripe Prices ; les `price_1TQ712…` actuels divergent (cf. CLAUDE.md).
8. **Rotation clé AWS** `AKIAXCZRV3YXAVVRYIWU` — clé déjà exposée en dev, à rotater avant ouverture trafic prod (cf. "Rotation de l'access key initiale").

### Pré-déploiement checklist
- [ ] CI verte sur `main` (format, lint, typecheck, unit, build, e2e)
- [ ] `pnpx convex deploy` exécuté → schema + functions à jour sur le déploiement prod
- [ ] Vercel preview URL testée manuellement (golden path : sign-up WhatsApp, magic link email, /contact, newsletter footer, RSVP `/i/[token]`, paiement test Stripe)
- [ ] DNS `wedillybird.com` pointé sur Vercel + certificat SSL provisionné
- [ ] Webhooks Stripe configurés sur le domaine prod (`https://wedillybird.com/api/webhooks/stripe`) avec le secret `STRIPE_WEBHOOK_SECRET` aligné
- [ ] Webhooks CinetPay (si activé) pointés sur prod (`/api/webhooks/cinetpay`)
- [ ] Lambda Rekognition callback URL pointe sur le Convex prod (`<prod-deploy>.convex.site/lambda/photo-moderation-callback`)

### Post-déploiement checklist
- [ ] Smoke test `/contact` → vérifier réception sur `hello@wedillybird.com`
- [ ] Smoke test magic link → vérifier réception sur un email réel
- [ ] Smoke test newsletter footer → vérifier insertion Convex `newsletterSubscribers` + notif admin
- [ ] Smoke test paiement live (1 €) puis remboursé immédiatement (validation flow Stripe)
- [ ] Vérifier Sentry / monitoring branché (si applicable)
- [ ] CGU `messages/fr.json` article 4 à réécrire (mention obsolète d'une formule "gratuite" + mauvais noms Sérénité/Prestige)

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

## Infrastructure de tests

### Convex env vars shadow `.env.local` côté dev
- Découvert pendant les tests anti-doublon (avril 2026) : le déploiement Convex dev `capable-crocodile-720` a `WHATSAPP_ACCESS_TOKEN` + `WHATSAPP_PHONE_NUMBER_ID` définis en env vars Convex.
- Conséquence : même quand `.env.local` du projet Next.js commente WhatsApp pour activer le mock, les actions Convex (qui tournent côté Convex cloud, pas Next.js) utilisent l'env vars Convex et envoient des messages réels via Meta Cloud API. Le retour `provider: 'meta_cloud'` dans `auth.requestOtp / auth.requestLinkPhone` est le tell.
- **Pour les tests E2E mockés du flow WhatsApp** :
  - Soit `pnpx convex env unset WHATSAPP_ACCESS_TOKEN WHATSAPP_PHONE_NUMBER_ID` avant les tests, puis restaurer après
  - Soit ajouter un mode test dédié dans `convex/auth.ts` (`requestOtp` + `requestLinkPhone`) qui force le mock si `process.env.E2E_MODE === '1'`
- Idem côté SES : si `EMAIL_DRIVER` est set sur Convex, ça override le `.env.local` de Next.js. À vérifier avant E2E mail.

### Test E2E linking happy path (manquant)
- Couvert par tests unit + Convex CLI tests (4 anti-doublon ✅, 1 happy-path partiel ✅, 1 verify check ✅)
- Manque : Playwright test bout-en-bout qui mocke OTP côté Convex (cf. note ci-dessus), navigue UI, vérifie patch `users.phone` après verify avec bon code
- À programmer avec le mode test E2E_MODE dédié

### Test "vraie vie" préprod (Vercel preview)
- Une fois le preview Vercel déployé, faire le scénario complet avec un vrai numéro + un vrai email :
  - Sign-up via magic link → onboarding → dashboard → carte "Activer WhatsApp" → ajouter numéro → réception SMS WhatsApp → saisie code → vérifier user.phone patché
  - Bonus : tester le rejet `PHONE_TAKEN` avec un numéro déjà pris en prod
- Bloqué par : déploiement preview Vercel (cf. checklist Production en haut)

## Refactoring critique (avant prod élargie)

### Pricing alignment Stripe Prices
- Source de vérité : `.context/redesign-direction.md` section "Pricing figé"
- État actuel : `lib/payments/plans.ts` aligné côté code (Essentiel 19€, Premium 49€, +29€ upsell post-mariage)
- À faire côté Stripe :
  - Recréer les Prices test/prod : Particuliers (19€ + 49€ + 29€ upsell) + Pros récurrents (89€/179€/349€/mo)
  - Mettre à jour `STRIPE_PRICE_*` env vars dev + Vercel
  - Supprimer/désactiver les anciens `price_1TQ712…` divergents
  - Tester le checkout sur chaque tier

### CGU article 4 — réécriture
- `messages/fr.json:39` (article 4 des CGU) parle encore d'une "formule gratuite (jusqu'à 30 invitations)" + plans "Sérénité 49 €, Prestige 119 €" — obsolète vs grille canonique
- À réécrire : 2 plans particuliers (Essentiel 19€, Premium 49€) + upsell post-mariage 29€ + tier Pros (Starter 89€, Business 179€, Agency 349€). Mention que les paiements sont fermes et définitifs (déjà OK), remboursement 100% sous 7j si event non envoyé.

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
