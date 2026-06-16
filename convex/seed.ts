import { v } from 'convex/values';
import type { Id } from './_generated/dataModel';
import { internalMutation, mutation } from './_generated/server';

const TEST_USERS = [
  {
    phone: '+33612931779',
    email: 'mamadou@wedillybird.test',
    fullName: 'Mamadou Seck',
    role: 'couple' as const,
  },
  {
    phone: '+221771234567',
    email: 'aicha@wedillybird.test',
    fullName: 'Aïcha Diallo',
    role: 'couple' as const,
  },
  {
    phone: '+33698765432',
    email: 'jean@wedillybird.test',
    fullName: 'Jean Dupont',
    role: 'couple' as const,
  },
  {
    phone: '+212661234567',
    email: 'fatima@wedillybird.test',
    fullName: 'Fatima Bennani',
    role: 'couple' as const,
  },
  {
    phone: '+225071234567',
    email: 'kwame@wedillybird.test',
    fullName: 'Kwame Kouassi',
    role: 'pro' as const,
  },
  {
    phone: '+33600000002',
    email: 'camille@wedillybird.test',
    fullName: 'Camille Faye',
    role: 'pro' as const,
  },
];

export const seedTestUsers = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const results: Array<{ phone: string; userId: string; created: boolean }> = [];

    for (const fixture of TEST_USERS) {
      const existing = await ctx.db
        .query('users')
        .withIndex('by_phone', (q) => q.eq('phone', fixture.phone))
        .first();

      if (existing) {
        await ctx.db.patch(existing._id, {
          fullName: fixture.fullName,
          email: fixture.email,
          role: fixture.role,
          lastSeenAt: now,
        });
        results.push({ phone: fixture.phone, userId: existing._id, created: false });
      } else {
        const userId = await ctx.db.insert('users', {
          phone: fixture.phone,
          email: fixture.email,
          fullName: fixture.fullName,
          role: fixture.role,
          locale: 'fr',
          createdAt: now,
          lastSeenAt: now,
        });
        results.push({ phone: fixture.phone, userId, created: true });
      }
    }

    return results;
  },
});

/**
 * Seed (ou promotion) d'un super admin pour les tests E2E du dashboard `/admin`.
 * Idempotent : crée le user s'il manque, sinon force `role: 'admin'`. Le numéro
 * correspond au fixture admin de `lib/dev/test-users.ts` (porte d'entrée
 * `/dev-login`).
 */
export const seedAdminUser = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const phone = '+33600000001';
    const existing = await ctx.db
      .query('users')
      .withIndex('by_phone', (q) => q.eq('phone', phone))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { role: 'admin', lastSeenAt: now });
      return { userId: existing._id, created: false };
    }
    const userId = await ctx.db.insert('users', {
      phone,
      email: 'admin@wedillybird.test',
      fullName: 'Super Admin',
      role: 'admin',
      locale: 'fr',
      createdAt: now,
      lastSeenAt: now,
    });
    return { userId, created: true };
  },
});

/**
 * Mutation utilitaire pour les tests E2E du flow linking : crée un user
 * "magic-link-only" (email présent, phone absent) — état intermédiaire
 * d'un user qui s'est connecté via magic link sans encore lier son
 * WhatsApp. Idempotent.
 */
export const seedEmailOnlyUser = mutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const normalized = email.trim().toLowerCase();
    const existing = await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', normalized))
      .first();
    if (existing) {
      return { userId: existing._id, created: false };
    }
    const now = Date.now();
    const userId = await ctx.db.insert('users', {
      email: normalized,
      fullName: 'Test Email-only',
      role: 'couple' as const,
      locale: 'fr' as const,
      createdAt: now,
      lastSeenAt: now,
    });
    return { userId, created: true };
  },
});

const LAUNCH_DEMO_SLUG = 'sarah-marc-launch-demo';

const LAUNCH_DEMO_OWNER = {
  phone: '+33600000001',
  email: 'demo-owner@wedillybird.test',
  fullName: 'Marc Lefèvre',
};

const LAUNCH_DEMO_GUESTS: Array<{
  fullName: string;
  phone?: string;
  email?: string;
  category?: string;
  plusOnesAllowed: number;
  plusOnesNames?: string[];
  rsvpStatus: 'pending' | 'attending' | 'declined' | 'maybe';
  dietaryRestrictions?: string;
}> = [
  {
    fullName: 'Aïcha Diallo',
    phone: '+221771112201',
    category: 'Family',
    plusOnesAllowed: 1,
    plusOnesNames: ['Ibrahima Diallo'],
    rsvpStatus: 'attending',
  },
  {
    fullName: 'Mamadou Seck',
    phone: '+221771112202',
    category: 'Family',
    plusOnesAllowed: 0,
    rsvpStatus: 'attending',
  },
  {
    fullName: 'Camille Moreau',
    phone: '+33611112203',
    category: 'Friends',
    plusOnesAllowed: 1,
    plusOnesNames: ['Lucas Moreau'],
    rsvpStatus: 'attending',
  },
  {
    fullName: 'Fatou Ndiaye',
    phone: '+221771112204',
    category: 'Friends',
    plusOnesAllowed: 0,
    rsvpStatus: 'attending',
    dietaryRestrictions: 'Vegetarian',
  },
  {
    fullName: 'Thomas Bernard',
    phone: '+33611112205',
    category: 'Friends',
    plusOnesAllowed: 1,
    plusOnesNames: ['Léa Bernard'],
    rsvpStatus: 'attending',
  },
  {
    fullName: 'Sophie Laurent',
    phone: '+33611112206',
    category: 'Work',
    plusOnesAllowed: 0,
    rsvpStatus: 'attending',
  },
  {
    fullName: 'Kwame Kouassi',
    phone: '+225071112207',
    category: 'Friends',
    plusOnesAllowed: 1,
    plusOnesNames: ['Akua Kouassi'],
    rsvpStatus: 'attending',
  },
  {
    fullName: 'Marie Rousseau',
    phone: '+33611112208',
    category: 'Family',
    plusOnesAllowed: 0,
    rsvpStatus: 'attending',
    dietaryRestrictions: 'Gluten free',
  },
  {
    fullName: 'Hugo Dubois',
    phone: '+33611112209',
    category: 'Friends',
    plusOnesAllowed: 0,
    rsvpStatus: 'attending',
  },
  {
    fullName: 'Awa Thiam',
    phone: '+221771112210',
    category: 'Family',
    plusOnesAllowed: 2,
    plusOnesNames: ['Moussa Thiam', 'Bineta Thiam'],
    rsvpStatus: 'attending',
  },
  {
    fullName: 'Pierre Garnier',
    phone: '+33611112211',
    category: 'Work',
    plusOnesAllowed: 1,
    plusOnesNames: ['Élise Garnier'],
    rsvpStatus: 'attending',
  },
  {
    fullName: 'Yasmine Benali',
    phone: '+33611112212',
    category: 'Friends',
    plusOnesAllowed: 0,
    rsvpStatus: 'attending',
  },
  {
    fullName: 'Nicolas Petit',
    phone: '+33611112213',
    category: 'Work',
    plusOnesAllowed: 0,
    rsvpStatus: 'maybe',
  },
  {
    fullName: 'Adama Touré',
    phone: '+225071112214',
    category: 'Family',
    plusOnesAllowed: 0,
    rsvpStatus: 'declined',
  },
  {
    fullName: 'Clara Marchand',
    phone: '+33611112215',
    category: 'Friends',
    plusOnesAllowed: 1,
    rsvpStatus: 'declined',
  },
  {
    fullName: 'Issa Sow',
    phone: '+221771112216',
    category: 'Family',
    plusOnesAllowed: 0,
    rsvpStatus: 'pending',
  },
  {
    fullName: 'Manon Lefebvre',
    phone: '+33611112217',
    category: 'Work',
    plusOnesAllowed: 0,
    rsvpStatus: 'pending',
  },
  {
    fullName: 'Khadija Coulibaly',
    phone: '+225071112218',
    category: 'Friends',
    plusOnesAllowed: 1,
    rsvpStatus: 'pending',
  },
];

