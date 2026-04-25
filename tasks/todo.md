# AWS SES + S3 (niveau 3) — plan d'exécution

Région : `eu-west-3` (Paris). Domaine d'envoi : `wedillybird.com`. CDN media : `media.wedillybird.com` (à confirmer).

## Phase 0 — Pré-requis utilisateur (à faire par toi avant que je code)

- [ ] Créer un utilisateur IAM `wedillybird-dev` (programmatic access)
- [ ] Lui attacher la policy `AdministratorAccess` (bootstrap dev — on scopera avant prod)
- [ ] Générer une access key + secret access key
- [ ] Coller dans `.env.local` :
  ```
  AWS_REGION=eu-west-3
  AWS_ACCESS_KEY_ID=AKIA...
  AWS_SECRET_ACCESS_KEY=...
  AWS_ACCOUNT_ID=...   # 12 chiffres
  ```
- [ ] Confirmer que tu as accès DNS de `wedillybird.com` (registrar / Cloudflare / Vercel DNS) pour ajouter les enregistrements DKIM/SPF/DMARC + le CNAME CloudFront
- [ ] Confirmer adresse `From` souhaitée (proposition : `noreply@wedillybird.com`, `bonjour@wedillybird.com`, `factures@wedillybird.com`)

## Phase 1 — Bootstrap local

- [ ] `aws sts get-caller-identity` (vérif credentials)
- [ ] Créer profil AWS CLI dédié (optionnel)
- [ ] Installer SDK : `@aws-sdk/client-s3`, `@aws-sdk/client-ses`, `@aws-sdk/client-sesv2`, `@aws-sdk/s3-request-presigner`, `@aws-sdk/lib-storage`
- [ ] Créer `lib/aws/clients.ts` (S3Client, SESv2Client mémoïsés)
- [ ] Ajouter `.env.example` avec toutes les variables AWS
- [ ] Ajouter validation Zod des env (`lib/env.ts`)

## Phase 2 — SES (emails transactionnels)

### Côté AWS

