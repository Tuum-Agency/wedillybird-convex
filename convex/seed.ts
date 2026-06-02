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

    const eventDate = new Date('2026-07-18T16:00:00.000Z').getTime();
    const galleryExpiresAt = eventDate + 180 * 24 * 60 * 60 * 1000;

    const existing = await ctx.db
      .query('events')
      .withIndex('by_slug', (q) => q.eq('slug', LAUNCH_DEMO_SLUG))
      .first();

    const eventPayload = {
      ownerId: owner._id,
      slug: LAUNCH_DEMO_SLUG,
      title: 'Sarah & Marc',
      coupleNames: { partnerA: 'Sarah', partnerB: 'Marc' },
      eventDate,
      timezone: 'Europe/Paris',
      venue: {
        name: 'Domaine du Vieux Moulin',
        address: 'Route des Lavandes, 84210 Pernes-les-Fontaines, France',
        lat: 43.9978,
        lng: 5.0588,
      },
      theme: {
        primaryColor: '#C2613E',
        accentColor: '#FAF3E8',
        fontFamily: 'Migra',
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
    if (!jean || !aicha || !kwame) {
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

    return {
      essential: {
        ownerPhone: jean.phone,
        eventId: essentialEventId,
        slug: 'gating-essential-demo',
        expect: 'faceSearch → FEATURE_NOT_IN_PLAN (bloqué)',
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