function makeQrToken(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 20);
}

/**
 * Seed dédié au tournage de la vidéo de lancement.
 *
 * Crée (ou re-synchronise) un event de démo "Sarah & Marc" avec 18 invités
 * couvrant les 4 états RSVP (attending/maybe/declined/pending), des plus-ones,
 * des dietary restrictions, et un mix culturel (FR + Afrique de l'Ouest).
 *
 * Idempotent : re-run efface les invités existants pour ce slug avant
 * réinsertion, donc les tokens QR sont toujours frais.
 *
 * Retourne l'URL publique de l'invitation à charger pour les captures vidéo.
 */
export const seedLaunchDemo = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    let owner = await ctx.db
      .query('users')
      .withIndex('by_phone', (q) => q.eq('phone', LAUNCH_DEMO_OWNER.phone))
      .first();
    if (!owner) {
      const ownerId = await ctx.db.insert('users', {
        phone: LAUNCH_DEMO_OWNER.phone,
        email: LAUNCH_DEMO_OWNER.email,
        fullName: LAUNCH_DEMO_OWNER.fullName,
        role: 'couple',
        locale: 'en',
        planTier: 'premium',
        createdAt: now,
        lastSeenAt: now,
      });
      owner = await ctx.db.get(ownerId);
    } else if (owner.planTier !== 'premium') {
      await ctx.db.patch(owner._id, { planTier: 'premium', lastSeenAt: now });
    }
    if (!owner) throw new Error('OWNER_INIT_FAILED');

    const eventDate = new Date('2026-09-05T16:00:00.000Z').getTime();
    const galleryExpiresAt = eventDate + 180 * 24 * 60 * 60 * 1000;

    const existing = await ctx.db
      .query('events')
      .withIndex('by_slug', (q) => q.eq('slug', LAUNCH_DEMO_SLUG))
      .first();

    const eventPayload = {
      ownerId: owner._id,
      slug: LAUNCH_DEMO_SLUG,
      title: 'Camille & Hugo',
      coupleNames: { partnerA: 'Camille', partnerB: 'Hugo' },
      eventDate,
      timezone: 'Europe/Paris',
      venue: {
        name: 'The Olive Grove Estate',
        address: 'Saint-Rémy-de-Provence, France',
        lat: 43.7904,
        lng: 4.8317,
      },
      theme: {
        primaryColor: 'oklch(72% 0.09 20)',
        accentColor: '#FAF3E8',
        fontFamily: 'Bodoni Moda',
      },
      status: 'active' as const,
      planTier: 'premium' as const,
      paidAt: now - 7 * 24 * 60 * 60 * 1000,
      maxGuests: 5000,
      galleryExpiresAt,
      messagingConfig: {
        templateStyle: 'warm' as const,
        personalMessage: 'Save the date — we cannot wait to celebrate with you.',
        preferredChannel: 'whatsapp' as const,
      },
      updatedAt: now,
    };

    let eventId: Id<'events'>;
    if (existing) {
      await ctx.db.patch(existing._id, eventPayload);
      eventId = existing._id;
      const oldGuests = await ctx.db
        .query('guests')
        .withIndex('by_event', (q) => q.eq('eventId', eventId))
        .collect();
      for (const g of oldGuests) await ctx.db.delete(g._id);
    } else {
      eventId = await ctx.db.insert('events', { ...eventPayload, createdAt: now });
    }

    const respondedOffsetMs = [2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 16];
    let respondedIdx = 0;
    let insertedGuests = 0;

    for (const fixture of LAUNCH_DEMO_GUESTS) {
      const responded =
        fixture.rsvpStatus === 'attending' ||
        fixture.rsvpStatus === 'declined' ||
        fixture.rsvpStatus === 'maybe';
      const rsvpRespondedAt = responded
        ? now - (respondedOffsetMs[respondedIdx++ % respondedOffsetMs.length] ?? 5) * 60 * 60 * 1000
        : undefined;

      await ctx.db.insert('guests', {
        eventId,
        fullName: fixture.fullName,
        ...(fixture.phone ? { phone: fixture.phone } : {}),
        ...(fixture.email ? { email: fixture.email } : {}),
        ...(fixture.category ? { category: fixture.category } : {}),
        plusOnesAllowed: fixture.plusOnesAllowed,
        ...(fixture.plusOnesNames ? { plusOnesNames: fixture.plusOnesNames } : {}),
        rsvpStatus: fixture.rsvpStatus,
        ...(rsvpRespondedAt ? { rsvpRespondedAt } : {}),
        ...(fixture.dietaryRestrictions
          ? { dietaryRestrictions: fixture.dietaryRestrictions }
          : {}),
        qrCodeToken: makeQrToken(),
        invitationSentAt: now - 14 * 24 * 60 * 60 * 1000,
        invitationChannel: 'whatsapp',
        createdAt: now,
        updatedAt: now,
      });
      insertedGuests++;
    }

    const firstAttendingGuest = await ctx.db
      .query('guests')
      .withIndex('by_event_rsvp', (q) => q.eq('eventId', eventId).eq('rsvpStatus', 'attending'))
      .first();

    const firstPendingGuest = await ctx.db
      .query('guests')
      .withIndex('by_event_rsvp', (q) => q.eq('eventId', eventId).eq('rsvpStatus', 'pending'))
      .first();

    return {
      ownerId: owner._id,
      ownerPhone: owner.phone,
      eventId,
      eventSlug: LAUNCH_DEMO_SLUG,
      eventTitle: 'Sarah & Marc',
      eventDate,
      guestsInserted: insertedGuests,
      sampleInvitationToken: firstPendingGuest?.qrCodeToken ?? firstAttendingGuest?.qrCodeToken,
      hint: 'Use /i/<sampleInvitationToken> to film the public invitation + RSVP flow.',
    };
  },
});

export const _resetLaunchDemo = internalMutation({
  args: { confirmPhrase: v.string() },
  handler: async (ctx, { confirmPhrase }) => {
    if (confirmPhrase !== 'RESET_LAUNCH_DEMO_CONFIRMED') {
      throw new Error('INVALID_CONFIRMATION');
    }
    const event = await ctx.db
      .query('events')
      .withIndex('by_slug', (q) => q.eq('slug', LAUNCH_DEMO_SLUG))
      .first();
    if (!event) return { deletedGuests: 0, deletedEvent: false };
    const guests = await ctx.db
      .query('guests')
      .withIndex('by_event', (q) => q.eq('eventId', event._id))
      .collect();
    for (const g of guests) await ctx.db.delete(g._id);
    await ctx.db.delete(event._id);
    return { deletedGuests: guests.length, deletedEvent: true };
  },
});

