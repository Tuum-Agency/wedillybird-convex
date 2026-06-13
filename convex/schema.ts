import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  users: defineTable({
    // Optional depuis l'ajout du Magic Link (avril 2026) : un user peut être
    // créé via email-only si pas de WhatsApp. Au moins un de phone/email.
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    fullName: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    locale: v.union(
      v.literal('fr'),
      v.literal('en'),
      v.literal('es'),
      v.literal('it'),
      v.literal('pt'),
      v.literal('de'),
      v.literal('ar'),
    ),
    role: v.union(v.literal('couple'), v.literal('pro'), v.literal('guest'), v.literal('admin')),
    // For couples: 'essential' | 'premium' (per-event, set on payment).
    // For pros: 'starter' | 'business' | 'agency' (subscription).
    // Note: 'free' was removed in the pricing alignment v2 (avril 2026).
    planTier: v.optional(
      v.union(
        v.literal('essential'),
        v.literal('premium'),
        v.literal('starter'),
        v.literal('business'),
        v.literal('agency'),
      ),
    ),
    stripeCustomerId: v.optional(v.string()),
    createdAt: v.number(),
    lastSeenAt: v.optional(v.number()),
  })
    .index('by_phone', ['phone'])
    .index('by_email', ['email']),

  organizations: defineTable({
    ownerId: v.id('users'),
    name: v.string(),
    slug: v.string(),
    logoStorageId: v.optional(v.id('_storage')),
    primaryColor: v.optional(v.string()),
    accentColor: v.optional(v.string()),
    /** Marque blanche (Agency) : domaine sur mesure + e-mail expéditeur + retrait du badge. */
    customDomain: v.optional(v.string()),
    senderEmail: v.optional(v.string()),
    whiteLabelFull: v.optional(v.boolean()),
    /** Préférences de notification par type (e-mail / in-app). */
    notificationPrefs: v.optional(
      v.object({
        rsvp: v.optional(v.object({ email: v.boolean(), app: v.boolean() })),
        payment: v.optional(v.object({ email: v.boolean(), app: v.boolean() })),
        newLead: v.optional(v.object({ email: v.boolean(), app: v.boolean() })),
        taskDue: v.optional(v.object({ email: v.boolean(), app: v.boolean() })),
        weeklyDigest: v.optional(v.object({ email: v.boolean(), app: v.boolean() })),
      }),
    ),
    /** Réglages messagerie par défaut (canal, expéditeur, template, relances). */
    messagingDefaults: v.optional(
      v.object({
        channel: v.union(v.literal('whatsapp'), v.literal('sms'), v.literal('auto')),
        senderName: v.string(),
        defaultTemplate: v.union(
          v.literal('editorial'),
          v.literal('classic'),
          v.literal('modern'),
          v.literal('festive'),
          v.literal('sober'),
        ),
        reminderJ7: v.boolean(),
        reminderJ1: v.boolean(),
      }),
    ),
    /**
     * Mode d'encaissement des paiements couples :
     * - `byop`   : compte Stripe perso de l'agence, connecté via OAuth Standard
     *              (charges directes). Mode actif.
     * - `manual` : suivi manuel, aucun encaissement en ligne (défaut)
     * - `managed`: LEGACY (ancien Stripe Connect managé). Plus jamais positionné
     *              par le code ; conservé dans l'union pour les données existantes.
     */
    paymentsMode: v.optional(v.union(v.literal('managed'), v.literal('byop'), v.literal('manual'))),
    /** LEGACY (mode managed) — versements gérés côté Stripe de l'agence en BYOP. */
    payoutSchedule: v.optional(
      v.union(v.literal('daily'), v.literal('weekly'), v.literal('manual')),
    ),
    stripeCustomerId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),
    /**
     * Stripe Connect (BYOP) : compte Stripe **de l'agence** connecté via OAuth
     * Standard. Les encaissements (budget, factures…) sont des *charges directes*
     * sur SON compte (en-tête `Stripe-Account`) — fonds direct chez l'agence,
     * aucun transfert plateforme. `…ChargesEnabled` est mis à true
     * à la connexion. `…PayoutsEnabled` / `…DetailsSubmitted` sont LEGACY (Express).
     */
    stripeConnectAccountId: v.optional(v.string()),
    stripeConnectChargesEnabled: v.optional(v.boolean()),
    stripeConnectPayoutsEnabled: v.optional(v.boolean()),
    stripeConnectDetailsSubmitted: v.optional(v.boolean()),
    subscriptionTier: v.optional(
      v.union(v.literal('starter'), v.literal('business'), v.literal('agency')),
    ),
    subscriptionStatus: v.optional(
      v.union(
        v.literal('trialing'),
        v.literal('active'),
        v.literal('past_due'),
        v.literal('canceled'),
        v.literal('unpaid'),
      ),
    ),
    subscriptionPeriodEnd: v.optional(v.number()),
    /**
     * Crédits Pay-as-you-go non-consommés. Chaque achat PAYG (one-shot 69 €)
     * crédite +1 ; chaque event créé sous mode PAYG décrémentera de 1 (gating
     * à programmer dans un sprint dédié, cf. BACKLOG).
     */
    paygCredits: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_owner', ['ownerId'])
    .index('by_slug', ['slug'])
    .index('by_stripe_customer', ['stripeCustomerId'])
    .index('by_stripe_subscription', ['stripeSubscriptionId'])
    .index('by_stripe_connect_account', ['stripeConnectAccountId']),

  /**
   * Achats Pay-as-you-go pro. Une row par checkout Stripe completed. La
   * mutation `paygPurchases:markPurchase` est idempotente via l'index
   * `by_session` (un même `stripeSessionId` ne crédite qu'une fois, même si
   * le webhook arrive plusieurs fois).
   */
  paygPurchases: defineTable({
    organizationId: v.id('organizations'),
    requesterId: v.id('users'),
    stripeSessionId: v.string(),
    amountMinor: v.number(),
    currency: v.union(
      v.literal('EUR'),
      v.literal('USD'),
      v.literal('XOF'),
      v.literal('MAD'),
      v.literal('TND'),
    ),
    createdAt: v.number(),
  })
    .index('by_session', ['stripeSessionId'])
    .index('by_organization', ['organizationId']),

  organizationMemberships: defineTable({
    organizationId: v.id('organizations'),
    userId: v.optional(v.id('users')),
    invitedPhone: v.optional(v.string()),
    invitedEmail: v.optional(v.string()),
    role: v.union(
      v.literal('owner'),
      v.literal('admin'),
      v.literal('planner'),
      v.literal('viewer'),
    ),
    status: v.union(v.literal('pending'), v.literal('active'), v.literal('revoked')),
    inviteToken: v.optional(v.string()),
    invitedBy: v.id('users'),
    invitedAt: v.number(),
    acceptedAt: v.optional(v.number()),
  })
    .index('by_organization', ['organizationId'])
    .index('by_user', ['userId'])
    .index('by_invite_token', ['inviteToken'])
    .index('by_org_user', ['organizationId', 'userId']),

  events: defineTable({
    ownerId: v.id('users'),
    organizationId: v.optional(v.id('organizations')),
    slug: v.string(),
    title: v.string(),
    coupleNames: v.object({
      partnerA: v.string(),
      partnerB: v.string(),
    }),
    eventDate: v.number(),
    timezone: v.string(),
    /** Enveloppe budgétaire — cible totale fixée avec le couple (centimes). */
    budgetEnvelopeMinor: v.optional(v.number()),
    venue: v.optional(
      v.object({
        name: v.string(),
        address: v.string(),
        lat: v.optional(v.number()),
        lng: v.optional(v.number()),
      }),
    ),
    coverImageKey: v.optional(v.string()),
    /**
     * Identifiant de la Rekognition Face Collection AWS associée à l'event,
     * de la forme `wb-event-{eventId}`. Set par le Lambda de modération à la
     * première photo `approved` (premier IndexFaces réussi).
     *
     * Quand undefined : aucune photo n'a encore été indexée — le bouton
     * "rechercher mes photos" doit afficher un état vide explicatif.
     *
     * Cleanup : à supprimer via Rekognition `DeleteCollection` quand
     * l'event est définitivement archivé / supprimé (cf. BACKLOG).
     */
    faceCollectionId: v.optional(v.string()),
    theme: v.optional(
      v.object({
        primaryColor: v.string(),
        accentColor: v.string(),
        fontFamily: v.string(),
      }),
    ),
    status: v.union(
      v.literal('draft'),
      v.literal('active'),
      v.literal('archived'),
      v.literal('cancelled'),
    ),
    // Set when the owner pays for one of the two B2C plans. Absent = unpaid draft.
    planTier: v.optional(v.union(v.literal('essential'), v.literal('premium'))),
    /**
     * Plan envisagé par le couple, devient `planTier` officiel après paiement
     * Stripe. Persisté dès la création de l'event pour pré-remplir le checkout
     * et permettre de payment-gater la publication. Reset quand le paiement
     * succeeds (`planTier` prend le relais).
     */
    pendingPlanTier: v.optional(v.union(v.literal('essential'), v.literal('premium'))),
    paidAt: v.optional(v.number()),
    // Hard cap kept for anti-abuse (uniform across plans). Defaults to 5000 on create.
    maxGuests: v.number(),
    // Gallery access expires after this timestamp. Computed from planTier
    // (Essential = J+30, Premium = J+180) on payment success. Post-event upsell
    // pushes this to J+5y.
    galleryExpiresAt: v.optional(v.number()),
    /**
     * Configuration du message d'invitation WhatsApp envoyé aux invités.
     * Le couple choisit un style préfabriqué (Wedillybird-prefab MVP — cf.
     * `lib/whatsapp/templates.ts`) et personnalise via un mot perso libre
     * (max 60 chars) + un canal préféré.
     *
     * Tier supérieur (Premium) débloquera les templates 100% custom plus
     * tard (cf. BACKLOG section "Templates WhatsApp Cloud API"). Pour
     * cette phase, customTemplateId est réservé pour W3.
     */
    messagingConfig: v.optional(
      v.object({
        templateStyle: v.union(
          v.literal('classic'),
          v.literal('warm'),
          v.literal('african'),
          v.literal('minimal'),
          v.literal('festive'),
        ),
        personalMessage: v.optional(v.string()),
        preferredChannel: v.union(v.literal('whatsapp'), v.literal('email'), v.literal('both')),
        // Référence vers un template custom soumis par le couple (cf. table
        // `whatsappTemplates`). Utilisé en priorité sur `templateStyle` quand
        // le template est `approved`. Tant que le template est `pending` ou
        // `rejected`, on retombe sur le style préfabriqué.
        customTemplateId: v.optional(v.id('whatsappTemplates')),
        // Canal sur lequel le couple veut être notifié quand Meta valide ou
        // rejette son template custom. Distinct de `preferredChannel` (qui
        // concerne l'envoi des invitations aux invités).
        templateNotifyChannel: v.optional(
          v.union(v.literal('whatsapp'), v.literal('email'), v.literal('both')),
        ),
      }),
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_owner', ['ownerId'])
    .index('by_slug', ['slug'])
    .index('by_status', ['status'])
    .index('by_organization', ['organizationId']),

  guests: defineTable({
    eventId: v.id('events'),
    fullName: v.string(),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    category: v.optional(v.string()),
    plusOnesAllowed: v.number(),
    plusOnesNames: v.optional(v.array(v.string())),
    rsvpStatus: v.union(
      v.literal('pending'),
      v.literal('attending'),
      v.literal('declined'),
      v.literal('maybe'),
    ),
    rsvpRespondedAt: v.optional(v.number()),
    dietaryRestrictions: v.optional(v.string()),
    notes: v.optional(v.string()),
    qrCodeToken: v.string(),
    checkedInAt: v.optional(v.number()),
    checkedInBy: v.optional(v.id('users')),
    invitationSentAt: v.optional(v.number()),
    invitationChannel: v.optional(
      v.union(v.literal('whatsapp'), v.literal('email'), v.literal('sms')),
    ),
    // Reminders sent (idempotence for the daily cron). Set when SES action succeeds.
    reminderD7SentAt: v.optional(v.number()),
    reminderD1SentAt: v.optional(v.number()),
    /**
     * Timestamp du dernier rappel (tous canaux/tiers confondus) envoyé à
     * l'invité. Utilisé comme garde-fou anti-doublon court-terme : si une
     * cron est ré-exécutée (manuellement ou suite à un retry transient) on
     * skip tout invité réveillé < 12 h plus tôt, peu importe le tier (D7/D1).
     * Distinct de `reminderD{7|1}SentAt` qui assurent l'idempotence par tier
     * sur la durée de vie de l'event.
     */
    lastReminderSentAt: v.optional(v.number()),
    /**
     * Table de placement assignée (plan de table / seating, feature Premium/Pro).
     * undefined = invité non assigné. L'invité + ses plus-ones confirmés
     * occupent cette table (capacité comptée côté query getSeatingPlan).
     */
    tableId: v.optional(v.id('tables')),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_event', ['eventId'])
    .index('by_event_rsvp', ['eventId', 'rsvpStatus'])
    .index('by_qr_token', ['qrCodeToken'])
    .index('by_phone', ['phone'])
    .index('by_table', ['tableId']),

  /**
   * Tables du plan de placement (seating) d'un event. Une row par table
   * physique. L'assignation invité→table est portée par `guests.tableId`.
   * Feature Premium + Pro (cf. `seatingPlan` dans convex/lib/entitlements.ts) ;
   * exclue d'Essentiel.
   */
  tables: defineTable({
    eventId: v.id('events'),
    name: v.string(),
    capacity: v.number(),
    // Forme du nœud dans le plan visuel spatial (v2). Défaut traité comme 'round'.
    shape: v.optional(v.union(v.literal('round'), v.literal('rect'))),
    // Position (px) du nœud sur le canvas du plan visuel (v2). undefined =
    // pas encore positionné → l'UI applique une grille par défaut.
    posX: v.optional(v.number()),
    posY: v.optional(v.number()),
    // Ordre d'affichage dans la vue liste (board drag-and-drop).
    order: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_event', ['eventId']),

  /**
   * Placement des **accompagnants** (plus-ones) sur une table, indépendamment
   * de leur invité principal (v2.1). Convention `memberIndex` :
   *  - L'invité principal (memberIndex 0) reste porté par `guests.tableId`
   *    (rétro-compat V1/V2) — il n'a PAS de row ici.
   *  - Chaque accompagnant `plusOnesNames[k]` = memberIndex `k + 1`, et a une
   *    row ici quand il est placé (absence de row = non placé).
   * Une personne = une place (la capacité d'une table compte les personnes).
   */
  tableAssignments: defineTable({
    eventId: v.id('events'),
    guestId: v.id('guests'),
    memberIndex: v.number(), // >= 1 (les accompagnants ; le principal est sur guests.tableId)
    tableId: v.id('tables'),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_event', ['eventId'])
    .index('by_table', ['tableId'])
    .index('by_guest', ['guestId'])
    .index('by_guest_member', ['guestId', 'memberIndex']),

  eventCollaborators: defineTable({
    eventId: v.id('events'),
    userId: v.id('users'),
    role: v.union(
      v.literal('couple'), // le ou les marié·e·s rattaché·e·s par l'agence (espace couple)
      v.literal('co_owner'),
      v.literal('planner'),
      v.literal('scanner'),
      v.literal('viewer'),
    ),
    invitedBy: v.id('users'),
    invitedAt: v.number(),
    acceptedAt: v.optional(v.number()),
  })
    .index('by_event', ['eventId'])
    .index('by_user', ['userId'])
    .index('by_event_user', ['eventId', 'userId']),

  payments: defineTable({
    userId: v.id('users'),
    eventId: v.id('events'),
    plan: v.union(v.literal('essential'), v.literal('premium')),
    currency: v.union(
      v.literal('EUR'),
      v.literal('USD'),
      v.literal('XOF'),
      v.literal('MAD'),
      v.literal('TND'),
    ),
    amountMinor: v.number(),
    provider: v.union(v.literal('stripe'), v.literal('mock')),
    providerSessionId: v.string(),
    providerEventId: v.optional(v.string()),
    status: v.union(
      v.literal('pending'),
      v.literal('succeeded'),
      v.literal('failed'),
      v.literal('cancelled'),
    ),
    failureReason: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_user', ['userId'])
    .index('by_event', ['eventId'])
    .index('by_session', ['provider', 'providerSessionId']),

  photos: defineTable({
    eventId: v.id('events'),
    // Exactly one of storageId (legacy Convex storage) or s3Key (current AWS S3) is set.
    storageId: v.optional(v.id('_storage')),
    s3Key: v.optional(v.string()),
    uploadedBy: v.optional(v.id('users')),
    uploadedByGuestToken: v.optional(v.string()),
    uploaderName: v.optional(v.string()),
    status: v.union(v.literal('pending'), v.literal('approved'), v.literal('rejected')),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    sizeBytes: v.number(),
    contentType: v.string(),
    /**
     * Variantes WebP générées par le Lambda Sharp à l'upload : `thumb-256`,
     * `medium-1024`, `large-2048`. Stockées sous `processed/{eventId}/{photoId}/{size}.webp`
     * et exposées via CloudFront (même distribution que `s3Key`).
     *
     * - thumb (max 256px) : grid masonry galerie owner/guest, ~12 KB / image.
     * - medium (max 1024px) : lightbox / face search hits, ~80 KB / image.
     * - large (max 2048px) : download single + ZIP (full-resolution-ish).
     *
     * Si absent (Lambda pas tourné, échec, ancienne photo) : fallback sur
     * `s3Key` original côté UI.
     */
    variants: v.optional(
      v.object({
        thumb: v.optional(v.string()),
        medium: v.optional(v.string()),
        large: v.optional(v.string()),
      }),
    ),
    moderatedAt: v.optional(v.number()),
    moderatedBy: v.optional(v.id('users')),
    moderation: v.optional(
      v.object({
        source: v.union(v.literal('rekognition'), v.literal('manual')),
        // `manual_review` = Rekognition n'a ni rejeté ni approuvé en confiance
        // (image détectée comme illustration suspecte ou OCR ambigu) — la
        // photo reste `status: 'pending'` jusqu'à intervention owner explicite.
        decision: v.union(v.literal('approved'), v.literal('rejected'), v.literal('manual_review')),
        topLabel: v.optional(v.string()),
        topConfidence: v.optional(v.number()),
        labels: v.optional(v.array(v.object({ name: v.string(), confidence: v.number() }))),
        /** Texte OCR brut extrait par Rekognition.DetectText (utile à l'audit). */
        ocrText: v.optional(v.string()),
        /** Mot-clé blacklist OCR qui a déclenché un `rejected` ou `manual_review`. */
        ocrFlaggedKeyword: v.optional(v.string()),
        /** Catégories haut-niveau détectées (Drawing, Illustration, Cartoon, etc.). */
        contentLabels: v.optional(v.array(v.string())),
        /** Raison lisible passée au owner pour expliquer un `manual_review`. */
        reviewReason: v.optional(v.string()),
        decidedAt: v.number(),
      }),
    ),
    createdAt: v.number(),
  })
    .index('by_event', ['eventId'])
    .index('by_event_status', ['eventId', 'status'])
    .index('by_guest_token', ['uploadedByGuestToken'])
    .index('by_s3_key', ['s3Key']),

  /**
   * Visages extraits par Rekognition `IndexFaces` pour chaque photo
   * `approved`. Une row par visage détecté (jusqu'à 5 par image), permet la
   * recherche par selfie via `SearchFacesByImage` puis lookup `faceId →
   * photoId` ici.
   *
   * Les valeurs `faceId` proviennent du Rekognition Face ID (UUID Rekognition,
   * stable tant que la collection existe). Suppression d'une photo doit
   * supprimer les `photoFaces` associés (cleanup côté `photos:remove`,
   * non encore câblé — cf. BACKLOG section "Câblage métier").
   */
  photoFaces: defineTable({
    photoId: v.id('photos'),
    eventId: v.id('events'),
    faceId: v.string(),
    boundingBox: v.optional(
      v.object({
        width: v.number(),
        height: v.number(),
        left: v.number(),
        top: v.number(),
      }),
    ),
    confidence: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index('by_photo', ['photoId'])
    .index('by_event', ['eventId'])
    .index('by_face', ['faceId']),

  otpSessions: defineTable({
    phone: v.string(),
    codeHash: v.string(),
    channel: v.union(v.literal('whatsapp'), v.literal('sms')),
    attempts: v.number(),
    expiresAt: v.number(),
    consumedAt: v.optional(v.number()),
    createdAt: v.number(),
    ipAddress: v.optional(v.string()),
  })
    .index('by_phone', ['phone'])
    .index('by_phone_expires', ['phone', 'expiresAt']),

  /**
   * Magic Link sessions — fallback auth par email pour les utilisateurs
   * sans WhatsApp. Pattern miroir de otpSessions :
   *  - tokenHash : SHA-256 du token (32 bytes random) avec email en salt
   *  - expiresAt : issuedAt + 15 min (court pour limiter l'exposition)
   *  - consumedAt : single-use, set quand le token est utilisé
   */
  magicLinkSessions: defineTable({
    email: v.string(),
    tokenHash: v.string(),
    expiresAt: v.number(),
    consumedAt: v.optional(v.number()),
    createdAt: v.number(),
    ipAddress: v.optional(v.string()),
  })
    .index('by_email', ['email'])
    .index('by_email_expires', ['email', 'expiresAt'])
    .index('by_token_hash', ['tokenHash']),

  /**
   * Link verifications — codes OTP 6 chiffres pour ajouter un identifiant
   * (phone OU email) à un user existant. Distinct de `otpSessions` /
   * `magicLinkSessions` qui sont pour le login. Évite les doublons : un user
   * peut activer sa 2e méthode de connexion sans créer un compte distinct.
   *
   * Pattern :
   *  1. Sender : `auth.requestLink{Phone,Email}` génère un code 6 digits,
   *     vérifie que le target n'appartient pas déjà à un autre user, envoie
   *     via WhatsApp (phone) ou SES (email)
   *  2. Verifier : `auth.verifyLink{Phone,Email}` vérifie le code, patche
   *     `users.{phone|email}` (block si pris entre-temps : race condition)
   */
  linkVerifications: defineTable({
    userId: v.id('users'),
    targetKind: v.union(v.literal('phone'), v.literal('email')),
    targetValue: v.string(),
    codeHash: v.string(),
    attempts: v.number(),
    expiresAt: v.number(),
    consumedAt: v.optional(v.number()),
    createdAt: v.number(),
    ipAddress: v.optional(v.string()),
  })
    .index('by_user', ['userId'])
    .index('by_user_kind', ['userId', 'targetKind'])
    .index('by_user_kind_expires', ['userId', 'targetKind', 'expiresAt']),

  /**
   * Newsletter subscribers — abonnés à la newsletter publique. MVP store-first :
   * on capture l'email avant de brancher un service externe (Brevo, Mailchimp).
   *
   * Toggle status pour permettre désabonnement plus tard sans hard-delete (RGPD :
   * un soft-delete avec timestamp permet la traçabilité, hard-delete sur demande
   * explicite via `rights` privacy policy).
   *
   * Pas de double opt-in pour le moment — `confirmedAt` réservé pour quand on
   * branchera le système de campagnes (lien de confirmation dans le mail
   * de bienvenue).
   */
  /**
   * Templates WhatsApp custom soumis par les couples (Premium tier).
   *
   * Le couple écrit son corps de message + libellé du bouton CTA, on génère
   * un nom Meta unique (`couple_{eventId}_{nanoid}`) et on soumet à
   * Meta Cloud API : `POST /{WABA_ID}/message_templates`. Meta valide en
   * 24-48h via Business Manager.
   *
   * États :
   *  - `draft` : créé localement, pas encore soumis à Meta
   *  - `pending` : soumis, en attente de revue Meta (status PENDING)
   *  - `approved` : Meta a validé (status APPROVED), utilisable pour broadcast
   *  - `rejected` : Meta a refusé (status REJECTED), `rejectionReason` rempli
   *  - `paused` : Meta a suspendu pour qualité (status PAUSED)
   *  - `disabled` : Meta a définitivement désactivé (status DISABLED)
   *
   * Le webhook Meta `message_template_status_update` met à jour ces états et
   * déclenche une notification au couple via `templateNotifyChannel`.
   *
   * Variables canoniques (alignement avec les 5 styles préfabriqués) :
   *   {{1}} = prénom invité, {{2}} = noms du couple, {{3}} = date,
   *   {{4}} = mot perso, {{5}} = optionnel (libre)
   * Le bouton CTA URL utilise un placeholder dynamique pour le QR token de
   * l'invité.
   */
  whatsappTemplates: defineTable({
    ownerId: v.id('users'),
    eventId: v.id('events'),
    // Nom unique côté Meta (lowercase, alphanumérique + underscore, max 512).
    name: v.string(),
    language: v.literal('fr'),
    category: v.literal('MARKETING'),
    bodyText: v.string(),
    ctaLabel: v.string(),
    // URL pattern du bouton, ex: `https://wedillybird.com/i/{{1}}`. Le {{1}}
    // sera remplacé par le qrCodeToken de l'invité au moment de l'envoi.
    ctaUrlPattern: v.string(),
    status: v.union(
      v.literal('draft'),
      v.literal('pending'),
      v.literal('approved'),
      v.literal('rejected'),
      v.literal('paused'),
      v.literal('disabled'),
    ),
    // ID Meta (assigné après soumission réussie). Utilisé par le webhook pour
    // matcher les events `message_template_status_update`.
    metaTemplateId: v.optional(v.string()),
    rejectionReason: v.optional(v.string()),
    submittedAt: v.optional(v.number()),
    reviewedAt: v.optional(v.number()),
    // Idempotence : si une notif a déjà été envoyée pour le passage à
    // `approved`/`rejected`/`disabled`, on ne renotifie pas.
    notifiedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_event', ['eventId'])
    .index('by_owner', ['ownerId'])
    .index('by_meta_id', ['metaTemplateId'])
    .index('by_status', ['status']),

  newsletterSubscribers: defineTable({
    email: v.string(),
    status: v.union(v.literal('active'), v.literal('unsubscribed')),
    source: v.optional(v.string()),
    subscribedAt: v.number(),
    unsubscribedAt: v.optional(v.number()),
    confirmedAt: v.optional(v.number()),
    ipAddress: v.optional(v.string()),
  })
    .index('by_email', ['email'])
    .index('by_status_subscribedAt', ['status', 'subscribedAt']),

  /**
   * Buckets de rate-limit générique. Une row par couple (scope, key) — par ex.
   * (`face_search`, `<userId>`) ou (`face_search`, `<guestToken>`). Le compteur
   * se reset quand `windowStartedAt` est plus vieux que la fenêtre configurée
   * côté caller (cf. `convex/lib/rateLimit.ts`).
   *
   * On utilise un bucket DB plutôt qu'un cache mémoire car les actions Convex
   * sont stateless et peuvent tourner sur des workers différents — il faut un
   * état partagé pour que le rate-limit soit fiable.
   */
  rateLimitBuckets: defineTable({
    scope: v.string(),
    key: v.string(),
    count: v.number(),
    windowStartedAt: v.number(),
    updatedAt: v.number(),
  }).index('by_scope_key', ['scope', 'key']),

  adminAuditLog: defineTable({
    adminId: v.id('users'),
    action: v.string(),
    targetType: v.union(
      v.literal('user'),
      v.literal('event'),
      v.literal('payment'),
      v.literal('organization'),
      v.literal('photo'),
      v.literal('template'),
      v.literal('newsletter'),
    ),
    targetId: v.string(),
    details: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index('by_admin', ['adminId'])
    .index('by_target', ['targetType', 'targetId'])
    .index('by_created', ['createdAt']),

  /**
   * CRM clients (back-office agence, feature Business+). Un client = un couple
   * suivi dans le pipeline commercial, du lead à la livraison. Peut être
   * converti en `events` (mariage) : `eventId` est alors renseigné.
   */
  clients: defineTable({
    organizationId: v.id('organizations'),
    partnerA: v.string(),
    partnerB: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    whatsapp: v.optional(v.string()),
    stage: v.union(
      v.literal('lead'),
      v.literal('contacted'),
      v.literal('quote'),
      v.literal('booked'),
      v.literal('in_progress'),
      v.literal('delivered'),
    ),
    /** Origine du lead (Instagram, recommandation, salon…). */
    source: v.optional(v.string()),
    weddingDate: v.optional(v.number()),
    venue: v.optional(v.string()),
    /** Budget estimé (prévu) en centimes d'euro. */
    budgetMinor: v.optional(v.number()),
    /** Budget déjà réservé/engagé en centimes d'euro. */
    budgetBookedMinor: v.optional(v.number()),
    /** Membre de l'agence assigné au dossier. */
    assigneeId: v.optional(v.id('users')),
    notes: v.optional(v.string()),
    /** Mariage créé lors de la conversion du lead. */
    eventId: v.optional(v.id('events')),
    lastContactAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_organization', ['organizationId'])
    .index('by_org_stage', ['organizationId', 'stage'])
    .index('by_event', ['eventId']),

  /**
   * Timeline d'activité d'un client CRM (notes manuelles + événements
   * auto-générés : changement de statut, création de mariage…).
   */
  clientNotes: defineTable({
    clientId: v.id('clients'),
    organizationId: v.id('organizations'),
    type: v.union(
      v.literal('note'),
      v.literal('status'),
      v.literal('call'),
      v.literal('email'),
      v.literal('payment'),
    ),
    text: v.string(),
    authorId: v.optional(v.id('users')),
    authorName: v.optional(v.string()),
    createdAt: v.number(),
  }).index('by_client', ['clientId']),

  /**
   * Lignes de budget d'un mariage (back-office agence). Lecture pour tous les
   * tiers, édition réservée à Business+. `organizationId` est dénormalisé pour
   * l'autorisation et les vues consolidées.
   */
  budgetLines: defineTable({
    eventId: v.id('events'),
    organizationId: v.id('organizations'),
    category: v.string(),
    label: v.string(),
    vendorName: v.optional(v.string()),
    /** Montant prévu (centimes d'euro). */
    plannedMinor: v.number(),
    /** Montant déjà payé (centimes d'euro). */
    paidMinor: v.number(),
    dueDate: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_event', ['eventId'])
    .index('by_organization', ['organizationId']),

  /**
   * Registre des paiements rattachés à une ligne de budget (back-office agence,
   * Business+). Plusieurs paiements partiels par ligne ; `budgetLines.paidMinor`
   * est le cache de la somme des paiements `succeeded`. Chaque paiement peut
   * porter un justificatif (Convex `_storage`, optionnel).
   *
   * Saisie manuelle (`status: 'succeeded'` immédiat) en Phase 1. Les champs
   * `provider`/`providerSessionId`/`status: 'pending'` sont réservés au
   * paiement en ligne (Wedillybird Pay) branché en Phase 2 — `by_session`
   * garantit l'idempotence des webhooks.
   */
  budgetPayments: defineTable({
    budgetLineId: v.id('budgetLines'),
    eventId: v.id('events'),
    organizationId: v.id('organizations'),
    /** Montant du paiement (centimes d'euro), > 0. */
    amountMinor: v.number(),
    method: v.union(
      v.literal('transfer'), // virement
      v.literal('card'), // carte (saisie manuelle)
      v.literal('cash'), // espèces
      v.literal('check'), // chèque
      v.literal('online'), // via Wedillybird Pay (Phase 2)
      v.literal('other'),
    ),
    status: v.union(v.literal('succeeded'), v.literal('pending'), v.literal('failed')),
    /** Date du paiement (ms). */
    paidAt: v.number(),
    note: v.optional(v.string()),
    /** Justificatif optionnel (blob Convex storage) + nom de fichier d'origine. */
    proofStorageId: v.optional(v.id('_storage')),
    proofFileName: v.optional(v.string()),
    // ---- Paiement en ligne (Wedillybird Pay) ----
    provider: v.optional(v.union(v.literal('stripe'), v.literal('mock'))),
    /** Compte connecté de l'agence sur lequel la session a été créée — sert à vérifier
     *  l'origine du webhook (`event.account`) pour bloquer tout marquage inter-tenant. */
    stripeConnectAccountId: v.optional(v.string()),
    providerSessionId: v.optional(v.string()),
    /** Lien de paiement à partager (Stripe Checkout) tant que le paiement est `pending`. */
    checkoutUrl: v.optional(v.string()),
    /** Reçu hébergé par le prestataire (preuve auto une fois `succeeded`). */
    receiptUrl: v.optional(v.string()),
    createdBy: v.id('users'),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_line', ['budgetLineId'])
    .index('by_event', ['eventId'])
    .index('by_organization', ['organizationId'])
    .index('by_session', ['provider', 'providerSessionId']),

  /**
   * Devis & Factures émis par une agence à ses clients (couples). Org-level,
   * réservé Business+ (`documentsEsign`/quoting). Montants en centimes.
   * Un document est soit un devis (`quote`) soit une facture (`invoice`) ; le
   * champ `status` couvre l'union des statuts des deux types.
   */
  quoteDocs: defineTable({
    organizationId: v.id('organizations'),
    type: v.union(v.literal('quote'), v.literal('invoice')),
    /** Numéro lisible : « DEV-2026-014 » / « FAC-2026-031 ». */
    number: v.string(),
    clientId: v.optional(v.id('clients')),
    /** Nom du client dénormalisé (affichage rapide même si la fiche change). */
    clientName: v.string(),
    eventId: v.optional(v.id('events')),
    status: v.union(
      v.literal('draft'),
      v.literal('sent'),
      v.literal('accepted'),
      v.literal('refused'),
      v.literal('expired'),
      v.literal('partial'),
      v.literal('paid'),
      v.literal('overdue'),
    ),
    lineItems: v.array(
      v.object({ label: v.string(), qty: v.number(), unitPriceMinor: v.number() }),
    ),
    discountMinor: v.optional(v.number()),
    discountPct: v.optional(v.number()),
    taxRate: v.optional(v.number()),
    /** Échéancier de paiement (factures) : acompte + solde, etc. */
    schedule: v.optional(
      v.array(
        v.object({
          label: v.string(),
          amountMinor: v.number(),
          dueDate: v.optional(v.number()),
          paid: v.boolean(),
        }),
      ),
    ),
    issueDate: v.number(),
    dueDate: v.optional(v.number()),
    notes: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_organization', ['organizationId'])
    .index('by_org_type', ['organizationId', 'type'])
    .index('by_client', ['clientId'])
    .index('by_event', ['eventId']),

  /**
   * Liens de paiement en ligne créés par l'agence sur SON compte Stripe connecté
   * (charge directe). Générique : adossé à une échéance de facture
   * (`kind: 'invoice'`) ou libre (`kind: 'free'`, montant + libellé ad hoc). Le
   * webhook réconcilie via `by_session` ; pour une facture, l'échéance liée passe
   * `paid` automatiquement à l'encaissement. Distinct de `budgetPayments` (qui est
   * adossé aux lignes de budget interne).
   */
  paymentLinks: defineTable({
    organizationId: v.id('organizations'),
    kind: v.union(v.literal('invoice'), v.literal('free')),
    /** Facture liée (kind 'invoice') + index de l'échéance dans `schedule`. */
    invoiceDocId: v.optional(v.id('quoteDocs')),
    invoiceMilestoneIndex: v.optional(v.number()),
    /** Mariage rattaché (pour l'espace couple) — dérivé de la facture (kind 'invoice'). */
    eventId: v.optional(v.id('events')),
    amountMinor: v.number(),
    currency: v.string(),
    /** Libellé affiché au couple sur Stripe Checkout. */
    description: v.string(),
    /** Nom du client (affichage agence), dénormalisé. */
    clientName: v.optional(v.string()),
    status: v.union(v.literal('pending'), v.literal('succeeded'), v.literal('failed')),
    provider: v.union(v.literal('stripe')),
    /** Compte connecté de l'agence sur lequel la session a été créée — sert à vérifier
     *  l'origine du webhook (`event.account`) pour bloquer tout marquage inter-tenant. */
    stripeConnectAccountId: v.optional(v.string()),
    providerSessionId: v.optional(v.string()),
    /** Lien Checkout à partager tant que `pending`. */
    checkoutUrl: v.optional(v.string()),
    /** Reçu hébergé Stripe (preuve auto une fois `succeeded`). */
    receiptUrl: v.optional(v.string()),
    createdBy: v.id('users'),
    createdAt: v.number(),
    updatedAt: v.number(),
    paidAt: v.optional(v.number()),
  })
    .index('by_organization', ['organizationId'])
    .index('by_session', ['providerSessionId'])
    .index('by_invoice', ['invoiceDocId'])
    .index('by_event', ['eventId']),

  /** Historique d'activité d'un document (création, envoi, paiement…). */
  quoteActivity: defineTable({
    docId: v.id('quoteDocs'),
    organizationId: v.id('organizations'),
    label: v.string(),
    /** Nom d'icône Lucide (ex. « FilePlus », « Send », « CircleCheck »). */
    icon: v.string(),
    createdAt: v.number(),
  }).index('by_doc', ['docId']),

  /**
   * Contrats agence → couple (module Finances, Business+). Cycle de vie :
   * brouillon → envoyé → signé couple → contre-signé → actif (ou annulé).
   * La signature est matérialisée par des transitions de statut (pas de
   * service e-sign externe) ; chaque étape est tracée dans `contractAudit`.
   */
  contracts: defineTable({
    organizationId: v.id('organizations'),
    number: v.string(),
    clientId: v.optional(v.id('clients')),
    clientName: v.string(),
    eventId: v.optional(v.id('events')),
    quoteId: v.optional(v.id('quoteDocs')),
    status: v.union(
      v.literal('draft'),
      v.literal('sent'),
      v.literal('signed_client'),
      v.literal('countersigned'),
      v.literal('active'),
      v.literal('cancelled'),
    ),
    sections: v.array(v.object({ title: v.string(), body: v.string() })),
    totalMinor: v.number(),
    /** Juridiction applicable (FR, BE, CH, LU, CA-QC, US…) → loi + cadre e-signature. */
    jurisdiction: v.optional(v.string()),
    sentAt: v.optional(v.number()),
    signedAt: v.optional(v.number()),
    /** Horodatage de la contre-signature agence (signature électronique). */
    countersignedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_organization', ['organizationId'])
    .index('by_client', ['clientId'])
    .index('by_event', ['eventId']),

  /** Journal d'audit d'un contrat (création, envoi, signature, etc.). */
  contractAudit: defineTable({
    contractId: v.id('contracts'),
    organizationId: v.id('organizations'),
    event: v.string(),
    by: v.optional(v.string()),
    ip: v.optional(v.string()),
    createdAt: v.number(),
  }).index('by_contract', ['contractId']),

  /**
   * Tâches de rétroplanning d'un mariage (back-office agence, tous tiers).
   * Organisées par phase relative à la date du jour J.
   */
  planningTasks: defineTable({
    eventId: v.id('events'),
    organizationId: v.id('organizations'),
    phase: v.union(
      v.literal('m12'),
      v.literal('m6'),
      v.literal('m3'),
      v.literal('m1'),
      v.literal('d7'),
      v.literal('dday'),
      v.literal('after'),
    ),
    title: v.string(),
    done: v.boolean(),
    /** Statut tri-état (vue Tableau/kanban). `done` reste synchronisé (status==='done'). */
    status: v.optional(v.union(v.literal('todo'), v.literal('doing'), v.literal('done'))),
    /** Note interne libre sur la tâche. */
    notes: v.optional(v.string()),
    /** Sous-tâches (checklist) de la tâche. */
    subtasks: v.optional(v.array(v.object({ label: v.string(), done: v.boolean() }))),
    dueDate: v.optional(v.number()),
    assigneeId: v.optional(v.id('users')),
    priority: v.optional(v.union(v.literal('low'), v.literal('normal'), v.literal('high'))),
    order: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_event', ['eventId'])
    .index('by_organization', ['organizationId']),

  /**
   * Modèles de rétroplanning personnalisés (org-level, tous tiers). Une agence
   * peut enregistrer un planning maison (liste de tâches par phase) et le
   * réappliquer à n'importe quel mariage, en plus des modèles intégrés.
   */
  planningTemplates: defineTable({
    organizationId: v.id('organizations'),
    name: v.string(),
    tasks: v.array(
      v.object({
        phase: v.union(
          v.literal('m12'),
          v.literal('m6'),
          v.literal('m3'),
          v.literal('m1'),
          v.literal('d7'),
          v.literal('dday'),
          v.literal('after'),
        ),
        title: v.string(),
      }),
    ),
    createdBy: v.optional(v.id('users')),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_organization', ['organizationId']),

  /**
   * Annuaire prestataires d'une agence (org-level, tous tiers ; Starter plafonné
   * à 25 fiches). Réutilisable d'un mariage à l'autre.
   */
  vendors: defineTable({
    organizationId: v.id('organizations'),
    name: v.string(),
    category: v.string(),
    location: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    whatsapp: v.optional(v.string()),
    website: v.optional(v.string()),
    /** Gamme de prix : 1 (€), 2 (€€), 3 (€€€). */
    priceRange: v.optional(v.number()),
    /** Note interne 0–5. */
    rating: v.optional(v.number()),
    notes: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_organization', ['organizationId']),

  /**
   * Rattachement prestataire ↔ mariage (« Par mariage ») : suit l'engagement
   * d'un prestataire sur un événement (statut + budget prévu + ligne budget liée).
   */
  vendorEngagements: defineTable({
    organizationId: v.id('organizations'),
    vendorId: v.id('vendors'),
    eventId: v.id('events'),
    status: v.union(
      v.literal('contacted'),
      v.literal('quoted'),
      v.literal('booked'),
      v.literal('confirmed'),
    ),
    /** Montant prévu rattaché (centimes d'euro). */
    plannedMinor: v.optional(v.number()),
    /** Ligne budget créée pour cet engagement, si « relier au budget ». */
    budgetLineId: v.optional(v.id('budgetLines')),
    notes: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_organization', ['organizationId'])
    .index('by_event', ['eventId'])
    .index('by_vendor', ['vendorId'])
    .index('by_vendor_event', ['vendorId', 'eventId']),
});