- [ ] Créer `EmailIdentity` pour `wedillybird.com` via SESv2 (DKIM Easy)
- [ ] Récupérer les 3 CNAME DKIM → **toi : ajouter au DNS**
- [ ] Ajouter SPF (`v=spf1 include:amazonses.com -all`) → **toi : DNS**
- [ ] Ajouter DMARC (`v=DMARC1; p=none; rua=mailto:dmarc@wedillybird.com`) → **toi : DNS**
- [ ] Vérifier `noreply@wedillybird.com` (sandbox = uniquement adresses vérifiées au début)
- [ ] Configuration set `wedillybird-default` + event destination CloudWatch (bounces, complaints, deliveries)
- [ ] Demander sortie de sandbox (cas d'usage, volume, opt-out, bounce/complaint handling) — **fenêtre 24-48h AWS**

### Côté code

- [ ] `lib/email/index.ts` : API `sendEmail({ to, template, data, replyTo? })`
- [ ] `lib/email/driver-ses.ts` : SESv2 SendEmail
- [ ] `lib/email/driver-mock.ts` : log + capture pour tests/E2E (toggle `EMAIL_DRIVER=mock`)
- [ ] `lib/email/templates/` : 3 templates (HTML + texte)
  - `guest-reminder` : rappel J-7 / J-1 invité
  - `pro-notification` : notif compte pro (nouveau membre, paiement reçu, etc.)
  - `stripe-invoice` : facture (PDF en PJ — bloqué par backlog Sprint 6 PDF)
- [ ] Tests vitest : driver mock + render templates
- [ ] Convex action `internal.email.send` (pour appels depuis mutations)

> Câblage métier (quand envoyer chaque email) reste à faire dans des PRs dédiées par feature — la plomberie est en place.

## Phase 3 — S3 + CloudFront (media)

### Côté AWS (via CDK ou aws CLI — je propose CDK TS pour avoir l'IaC dans le repo)

- [ ] `infra/` (nouveau workspace pnpm) avec CDK TypeScript
- [ ] Stack `WedillybirdMediaStack` :
  - [ ] Bucket `wedillybird-media-prod` (eu-west-3, versioning, TLS-only, BlockPublicAccess all)
  - [ ] Lifecycle : `incoming/` → 30j, `processed/` → IA après 90j
  - [ ] CORS : PUT depuis `https://wedillybird.com` + previews Vercel (regex)
  - [ ] CloudFront distribution + OAC (Origin Access Control)
  - [ ] ACM cert pour `media.wedillybird.com` (us-east-1 — requis par CloudFront)
  - [ ] Custom domain CloudFront `media.wedillybird.com`
  - [ ] CNAME `media` → distribution → **toi : DNS**
  - [ ] IAM Role `wedillybird-app-runtime` (lecture/écriture bucket + invoke Lambdas)
- [ ] `cdk deploy` → noter outputs (bucket name, distribution domain, role ARN)

## Phase 4 — Migration Convex storage → S3

- [ ] Schema `convex/schema.ts` : `photos.s3Key: string` (à côté de `storageId` legacy, optionnel)
- [ ] Convex action `photos.createS3UploadUrl` (presign PUT, key = `incoming/{eventId}/{uuid}.{ext}`)
- [ ] Adapter `components/.../PhotoUploader.tsx` pour PUT direct vers S3 (au lieu de Convex storage)
- [ ] Confirm callbacks : storer `s3Key` dans la row `photos`
- [ ] `lib/photos/url.ts` : helper `getPhotoUrl(s3Key)` → `https://media.wedillybird.com/{s3Key}`
- [ ] Adapter `listForOwner` / `listApprovedForGuest` pour retourner les URLs CloudFront
- [ ] Script migration `convex/migratePhotos.ts` : copier les `_storage` Convex existants vers S3 + patch rows (idempotent)
- [ ] Garder `storageId` en read-fallback pendant la transition

## Phase 5 — Lambdas (modération + variantes)

### Stack `WedillybirdMediaProcessingStack`

- [ ] Lambda `moderation` (Node 22) :
  - Trigger : S3 ObjectCreated sous `incoming/`
  - Appelle `rekognition.DetectModerationLabels`
  - HTTP POST signé vers Convex `internal.photos.markModerated` (rejet si Explicit/Violence ≥ 80%)
- [ ] Lambda `variants` (Node 22, layer sharp) :
  - Trigger : `incoming/` (après modération approved)
  - Génère thumb 320, medium 800, full 2000 → upload `processed/{photoId}/{variant}.webp`
  - HTTP POST signé vers Convex `internal.photos.setVariants`
- [ ] Convex HTTP routes `convex/http.ts` :
  - `POST /api/lambda/moderation-callback`
  - `POST /api/lambda/variants-callback`
  - Vérif HMAC signature (`LAMBDA_CALLBACK_SECRET`)
- [ ] Schema photo : `variants: { thumb, medium, full }` + `moderation: { labels, score, decision, decidedAt }`
- [ ] Galerie : utiliser `thumb` en grid, `medium` en lightbox (déjà prévu backlog)

## Phase 6 — Vercel + CI

- [ ] Ajouter env vars sur Vercel (Production + Preview) via `vercel env add`
- [ ] Ajouter secrets GitHub Actions si besoin pour CDK deploy
- [ ] PR finale `feat/aws-ses-s3-setup` (ou découpée en 3 PRs : SES / S3+CDN / Lambdas)

## Risques / points d'attention

- **SES sandbox** : tant qu'on est en sandbox, pas d'envoi à de vrais invités → on dev avec adresses vérifiées + driver mock
- **Coût CloudFront ACM** : cert obligatoirement en `us-east-1`, pas dans `eu-west-3` — gestion cross-region dans le CDK
- **Convex actions et AWS SDK** : Convex supporte le SDK AWS dans les `action` (pas dans `mutation`/`query`) — bien isoler les appels
- **Migration photos existantes** : risque de double comptage. Script idempotent + dry-run d'abord
- **DNS propagation** : DKIM peut prendre 1-72h, CloudFront 5-30min — séquencer les phases pour ne pas attendre