/**
 * Seed des fixtures de gating par formule, pour vérifier en dev browser (via
 * /dev-login + comptes bypass) que les blocages de features fonctionnent
 * totalement selon le tier. Idempotent (upsert par slug). Requiert d'avoir
 * lancé `seedTestUsers` au préalable.
 *
 * Crée :
 *  - 1 event ESSENTIEL (owner Jean +33698765432) → faceSearch BLOQUÉ
 *    (`FEATURE_NOT_IN_PLAN`).
 *  - 1 event PREMIUM (owner Aïcha +221771234567) → faceSearch AUTORISÉ
 *    (passe le gate ; retombe sur `NO_COLLECTION_YET` faute d'indexation, donc
 *    sans dépendance AWS — distinguable de l'erreur Essentiel).
 *  - 1 orga PRO Starter (owner Kwame +225071234567), sub active, AU QUOTA
 *    (5 events actifs = quota Starter) + 1 event draft à publier → publication
 *    BLOQUÉE (`EVENT_QUOTA_EXCEEDED`, bouton pré-désactivé + hint).
 */
export const seedTierFixtures = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const eventDate = now + 60 * 24 * 60 * 60 * 1000; // J+60
    const galleryExpiresAt = eventDate + 180 * 24 * 60 * 60 * 1000;
    const theme = { primaryColor: '#C2613E', accentColor: '#FAF3E8', fontFamily: 'Migra' };

    async function userByPhone(phone: string) {
      return ctx.db
        .query('users')
        .withIndex('by_phone', (q) => q.eq('phone', phone))
        .first();
    }

    const jean = await userByPhone('+33698765432');
    const aicha = await userByPhone('+221771234567');
    const kwame = await userByPhone('+225071234567');
    const camille = await userByPhone('+33600000002');
    if (!jean || !aicha || !kwame || !camille) {
      throw new Error('RUN_seedTestUsers_FIRST');
    }

    // Supprime un event (et ses guests) par slug pour réinsertion propre.
    async function wipeBySlug(slug: string) {
      const ev = await ctx.db
        .query('events')
        .withIndex('by_slug', (q) => q.eq('slug', slug))
        .first();
      if (!ev) return;
      const guests = await ctx.db
        .query('guests')
        .withIndex('by_event', (q) => q.eq('eventId', ev._id))
        .collect();
      for (const g of guests) await ctx.db.delete(g._id);
      await ctx.db.delete(ev._id);
    }

    // 1) ESSENTIEL — faceSearch doit être bloqué.
    await wipeBySlug('gating-essential-demo');
    const essentialEventId = await ctx.db.insert('events', {
      ownerId: jean._id,
      slug: 'gating-essential-demo',
      title: 'Essentiel Demo',
      coupleNames: { partnerA: 'Léa', partnerB: 'Tom' },
      eventDate,
      timezone: 'Europe/Paris',
      theme,
      status: 'active',
      planTier: 'essential',
      paidAt: now - 24 * 60 * 60 * 1000,
      maxGuests: 100,
      galleryExpiresAt,
      createdAt: now,
      updatedAt: now,
    });

    // 2) PREMIUM — faceSearch doit passer le gate.
    await wipeBySlug('gating-premium-demo');
    const premiumEventId = await ctx.db.insert('events', {
      ownerId: aicha._id,
      slug: 'gating-premium-demo',
      title: 'Premium Demo',
      coupleNames: { partnerA: 'Nadia', partnerB: 'Sami' },
      eventDate,
      timezone: 'Europe/Paris',
      theme,
      status: 'active',
      planTier: 'premium',
      paidAt: now - 24 * 60 * 60 * 1000,
      maxGuests: 250,
      galleryExpiresAt,
      createdAt: now,
      updatedAt: now,
    });

    // Quelques invités confirmés sur l'event Premium → de quoi alimenter le
    // plan de table (board seating) en dev / e2e.
    const premiumGuests: Array<{
      fullName: string;
      plusOnesAllowed: number;
      plusOnesNames?: string[];
    }> = [
      { fullName: 'Alice Martin', plusOnesAllowed: 1, plusOnesNames: ['Bob Martin'] },
      { fullName: 'Chloé Bernard', plusOnesAllowed: 0 },
      { fullName: 'David Petit', plusOnesAllowed: 0 },
      { fullName: 'Emma Durand', plusOnesAllowed: 1, plusOnesNames: ['Félix Durand'] },
    ];
    for (const g of premiumGuests) {
      await ctx.db.insert('guests', {
        eventId: premiumEventId,
        fullName: g.fullName,
        plusOnesAllowed: g.plusOnesAllowed,
        ...(g.plusOnesNames ? { plusOnesNames: g.plusOnesNames } : {}),
        rsvpStatus: 'attending' as const,
        rsvpRespondedAt: now,
        qrCodeToken: makeQrToken(),
        createdAt: now,
        updatedAt: now,
      });
    }

    // 3) PRO Starter au quota (5 actifs) + 1 draft → publication bloquée.
    let org = await ctx.db
      .query('organizations')
      .withIndex('by_slug', (q) => q.eq('slug', 'gating-pro-org'))
      .first();
    if (!org) {
      const orgId = await ctx.db.insert('organizations', {
        ownerId: kwame._id,
        name: 'Gating Pro Studio',
        slug: 'gating-pro-org',
        subscriptionTier: 'starter',
        subscriptionStatus: 'active',
        createdAt: now,
        updatedAt: now,
      });
      org = await ctx.db.get(orgId);
    } else {
      await ctx.db.patch(org._id, {
        subscriptionTier: 'starter',
        subscriptionStatus: 'active',
        updatedAt: now,
      });
    }
    if (!org) throw new Error('ORG_INIT_FAILED');

    const membership = await ctx.db
      .query('organizationMemberships')
      .withIndex('by_org_user', (q) => q.eq('organizationId', org._id).eq('userId', kwame._id))
      .first();
    if (!membership) {
      await ctx.db.insert('organizationMemberships', {
        organizationId: org._id,
        userId: kwame._id,
        role: 'owner',
        status: 'active',
        invitedBy: kwame._id,
        invitedAt: now,
        acceptedAt: now,
      });
    }

    for (let i = 1; i <= 5; i++) {
      const slug = `gating-pro-active-${i}`;
      await wipeBySlug(slug);
      await ctx.db.insert('events', {
        ownerId: kwame._id,
        organizationId: org._id,
        slug,
        title: `Pro Active ${i}`,
        coupleNames: { partnerA: `Couple ${i}`, partnerB: 'Invité' },
        eventDate,
        timezone: 'Europe/Paris',
        theme,
        status: 'active',
        maxGuests: 150,
        galleryExpiresAt,
        createdAt: now,
        updatedAt: now,
      });
    }

    await wipeBySlug('gating-pro-draft-demo');
    const proDraftEventId = await ctx.db.insert('events', {
      ownerId: kwame._id,
      organizationId: org._id,
      slug: 'gating-pro-draft-demo',
      title: 'Pro Draft À Publier',
      coupleNames: { partnerA: 'Couple 6', partnerB: 'Invité' },
      eventDate,
      timezone: 'Europe/Paris',
      theme,
      status: 'draft',
      maxGuests: 150,
      createdAt: now,
      updatedAt: now,
    });

    // 4) BUSINESS — agence Studio Lumière, back-office complet (CRM, budget…)
    //    avec quelques clients de démo pour peupler le pipeline (e2e + captures).
    let bizOrg = await ctx.db
      .query('organizations')
      .withIndex('by_slug', (q) => q.eq('slug', 'demo-business-org'))
      .first();
    // Agency (Studio Lumière) : back-office complet, tous les modules débloqués
    // (CRM, budget, prestataires, analytics, intégrations).
    if (!bizOrg) {
      const bizId = await ctx.db.insert('organizations', {
        ownerId: camille._id,
        name: 'Studio Lumière',
        slug: 'demo-business-org',
        subscriptionTier: 'agency',
        subscriptionStatus: 'active',
        createdAt: now,
        updatedAt: now,
      });
      bizOrg = await ctx.db.get(bizId);
    } else {
      await ctx.db.patch(bizOrg._id, {
        subscriptionTier: 'agency',
        subscriptionStatus: 'active',
        updatedAt: now,
      });
    }
    if (!bizOrg) throw new Error('BIZ_ORG_INIT_FAILED');

    const bizMembership = await ctx.db
      .query('organizationMemberships')
      .withIndex('by_org_user', (q) =>
        q.eq('organizationId', bizOrg!._id).eq('userId', camille._id),
      )
      .first();
    if (!bizMembership) {
      await ctx.db.insert('organizationMemberships', {
        organizationId: bizOrg._id,
        userId: camille._id,
        role: 'owner',
        status: 'active',
        invitedBy: camille._id,
        invitedAt: now,
        acceptedAt: now,
      });
    }

    // Données de démo en **create-once** (pas de wipe) → les specs e2e qui
    // tournent en parallèle et appellent toutes seedTierFixtures ne s'écrasent
    // pas mutuellement. Les items ajoutés par les tests persistent (assertions
    // sur des noms uniques côté tests).
    const demoClients: Array<{
      partnerA: string;
      partnerB: string;
      stage: 'lead' | 'contacted' | 'quote' | 'booked' | 'in_progress' | 'delivered';
      phone?: string;
      whatsapp?: string;
      email?: string;
      venue?: string;
      budgetMinor?: number;
      budgetBookedMinor?: number;
      source?: string;
    }> = [
      {
        partnerA: 'Awa',
        partnerB: 'Karim',
        stage: 'booked',
        phone: '+33 6 41 22 18 03',
        whatsapp: '+33 6 41 22 18 03',
        email: 'awa.traore@gmail.com',
        venue: 'Domaine de la Roseraie, Aix-en-Provence',
        budgetMinor: 1_800_000,
        budgetBookedMinor: 1_260_000,
        source: 'Recommandation',
      },
      {
        partnerA: 'Léa',
        partnerB: 'Tom',
        stage: 'in_progress',
        phone: '+33 6 88 54 09 71',
        whatsapp: '+33 6 88 54 09 71',
        email: 'lea.bernard@outlook.fr',
        venue: 'Château de Varennes, Bourgogne',
        budgetMinor: 2_400_000,
        budgetBookedMinor: 1_920_000,
        source: 'Instagram',
      },
      {
        partnerA: 'Sofia',
        partnerB: 'Mehdi',
        stage: 'quote',
        phone: '+33 7 60 31 47 92',
        email: 'sofia.haddad@gmail.com',
        budgetMinor: 3_100_000,
        source: 'Salon',
      },
    ];
    const existingClient = await ctx.db
      .query('clients')
      .withIndex('by_organization', (q) => q.eq('organizationId', bizOrg._id))
      .first();
    if (!existingClient) {
      for (const c of demoClients) {
        const cid = await ctx.db.insert('clients', {
          organizationId: bizOrg._id,
          partnerA: c.partnerA,
          partnerB: c.partnerB,
          stage: c.stage,
          ...(c.phone ? { phone: c.phone } : {}),
          ...(c.whatsapp ? { whatsapp: c.whatsapp } : {}),
          ...(c.email ? { email: c.email } : {}),
          ...(c.venue ? { venue: c.venue } : {}),
          ...(c.budgetMinor != null ? { budgetMinor: c.budgetMinor } : {}),
          ...(c.budgetBookedMinor != null ? { budgetBookedMinor: c.budgetBookedMinor } : {}),
          weddingDate: eventDate,
          ...(c.source ? { source: c.source } : {}),
          assigneeId: camille._id,
          lastContactAt: now,
          createdAt: now,
          updatedAt: now,
        });
        await ctx.db.insert('clientNotes', {
          clientId: cid,
          organizationId: bizOrg._id,
          type: 'note',
          text: `Lead entrant via ${c.source ?? 'le site'}. Dossier suivi par Camille.`,
          createdAt: now,
        });
      }
    }

    // Mariage de démo **stable** (create-once par slug) → l'id ne change pas
    // entre deux seeds, donc le budget rattaché reste valide.
    let bizEvent = await ctx.db
      .query('events')
      .withIndex('by_slug', (q) => q.eq('slug', 'demo-business-wedding'))
      .first();
    if (!bizEvent) {
      const bizEvtId = await ctx.db.insert('events', {
        ownerId: camille._id,
        organizationId: bizOrg._id,
        slug: 'demo-business-wedding',
        title: 'Awa & Karim',
        coupleNames: { partnerA: 'Awa', partnerB: 'Karim' },
        eventDate,
        timezone: 'Europe/Paris',
        status: 'active',
        maxGuests: 150,
        venue: { name: 'Domaine de la Roseraie', address: 'Aix-en-Provence' },
        galleryExpiresAt,
        createdAt: now,
        updatedAt: now,
      });
      bizEvent = await ctx.db.get(bizEvtId);
    }
    const bizEventId = bizEvent!._id;
    // Enveloppe budgétaire de démo (backfill idempotent sur l'event stable).
    if (bizEvent!.budgetEnvelopeMinor == null) {
      await ctx.db.patch(bizEventId, { budgetEnvelopeMinor: 1_800_000, updatedAt: now });
    }
    // Lieu de réception (backfill idempotent — affiché dans les infos du mariage).
    if (bizEvent!.venue == null) {
      await ctx.db.patch(bizEventId, {
        venue: { name: 'Domaine de la Roseraie', address: 'Aix-en-Provence' },
        updatedAt: now,
      });
    }

    // Autres mariages de l'agence (peuplent les sélecteurs + la liste Mariages).
    // Create-once par slug ; rattachés à l'org et à Camille.
    const moreEvents = [
      {
        slug: 'demo-lea-tom',
        partnerA: 'Léa',
        partnerB: 'Tom',
        days: 90,
        venue: { name: 'Château de Varennes', address: 'Bourgogne' },
        maxGuests: 120,
      },
      {
        slug: 'demo-sofia-mehdi',
        partnerA: 'Sofia',
        partnerB: 'Mehdi',
        days: 120,
        venue: { name: 'Villa Ephrussi', address: 'Saint-Jean-Cap-Ferrat' },
        maxGuests: 180,
      },
    ];
    for (const ev of moreEvents) {
      const existing = await ctx.db
        .query('events')
        .withIndex('by_slug', (q) => q.eq('slug', ev.slug))
        .first();
      if (existing) continue;
      await ctx.db.insert('events', {
        ownerId: camille._id,
        organizationId: bizOrg._id,
        slug: ev.slug,
        title: `${ev.partnerA} & ${ev.partnerB}`,
        coupleNames: { partnerA: ev.partnerA, partnerB: ev.partnerB },
        eventDate: now + ev.days * 24 * 60 * 60 * 1000,
        timezone: 'Europe/Paris',
        status: 'active',
        maxGuests: ev.maxGuests,
        venue: ev.venue,
        galleryExpiresAt,
        createdAt: now,
        updatedAt: now,
      });
    }

    // Liste d'invités de démo pour le hub mariage agence (Invités / Messaging /
    // Check-in / Plan de table). Create-once : si l'event a déjà des invités,
    // on ne réinsère rien. Distribution RSVP « saine » (majorité confirmés).
    const existingBizGuest = await ctx.db
      .query('guests')
      .withIndex('by_event', (q) => q.eq('eventId', bizEventId))
      .first();
    if (!existingBizGuest) {
      const bizGuests: Array<{
        fullName: string;
        phone: string;
        category: 'Famille' | 'Amis' | 'Témoins' | 'Collègues';
        plusOnesAllowed: number;
        rsvpStatus: 'attending' | 'pending' | 'declined' | 'maybe';
      }> = [
        {
          fullName: 'Aminata Diallo',
          phone: '+221 77 123 45 67',
          category: 'Famille',
          plusOnesAllowed: 2,
          rsvpStatus: 'attending',
        },
        {
          fullName: 'Amadou Diallo',
          phone: '+221 77 987 65 43',
          category: 'Famille',
          plusOnesAllowed: 1,
          rsvpStatus: 'attending',
        },
        {
          fullName: 'Khadija Ndiaye',
          phone: '+221 76 321 65 98',
          category: 'Famille',
          plusOnesAllowed: 0,
          rsvpStatus: 'attending',
        },
        {
          fullName: 'Ousmane Sarr',
          phone: '+221 76 778 99 00',
          category: 'Famille',
          plusOnesAllowed: 2,
          rsvpStatus: 'pending',
        },
        {
          fullName: 'Mariama Bâ',
          phone: '+221 78 909 12 34',
          category: 'Famille',
          plusOnesAllowed: 1,
          rsvpStatus: 'attending',
        },
        {
          fullName: 'Cheikh Gueye',
          phone: '+221 77 556 67 78',
          category: 'Famille',
          plusOnesAllowed: 0,
          rsvpStatus: 'declined',
        },
        {
          fullName: 'Camille Bernard',
          phone: '+33 6 12 34 56 78',
          category: 'Amis',
          plusOnesAllowed: 1,
          rsvpStatus: 'attending',
        },
        {
          fullName: 'Hugo Lefèvre',
          phone: '+33 6 88 44 22 11',
          category: 'Amis',
          plusOnesAllowed: 1,
          rsvpStatus: 'attending',
        },
        {
          fullName: 'Sophie Marchand',
          phone: '+33 7 65 43 21 09',
          category: 'Amis',
          plusOnesAllowed: 0,
          rsvpStatus: 'pending',
        },
        {
          fullName: 'Léa Petit',
          phone: '+33 6 22 33 44 55',
          category: 'Amis',
          plusOnesAllowed: 0,
          rsvpStatus: 'attending',
        },
        {
          fullName: 'Élise Moreau',
          phone: '+33 7 12 98 76 54',
          category: 'Amis',
          plusOnesAllowed: 1,
          rsvpStatus: 'maybe',
        },
        {
          fullName: 'Nora Benali',
          phone: '+212 6 70 11 22 33',
          category: 'Amis',
          plusOnesAllowed: 1,
          rsvpStatus: 'attending',
        },
        {
          fullName: 'Mehdi Haddad',
          phone: '+212 6 61 23 45 67',
          category: 'Amis',
          plusOnesAllowed: 1,
          rsvpStatus: 'pending',
        },
        {
          fullName: 'Awa Traoré',
          phone: '+221 76 555 33 22',
          category: 'Témoins',
          plusOnesAllowed: 1,
          rsvpStatus: 'attending',
        },
        {
          fullName: 'Yacine Mbaye',
          phone: '+221 77 444 88 12',
          category: 'Témoins',
          plusOnesAllowed: 0,
          rsvpStatus: 'attending',
        },
        {
          fullName: 'Fatou Sow',
          phone: '+221 78 222 11 09',
          category: 'Témoins',
          plusOnesAllowed: 2,
          rsvpStatus: 'attending',
        },
        {
          fullName: 'Ibrahima Fall',
          phone: '+221 77 010 20 30',
          category: 'Témoins',
          plusOnesAllowed: 0,
          rsvpStatus: 'attending',
        },
        {
          fullName: 'Modou Diop',
          phone: '+221 78 345 12 67',
          category: 'Collègues',
          plusOnesAllowed: 0,
          rsvpStatus: 'pending',
        },
        {
          fullName: 'Clara Dubois',
          phone: '+33 6 47 81 20 55',
          category: 'Collègues',
          plusOnesAllowed: 1,
          rsvpStatus: 'attending',
        },
        {
          fullName: 'Thomas Girard',
          phone: '+33 6 95 12 73 40',
          category: 'Collègues',
          plusOnesAllowed: 0,
          rsvpStatus: 'declined',
        },
        {
          fullName: 'Inès Roussel',
          phone: '+33 7 33 64 18 92',
          category: 'Collègues',
          plusOnesAllowed: 0,
          rsvpStatus: 'attending',
        },
        {
          fullName: 'Bineta Faye',
          phone: '+221 77 802 44 19',
          category: 'Famille',
          plusOnesAllowed: 1,
          rsvpStatus: 'pending',
        },
        {
          fullName: 'Lucas Martin',
          phone: '+33 6 70 55 13 28',
          category: 'Amis',
          plusOnesAllowed: 1,
          rsvpStatus: 'attending',
        },
        {
          fullName: 'Aïssatou Ba',
          phone: '+221 76 410 67 33',
          category: 'Témoins',
          plusOnesAllowed: 0,
          rsvpStatus: 'attending',
        },
      ];
      const bizRespondedOffset = [3, 5, 7, 9, 11, 13, 15, 18, 21, 26];
      let bizRespIdx = 0;
      for (const g of bizGuests) {
        const responded =
          g.rsvpStatus === 'attending' || g.rsvpStatus === 'declined' || g.rsvpStatus === 'maybe';
        const rsvpRespondedAt = responded
          ? now -
            (bizRespondedOffset[bizRespIdx++ % bizRespondedOffset.length] ?? 5) * 60 * 60 * 1000
          : undefined;
        await ctx.db.insert('guests', {
          eventId: bizEventId,
          fullName: g.fullName,
          phone: g.phone,
          category: g.category,
          plusOnesAllowed: g.plusOnesAllowed,
          rsvpStatus: g.rsvpStatus,
          ...(rsvpRespondedAt ? { rsvpRespondedAt } : {}),
          qrCodeToken: makeQrToken(),
          invitationSentAt: now - 14 * 24 * 60 * 60 * 1000,
          invitationChannel: 'whatsapp',
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    // Prestataires démo (create-once).
    const demoVendors = [
      {
        name: 'Domaine de Bellevue',
        category: 'Lieu',
        location: 'Provence',
        priceRange: 3,
        rating: 5,
      },
      { name: 'Maison Diop', category: 'Traiteur', location: 'Paris', priceRange: 2, rating: 4 },
      {
        name: 'Studio Lumen',
        category: 'Photo / Vidéo',
        location: 'Lyon',
        priceRange: 2,
        rating: 5,
      },
      {
        name: 'Atelier Camélia',
        category: 'Décoration & Fleurs',
        location: 'Aix-en-Provence',
        priceRange: 2,
        rating: 5,
      },
      {
        name: 'Studio Sono',
        category: 'Musique / DJ',
        location: 'Marseille',
        priceRange: 2,
        rating: 4,
      },
      { name: 'Maison Lila', category: 'Tenues', location: 'Paris', priceRange: 3, rating: 5 },
      { name: 'Atelier Plume', category: 'Papeterie', location: 'Lyon', priceRange: 1, rating: 4 },
    ];
    const existingVendors = await ctx.db
      .query('vendors')
      .withIndex('by_organization', (q) => q.eq('organizationId', bizOrg._id))
      .collect();
    const vendorNames = new Set(existingVendors.map((v) => v.name));
    for (const vn of demoVendors) {
      if (vendorNames.has(vn.name)) continue;
      await ctx.db.insert('vendors', {
        organizationId: bizOrg._id,
        name: vn.name,
        category: vn.category,
        location: vn.location,
        priceRange: vn.priceRange,
        rating: vn.rating,
        createdAt: now,
        updatedAt: now,
      });
    }

    // Engagements « Par mariage » démo (create-once) : rattache les prestataires
    // au mariage agence avec des statuts variés + budget prévu.
    const existingEngagement = await ctx.db
      .query('vendorEngagements')
      .withIndex('by_event', (q) => q.eq('eventId', bizEventId))
      .first();
    if (!existingEngagement) {
      const orgVendors = await ctx.db
        .query('vendors')
        .withIndex('by_organization', (q) => q.eq('organizationId', bizOrg._id))
        .collect();
      const engSeed: Array<{
        name: string;
        status: 'contacted' | 'quoted' | 'booked' | 'confirmed';
        plannedMinor: number;
      }> = [
        { name: 'Domaine de Bellevue', status: 'confirmed', plannedMinor: 800_000 },
        { name: 'Maison Diop', status: 'booked', plannedMinor: 600_000 },
        { name: 'Studio Lumen', status: 'quoted', plannedMinor: 250_000 },
      ];
      for (const e of engSeed) {
        const vd = orgVendors.find((v) => v.name === e.name);
        if (!vd) continue;
        await ctx.db.insert('vendorEngagements', {
          organizationId: bizOrg._id,
          vendorId: vd._id,
          eventId: bizEventId,
          status: e.status,
          plannedMinor: e.plannedMinor,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    // Budget démo — set curé riche (montants/statuts variés, échéances).
    const DAY_MS = 24 * 60 * 60 * 1000;
    const evDate = bizEvent!.eventDate;
    const demoBudget = [
      {
        category: 'Lieu',
        label: 'Domaine de Bellevue',
        vendorName: 'Domaine de Bellevue',
        plannedMinor: 800_000,
        paidMinor: 400_000,
        due: evDate - 90 * DAY_MS,
      },
      {
        category: 'Traiteur',
        label: 'Menu 150 couverts',
        vendorName: 'Maison Diop',
        plannedMinor: 600_000,
        paidMinor: 300_000,
        due: evDate - 30 * DAY_MS,
      },
      {
        category: 'Photo / Vidéo',
        label: 'Reportage jour J',
        vendorName: 'Studio Lumen',
        plannedMinor: 250_000,
        paidMinor: 250_000,
        due: evDate - 120 * DAY_MS,
      },
      {
        category: 'Décoration & Fleurs',
        label: 'Scénographie florale',
        vendorName: 'Atelier Camélia',
        plannedMinor: 180_000,
        paidMinor: 90_000,
        due: evDate - 20 * DAY_MS,
      },
      {
        category: 'Musique / DJ',
        label: 'DJ + sonorisation',
        vendorName: 'Studio Sono',
        plannedMinor: 150_000,
        paidMinor: 0,
        due: evDate - 15 * DAY_MS,
      },
      {
        category: 'Tenues',
        label: 'Robe & costume',
        vendorName: 'Maison Lila',
        plannedMinor: 320_000,
        paidMinor: 160_000,
        due: evDate - 45 * DAY_MS,
      },
      {
        category: 'Papeterie',
        label: 'Faire-part & menus',
        vendorName: 'Atelier Plume',
        plannedMinor: 45_000,
        paidMinor: 45_000,
        due: evDate - 150 * DAY_MS,
      },
    ];
    const existingLines = await ctx.db
      .query('budgetLines')
      .withIndex('by_event', (q) => q.eq('eventId', bizEventId))
      .collect();
    // Nettoie les lignes vides (artefacts de test : « Fleurs … » à 0 €).
    for (const l of existingLines) {
      if (l.plannedMinor === 0 && l.paidMinor === 0) await ctx.db.delete(l._id);
    }
    // Upsert par libellé : ajoute les lignes curées manquantes (idempotent).
    const keptLabels = new Set(
      existingLines.filter((l) => !(l.plannedMinor === 0 && l.paidMinor === 0)).map((l) => l.label),
    );
    for (const b of demoBudget) {
      if (keptLabels.has(b.label)) continue;
      const lineId = await ctx.db.insert('budgetLines', {
        eventId: bizEventId,
        organizationId: bizOrg._id,
        category: b.category,
        label: b.label,
        vendorName: b.vendorName,
        plannedMinor: b.plannedMinor,
        paidMinor: b.paidMinor,
        dueDate: b.due,
        createdAt: now,
        updatedAt: now,
      });
      // Le montant déjà réglé devient un paiement du registre (cohérence avec le
      // suivi par paiements : `paidMinor` = somme des paiements `succeeded`).
      if (b.paidMinor > 0) {
        await ctx.db.insert('budgetPayments', {
          budgetLineId: lineId,
          eventId: bizEventId,
          organizationId: bizOrg._id,
          amountMinor: b.paidMinor,
          method: 'transfer',
          status: 'succeeded',
          paidAt: b.due,
          note: 'Acompte',
          createdBy: camille._id,
          createdAt: now,
          updatedAt: now,
        });
      }
    }
    // Backfill : lignes déjà présentes (seeds antérieurs au registre) sans aucun
    // paiement → crée un acompte égal à leur `paidMinor` pour peupler l'historique.
    for (const l of existingLines) {
      if (l.paidMinor <= 0) continue;
      const hasPayment = await ctx.db
        .query('budgetPayments')
        .withIndex('by_line', (q) => q.eq('budgetLineId', l._id))
        .first();
      if (hasPayment) continue;
      await ctx.db.insert('budgetPayments', {
        budgetLineId: l._id,
        eventId: bizEventId,
        organizationId: bizOrg._id,
        amountMinor: l.paidMinor,
        method: 'transfer',
        status: 'succeeded',
        paidAt: l.dueDate ?? now,
        note: 'Acompte',
        createdBy: camille._id,
        createdAt: now,
        updatedAt: now,
      });
    }
    // Devis & Factures démo — upsert-by-number avec reset à chaque seed → état
    // déterministe (FAC-031 garde toujours son solde non réglé pour les e2e).
    {
      const orgClients = await ctx.db
        .query('clients')
        .withIndex('by_organization', (q) => q.eq('organizationId', bizOrg._id))
        .collect();
      const byA = (a: string) => orgClients.find((c) => c.partnerA === a);
      const cn = (c: { partnerA: string; partnerB?: string } | undefined) =>
        c ? (c.partnerB ? `${c.partnerA} & ${c.partnerB}` : c.partnerA) : 'Client';
      const awa = byA('Awa');
      const lea = byA('Léa');
      const sofia = byA('Sofia');
      const year = new Date(now).getFullYear();
      const due = now + 30 * 24 * 3600 * 1000;
      const coord = [
        { label: 'Coordination jour J (12 h)', qty: 1, unitPriceMinor: 140_000 },
        { label: 'Supervision équipe & prestataires', qty: 1, unitPriceMinor: 80_000 },
        { label: 'Repérage & plan de salle', qty: 1, unitPriceMinor: 30_000 },
      ];
      type SeedDoc = {
        type: 'quote' | 'invoice';
        number: string;
        client?: { _id: Id<'clients'>; partnerA: string; partnerB?: string };
        eventId?: Id<'events'>;
        status:
          | 'draft'
          | 'sent'
          | 'accepted'
          | 'refused'
          | 'expired'
          | 'partial'
          | 'paid'
          | 'overdue';
        lineItems: Array<{ label: string; qty: number; unitPriceMinor: number }>;
        discountMinor?: number;
        schedule?: Array<{ label: string; amountMinor: number; paid: boolean }>;
        notes?: string;
      };
      const seedDocs: SeedDoc[] = [
        {
          type: 'quote',
          number: `DEV-${year}-014`,
          client: awa,
          eventId: bizEventId,
          status: 'sent',
          lineItems: coord,
          notes: 'Devis valable 30 jours. Acompte de 30 % à la signature.',
        },
        {
          type: 'invoice',
          number: `FAC-${year}-031`,
          client: awa,
          eventId: bizEventId,
          status: 'partial',
          lineItems: coord,
          schedule: [
            { label: 'Acompte 30 %', amountMinor: 75_000, paid: true },
            { label: 'Solde', amountMinor: 175_000, paid: false },
          ],
        },
        {
          type: 'quote',
          number: `DEV-${year}-018`,
          client: lea,
          status: 'accepted',
          lineItems: [{ label: 'Forfait coordination complète', qty: 1, unitPriceMinor: 320_000 }],
          discountMinor: 20_000,
        },
        {
          type: 'invoice',
          number: `FAC-${year}-027`,
          client: sofia,
          status: 'paid',
          lineItems: [{ label: 'Forfait Premium coordination', qty: 1, unitPriceMinor: 420_000 }],
          schedule: [
            { label: 'Acompte 50 %', amountMinor: 210_000, paid: true },
            { label: 'Solde', amountMinor: 210_000, paid: true },
          ],
        },
        {
          type: 'invoice',
          number: `FAC-${year}-022`,
          client: lea,
          status: 'overdue',
          lineItems: [{ label: 'Acompte forfait coordination', qty: 1, unitPriceMinor: 150_000 }],
          schedule: [{ label: 'Acompte', amountMinor: 150_000, paid: false }],
        },
      ];
      const existingDocs = await ctx.db
        .query('quoteDocs')
        .withIndex('by_organization', (q) => q.eq('organizationId', bizOrg._id))
        .collect();
      for (const d of seedDocs) {
        const fields = {
          organizationId: bizOrg._id,
          type: d.type,
          number: d.number,
          ...(d.client ? { clientId: d.client._id } : {}),
          clientName: cn(d.client),
          ...(d.eventId ? { eventId: d.eventId } : {}),
          status: d.status,
          lineItems: d.lineItems,
          ...(d.discountMinor != null ? { discountMinor: d.discountMinor } : {}),
          ...(d.schedule ? { schedule: d.schedule } : {}),
          dueDate: due,
          ...(d.notes ? { notes: d.notes } : {}),
          updatedAt: now,
        };
        const prior = existingDocs.find((x) => x.number === d.number);
        if (prior) {
          // reset l'état canonique (schedule/statut) sans dupliquer l'activité
          await ctx.db.patch(prior._id, fields);
          continue;
        }
        const docId = await ctx.db.insert('quoteDocs', {
          ...fields,
          issueDate: now,
          createdAt: now,
        });
        await ctx.db.insert('quoteActivity', {
          docId,
          organizationId: bizOrg._id,
          label: d.type === 'quote' ? 'Devis créé' : 'Facture créée',
          icon: 'FilePlus',
          createdAt: now,
        });
      }
    }
    // Contrat de démo — Awa & Karim, envoyé pour signature. On RÉINITIALISE à
    // chaque seed (comme le rétroplanning ci-dessous) : sinon le contrat de démo
    // s'accumule au fil des re-seeds sur le déploiement dev partagé et les vues
    // (et les tests) voient plusieurs CON-2026-007.
    {
      const oldContracts = await ctx.db
        .query('contracts')
        .withIndex('by_organization', (q) => q.eq('organizationId', bizOrg._id))
        .collect();
      for (const c of oldContracts) {
        const audits = await ctx.db
          .query('contractAudit')
          .withIndex('by_contract', (q) => q.eq('contractId', c._id))
          .collect();
        for (const a of audits) await ctx.db.delete(a._id);
        await ctx.db.delete(c._id);
      }
      const orgClients = await ctx.db
        .query('clients')
        .withIndex('by_organization', (q) => q.eq('organizationId', bizOrg._id))
        .collect();
      const awa = orgClients.find((c) => c.partnerA === 'Awa');
      const ctSections = [
        {
          title: 'Parties',
          body: 'Entre l’agence Studio Lumière, représentée par Camille, ci-après « le Prestataire », et {{couple}}, ci-après « les Clients ».',
        },
        {
          title: 'Prix & échéancier',
          body: 'Le montant total s’élève à {{total}}. Un acompte de 30 % ({{acompte}}) est dû à la signature ; le solde ({{solde}}) au plus tard à J−30.',
        },
        {
          title: 'Annulation & report',
          body: 'En cas d’annulation par les Clients, l’acompte reste acquis. Le report de date est gratuit dans la limite des disponibilités.',
        },
      ];
      const ctId = await ctx.db.insert('contracts', {
        organizationId: bizOrg._id,
        number: `CON-${new Date(now).getFullYear()}-007`,
        ...(awa ? { clientId: awa._id } : {}),
        clientName: awa
          ? awa.partnerB
            ? `${awa.partnerA} & ${awa.partnerB}`
            : awa.partnerA
          : 'Awa & Karim',
        eventId: bizEventId,
        status: 'sent',
        sections: ctSections,
        totalMinor: 250_000,
        sentAt: now,
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert('contractAudit', {
        contractId: ctId,
        organizationId: bizOrg._id,
        event: 'Contrat créé',
        by: 'Camille',
        createdAt: now,
      });
      await ctx.db.insert('contractAudit', {
        contractId: ctId,
        organizationId: bizOrg._id,
        event: 'Envoyé pour signature',
        by: 'Camille',
        createdAt: now,
      });
    }
    // Rétroplanning de démo (varié : statuts tri-état + échéances) sur l'event
    // agence, pour peupler les vues Par phase / Tableau / Frise comme le design.
    // On RÉINITIALISE systématiquement au set curé (16 tâches) : sinon les tâches
    // créées par les tests/l'usage s'accumulent sans limite et la page devient
    // injouable (des centaines de doublons). Le seed = source de vérité de la démo.
    {
      const oldTasks = await ctx.db
        .query('planningTasks')
        .withIndex('by_event', (q) => q.eq('eventId', bizEventId))
        .collect();
      for (const t of oldTasks) await ctx.db.delete(t._id);
      const DAY = 24 * 60 * 60 * 1000;
      const planSeed: Array<{
        phase: 'm12' | 'm6' | 'm3' | 'm1' | 'd7' | 'dday' | 'after';
        title: string;
        status: 'todo' | 'doing' | 'done';
        due: number | null; // jours depuis maintenant (null = sans échéance)
      }> = [
        { phase: 'm12', title: 'Définir le budget global', status: 'done', due: -40 },
        { phase: 'm12', title: 'Choisir et réserver le lieu', status: 'done', due: -35 },
        { phase: 'm12', title: 'Établir la liste des invités', status: 'done', due: -28 },
        { phase: 'm6', title: 'Réserver le traiteur', status: 'done', due: -10 },
        { phase: 'm6', title: 'Réserver le photographe / vidéaste', status: 'doing', due: 6 },
        { phase: 'm6', title: 'Choisir les tenues des mariés', status: 'todo', due: 12 },
        { phase: 'm3', title: 'Envoyer les faire-part', status: 'doing', due: -2 },
        { phase: 'm3', title: 'Réserver le DJ / groupe', status: 'todo', due: 18 },
        { phase: 'm3', title: 'Commander les fleurs et la décoration', status: 'todo', due: 22 },
        { phase: 'm1', title: 'Finaliser le plan de table', status: 'todo', due: 33 },
        { phase: 'm1', title: 'Confirmer le menu final avec le traiteur', status: 'todo', due: 36 },
        { phase: 'm1', title: 'Relancer les invités sans réponse', status: 'todo', due: 40 },
        { phase: 'd7', title: 'Briefer les prestataires sur le déroulé', status: 'todo', due: 53 },
        { phase: 'd7', title: 'Préparer la trousse de secours jour J', status: 'todo', due: 54 },
        { phase: 'dday', title: 'Coordonner l’arrivée des prestataires', status: 'todo', due: 60 },
        {
          phase: 'after',
          title: 'Envoyer les remerciements et la galerie photos',
          status: 'todo',
          due: 74,
        },
      ];
      let pOrder = now;
      for (const t of planSeed) {
        await ctx.db.insert('planningTasks', {
          eventId: bizEventId,
          organizationId: bizOrg._id,
          phase: t.phase,
          title: t.title,
          done: t.status === 'done',
          status: t.status,
          ...(t.due != null ? { dueDate: now + t.due * DAY } : {}),
          assigneeId: camille._id,
          order: pOrder++,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    return {
      essential: {
        ownerPhone: jean.phone,
        eventId: essentialEventId,
        slug: 'gating-essential-demo',
        expect: 'faceSearch → FEATURE_NOT_IN_PLAN (bloqué)',
      },
      business: {
        ownerPhone: camille.phone,
        organizationId: bizOrg._id,
        slug: 'demo-business-org',
        eventId: bizEventId,
        clientCount: demoClients.length,
        budgetLineCount: demoBudget.length,
        expect: 'CRM + budget accessibles (Business)',
      },
      premium: {
        ownerPhone: aicha.phone,
        eventId: premiumEventId,
        slug: 'gating-premium-demo',
        expect: 'faceSearch → NO_COLLECTION_YET (gate passé)',
      },
      pro: {
        ownerPhone: kwame.phone,
        organizationId: org._id,
        activeEvents: 5,
        quota: 5,
        draftEventId: proDraftEventId,
        draftSlug: 'gating-pro-draft-demo',
        expect: 'publish draft → EVENT_QUOTA_EXCEEDED (bouton désactivé)',
      },
    };
  },
});

/** Dev only : vide les clients + notes d'une organisation (pour re-seed propre). */
export const _wipeOrgClients = internalMutation({
  args: { organizationId: v.id('organizations') },
  handler: async (ctx, { organizationId }) => {
    const clients = await ctx.db
      .query('clients')
      .withIndex('by_organization', (q) => q.eq('organizationId', organizationId))
      .collect();
    let deleted = 0;
    for (const c of clients) {
      const notes = await ctx.db
        .query('clientNotes')
        .withIndex('by_client', (q) => q.eq('clientId', c._id))
        .collect();
      for (const n of notes) await ctx.db.delete(n._id);
      await ctx.db.delete(c._id);
      deleted += 1;
    }
    return { deleted };
  },
});

export const _resetTestData = internalMutation({
  args: { confirmPhrase: v.string() },
  handler: async (ctx, { confirmPhrase }) => {
    if (confirmPhrase !== 'RESET_TEST_DATA_CONFIRMED') {
      throw new Error('INVALID_CONFIRMATION');
    }
    const testPhones = TEST_USERS.map((u) => u.phone);
    const toDelete = await ctx.db.query('users').collect();
    let deleted = 0;
    for (const user of toDelete) {
      if (user.phone && testPhones.includes(user.phone)) {
        await ctx.db.delete(user._id);
        deleted++;
      }
    }
    return { deleted };
  },
});

/**
 * Seed (idempotent) pour les tests e2e de l'upsell HD post-event + livre photo.
 * Crée deux events possédés par Fatima (+212661234567), un user couple sans
 * autre event seedé :
 *   - `upsell-purchased-demo` : Essentiel AVEC upsell HD acheté
 *     (`hdUpsellPurchasedAt`, galerie +5 ans) + une commande de livre photo
 *     `requested` → la carte upsell s'affiche en état « acheté » (download HD +
 *     statut livre photo) et l'admin /admin/photo-books a de la donnée.
 *   - `upsell-buy-demo` : Premium SANS upsell → la carte propose l'achat (+29 €).
 * Isolé des fixtures de gating (n'altère pas `feature-gating.spec.ts`).
 */
export const seedUpsellDemo = mutation({
  // `suffix` rend les slugs uniques par worker Playwright (ex. `-chromium`) :
  // les projets/workers tournent en parallèle et re-seedent chacun ; sans
  // suffixe ils wiperaient les mêmes slugs et supprimeraient les events
  // utilisés par un autre worker (→ 404 intermittents).
  args: { suffix: v.optional(v.string()) },
  handler: async (ctx, { suffix }) => {
    const sfx = (suffix ?? '').replace(/[^a-z0-9-]/gi, '').slice(0, 40);
    const now = Date.now();
    const eventDate = now + 30 * 24 * 60 * 60 * 1000; // J+30
    const theme = { primaryColor: '#C2613E', accentColor: '#FAF3E8', fontFamily: 'Migra' };
    const purchasedSlug = `upsell-purchased-demo${sfx}`;
    const buySlug = `upsell-buy-demo${sfx}`;

    const fatima = await ctx.db
      .query('users')
      .withIndex('by_phone', (q) => q.eq('phone', '+212661234567'))
      .first();
    if (!fatima) throw new Error('RUN_seedTestUsers_FIRST');

    async function wipeEventBySlug(slug: string) {
      const ev = await ctx.db
        .query('events')
        .withIndex('by_slug', (q) => q.eq('slug', slug))
        .first();
      if (!ev) return;
      const orders = await ctx.db
        .query('photoBookOrders')
        .withIndex('by_event', (q) => q.eq('eventId', ev._id))
        .collect();
      for (const o of orders) await ctx.db.delete(o._id);
      await ctx.db.delete(ev._id);
    }

    await wipeEventBySlug(purchasedSlug);
    await wipeEventBySlug(buySlug);

    const purchasedEventId = await ctx.db.insert('events', {
      ownerId: fatima._id,
      slug: purchasedSlug,
      title: 'Archive HD Demo',
      coupleNames: { partnerA: 'Inès', partnerB: 'Yanis' },
      eventDate,
      timezone: 'Europe/Paris',
      theme,
      status: 'active',
      planTier: 'essential',
      paidAt: now - 24 * 60 * 60 * 1000,
      maxGuests: 100,
      galleryExpiresAt: eventDate + 5 * 365 * 24 * 60 * 60 * 1000,
      hdUpsellPurchasedAt: now - 60 * 60 * 1000,
      createdAt: now,
      updatedAt: now,
    });

    // Pas de commande de livre photo seedée : la spec e2e la crée via l'UI
    // (formulaire du Dialog) pour tester le flux complet jusqu'à l'admin. Le
    // wipe ci-dessus garantit l'idempotence entre deux exécutions.

    const buyEventId = await ctx.db.insert('events', {
      ownerId: fatima._id,
      slug: buySlug,
      title: 'Premium sans upsell',
      coupleNames: { partnerA: 'Sofia', partnerB: 'Liam' },
      eventDate,
      timezone: 'Europe/Paris',
      theme,
      status: 'active',
      planTier: 'premium',
      paidAt: now - 24 * 60 * 60 * 1000,
      maxGuests: 250,
      galleryExpiresAt: eventDate + 180 * 24 * 60 * 60 * 1000,
      createdAt: now,
      updatedAt: now,
    });

    return {
      ownerPhone: fatima.phone,
      purchasedEventId,
      buyEventId,
    };
  },
});
